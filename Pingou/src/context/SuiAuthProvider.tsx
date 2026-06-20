/**
 * Sui auth context (active when EXPO_PUBLIC_SUI_ENABLED=true).
 *
 * Replaces the Supabase session/profile with: a zkLogin address + signer, and the
 * user's own decrypted profile (from the on-chain Profile -> Walrus -> Seal). The
 * legacy Supabase AuthProvider stays untouched and is used when the flag is off.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { loginWithGoogle, loginWithApple, restoreSession, logout as zkLogout, type ZkLoginSigner } from '../lib/sui/zkLogin';

export type AuthProviderId = 'google' | 'apple';
import { clearProfileSession, prewarmProfileSession } from '../lib/sui/seal';
import { connectRealtime, disconnectRealtime } from '../lib/sui/realtime';
import {
  loadOwnProfile,
  saveOwnProfile,
  type OwnedProfileRef,
} from '../lib/sui/profileService';
import { getCachedOwnProfile, clearCachedOwnProfile } from '../lib/sui/profileCache';
import type { PingouProfileData } from '../lib/sui/profileStore';

interface SuiAuthValue {
  address: string | null;
  signer: ZkLoginSigner | null;
  /** The user's own Profile object/cap, once created. */
  profileRef: OwnedProfileRef | null;
  /** Decrypted own profile, or null if not set up yet. */
  profile: PingouProfileData | null;
  /** True during the initial session restore. */
  loading: boolean;
  /** True while a profile read/write is in flight. */
  busy: boolean;
  login: (provider?: AuthProviderId) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (data: PingouProfileData) => Promise<void>;
  refresh: () => Promise<void>;
}

const SuiAuthContext = createContext<SuiAuthValue>({} as SuiAuthValue);
export const useSuiAuth = () => useContext(SuiAuthContext);

export const SuiAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<ZkLoginSigner | null>(null);
  const [profileRef, setProfileRef] = useState<OwnedProfileRef | null>(null);
  const [profile, setProfile] = useState<PingouProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Addresses we've already auto-healed this session (avoid re-create loops).
  const healedFor = useRef<Set<string>>(new Set());

  const loadProfileFor = useCallback(
    async (addr: string, s: ZkLoginSigner) => {
      try {
        const res = await loadOwnProfile(addr, s);
        if (res && res.hashValid) {
          setProfileRef(res.ref);
          setProfile(res.data);
        } else if (res && !res.hashValid) {
          // The profile's immutable share_hash is wrong (created before the hash
          // fix), so it can never complete an exchange. Re-create a correct one
          // once, preserving the user's details, and switch to it. Show the card
          // meanwhile so it doesn't flash an empty state.
          setProfile(res.data);
          if (healedFor.current.has(addr)) {
            setProfileRef(res.ref);
            return;
          }
          healedFor.current.add(addr);
          await saveOwnProfile(addr, s, res.data, { forceCreate: true });
          const fresh = await loadOwnProfile(addr, s);
          if (fresh) {
            setProfileRef(fresh.ref);
            setProfile(fresh.data);
          }
        } else {
          // Confirmed: no profile for this address on the CURRENT package (the
          // lookup succeeded — RPC errors throw and are caught below). Drop any
          // stale cached profile (e.g. left over from a previous package) so the
          // user is shown "set up your card" instead of a dead profile whose id
          // would fail every exchange with a TypeMismatch.
          setProfileRef(null);
          setProfile(null);
          await clearCachedOwnProfile(addr);
        }
      } catch (err) {
        // Transient (e.g. network) — keep showing whatever we have and retry later.
        console.warn('Failed to load Sui profile:', err);
      }
    },
    []
  );

  // Render the cached profile instantly (by address), then refresh from chain in the
  // background — so an existing user sees their card the moment they sign in.
  const hydrate = useCallback(
    async (addr: string, s: ZkLoginSigner) => {
      const cached = await getCachedOwnProfile(addr);
      if (cached) {
        setProfileRef(cached.ref);
        setProfile(cached.data);
      }
      loadProfileFor(addr, s); // non-blocking refresh; clears a confirmed-gone profile
    },
    [loadProfileFor]
  );

  // Restore an existing session on launch.
  useEffect(() => {
    let mounted = true;
    const start = Date.now();
    (async () => {
      try {
        const session = await restoreSession();
        if (!mounted) return;
        if (session) {
          setAddress(session.address);
          setSigner(session.signer);
          connectRealtime(session.address);
          prewarmProfileSession(session.address, session.signer); // warm Seal for fast first decrypt
          await hydrate(session.address, session.signer);
        }
      } finally {
        // Keep the brand splash up for a minimum beat so it reads intentionally,
        // not as a flicker.
        const wait = 850 - (Date.now() - start);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hydrate]);

  const login = useCallback(async (provider: AuthProviderId = 'google') => {
    setBusy(true);
    try {
      const session = await (provider === 'apple' ? loginWithApple() : loginWithGoogle());
      setAddress(session.address);
      setSigner(session.signer);
      connectRealtime(session.address);
      prewarmProfileSession(session.address, session.signer); // warm Seal for fast first decrypt
      await hydrate(session.address, session.signer);
    } finally {
      setBusy(false);
    }
  }, [hydrate]);

  const logout = useCallback(async () => {
    clearProfileSession();
    disconnectRealtime();
    await zkLogout();
    setAddress(null);
    setSigner(null);
    setProfileRef(null);
    setProfile(null);
  }, []);

  const saveProfile = useCallback(
    async (data: PingouProfileData) => {
      if (!address || !signer) throw new Error('Not signed in');
      // Preserve the existing share-code across edits (it's committed on-chain).
      const merged = { ...data, shareCode: data.shareCode ?? profile?.shareCode };
      const prev = profile;

      // Optimistic: reflect the change instantly so the UI feels immediate.
      setProfile(merged);
      setBusy(true);

      // Persist on-chain (Seal + Walrus + sponsored tx) in the background so the
      // caller can navigate away right away.
      (async () => {
        try {
          await saveOwnProfile(address, signer, merged);
          // Reconcile with the canonical state (profile ref + freshly-minted
          // share-code on first create).
          await loadProfileFor(address, signer);
        } catch (e: any) {
          setProfile(prev); // roll back the optimistic update
          Alert.alert('Save failed', e?.message ?? 'Could not save your profile. Please try again.');
        } finally {
          setBusy(false);
        }
      })();
    },
    [address, signer, profile, loadProfileFor]
  );

  const refresh = useCallback(async () => {
    if (address && signer) await loadProfileFor(address, signer);
  }, [address, signer, loadProfileFor]);

  return (
    <SuiAuthContext.Provider
      value={{ address, signer, profileRef, profile, loading, busy, login, logout, saveProfile, refresh }}>
      {children}
    </SuiAuthContext.Provider>
  );
};
