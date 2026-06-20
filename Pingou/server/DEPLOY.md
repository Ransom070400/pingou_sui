# Deploying the sponsor backend (get off the tunnel)

Goal: a stable `https://…` URL for the Enoki sponsor backend, so writes don't depend
on your Mac, a tunnel, or your Wi-Fi. Set it once in `.env.local` and forget it.

The service is tiny (Node `http` + `@mysten/enoki`). Three host options below — Render
is the simplest free path.

## Option A — Render (recommended, free)

1. Push this repo to GitHub.
2. Render dashboard → **New + → Blueprint** → pick your repo. It reads `server/render.yaml`
   (root dir `Pingou/server`, build `npm install`, start `npm start`, health `/health`).
   - Or **New + → Web Service** manually: Root Directory `Pingou/server`, Build `npm install`,
     Start `npm start`.
3. Set the secret env vars in the dashboard (blueprint marks them `sync:false`):
   - `ENOKI_PRIVATE_KEY = enoki_private_…`
   - `SPONSOR_SECRET = <same value as the app's EXPO_PUBLIC_SPONSOR_SECRET>`
   (`PINGOU_PACKAGE_ID`, `SUI_NETWORK` come from the blueprint.)
4. Deploy → you get `https://pingou-sponsor.onrender.com` (or similar).
5. Verify: open `https://…onrender.com/health` → `{"ok":true,"network":"testnet"}`.

> Free Render web services **sleep after ~15 min idle** — the first request then takes
> ~30s to wake. Fine for testing; upgrade or use Railway if that annoys you.

## Option B — Railway (no idle sleep, usage-based)

1. Railway → New Project → Deploy from repo.
2. Set **Root Directory** = `Pingou/server`, Start command `npm start`.
3. Add env vars: `ENOKI_PRIVATE_KEY`, `PINGOU_PACKAGE_ID`, `SUI_NETWORK=testnet`.
4. Generate a domain → `https://…up.railway.app`.

## Option C — Fly.io (Docker)

```bash
cd server
fly launch --no-deploy            # generates fly.toml; uses the Dockerfile here
fly secrets set ENOKI_PRIVATE_KEY=enoki_private_… \
  PINGOU_PACKAGE_ID=0xe9e00a0f790fd1ec16fa122cb85978e5667db20178e866e3c1b930c0e0d8960d \
  SUI_NETWORK=testnet
fly deploy
```

## Point the app at it (any option)

In `Pingou/.env.local`:
```
EXPO_PUBLIC_SPONSOR_API_URL=https://<your-deployed-host>
```
Restart Metro (`npx expo start --clear`). Now you can stop the local `npm run dev` and
the cloudflared tunnel for good — the app reaches the backend from anywhere.

## Notes
- The backend only sponsors `profile::{create_and_keep,set_blob,add,add_self,remove}` on
  the configured package — keep `PINGOU_PACKAGE_ID` in sync with the app after any redeploy.
- `ENOKI_PRIVATE_KEY` lives only in the host's env, never in git.
- For mainnet later: new Enoki key + `SUI_NETWORK=mainnet` + the mainnet package id.
