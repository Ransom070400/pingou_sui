/**
 * Central config for the Sui migration (zkLogin + Walrus + Seal).
 *
 * Everything is driven by EXPO_PUBLIC_* env (see .env.example). While
 * `SUI_ENABLED` is false the rest of the app keeps using Supabase — nothing here
 * runs unless a Sui code path is explicitly reached behind the flag.
 *
 * NOTE: only PUBLIC values belong here. The Enoki private key and any signing
 * authority live on the sponsorship backend, never in the client bundle.
 */

export type SuiNetwork = 'testnet' | 'mainnet';

const env = process.env;

/** Master switch — gate every Sui code path on this. */
export const SUI_ENABLED = env.EXPO_PUBLIC_SUI_ENABLED === 'true';

export const SUI_NETWORK: SuiNetwork =
  env.EXPO_PUBLIC_SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

/** Full-node RPC for the active network. */
export const SUI_RPC_URL =
  SUI_NETWORK === 'mainnet'
    ? 'https://fullnode.mainnet.sui.io:443'
    : 'https://fullnode.testnet.sui.io:443';

/** Published `pingou` Move package id (profile + Seal policy). */
export const PINGOU_PACKAGE_ID = env.EXPO_PUBLIC_PINGOU_PACKAGE_ID ?? '';

/** Fully-qualified Seal policy target for `tx.moveCall`. */
export const SEAL_APPROVE_TARGET =
  `${PINGOU_PACKAGE_ID}::profile::seal_approve` as const;

// ── Enoki (zkLogin) ─────────────────────────────────────────────
export const ENOKI_PUBLIC_KEY = env.EXPO_PUBLIC_ENOKI_PUBLIC_KEY ?? '';
export const ENOKI_API_BASE = 'https://api.enoki.mystenlabs.com/v1';
export const GOOGLE_CLIENT_ID = env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

/** OAuth redirect — must match app.json `scheme` and the Enoki/Google console. */
export const OAUTH_REDIRECT_SCHEME = 'pingou';
export const OAUTH_REDIRECT_PATH = 'auth-callback';

// ── Apple (zkLogin via web flow; native Apple sign-in is incompatible) ──
/** Apple Services ID (e.g. com.anonymous.pingou.signin). Register THIS in Enoki. */
export const APPLE_SERVICES_ID = env.EXPO_PUBLIC_APPLE_SERVICES_ID ?? '';
/** HTTPS return URL registered with Apple — a page that bounces the fragment into
 *  `pingou://auth-callback`. Apple forbids custom-scheme / localhost redirects. */
export const APPLE_REDIRECT_URI = env.EXPO_PUBLIC_APPLE_REDIRECT_URI ?? '';

// ── Walrus (HTTP; SDK can't run on Hermes) ──────────────────────
export const WALRUS_PUBLISHER =
  env.EXPO_PUBLIC_WALRUS_PUBLISHER ?? 'https://publisher.walrus-testnet.walrus.space';
export const WALRUS_AGGREGATOR =
  env.EXPO_PUBLIC_WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space';
/** Default storage duration (Walrus epochs ≈ 2 weeks each; 26 ≈ 1 year). */
export const WALRUS_EPOCHS = 26;

// ── Seal key servers ────────────────────────────────────────────
// Open-mode, free testnet servers run by Mysten (2-of-2). Swap for permissioned
// mainnet operators (incl. Enoki) when going to mainnet.
export interface SealKeyServer {
  objectId: string;
  weight: number;
}
export const SEAL_KEY_SERVERS: Record<SuiNetwork, SealKeyServer[]> = {
  testnet: [
    { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
    { objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
  ],
  mainnet: [], // fill with permissioned operators before mainnet
};
export const SEAL_THRESHOLD = 2;

// ── Sponsorship backend ─────────────────────────────────────────
// In dev the Mac's LAN IP changes (DHCP / switching Wi-Fi), which kept breaking a
// hardcoded sponsor URL. Since the device already reaches Metro on the Mac's CURRENT
// IP to load the JS bundle, derive the backend host from the Metro dev host (port
// 8787). An explicit EXPO_PUBLIC_SPONSOR_API_URL still wins (e.g. for production).
function deriveSponsorUrl(): string {
  if (env.EXPO_PUBLIC_SPONSOR_API_URL) return env.EXPO_PUBLIC_SPONSOR_API_URL;
  try {
    // Lazy require so this file still imports under Node (headless smoke tests).
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined =
      Constants?.expoConfig?.hostUri ??
      Constants?.expoGoConfig?.debuggerHost ??
      Constants?.manifest?.debuggerHost;
    const host = hostUri?.split(':')[0];
    if (host) return `http://${host}:8787`;
  } catch {
    // expo-constants unavailable (e.g. Node) — fall through.
  }
  return 'http://localhost:8787';
}

export const SPONSOR_API_URL = deriveSponsorUrl();

/** Shared secret for the sponsor backend (must match the server's SPONSOR_SECRET).
 *  Bundled into the app, so it deters casual abuse, not a determined attacker. */
export const SPONSOR_SECRET = env.EXPO_PUBLIC_SPONSOR_SECRET ?? '';

/**
 * Throws if a required value is missing while Sui is enabled. Call at the entry
 * of a Sui flow so misconfiguration fails loudly instead of mid-transaction.
 */
export function assertSuiConfig(): void {
  if (!SUI_ENABLED) return;
  const missing: string[] = [];
  if (!PINGOU_PACKAGE_ID) missing.push('EXPO_PUBLIC_PINGOU_PACKAGE_ID');
  if (!ENOKI_PUBLIC_KEY) missing.push('EXPO_PUBLIC_ENOKI_PUBLIC_KEY');
  if (!GOOGLE_CLIENT_ID) missing.push('EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  if (SUI_NETWORK === 'mainnet' && SEAL_KEY_SERVERS.mainnet.length === 0) {
    missing.push('SEAL_KEY_SERVERS.mainnet');
  }
  if (missing.length) {
    throw new Error(`Sui is enabled but missing config: ${missing.join(', ')}`);
  }
}
