/**
 * Local connections list for Sui mode.
 *
 * There's no Supabase `connections` table anymore. A "connection" is just a peer
 * you've exchanged with; we keep a lightweight per-user list on-device (keyed by
 * the owner's address) and resolve/decrypt each peer's profile on demand. Whether
 * you can actually read a peer's card is enforced on-chain by their Seal allowlist.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredConnection {
  /** Peer's Sui address (from their QR). */
  address: string;
  /** Peer's on-chain Profile object id (resolved at scan time). */
  profileObjectId: string;
  /** Cached display name, if we could decrypt at scan time. */
  name?: string;
  createdAt: number;
}

const key = (owner: string) => `pingou.connections.${owner}`;

export async function listConnections(owner: string): Promise<StoredConnection[]> {
  try {
    const raw = await AsyncStorage.getItem(key(owner));
    return raw ? (JSON.parse(raw) as StoredConnection[]) : [];
  } catch {
    return [];
  }
}

/** Add or update a connection (dedup by peer address), newest first. */
export async function addConnection(owner: string, conn: StoredConnection): Promise<void> {
  const existing = await listConnections(owner);
  const next = [conn, ...existing.filter((c) => c.address !== conn.address)];
  await AsyncStorage.setItem(key(owner), JSON.stringify(next));
}

export async function getConnection(
  owner: string,
  peerAddress: string
): Promise<StoredConnection | null> {
  const all = await listConnections(owner);
  return all.find((c) => c.address === peerAddress) ?? null;
}
