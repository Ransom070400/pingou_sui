# Pingou — Sui Migration Testing Runbook

How to verify the zkLogin + Walrus + Seal migration. Two layers:

1. **Headless smoke tests** (Node, no device) — prove the on-chain + crypto core. Already green.
2. **On-device test** (dev client) — the only way to exercise Google OAuth + sponsored gas.

Everything is gated by `EXPO_PUBLIC_SUI_ENABLED`. With it `false`, the app is 100% the
old Supabase build. Nothing below affects production until you flip it.

Deployed testnet package: `0xe9e00a0f790fd1ec16fa122cb85978e5667db20178e866e3c1b930c0e0d8960d`
(module `profile`). Move source: `move/pingou/`.

---

## 0. Prerequisites

- Node 22, `sui` CLI (`sui client active-env` → `testnet`, address funded — `sui client gas`).
- `.env.local` filled: `EXPO_PUBLIC_PINGOU_PACKAGE_ID`, `EXPO_PUBLIC_ENOKI_PUBLIC_KEY`,
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, Walrus endpoints. (`EXPO_PUBLIC_SUI_ENABLED` stays `false`
  until step 3.)
- Enoki **private** key for the backend (NOT in `.env.local` / not `EXPO_PUBLIC_*`).
- A Google account added as a **test user** on the OAuth consent screen.

---

## 1. Move package (on-chain logic)

```bash
cd move/pingou && sui move test
```
Expect 3/3 pass (owner/grantee access, blob repoint + revoke, wrong-cap rejected).

Re-deploy only if you changed the Move source (local CLI 1.58 vs network 1.73 needs the flag):
```bash
sui client publish --skip-dependency-verification --json
# copy the published packageId into .env.local + server/.env, then re-run the smoke tests
```

---

## 2. Headless smoke tests (Walrus + Seal + exchange)

These hit **live testnet** Walrus + Seal key servers and the deployed `seal_approve`. They
need the deployer key, exported transiently. The reader in the exchange test needs no gas.

```bash
# export the active key to an env var (don't commit / don't print it)
KEY=$(sui keytool export --key-identity "$(sui client active-address)" --json \
  | sed -n 's/.*"exportedPrivateKey": *"\([^"]*\)".*/\1/p')

PKG=0xe9e00a0f790fd1ec16fa122cb85978e5667db20178e866e3c1b930c0e0d8960d

# (a) storage round-trip: Walrus + Seal encrypt -> store -> read -> decrypt (owner)
#     PINGOU_PROFILE_ID = any Profile object you own (create one if needed, see below)
EXPO_PUBLIC_PINGOU_PACKAGE_ID=$PKG EXPO_PUBLIC_SUI_NETWORK=testnet \
  PINGOU_PROFILE_ID=<your profile object id> SUI_PRIVKEY=$KEY \
  npx tsx scripts/sui-smoke.ts

# (b) exchange access control: B denied before grant, decrypts after A grants
EXPO_PUBLIC_PINGOU_PACKAGE_ID=$PKG EXPO_PUBLIC_SUI_NETWORK=testnet \
  SUI_PRIVKEY=$KEY \
  npx tsx scripts/sui-exchange-smoke.ts

unset KEY
```

Need a Profile object id for (a)? Make one:
```bash
sui client call --package $PKG --module profile --function create_and_keep \
  --args "blob-test" --json | grep -A2 '"objectType".*::profile::Profile'
```

Expected: both scripts end with `✅`. The exchange test takes a minute or two (the
denied read retries the key servers before failing — that delay is normal).

---

## 3. Backend (Enoki sponsorship)

```bash
cd server
cp .env.example .env            # then paste your enoki_private_... into ENOKI_PRIVATE_KEY
npm install
npm run dev                     # -> "pingou-sponsor listening on :8787 (testnet)"
curl -s localhost:8787/health   # -> {"ok":true,"network":"testnet"}
```
Keep this running for any on-device test that writes on-chain (profile create/edit, scan).
`EXPO_PUBLIC_SPONSOR_API_URL` in `.env.local` must point at it. On a physical phone,
`localhost` won't reach your Mac — use your machine's LAN IP (e.g. `http://192.168.x.x:8787`).

---

## 4. On-device test (the full flow)

zkLogin's Google OAuth needs a **dev client** (not Expo Go), and the iOS URL scheme is
native config, so a rebuild is required after the `app.json` change.

