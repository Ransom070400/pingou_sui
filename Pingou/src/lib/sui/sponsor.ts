/**
 * Client side of sponsored transactions. The app builds a transaction *kind*, the
 * backend (which holds the Enoki private key) wraps + sponsors it, the user signs
 * the returned bytes with their zkLogin signer, and the backend executes it.
 *
 *   build kind --> POST /sponsor --> sign bytes --> POST /execute --> digest
 */
import type { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { suiClient } from './suiClient';
import { SPONSOR_API_URL, SPONSOR_SECRET } from './config';
import type { ZkLoginSigner } from './zkLogin';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${SPONSOR_API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SPONSOR_SECRET ? { Authorization: `Bearer ${SPONSOR_SECRET}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    // Surface the exact URL so we can tell env/reachability issues apart.
    throw new Error(`Could not reach sponsor backend at ${url} — ${e?.message ?? e}`);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `sponsor ${path} failed (${res.status})`);
  return json as T;
}

/**
 * Sponsor, sign, and execute `tx` on behalf of `signer` (the zkLogin user).
 * Returns the executed transaction digest.
 */
export async function sponsorAndExecute(
  tx: Transaction,
  signer: ZkLoginSigner,
  sender: string
): Promise<string> {
  const kindBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });

  const { bytes, digest } = await postJson<{ bytes: string; digest: string }>('/sponsor', {
    sender,
    transactionKindBytes: toBase64(kindBytes),
  });

  const { signature } = await signer.signTransaction(fromBase64(bytes));

  const result = await postJson<{ digest: string }>('/execute', { digest, signature });
  return result.digest;
}
