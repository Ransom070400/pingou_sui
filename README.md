# Pingou 🐧

**Your contact card, encrypted and on-chain. Tap a QR once — you both walk away with each other's card.**

Pingou is a mobile contact-sharing app built on the **Sui** stack. There are no wallets, seed phrases, or passwords: you sign in with Google or Apple (zkLogin), your card is **encrypted** (Seal) and stored on **Walrus**, and a single QR scan exchanges cards both ways. Gas is **sponsored**, so users never need SUI.

> The app lives in the [`Pingou/`](./Pingou) subdirectory. All commands below assume `cd Pingou` first.

---

## ✨ Features

- **Passwordless sign-in** — Google / Apple via Sui **zkLogin** (Enoki). No wallet to manage.
- **Encrypted profile** — your card is sealed with **Seal** threshold encryption and stored on **Walrus**; only people you connect with can decrypt it.
- **One-scan exchange** — scanning a QR grants both directions at once (no "share back"), via an on-chain allowlist + a secret share-code.
- **Sponsored gas** — a backend gas station (Enoki) pays for every transaction; users hold no SUI.
- **Instant feedback** — a realtime relay pops a "Connected ✓" + chime on both devices the moment a scan lands.
- **Private by design** — cards are encrypted at rest; access is enforced on-chain by the Move `seal_approve` policy.
- **Real account deletion** — revokes all access and clears your on-chain card pointer.

---

## 🏗️ Architecture

```
┌─────────────┐    zkLogin (Enoki)        ┌──────────────────────────┐
│   Mobile    │ ───────────────────────▶  │  Enoki  (OAuth → zk addr,│
│  (Expo RN)  │                           │   gas-station sponsor)   │
│             │    encrypt (Seal)         └──────────────────────────┘
│  - profile  │ ──┐                                   ▲ holds private key
│  - scanner  │   │  ciphertext                       │
│  - QR       │   ▼                          ┌────────┴─────────┐
│             │  Walrus (HTTP) ◀────────────│  Sponsor backend  │  /sponsor /execute
└──────┬──────┘   blob store                │  (Node, server/)  │  + realtime relay
       │                                     └────────┬─────────┘
       │  build tx → sponsor → sign → execute         │
       ▼                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sui (testnet)  —  Move package `pingou::profile`                  │
│  Profile { blob_id, share_hash, allow: Table<address,bool> }      │
│  create / set_blob / add / add_self / remove / seal_approve       │
└──────────────────────────────────────────────────────────────────┘
```

