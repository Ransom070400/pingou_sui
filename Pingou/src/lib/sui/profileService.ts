/**
 * Orchestrates a user's encrypted profile + the one-scan two-way exchange.
 *
 * Profile create/edit:  Seal-encrypt → Walrus → on-chain Profile (sponsored).
 * Exchange (one scan):  a single sponsored tx grants BOTH directions, then we read
 *                       the peer's card. Connections are derived from the on-chain
 *                       allow table (in a two-way scan each party lands in the
 *                       other's allow table).
 */
import { makeProfileSealId, decryptForProfileFresh } from './seal';
import { saveProfile, loadProfile, type PingouProfileData } from './profileStore';
import { readBlob } from './walrus';
import {
  buildCreateProfileTx,
  buildSetBlobTx,
  buildExchangeTx,
  buildRemoveAccessTx,
  buildDeleteProfileTx,
  getProfile,
  getCreatedProfileRef,
  findOwnedProfile,
  findPeerProfileForMember,
  getConnectionAddresses,
} from './profile';
import {
  getCachedCard,
  setCachedCard,
  getCachedProfile,
  setCachedProfile,
  setCachedOwnProfile,
  getActiveCap,
  setActiveCap,
  clearActiveCap,
  clearCachedOwnProfile,
  type CachedCard,
} from './profileCache';
import { clearProfileSession } from './seal';
import { generateShareCode, shareCodeBytes, type ConnectPayload } from './share';
import { shareCodeHash } from './shareHash';
import { sponsorAndExecute } from './sponsor';
import type { ZkLoginSigner } from './zkLogin';

