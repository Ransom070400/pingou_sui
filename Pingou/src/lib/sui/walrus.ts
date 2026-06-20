/**
 * Walrus storage over plain HTTP.
 *
 * The `@mysten/walrus` SDK depends on WASM and does NOT run on Hermes, so we talk
 * to a publisher (write) / aggregator (read) directly with fetch — which works in
 * both React Native and Node. Blobs are public + immutable + content-addressed:
 * we store Seal-CIPHERTEXT here, never plaintext, and "editing" a profile means
 * writing a new blob and repointing the on-chain Profile at the new id.
 */
import { WALRUS_PUBLISHER, WALRUS_AGGREGATOR, WALRUS_EPOCHS } from './config';

export interface StoreBlobResult {
  /** Content-addressed id used to read the blob back (stable for identical bytes). */
  blobId: string;
  /** On-chain Sui `Blob` object id (present unless the content was already certified). */
  objectId?: string;
  /** Whether this content was already stored on the network (dedup hit). */
  alreadyCertified: boolean;
}

export interface StoreBlobOptions {
  /** Storage duration in Walrus epochs (~2 weeks each). Defaults to ~1 year. */
  epochs?: number;
  /** Register as owner-deletable rather than permanent. */
  deletable?: boolean;
  /** Transfer the resulting Blob object to this Sui address. */
  sendObjectTo?: string;
}

/** Upload bytes to Walrus. Returns the blob id used to read them back. */
export async function storeBlob(
  data: Uint8Array,
  opts: StoreBlobOptions = {}
): Promise<StoreBlobResult> {
  const params = new URLSearchParams();
  params.set('epochs', String(opts.epochs ?? WALRUS_EPOCHS));
  if (opts.deletable) params.set('deletable', 'true');
  if (opts.sendObjectTo) params.set('send_object_to', opts.sendObjectTo);

  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?${params.toString()}`, {
    method: 'PUT',
    body: data as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`Walrus store failed: ${res.status} ${await safeText(res)}`);
  }

  const json: any = await res.json();
  if (json.newlyCreated) {
    const obj = json.newlyCreated.blobObject;
    return { blobId: obj.blobId, objectId: obj.id, alreadyCertified: false };
  }
  if (json.alreadyCertified) {
    return { blobId: json.alreadyCertified.blobId, alreadyCertified: true };
  }
  throw new Error(`Walrus store: unexpected response shape: ${JSON.stringify(json)}`);
}

/** Read a blob back by id. Returns the raw bytes (Seal ciphertext, in our case).
 *  Times out a stalled aggregator and retries once so a slow node can't hang a scan. */
export async function readBlob(blobId: string, timeoutMs = 12_000): Promise<Uint8Array> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Walrus read failed: ${res.status} ${await safeText(res)}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Walrus read failed');
}

/** Direct URL for a blob — handy for `<Image source={{ uri }}>` on non-encrypted blobs. */
export function blobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
