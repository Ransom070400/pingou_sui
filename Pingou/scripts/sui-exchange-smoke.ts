/**
 * One-scan exchange access-control test against LIVE testnet, two identities.
 *   A (funded) sets up an encrypted profile with a share-code hash. B presents the
 *   share-code via `add_self` (what a QR scanner does) and must then decrypt A's
 *   card; with a WRONG code it must fail. Proves the share-code gate + Seal access.
 *
 * Usage: EXPO_PUBLIC_PINGOU_PACKAGE_ID=0x.. SUI_PRIVKEY=suiprivkey1.. npx tsx scripts/sui-exchange-smoke.ts
 */
import { createHash } from 'node:crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { NoAccessError } from '@mysten/seal';
import { suiClient } from '../src/lib/sui/suiClient';
import { saveProfile } from '../src/lib/sui/profileStore';
import { buildCreateProfileTx, buildSetBlobTx, buildAddSelfTx, findOwnedProfile } from '../src/lib/sui/profile';
import { loadPeerProfile } from '../src/lib/sui/profileService';

function ok(c: boolean, m: string) {
  if (!c) throw new Error('FAILED: ' + m);
  console.log('  ✓ ' + m);
}

async function main() {
  const A = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVKEY!);
  const B = Ed25519Keypair.generate();
  console.log('A (sharer):', A.toSuiAddress());
  console.log('B (scanner):', B.toSuiAddress());

  const exec = async (tx: any, signer: any) => {
    const r = await suiClient.signAndExecuteTransaction({ transaction: tx, signer });
    await suiClient.waitForTransaction({ digest: r.digest });
    return r;
  };

  const CODE = 'pingou-share-code-abc123';
  const shareHash = new Uint8Array(createHash('sha256').update(CODE, 'utf8').digest());
  const codeBytes = new TextEncoder().encode(CODE);

  // Fund B so it can submit add_self (a scanner pays nothing in-app — gas is
  // sponsored — but here we sign directly).
  console.log('\n[1] fund B + A sets up profile');
  const fund = new Transaction();
  const [coin] = fund.splitCoins(fund.gas, [60_000_000]);
  fund.transferObjects([coin], B.toSuiAddress());
  await exec(fund, A);

  await exec(buildCreateProfileTx('', shareHash), A);
  const aRef = await findOwnedProfile(A.toSuiAddress());
  ok(!!aRef, 'A profile resolved');
  const aProfile = { fullname: 'Grace Hopper', bio: 'compiler pioneer', socials: { x: 'grace' } };
  const { blobId } = await saveProfile(aRef!.profileObjectId, aProfile);
  await exec(buildSetBlobTx(aRef!.profileObjectId, aRef!.ownerCapId, blobId), A);

  // B with a WRONG code can't self-grant.
  console.log('\n[2] B add_self with WRONG code (expect abort)');
  let aborted = false;
  try {
    await exec(buildAddSelfTx(aRef!.profileObjectId, new TextEncoder().encode('wrong')), B);
  } catch {
    aborted = true;
  }
  ok(aborted, 'wrong share-code is rejected on-chain');

  // B reads before self-grant -> denied.
  console.log('\n[3] B reads A before self-grant (expect DENIED)');
  let denied = false;
  try {
    await loadPeerProfile(B.toSuiAddress(), B as any, aRef!.profileObjectId);
  } catch (e) {
    denied = e instanceof NoAccessError || /access|approve|denied/i.test(String(e));
  }
  ok(denied, 'B denied before presenting the code');

  // B presents the correct code -> self-grant -> can decrypt.
  console.log('\n[4] B add_self with CORRECT code, then read A (expect SUCCESS)');
  await exec(buildAddSelfTx(aRef!.profileObjectId, codeBytes), B);
  const got = await loadPeerProfile(B.toSuiAddress(), B as any, aRef!.profileObjectId);
  ok(JSON.stringify(got) === JSON.stringify({ ...aProfile }), 'B decrypts A after presenting the code');

  console.log('\n✅ ONE-SCAN EXCHANGE VERIFIED — share-code gates self-grant + decryption.');
}

main().catch((e) => {
  console.error('\n❌ exchange smoke failed:\n', e);
  process.exit(1);
});