export interface OwnedProfileRef {
  profileObjectId: string;
  ownerCapId: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** findOwnedProfile honouring the locally-pinned active cap (a re-created profile). */
async function findOwned(address: string): Promise<OwnedProfileRef | null> {
  const active = await getActiveCap(address);
  return findOwnedProfile(address, active ?? undefined);
}

async function findOwnedWithRetry(address: string, tries = 6): Promise<OwnedProfileRef | null> {
  for (let i = 0; i < tries; i++) {
    const found = await findOwned(address);
    if (found) return found;
    await sleep(800);
  }
  return null;
}

/**
 * Encrypt + upload `data`, creating the on-chain Profile (sponsored) if needed.
 * On first create we mint a share-code and commit its hash on-chain; on edits the
 * existing share-code (carried in `data.shareCode`) is preserved.
 */
export async function saveOwnProfile(
  address: string,
  signer: ZkLoginSigner,
  data: PingouProfileData,
  opts?: { forceCreate?: boolean }
): Promise<OwnedProfileRef> {
  // forceCreate mints a brand-new profile even if one exists — used to replace a
  // profile whose immutable share_hash is wrong (can't be fixed in place).
  let ref = opts?.forceCreate ? null : await findOwned(address);
  let shareCode = data.shareCode;

  if (!ref) {
    // New profile: the share-code's hash must be set at creation (immutable after).
    shareCode = generateShareCode();
    const shareHash = shareCodeHash(shareCode);
    const digest = await sponsorAndExecute(buildCreateProfileTx('', shareHash), signer, address);
    // Read the new object ids from the tx effects (fast) instead of polling.
    ref = (await getCreatedProfileRef(digest)) ?? (await findOwnedWithRetry(address));
    if (!ref) throw new Error('Profile created but not yet indexed; try again.');
    // Pin this as the active profile so it supersedes any older (broken) one.
    await setActiveCap(address, ref.ownerCapId);
    // Verify the committed hash matches locally — catches any on-device hash bug
    // up front instead of as a later EBadShareCode on every scan.
    const oc = await getProfile(ref.profileObjectId);
    if (oc?.shareHash && !bytesEqual(oc.shareHash, shareHash)) {
      throw new Error('Share-code hash mismatch on this device — please update the app.');
    }
  }
  if (!shareCode) shareCode = generateShareCode(); // safety net

  const full = { ...data, shareCode };
  const { blobId } = await saveProfile(ref.profileObjectId, full);
  await setCachedProfile(blobId, full); // so the reload after save is instant
  await setCachedOwnProfile(address, { ref, data: full }); // instant on next sign-in
  await sponsorAndExecute(
    buildSetBlobTx(ref.profileObjectId, ref.ownerCapId, blobId),
    signer,
    address
  );
  return ref;
}

/**
 * Load + decrypt the caller's own profile (owner always has access). `hashValid` is
 * false when the profile's immutable on-chain share_hash doesn't match its share-code
 * — i.e. it can never complete an exchange and should be re-created.
 */
export async function loadOwnProfile(
  address: string,
  signer: ZkLoginSigner
): Promise<{ ref: OwnedProfileRef; data: PingouProfileData; hashValid: boolean } | null> {
  const ref = await findOwned(address);
  if (!ref) return null;
  const onchain = await getProfile(ref.profileObjectId);
  if (!onchain?.blobId) return null;
  // Cache-first: own profile is keyed by the immutable blob id, so once decrypted
  // it loads instantly on next launch (no Walrus/Seal) until the profile changes.
  let data = await getCachedProfile(onchain.blobId);
  if (!data) {
    data = await loadProfile({
      profileObjectId: ref.profileObjectId,
      blobId: onchain.blobId,
      sealId: makeProfileSealId(ref.profileObjectId),
      address,
      signer,
    });
    await setCachedProfile(onchain.blobId, data);
  }
  await setCachedOwnProfile(address, { ref, data }); // for instant render next sign-in
  const hashValid =
    !!onchain.shareHash &&
    !!data.shareCode &&
    bytesEqual(onchain.shareHash, shareCodeHash(data.shareCode));
  return { ref, data, hashValid };
}

/** Load + decrypt a peer's profile by id (only works once I have access). */
export async function loadPeerProfile(
  myAddress: string,
  signer: ZkLoginSigner,
  peerProfileObjectId: string
): Promise<PingouProfileData> {
  const onchain = await getProfile(peerProfileObjectId);
  if (!onchain?.blobId) throw new Error('Peer has no profile set up yet');
  return loadProfile({
    profileObjectId: peerProfileObjectId,
    blobId: onchain.blobId,
    sealId: makeProfileSealId(peerProfileObjectId),
    address: myAddress,
    signer,
  });
}

/**
 * Scan-to-exchange: one sponsored tx grants both directions (I read the peer; the
 * peer can read me), then return the peer's decrypted card. `peer` comes from the
 * scanned QR (address + profileId + share-code).
 */
export async function exchange(
  myAddress: string,
  signer: ZkLoginSigner,
  myRef: OwnedProfileRef,
  peer: ConnectPayload
): Promise<PingouProfileData> {
  // The peer's ciphertext is public — start fetching it (and its blob id) WHILE the
  // grant tx is in flight, so we only pay the slower of the two, not their sum.
  const fetchP = (async () => {
    const oc = await getProfile(peer.profileId);
    if (!oc?.blobId) throw new Error('Peer has no profile set up yet');
    return { blobId: oc.blobId, ciphertext: await readBlob(oc.blobId) };
  })();
  fetchP.catch(() => {}); // don't let an early reject surface as unhandled

  await sponsorAndExecute(
    buildExchangeTx({
      peerProfileId: peer.profileId,
      peerCodeBytes: shareCodeBytes(peer.code),
      myProfileId: myRef.profileObjectId,
      myCapId: myRef.ownerCapId,
      peerAddress: peer.address,
    }),
    signer,
    myAddress
  );

  const { blobId, ciphertext } = await fetchP;
  // Decrypt now that the grant has landed (seal_approve sees us in the allow table).
  const plaintext = await decryptForProfileFresh({
    ciphertext,
    profileObjectId: peer.profileId,
    id: makeProfileSealId(peer.profileId),
    address: myAddress,
    signer,
  });
  const data = JSON.parse(new TextDecoder().decode(plaintext)) as PingouProfileData;
  // Cache the card + profile so the connections list/detail open instantly later.
  await setCachedProfile(blobId, data);
  await setCachedCard(blobId, { fullname: data.fullname, avatar: data.avatar, bio: data.bio });
  return data;
}

/**
 * Decrypt just the display fields of a connection's card, using the local cache
 * (keyed by the immutable Walrus blob id) so reopens are instant.
 */
export async function loadConnectionCard(
  address: string,
  signer: ZkLoginSigner,
  profileObjectId: string
): Promise<CachedCard> {
  const onchain = await getProfile(profileObjectId);
  if (!onchain?.blobId) throw new Error('Peer has no profile set up yet');
  const cached = await getCachedCard(onchain.blobId);
  if (cached) return cached;
  const data = await loadProfile({
    profileObjectId,
    blobId: onchain.blobId,
    sealId: makeProfileSealId(profileObjectId),
    address,
    signer,
  });
  const card: CachedCard = { fullname: data.fullname, avatar: data.avatar, bio: data.bio };
  await setCachedCard(onchain.blobId, card);
  return card;
}

/**
 * Delete a connection: revoke the peer's access to my card (sponsored on-chain
 * `remove`), which also drops them from my connections list (it's derived from my
 * allow table). Needs my own Profile ref.
 */
export async function removeConnection(
  address: string,
  signer: ZkLoginSigner,
  peerAddress: string
): Promise<void> {
  const ref = await findOwned(address);
  if (!ref) throw new Error('You have no profile');
  await sponsorAndExecute(
    buildRemoveAccessTx(ref.profileObjectId, ref.ownerCapId, peerAddress),
    signer,
    address
  );
}

/**
 * Delete the caller's card: revoke every granted address and clear the on-chain blob
 * pointer (one sponsored tx), then wipe local caches + the Seal session. The encrypted
 * card becomes unreachable and nobody retains access. (The shared Profile shell can't
 * be destroyed on-chain.) Safe no-op if there's no profile.
 */
export async function deleteOwnProfile(address: string, signer: ZkLoginSigner): Promise<void> {
  const ref = await findOwned(address);
  if (ref) {
    const onchain = await getProfile(ref.profileObjectId);
    const granted = onchain?.allowTableId
      ? await getConnectionAddresses(onchain.allowTableId)
      : [];
    await sponsorAndExecute(
      buildDeleteProfileTx(ref.profileObjectId, ref.ownerCapId, granted),
      signer,
      address
    );
  }
  // Local cleanup regardless, so the device retains nothing.
  await clearCachedOwnProfile(address);
  await clearActiveCap(address);
  clearProfileSession();
}

export interface Connection {
  address: string;
  profileObjectId: string;
}

/** My connections = addresses in my Profile's allow table, resolved to their profiles. */
export async function getMyConnections(address: string): Promise<Connection[]> {
  const ref = await findOwned(address);
  if (!ref) return [];
  const onchain = await getProfile(ref.profileObjectId);
  if (!onchain?.allowTableId) return [];
  const addrs = await getConnectionAddresses(onchain.allowTableId);
  // Resolve each peer to the profile that actually granted ME access — a peer who
  // re-created their profile owns several, and only one is the one we connected to.
  const resolved = await Promise.all(
    addrs.map(async (a) => {
      const pid = await findPeerProfileForMember(a, address);
      return pid ? { address: a, profileObjectId: pid } : null;
    })
  );
  return resolved.filter((c): c is Connection => c !== null);
}
