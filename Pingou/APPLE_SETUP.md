# Sign in with Apple (zkLogin) — setup

The code is done. Apple sign-in uses the **web OAuth flow** (native Apple sign-in is
incompatible with zkLogin — it SHA256-hashes the nonce and uses the bundle id as
`aud`). The "Continue with Apple" button appears automatically once
`EXPO_PUBLIC_APPLE_SERVICES_ID` is set.

The redirect handoff is already handled: the sponsor backend serves a bounce page at
`/apple-callback` that forwards Apple's `#id_token` into `pingou://auth-callback`.

## Prerequisites (this is the real work — Apple infra)

You need an **Apple Developer account** ($99/yr).

### 1. App ID
Identifiers → App IDs → `com.anonymous.pingou` → enable **Sign In with Apple**.
(`usesAppleSignIn: true` is already in app.json.)

### 2. Services ID  (this becomes your "client id")
Identifiers → **Services IDs** → create e.g. `com.anonymous.pingou.signin` → enable
**Sign In with Apple** → Configure:
- **Primary App ID:** `com.anonymous.pingou`
- **Domains:** the host of your deployed backend, e.g. `pingou-sponsor.onrender.com`
- **Return URLs:** `https://pingou-sponsor.onrender.com/apple-callback`

> ⚠️ Apple may **reject shared domains** like `onrender.com`. If it won't verify, point
> a **custom domain** at the backend (Render → Settings → Custom Domain) and use that
> for the Domain + Return URL + `EXPO_PUBLIC_APPLE_REDIRECT_URI`.

### 3. Domain verification
Apple gives you `apple-developer-domain-association.txt`. Put its contents in the
backend env var **`APPLE_DOMAIN_ASSOCIATION`** (Render → Environment), redeploy, then
click **Verify** in Apple. The backend serves it at
`/.well-known/apple-developer-domain-association.txt`.

### 4. Enoki
Enoki portal → your project → **Auth Providers → + Apple** → paste the **Services ID**
(`com.anonymous.pingou.signin`) as the Client ID. (Must equal the JWT `aud`, or you get
"Invalid client id".)

### 5. App env (`.env.local`)
```
EXPO_PUBLIC_APPLE_SERVICES_ID=com.anonymous.pingou.signin
EXPO_PUBLIC_APPLE_REDIRECT_URI=https://pingou-sponsor.onrender.com/apple-callback
```
Restart Metro `--clear`. The Apple button now appears.

## How it flows
1. App opens `appleid.apple.com/auth/authorize` with `response_type=code id_token`,
   `response_mode=fragment`, `scope=openid`, and the **zkLogin nonce** (Apple echoes it raw).
2. Apple redirects to `…/apple-callback#id_token=…`; the backend page bounces it to
   `pingou://auth-callback#…`.
3. The app parses the `id_token` and hands it to Enoki (`/zklogin`, `/zklogin/zkp`) —
   same as Google.

## Notes
- `scope` MUST stay `openid` — requesting name/email forces `response_mode=form_post`.
- This flow works on **Android too** (it's just a browser flow) — no native Apple needed.
- App Store Guideline 4.8: offering Sign In with Apple is required if you offer Google.
