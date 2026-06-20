/**
 * End-to-end smoke test against LIVE testnet (run from Node, not the app):
 *   1. Walrus store/read round-trip.
 *   2. Seal encrypt -> Walrus -> Walrus read -> Seal decrypt, gated by the
 *      deployed `profile::seal_approve` policy on a real Profile object.
 *
 * Usage:
 *   EXPO_PUBLIC_PINGOU_PACKAGE_ID=0x.. PINGOU_PROFILE_ID=0x.. SUI_PRIVKEY=suiprivkey1.. \
 *     npx tsx scripts/sui-smoke.ts
 */
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { storeBlob, readBlob } from '../src/lib/sui/walrus';
import { encryptForProfile, decryptForProfile, createProfileSessionKey } from '../src/lib/sui/seal';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function main() {
  const profileId = process.env.PINGOU_PROFILE_ID!;
  const keypair = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVKEY!);
  const address = keypair.toSuiAddress();
  console.log('signer address:', address);
  console.log('profile object:', profileId);

  // 1. Walrus round-trip --------------------------------------------------
  console.log('\n[1] Walrus store/read round-trip');
  const raw = new TextEncoder().encode('pingou-walrus-' + Date.now());
  const { blobId } = await storeBlob(raw);
  console.log('  stored blobId:', blobId);
  const back = await readBlob(blobId);
  assert(
    Buffer.from(back).equals(Buffer.from(raw)),
    'bytes read back from Walrus match what was stored'
  );

  // 2. Seal encrypt -> Walrus -> read -> Seal decrypt ---------------------
  console.log('\n[2] Seal encrypt -> Walrus -> Seal decrypt (policy-gated)');
  const profile = { fullname: 'Ada Lovelace', bio: 'first programmer', socials: { x: 'ada' } };
  const plaintext = new TextEncoder().encode(JSON.stringify(profile));

  const { ciphertext, id } = await encryptForProfile(profileId, plaintext);
  console.log('  seal id:', id);
  console.log('  ciphertext bytes:', ciphertext.length);

  const stored = await storeBlob(ciphertext);
  console.log('  ciphertext blobId:', stored.blobId);
  const fetched = await readBlob(stored.blobId);
  assert(
    Buffer.from(fetched).equals(Buffer.from(ciphertext)),
    'ciphertext survives the Walrus round-trip intact'
  );

  const sessionKey = await createProfileSessionKey(address, keypair);
  const decrypted = await decryptForProfile({
    ciphertext: fetched,
    profileObjectId: profileId,
    id,
    sessionKey,
  });
  const decoded = JSON.parse(new TextDecoder().decode(decrypted));
  assert(
    JSON.stringify(decoded) === JSON.stringify(profile),
    'owner decrypts the profile back to the original (seal_approve allowed)'
  );

  console.log('\n✅ ALL CHECKS PASSED — Walrus + Seal + on-chain policy work end to end.');
}

main().catch((e) => {
  console.error('\n❌ smoke test failed:\n', e);
  process.exit(1);
});
