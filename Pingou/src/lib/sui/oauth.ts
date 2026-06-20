/**
 * Google OAuth for zkLogin — authorization-code flow with PKCE.
 *
 * Google removed the implicit (`response_type=id_token`) flow ("unsupported
 * response type"), so native clients must use `response_type=code` + PKCE, then
 * exchange the code for tokens. zkLogin still works: Google echoes our `nonce` into
 * the returned `id_token`. iOS clients are public (no secret), so the exchange needs
 * only the code + PKCE verifier.
 *
 * We drive the flow with WebBrowser so the zkLogin nonce is fully under our control.
 * Redirect = the iOS reverse-client-id scheme (registered in app.json).
 */
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { toBase64, toHex } from '@mysten/sui/utils';
import {
  GOOGLE_CLIENT_ID,
  APPLE_SERVICES_ID,
  APPLE_REDIRECT_URI,
  OAUTH_REDIRECT_SCHEME,
  OAUTH_REDIRECT_PATH,
} from './config';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const APPLE_AUTH_ENDPOINT = 'https://appleid.apple.com/auth/authorize';

/** `12345-abc.apps.googleusercontent.com` -> `com.googleusercontent.apps.12345-abc`. */
export function googleReverseClientId(clientId = GOOGLE_CLIENT_ID): string {
  const prefix = clientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${prefix}`;
}

/** The redirect URI registered for the iOS client. */
export function googleRedirectUri(): string {
  return `${googleReverseClientId()}:/oauthredirect`;
}

const toBase64Url = (b64: string) =>
  b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function makeCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(toBase64(bytes));
}

async function makeCodeChallenge(verifier: string): Promise<string> {
  const b64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return toBase64Url(b64);
}

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const collect = (seg: string) =>
    seg.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    });
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q !== -1) collect(url.substring(q + 1, h === -1 ? undefined : h));
  if (h !== -1) collect(url.substring(h + 1));
  return out;
}

/** Run Google sign-in (PKCE code flow) and return the OIDC id_token (JWT) bound to `nonce`. */
export async function signInWithGoogle(nonce: string): Promise<string> {
  const redirectUri = googleRedirectUri();
  const verifier = makeCodeVerifier();
  const challenge = await makeCodeChallenge(verifier);

  const authParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `${GOOGLE_AUTH_ENDPOINT}?${authParams.toString()}`,
    redirectUri
  );
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google sign-in was cancelled');
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in failed');
  }

  const params = parseParams(result.url);
  if (params.error) throw new Error(params.error_description || params.error);
  if (!params.code) throw new Error('No authorization code returned from Google');

  // Exchange the code for tokens (public client: no secret, PKCE verifier instead).
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  const json: any = await res.json();
  if (!res.ok || !json.id_token) {
    throw new Error(json.error_description || json.error || 'Google token exchange failed');
  }
  return json.id_token as string;
}

/**
 * Sign in with Apple for zkLogin — WEB flow (native Apple sign-in hashes the nonce
 * and uses the bundle id as `aud`, both incompatible with zkLogin).
 *
 * Apple returns the id_token directly in the redirect fragment (no token exchange),
 * and echoes our raw `nonce`. Apple only redirects to a registered HTTPS URL, so
 * `APPLE_REDIRECT_URI` must be a page that bounces `#...` into our app scheme.
 * `scope` MUST stay `openid` only — requesting name/email forces form_post.
 */
export async function signInWithApple(nonce: string): Promise<string> {
  const appReturn = `${OAUTH_REDIRECT_SCHEME}://${OAUTH_REDIRECT_PATH}`;
  const state = (() => {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return toHex(b);
  })();

  const params = new URLSearchParams({
    client_id: APPLE_SERVICES_ID,
    redirect_uri: APPLE_REDIRECT_URI,
    response_type: 'code id_token',
    response_mode: 'fragment',
    scope: 'openid',
    nonce,
    state,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `${APPLE_AUTH_ENDPOINT}?${params.toString()}`,
    appReturn
  );
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Apple sign-in was cancelled');
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('Apple sign-in failed');
  }

  const parsed = parseParams(result.url);
  if (parsed.error) throw new Error(parsed.error_description || parsed.error);
  if (parsed.state && parsed.state !== state) throw new Error('Apple state mismatch');
  if (!parsed.id_token) throw new Error('No id_token returned from Apple');
  return parsed.id_token;
}
