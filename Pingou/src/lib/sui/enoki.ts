/**
 * Minimal Enoki HTTP client for React Native.
 *
 * The `@mysten/enoki` SDK can't be imported on Hermes (its index pulls in
 * `@mysten/webcrypto-signer` + wallet pop-up code). So we replicate only the few
 * REST calls we need, mirroring the SDK's exact endpoints/headers/bodies (verified
 * against EnokiClient source): base `/v1`, `Authorization: Bearer <publicKey>`,
 * `zklogin-jwt` header for JWT-scoped calls, and `ephemeralPublicKey.toSuiPublicKey()`
 * (which avoids the 33-vs-32-byte encoding footgun).
 *
 * Only the PUBLIC api key is used here. Sponsorship (which needs the PRIVATE key)
 * goes through our own backend — see lib/sui/sponsor.ts.
 */
import type { PublicKey } from '@mysten/sui/cryptography';
import { ENOKI_API_BASE, ENOKI_PUBLIC_KEY, SUI_NETWORK } from './config';

/** The zkLogin proof Enoki returns — this is the `inputs` for getZkLoginSignature. */
export interface ZkLoginProof {
  proofPoints: { a: string[]; b: string[][]; c: string[] };
  issBase64Details: { value: string; indexMod4: number };
  headerBase64: string;
  addressSeed: string;
}

function reqId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function enokiFetch<T>(path: string, init: RequestInit & { jwt?: string }): Promise<T> {
  const { jwt, ...rest } = init;
  const res = await fetch(`${ENOKI_API_BASE}/${path}`, {
    ...rest,
    headers: {
      ...rest.headers,
      ...(jwt ? { 'zklogin-jwt': jwt } : {}),
      Authorization: `Bearer ${ENOKI_PUBLIC_KEY}`,
      'Content-Type': 'application/json',
      'Request-Id': reqId(),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      msg = JSON.parse(text).errors?.[0]?.message ?? text;
    } catch {}
    throw new Error(`Enoki API ${res.status}: ${msg}`);
  }
  return JSON.parse(text).data as T;
}

export interface NonceResponse {
  nonce: string;
  randomness: string;
  epoch: number;
  maxEpoch: number;
  estimatedExpiration: number;
}

/** Create a zkLogin nonce bound to an ephemeral key + an epoch window. */
export function createZkLoginNonce(ephemeralPublicKey: PublicKey): Promise<NonceResponse> {
  return enokiFetch<NonceResponse>('zklogin/nonce', {
    method: 'POST',
    body: JSON.stringify({
      network: SUI_NETWORK,
      ephemeralPublicKey: ephemeralPublicKey.toSuiPublicKey(),
    }),
  });
}

export interface ZkLoginInfo {
  salt: string;
  address: string;
}

/** Exchange the OAuth JWT for the user's Sui address + salt. */
export function getZkLogin(jwt: string): Promise<ZkLoginInfo> {
  return enokiFetch<ZkLoginInfo>('zklogin', { method: 'GET', jwt });
}

/** Request the ZK proof that, with the ephemeral signature, authorizes the address. */
export function createZkLoginProof(args: {
  jwt: string;
  ephemeralPublicKey: PublicKey;
  maxEpoch: number;
  randomness: string;
}): Promise<ZkLoginProof> {
  return enokiFetch<ZkLoginProof>('zklogin/zkp', {
    method: 'POST',
    jwt: args.jwt,
    body: JSON.stringify({
      network: SUI_NETWORK,
      ephemeralPublicKey: args.ephemeralPublicKey.toSuiPublicKey(),
      maxEpoch: args.maxEpoch,
      randomness: args.randomness,
    }),
  });
}
