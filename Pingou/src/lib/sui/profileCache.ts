/**
 * Local cache of decrypted profile cards, keyed by Walrus blob id.
 *
 * Blob ids are content-addressed and immutable, so a cached card is valid until the
 * peer edits their profile (which produces a new blob id). This makes the
 * connections list render instantly on reopen — no Walrus fetch / Seal decrypt
 * unless the card actually changed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PingouProfileData } from './profileStore';

export interface CachedCard {
  fullname?: string;
  avatar?: string;
  bio?: string;
}

const cardKey = (blobId: string) => `pingou.card.${blobId}`;
const profileKey = (blobId: string) => `pingou.profile.${blobId}`;

export async function getCachedCard(blobId: string): Promise<CachedCard | null> {
  try {
    const raw = await AsyncStorage.getItem(cardKey(blobId));
    return raw ? (JSON.parse(raw) as CachedCard) : null;
  } catch {
    return null;
  }
}

export async function setCachedCard(blobId: string, card: CachedCard): Promise<void> {
  try {
    await AsyncStorage.setItem(cardKey(blobId), JSON.stringify(card));
  } catch {
    // best-effort
  }
}

/** Full decrypted profile cache (for the user's own card) — keyed by blob id. */
export async function getCachedProfile(blobId: string): Promise<PingouProfileData | null> {
  try {
    const raw = await AsyncStorage.getItem(profileKey(blobId));
    return raw ? (JSON.parse(raw) as PingouProfileData) : null;
  } catch {
    return null;
  }
}

export async function setCachedProfile(blobId: string, data: PingouProfileData): Promise<void> {
  try {
    await AsyncStorage.setItem(profileKey(blobId), JSON.stringify(data));
  } catch {
    // best-effort
  }
}

/**
 * The user's OWN profile cached by ADDRESS (ref + decrypted data), so it can render
 * instantly the moment they sign in — before any RPC. Refreshed in the background.
 */
export interface CachedOwnProfile {
  ref: { profileObjectId: string; ownerCapId: string };
  data: PingouProfileData;
}
const ownKey = (address: string) => `pingou.own.${address}`;

export async function getCachedOwnProfile(address: string): Promise<CachedOwnProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(ownKey(address));
    return raw ? (JSON.parse(raw) as CachedOwnProfile) : null;
  } catch {
    return null;
  }
}

export async function setCachedOwnProfile(address: string, value: CachedOwnProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(ownKey(address), JSON.stringify(value));
  } catch {
    // best-effort
  }
}

/** Drop the cached own profile (e.g. it no longer exists on the current package). */
export async function clearCachedOwnProfile(address: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(ownKey(address));
  } catch {
    // best-effort
  }
}

/**
 * The OwnerCap the app should treat as "my profile" for an address. Set when we
 * (re)create a profile, so a freshly-minted correct profile supersedes any older
 * broken one that `getOwnedObjects` might still return first.
 */
const activeCapKey = (address: string) => `pingou.activecap.${address}`;

export async function getActiveCap(address: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(activeCapKey(address));
  } catch {
    return null;
  }
}

export async function setActiveCap(address: string, capId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(activeCapKey(address), capId);
  } catch {
    // best-effort
  }
}

export async function clearActiveCap(address: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(activeCapKey(address));
  } catch {
    // best-effort
  }
}
