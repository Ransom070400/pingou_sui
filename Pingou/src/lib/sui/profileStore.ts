/**
 * High-level profile storage: ties Seal (encrypt) + Walrus (store) together.
 *
 *   save:  profile JSON --Seal encrypt--> ciphertext --Walrus--> blobId  (+ seal id)
 *   load:  blobId --Walrus--> ciphertext --Seal decrypt--> profile JSON
 *
 * The returned `blobId`/`sealId` are then committed on-chain via
 * buildCreateProfileTx / buildSetBlobTx so a scanner can resolve them.
 */
import type { Signer } from '@mysten/sui/cryptography';
import { encryptForProfile, decryptForProfileFresh } from './seal';
import { storeBlob, readBlob } from './walrus';

/** The shareable profile payload (public-ish contact card — but encrypted at rest). */
export interface PingouProfileData {
  fullname: string;
  nickname?: string;
  bio?: string;
  phone?: string;
  email?: string;
  socials?: Record<string, string>;
  /** Avatar as a Walrus blob id or data URI (kept small). */
  avatar?: string;
  /** Secret share-code embedded in this profile's QR; its sha256 is the on-chain
   *  share_hash. Lets a scanner grant themselves read access (one-scan exchange). */
  shareCode?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SavedProfile {
  blobId: string;
  sealId: string;
}

/** Encrypt + upload a profile. Returns the Walrus blob id and Seal id to persist on-chain. */
export async function saveProfile(
  profileObjectId: string,
  data: PingouProfileData
): Promise<SavedProfile> {
  const bytes = enc.encode(JSON.stringify(data));
  const { ciphertext, id } = await encryptForProfile(profileObjectId, bytes);
  const { blobId } = await storeBlob(ciphertext);
  return { blobId, sealId: id };
}

/** Download + decrypt a profile. Decryption self-heals an expired session key. */
export async function loadProfile(args: {
  profileObjectId: string;
  blobId: string;
  sealId: string;
  address: string;
  signer: Signer;
}): Promise<PingouProfileData> {
  const ciphertext = await readBlob(args.blobId);
  const plaintext = await decryptForProfileFresh({
    ciphertext,
    profileObjectId: args.profileObjectId,
    id: args.sealId,
    address: args.address,
    signer: args.signer,
  });
  return JSON.parse(dec.decode(plaintext)) as PingouProfileData;
}
