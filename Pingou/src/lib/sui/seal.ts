/**
 * Seal encryption wrapper for Pingou profiles.
 *
 * Unlike the Walrus/Enoki SDKs, `@mysten/seal` runs on Hermes (pure-JS BLS), as
 * long as we (a) use the `Hmac256Ctr` DEM instead of WebCrypto AES-GCM, and
 * (b) polyfill `crypto.getRandomValues` (see lib/sui/polyfills).
 *
 * Identity model: a ciphertext's Seal `id` is namespaced by the owner's Profile
 * object id (`id = <profileObjectId bytes> ++ <random nonce>`). The on-chain
 * `profile::seal_approve` checks that prefix AND that the requester is the owner
 * or on the allowlist — so only people you've granted access can fetch key shares.
 */
import { SealClient, SessionKey, DemType, ExpiredSessionKeyError } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import type { Signer } from '@mysten/sui/cryptography';
import { suiClient } from './suiClient';
import {
  PINGOU_PACKAGE_ID,
  SEAL_APPROVE_TARGET,
  SEAL_KEY_SERVERS,
  SEAL_THRESHOLD,
  SUI_NETWORK,
} from './config';

let _client: SealClient | null = null;

export function getSealClient(): SealClient {
  if (!_client) {
    _client = new SealClient({
      suiClient: suiClient as any,
      serverConfigs: SEAL_KEY_SERVERS[SUI_NETWORK].map((s) => ({
        objectId: s.objectId,
        weight: s.weight,
      })),
      verifyKeyServers: false,
    });
  }
  return _client;
}

const strip0x = (id: string) => (id.startsWith('0x') ? id.slice(2) : id);

/**
 * Deterministic Seal identity for a profile = its object id (hex, no 0x).
 *
 * Deterministic (not a random nonce) so a peer who reads your on-chain Profile can
 * derive the same id and decrypt — they don't need to be told a nonce. The
 * `seal_approve` policy only checks the object-id prefix, so reusing the id across
 * profile edits is fine.
 */
export function makeProfileSealId(profileObjectId: string): string {
  return strip0x(profileObjectId);
}

export interface EncryptResult {
  /** BCS bytes of the encrypted object — this is what we upload to Walrus. */
  ciphertext: Uint8Array;
  /** The Seal id used; persist it alongside the blob (e.g. on-chain) for decrypt. */
  id: string;
  /** Symmetric backup key — DO NOT share; optional owner-side recovery only. */
  backupKey: Uint8Array;
}

/** Encrypt arbitrary bytes (e.g. a JSON profile) for a profile's access policy. */
export async function encryptForProfile(
  profileObjectId: string,
  data: Uint8Array,
  id = makeProfileSealId(profileObjectId)
): Promise<EncryptResult> {
  const { encryptedObject, key } = await getSealClient().encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PINGOU_PACKAGE_ID,
    id,
    data,
    demType: DemType.Hmac256Ctr,
  });
  return { ciphertext: encryptedObject, id, backupKey: key };
}

/** Bytes of a `seal_approve` PTB the key servers dry-run to authorize decryption. */
export async function buildSealApproveTxBytes(
  profileObjectId: string,
  id: string
): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.moveCall({
    target: SEAL_APPROVE_TARGET,
    arguments: [tx.pure.vector('u8', fromHex(id)), tx.object(profileObjectId)],
  });
  return tx.build({ client: suiClient as any, onlyTransactionKind: true });
}

/**
 * Decrypt a profile ciphertext. Requires a `SessionKey` the user has signed
 * (via their zkLogin/Enoki signer in-app, or a keypair in tests).
 */
export async function decryptForProfile(args: {
  ciphertext: Uint8Array;
  profileObjectId: string;
  id: string;
  sessionKey: SessionKey;
}): Promise<Uint8Array> {
  const txBytes = await buildSealApproveTxBytes(args.profileObjectId, args.id);
  return getSealClient().decrypt({
    data: args.ciphertext,
    sessionKey: args.sessionKey,
    txBytes,
  });
}

/** Create a SessionKey for decryption. `signer` is the user's keypair/EnokiSigner. */
export async function createProfileSessionKey(
  address: string,
  signer: Signer,
  ttlMin = 30
): Promise<SessionKey> {
  return SessionKey.create({
    address,
    packageId: PINGOU_PACKAGE_ID,
    ttlMin,
    suiClient: suiClient as any,
    signer,
  });
}

// Cache one signed SessionKey per address so we don't re-sign on every decrypt,
// but always hand back a non-expired one.
let cachedSession: { address: string; key: SessionKey } | null = null;

async function getProfileSession(address: string, signer: Signer): Promise<SessionKey> {
  if (cachedSession?.address === address && !cachedSession.key.isExpired()) {
    return cachedSession.key;
  }
  const key = await createProfileSessionKey(address, signer);
  cachedSession = { address, key };
  return key;
}

/** Drop the cached SessionKey (call on logout / account switch). */
export function clearProfileSession(): void {
  cachedSession = null;
}

/**
 * Warm the cached SessionKey ahead of the first decrypt (call right after sign-in),
 * so a scan doesn't pay the create-and-sign cost on its critical path. Best-effort.
 */
export async function prewarmProfileSession(address: string, signer: Signer): Promise<void> {
  try {
    await getProfileSession(address, signer);
  } catch {
    // best-effort; the decrypt path will create one if this didn't land
  }
}

/**
 * Decrypt using a cached-but-valid SessionKey, self-healing if it expires mid-flow
 * (recreate once and retry). This is the path callers should use.
 */
export async function decryptForProfileFresh(args: {
  ciphertext: Uint8Array;
  profileObjectId: string;
  id: string;
  address: string;
  signer: Signer;
}): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const sessionKey = await getProfileSession(args.address, args.signer);
    try {
      return await decryptForProfile({
        ciphertext: args.ciphertext,
        profileObjectId: args.profileObjectId,
        id: args.id,
        sessionKey,
      });
    } catch (e) {
      if (e instanceof ExpiredSessionKeyError && attempt === 0) {
        clearProfileSession();
        continue;
      }
      throw e;
    }
  }
  throw new Error('unreachable');
}

export { SessionKey };
