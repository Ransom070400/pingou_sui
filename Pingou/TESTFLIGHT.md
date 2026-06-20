# Shipping Pingou (iOS) to TestFlight

Build with EAS, submit with `eas submit`. The first submit is interactive (you hand
EAS an App Store Connect API key); after that EAS stores it and every submit is one
command. No Mac/Xcode required — builds run in the cloud.

## 0. One-time prerequisites
- **Apple Developer Program** membership ($99/yr).
- An app record in **App Store Connect** with bundle id `com.ezeransom.pingou`
  (App Store Connect → Apps → ➕ → New App). Note its **Apple ID** (a number) — that's
  `ascAppId`.
- An **App Store Connect API key**:
  App Store Connect → **Users and Access → Integrations → App Store Connect API** →
  generate a key (role: **App Manager** or **Admin**) → **download the `.p8` once**
  (you can't re-download it) and note the **Key ID** and **Issuer ID**.
  Keep the `.p8` outside git — `*.p8` is already gitignored.

## 1. Make sure the build has your env vars
EAS builds from your **git repo**, and `.env.local` is gitignored, so its
`EXPO_PUBLIC_*` values are NOT in the build unless you push them to EAS:

```bash
eas env:push --environment production --path .env.local
```
(or set them in the Expo dashboard → project → Environment variables, scoped to
`production`). Required: `EXPO_PUBLIC_SUI_ENABLED`, `EXPO_PUBLIC_SUI_NETWORK`,
`EXPO_PUBLIC_PINGOU_PACKAGE_ID`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`,
`EXPO_PUBLIC_SPONSOR_API_URL`, `EXPO_PUBLIC_SPONSOR_SECRET` (+ any Walrus/Seal/Apple).

## 2. Build + submit
```bash
npm i -g eas-cli
eas login
eas build:configure                              # first time only
eas build  --platform ios --profile production
eas submit --platform ios --profile production
```
On the first `eas submit` it asks for the `.p8` path, Key ID, Issuer ID, and the
ascAppId — then offers to **save them to EAS**. Say yes; future submits are
non-interactive.

## 3. In App Store Connect → TestFlight
- **Internal testing** (you + up to 100 teammates): available immediately, **no
  review**. Fastest way onto your own phone.
- **External testing** (up to 10,000 testers via a link): requires **Beta App
  Review**, which checks the guidelines below.

## Before external testers (Beta App Review will check these)
- **Sign in with Apple** must work (Guideline 4.8 — required because Google is
  offered). The app code is ready; finish the Apple infra (Services ID, domain
  verification, Enoki provider registration) per `APPLE_SETUP.md`.
- **Account deletion** is implemented (Delete Account revokes access + clears the
  on-chain card, then signs out) — satisfies 5.1.1(v).
- A **privacy policy URL**.
- Keep the **sponsor backend awake** (off Render free tier) and its testnet SUI
  funded, or testers hit cold-starts / failed writes.

## Optional: non-interactive submit (CI)
If you'd rather pin it in `eas.json` instead of EAS-stored credentials, add (with
your real values; keep the `.p8` gitignored):

```json
"submit": {
  "production": {
    "ios": {
      "ascApiKeyPath": "./secrets/asc_api_key.p8",
      "ascApiKeyId": "ABCD1234",
      "ascApiKeyIssuerId": "00000000-0000-0000-0000-000000000000",
      "ascAppId": "1234567890"
    }
  }
}
```
