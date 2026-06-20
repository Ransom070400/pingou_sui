/**
 * Pingou sponsorship backend.
 *
 * Holds the Enoki PRIVATE key and sponsors a tightly-scoped set of transactions
 * (only our `profile` module's calls) so zkLogin users never need SUI for gas.
 *
 *   POST /sponsor  { sender, transactionKindBytes (base64) } -> { bytes, digest }
 *   POST /execute  { digest, signature }                     -> { digest }
 *
 * Abuse protection (this endpoint spends YOUR gas):
 *   - allowedMoveCallTargets restricts sponsorship to profile:: calls only.
 *   - Optional shared secret (SPONSOR_SECRET) — required if set. NOTE the app ships
 *     it in EXPO_PUBLIC_*, so it's extractable: it deters casual/bot abuse, not a
 *     determined attacker. For mainnet, validate the zkLogin JWT instead (TODO).
 *   - Rate limiting per sender address and per client IP.
 *
 * Run:  cp .env.example .env  (fill ENOKI_PRIVATE_KEY + PINGOU_PACKAGE_ID), then
 *       npm install && npm run dev
 */
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { EnokiClient } from '@mysten/enoki';

const PORT = Number(process.env.PORT ?? 8787);
const NETWORK = process.env.SUI_NETWORK ?? 'testnet';
const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_KEY;
const PACKAGE_ID = process.env.PINGOU_PACKAGE_ID;
const SPONSOR_SECRET = process.env.SPONSOR_SECRET ?? '';
const RATE_MAX = Number(process.env.RATE_MAX ?? 30); // requests per window per key
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS ?? 60_000);

if (!ENOKI_PRIVATE_KEY || !PACKAGE_ID) {
  console.error('Missing ENOKI_PRIVATE_KEY or PINGOU_PACKAGE_ID in env (.env).');
  process.exit(1);
}

const enoki = new EnokiClient({ apiKey: ENOKI_PRIVATE_KEY });

// Only these calls may be sponsored. Keep in sync with the Move module.
const ALLOWED_TARGETS = [
  `${PACKAGE_ID}::profile::create_and_keep`,
  `${PACKAGE_ID}::profile::set_blob`,
  `${PACKAGE_ID}::profile::add`,
  `${PACKAGE_ID}::profile::add_self`,
  `${PACKAGE_ID}::profile::remove`,
];

// ── Rate limiting (sliding window, in-memory) ──────────────────────────────
const hits = new Map(); // key -> [timestamps]
function tooMany(key) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > RATE_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of hits) {
    const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS);
    if (fresh.length) hits.set(k, fresh);
    else hits.delete(k);
  }
}, RATE_WINDOW_MS).unref();

function authorized(req) {
  if (!SPONSOR_SECRET) return true; // open (dev) when no secret configured
  return (req.headers['authorization'] || '') === `Bearer ${SPONSOR_SECRET}`;
}
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, network: NETWORK });
    }

    // Apple Sign In redirect target: Apple only redirects to a registered HTTPS URL,
    // so we serve a page that bounces the #fragment (id_token) into the app scheme.
    if (req.method === 'GET' && req.url.startsWith('/apple-callback')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(
        `<!doctype html><meta charset="utf-8"><title>Pingou</title>` +
          `<script>location.replace('pingou://auth-callback'+(location.hash||''))</script>` +
          `Returning to Pingou…`
      );
    }
    // Apple domain verification file (paste Apple's content into APPLE_DOMAIN_ASSOCIATION).
    if (req.method === 'GET' && req.url === '/.well-known/apple-developer-domain-association.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(process.env.APPLE_DOMAIN_ASSOCIATION ?? '');
    }

    // Everything below spends gas — gate it.
    if (req.method === 'POST' && (req.url === '/sponsor' || req.url === '/execute')) {
      if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
      const ip = clientIp(req);
      if (tooMany(`ip:${ip}`)) return send(res, 429, { error: 'rate limit exceeded' });

      if (req.url === '/sponsor') {
        const { sender, transactionKindBytes } = await readJson(req);
        if (!sender || !transactionKindBytes) {
          return send(res, 400, { error: 'sender and transactionKindBytes required' });
        }
        if (tooMany(`addr:${sender}`)) return send(res, 429, { error: 'rate limit exceeded' });
        const sponsored = await enoki.createSponsoredTransaction({
          network: NETWORK,
          sender,
          transactionKindBytes,
          allowedAddresses: [sender],
          allowedMoveCallTargets: ALLOWED_TARGETS,
        });
        return send(res, 200, { bytes: sponsored.bytes, digest: sponsored.digest });
      }

      // /execute
      const { digest, signature } = await readJson(req);
      if (!digest || !signature) {
        return send(res, 400, { error: 'digest and signature required' });
      }
      const result = await enoki.executeSponsoredTransaction({ digest, signature });
      return send(res, 200, { digest: result.digest });
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    // Surface Enoki's specific complaint (e.g. disallowed target, gas, bad object)
    // instead of the opaque "Request to Enoki API failed (status: 400)".
    const detail =
      err?.errors?.[0]?.message || err?.cause?.message || err?.code || String(err?.message ?? err);
    send(res, 500, { error: detail });
  }
});

// ── Realtime relay (WebSocket) ─────────────────────────────────────────────
// Clients register their Sui address; a `notify` from one client is pushed to the
// target address's open sockets — so a scanned device sees "Connected!" instantly
// instead of polling the chain.
const wss = new WebSocketServer({
  server,
  verifyClient: (info, done) => {
    if (!SPONSOR_SECRET) return done(true);
    const token = new URL(info.req.url, 'http://x').searchParams.get('token');
    done(token === SPONSOR_SECRET, 401, 'unauthorized');
  },
});
const sockets = new Map(); // address -> Set<ws>

wss.on('connection', (ws) => {
  let addr = null;
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'register' && typeof msg.address === 'string') {
      addr = msg.address;
      if (!sockets.has(addr)) sockets.set(addr, new Set());
      sockets.get(addr).add(ws);
    } else if (msg.type === 'notify' && typeof msg.to === 'string') {
      const targets = sockets.get(msg.to);
      if (targets) {
        const out = JSON.stringify({
          type: 'connected',
          from: msg.from,
          name: msg.name,
          avatar: msg.avatar,
          profileId: msg.profileId,
        });
        for (const c of targets) {
          try {
            c.send(out);
          } catch {}
        }
      }
    }
  });
  ws.on('close', () => {
    if (addr && sockets.has(addr)) {
      sockets.get(addr).delete(ws);
      if (!sockets.get(addr).size) sockets.delete(addr);
    }
  });
});

server.listen(PORT, () =>
  console.log(
    `pingou-sponsor listening on :${PORT} (${NETWORK}) — auth:${SPONSOR_SECRET ? 'on' : 'OFF'} rate:${RATE_MAX}/${RATE_WINDOW_MS}ms ws:on`
  )
);

// Keep-alive: Render's free tier sleeps after ~15 min with no inbound traffic, which
// gives the next user a ~30–60s cold start. While we're awake, ping our own public
// URL every 10 min so the idle timer never trips. Render injects RENDER_EXTERNAL_URL;
// off Render (local) this is skipped. A real cron (cron-job.org/UptimeRobot) hitting
// /health is a more robust backstop since it can also wake a cold instance.
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) {
  setInterval(
    () => {
      fetch(`${SELF_URL.replace(/\/$/, '')}/health`).catch(() => {});
    },
    10 * 60 * 1000
  ).unref();
}
