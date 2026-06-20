/**
 * Share-code hashing. This MUST produce exactly Move's `hash::sha2_256(utf8(code))`,
 * because `add_self` asserts `sha2_256(code) == share_hash` (aborts EBadShareCode
 * otherwise). We use @noble/hashes (pure JS, Hermes-safe, the same lib Seal uses)
 * instead of expo-crypto, whose base64-digest path did NOT round-trip to the same
 * bytes — so the committed share_hash was wrong and every exchange aborted with
 * EBadShareCode.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { shareCodeBytes } from './share';

/** sha256(utf8(code)) as bytes — matches Move's `hash::sha2_256(code)`. */
export function shareCodeHash(code: string): Uint8Array {
  return sha256(shareCodeBytes(code));
}
