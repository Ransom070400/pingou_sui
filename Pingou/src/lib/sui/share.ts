/**
 * Share-code + connect-QR helpers for the one-scan two-way exchange.
 *
 * Each profile has a secret `shareCode` (kept inside the owner's encrypted profile)
 * whose sha256 is stored on-chain as `share_hash`. The owner's QR carries the code
 * in cleartext. A scanner presents the code to `add_self` to grant THEMSELVES read
 * access — so one scan can grant both directions (see profileService.exchange).
 */
import { toHex } from '@mysten/sui/utils';

/** A fresh random share-code (hex, 32 chars). */
export function generateShareCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** The exact bytes to pass to `add_self(code)` — utf8 of the code string. */
export function shareCodeBytes(code: string): Uint8Array {
  return new TextEncoder().encode(code);
}

export interface ConnectPayload {
  address: string;
  profileId: string;
  code: string;
}

/** What the owner's QR encodes. */
export function buildConnectQR(p: ConnectPayload): string {
  const params = new URLSearchParams({ a: p.address, p: p.profileId, c: p.code });
  return `pingou://connect?${params.toString()}`;
}

/** Parse a scanned QR back into a ConnectPayload, or null if it isn't ours. */
export function parseConnectQR(data: string): ConnectPayload | null {
  if (!data.startsWith('pingou://connect')) return null;
  const q = data.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(data.slice(q + 1));
  const address = params.get('a');
  const profileId = params.get('p');
  const code = params.get('c');
  if (!address || !profileId || !code) return null;
  return { address, profileId, code };
}