**How a connection works (one scan):** your QR encodes `address + profileId + share-code`. When someone scans it, a single sponsored transaction runs `add_self` (they prove the share-code → they're added to *your* allowlist) **and** `add` (you add them to *theirs*). Both sides can now decrypt each other's card; Seal's key servers authorize decryption by dry-running the on-chain `seal_approve` policy.

---

## 🧰 Tech stack

| Layer | Tech |
|---|---|
| App | Expo SDK 54 · React Native 0.81 · expo-router · NativeWind · TypeScript |
| Identity | Sui **zkLogin** via **Enoki** (HTTP API) — Google (PKCE) + Apple |
| Storage | **Walrus** (HTTP publisher/aggregator) |
| Encryption | **Seal** threshold encryption (`Hmac256Ctr`, 2-of-2 testnet key servers) |
| Chain | **Sui** (testnet) + Move package `pingou::profile` |
| Gas | **Enoki** sponsored transactions (gas station) |
| Backend | Node `http` server (`server/index.mjs`) — sponsor/execute, realtime WS relay |
| Build/Deploy | EAS Build · Render (backend) |

---

## 📁 Project structure

```
Pingou/
├─ src/
│  ├─ app/                 # expo-router screens (auth, tabs, editProfile, connectionDetail…)
│  ├─ components/          # UI (profile/, edit-profile/, ConnectionSuccess, WelcomeCards…)
│  ├─ context/             # SuiAuthProvider (zkLogin session + profile)
│  └─ lib/sui/             # the Sui stack:
│     ├─ zkLogin.ts        #   zkLogin signer (Enoki HTTP)
│     ├─ oauth.ts          #   Google PKCE + Apple web flow
│     ├─ seal.ts           #   Seal encrypt/decrypt + session keys
│     ├─ walrus.ts         #   Walrus blob store/read (HTTP)
│     ├─ profile.ts        #   Move tx builders + reads
│     ├─ profileService.ts #   create / load / exchange / delete orchestration
│     ├─ sponsor.ts        #   sponsor → sign → execute handoff
│     ├─ realtime.ts       #   WebSocket relay client
│     └─ config.ts         #   env-driven config
├─ move/pingou/            # Move smart contract (sources/profile.move)
├─ server/                 # Enoki sponsorship backend + realtime relay
├─ app.json · eas.json     # Expo / EAS Build config
└─ *.md                    # SUI_MIGRATION, SUI_TESTING, APPLE_SETUP, TESTFLIGHT
```

---

## 🚀 Getting started

### Prerequisites
- Node 18+ and npm
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) (to deploy the Move package)
- An [Enoki](https://portal.enoki.mystenlabs.com/) account (zkLogin + gas station) with a Google OAuth client registered
- For native builds: an [Expo](https://expo.dev) account + [EAS CLI](https://docs.expo.dev/eas/) (no local Android/Xcode toolchain needed — EAS builds in the cloud)

### 1. Install
```bash
cd Pingou
npm install
```

### 2. Configure the app — `Pingou/.env.local`
```bash
EXPO_PUBLIC_SUI_ENABLED=true
EXPO_PUBLIC_SUI_NETWORK=testnet
EXPO_PUBLIC_PINGOU_PACKAGE_ID=0x...        # your deployed Move package id
EXPO_PUBLIC_ENOKI_PUBLIC_KEY=enoki_public_...
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_SPONSOR_API_URL=https://your-sponsor.onrender.com
EXPO_PUBLIC_SPONSOR_SECRET=...             # must match the server's SPONSOR_SECRET
# optional overrides:
# EXPO_PUBLIC_WALRUS_PUBLISHER=...  EXPO_PUBLIC_WALRUS_AGGREGATOR=...
```

### 3. Configure the backend — `Pingou/server/.env`
```bash
ENOKI_PRIVATE_KEY=enoki_private_...        # KEEP SECRET — backend only, never in the app
PINGOU_PACKAGE_ID=0x...                     # same as the app's package id
SUI_NETWORK=testnet
SPONSOR_SECRET=...                          # same as EXPO_PUBLIC_SPONSOR_SECRET
# PORT=8787  RATE_MAX=30  RATE_WINDOW_MS=60000
```

### 4. Deploy the Move package (optional — if you don't have one yet)
```bash
cd move/pingou
sui client publish --skip-dependency-verification --gas-budget 200000000
# copy the published packageId into both .env files above
```

### 5. Run
```bash
# backend (terminal 1)
cd Pingou/server && npm install && node --env-file=.env index.mjs

# app (terminal 2)
cd Pingou && npx expo start --clear
```
Open in a **dev client** or build (custom OAuth schemes don't work in Expo Go).

---

## 📜 Smart contract — `pingou::profile`

A `Profile` is a shared object holding a Walrus `blob_id`, the `sha2_256` of the QR share-code, and an `allow` table of addresses. Key entries:

| Function | Purpose |
|---|---|
| `create_and_keep(blob_id, share_hash)` | Create a Profile + keep the `OwnerCap` |
| `set_blob(profile, cap, blob_id)` | Repoint to a new encrypted card |
| `add(profile, cap, addr)` | Owner grants `addr` read access |
| `add_self(profile, code)` | Scanner adds themselves by proving the share-code |
| `remove(profile, cap, addr)` | Revoke access |
| `seal_approve(id, profile)` | Seal key-server access policy (owner or allowlisted) |

---

## ⚙️ Environment variables

**App (`EXPO_PUBLIC_*`, baked into the build):** `SUI_ENABLED`, `SUI_NETWORK`, `PINGOU_PACKAGE_ID`, `ENOKI_PUBLIC_KEY`, `GOOGLE_CLIENT_ID`, `SPONSOR_API_URL`, `SPONSOR_SECRET`, `WALRUS_PUBLISHER`, `WALRUS_AGGREGATOR`.

**Backend:** `ENOKI_PRIVATE_KEY` (secret), `PINGOU_PACKAGE_ID`, `SUI_NETWORK`, `SPONSOR_SECRET`, `PORT`, `RATE_MAX`, `RATE_WINDOW_MS`.

> ⚠️ EAS builds from your **git repo**, and `.env.local` is gitignored — push the `EXPO_PUBLIC_*` vars to EAS (`eas env:push --environment <profile> --path .env.local`) or they won't be in the build.

---

## 📦 Building & shipping

```bash
# Android — installable APK with a download link (no Apple needed)
npm run build:preview      # eas build --profile preview  (outputs .apk)

# iOS — TestFlight
npm run build:prod         # eas build --profile production
eas submit --platform ios --profile production
```
See **[TESTFLIGHT.md](./Pingou/TESTFLIGHT.md)** for the full iOS flow and **[APPLE_SETUP.md](./Pingou/APPLE_SETUP.md)** for Sign in with Apple.

---

## 🔐 Security notes

- `ENOKI_PRIVATE_KEY` lives **only** on the backend — never ship it in the app.
- `SPONSOR_SECRET` is bundled into the app (`EXPO_PUBLIC_`), so it's extractable; it deters casual abuse, not a determined attacker. The backend also rate-limits per sender/IP. For production, validate the zkLogin JWT instead.
- Profiles are encrypted client-side before upload; Walrus only ever holds ciphertext.

---

## 📚 More docs

- [SUI_MIGRATION.md](./Pingou/SUI_MIGRATION.md) — migration design & decisions
- [SUI_TESTING.md](./Pingou/SUI_TESTING.md) — test runbook
- [TESTFLIGHT.md](./Pingou/TESTFLIGHT.md) — iOS build & submit
- [APPLE_SETUP.md](./Pingou/APPLE_SETUP.md) — Sign in with Apple
- [server/DEPLOY.md](./Pingou/server/DEPLOY.md) — deploying the sponsor backend

---

## 📝 Status

Built on **Sui testnet**. Core flows (sign-in, profile, one-scan exchange, decrypt, connections, delete) are working and verified on-device. Currently a beta — testnet data may be reset.