```bash
# 1. turn on Sui mode
#    .env.local:  EXPO_PUBLIC_SUI_ENABLED=true
# 2. make sure the sponsor backend (step 3) is running
# 3. native rebuild + run
npx expo run:ios          # or: eas build --profile development, then install
```

Walk the flow:

| Step | Action | Expect |
|---|---|---|
| Auth | Get Started → **Continue with Google** | Google sheet → returns signed in (Sui address) |
| Setup | "Create profile" → tap photo → pick avatar → fill fields → Save | 2 sponsored txs (~seconds) → profile renders **decrypted**, avatar shown |
| Restart | Kill + reopen the app | Stays signed in, profile loads (session restored from SecureStore) |
| Exchange | One person scans the other's QR (one scan is enough) | One sponsored tx → both cards exchanged; the scanner sees the card immediately, and both appear under Connections |
| Logout | Logout → reopen | Back to the Google sign-in screen |

---

## 5. Troubleshooting (failure → cause → fix)

| Symptom | Likely cause | Fix |
|---|---|---|
| Google returns `redirect_uri_mismatch` | iOS client reverse-scheme not registered, or wrong client type | Use an **iOS** OAuth client; confirm `app.json` ios `CFBundleURLSchemes` has `com.googleusercontent.apps.<id>`; rebuild |
| Enoki `invalid client id` on proof | App's Google client id ≠ the one registered in Enoki (JWT `aud` mismatch) | Same client id in `.env.local` **and** Enoki portal → Auth Providers |
| OAuth opens but never returns to app | Redirect scheme not caught / using Expo Go | Dev client only; verify the redirect = `com.googleusercontent.apps.<id>:/oauthredirect` |
| `crypto.getRandomValues not supported` | polyfill not loaded first | Ensure `import 'react-native-get-random-values'` is line 1 of `src/app/_layout.tsx` |
| Seal decrypt throws about `crypto.subtle` | DEM defaulted to AES-GCM (no WebCrypto on Hermes) | We pass `DemType.Hmac256Ctr` in `seal.ts` — confirm it's still there |
| Sponsor call 500 / "allowed targets" | tx target not in the backend allowlist, or wrong package id | `server/.env` `PINGOU_PACKAGE_ID` must match the app; targets are `profile::{create_and_keep,set_blob,add,remove}` |
| Sponsor unreachable on phone | `localhost` from device | Set `EXPO_PUBLIC_SPONSOR_API_URL` to your Mac's LAN IP |
| "Profile created but not yet indexed" | RPC lag right after create | It retries; tap again / wait. Increase retries in `profileService.findOwnedWithRetry` if persistent |
| Exchange fails / "EBadShareCode" | Scanning an old QR, or share-code mismatch after a contract redeploy | Both parties recreate their profile on the current package so their QR carries a valid share-code |
| `SuiClient is not a constructor` (scripts) | v2 renamed the client | Use `SuiJsonRpcClient` from `@mysten/sui/jsonRpc` (already done in `suiClient.ts`) |
| `Cannot read property 'prototype' of undefined` at `@mysten/sui/jsonRpc` import | @mysten/sui v2 circular ESM dep + Metro eager imports | `metro.config.js` sets `inlineRequires: true` (done). Restart with `expo start --clear` |
| `supabaseUrl is required` / many "missing default export" | `createClient('','')` throws at import (blank Supabase env) | Fixed in `supabase.ts` (placeholder fallback); pull latest |
| App warns `expo-notifications removed from Expo Go` / OAuth never returns | Running in **Expo Go** | Use the **dev client** (`expo run:ios`), not Expo Go — required for zkLogin |
| Google: "Access blocked: unsupported response type" | Google killed the implicit flow | Fixed: `oauth.ts` uses PKCE auth-code flow now. Rebuild (`expo run:ios`) — `expo-crypto` is a new native module |
| Google: "Access blocked: …not completed verification / is being tested" | Consent screen in Testing + you're not allow-listed | Google Console → OAuth consent screen → **Test users** → add your email |
| Walrus store 413 / fails | public testnet publisher 10 MiB cap / flaky | Keep avatars small; for production run your own publisher or an upload relay |

---

## 6. What is NOT covered yet

- **Existing Supabase users**: no migration path wired — decide email-link vs clean break
  before flipping the flag in production.
- **Folders / events** screens are still Supabase-only (outside the 3-feature scope).
- **Mainnet**: testnet only. Mainnet needs permissioned Seal key servers, a mainnet Enoki
  app, real WAL for Walrus, and a gas budget for sponsorship. See `SUI_MIGRATION.md` §8/§11.
