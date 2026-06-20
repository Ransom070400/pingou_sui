import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ProfileType } from '../types/ProfileTypes';
import { registerForPushNotifications } from '../utils/notifications';

const AuthContext = createContext<{
  profile: ProfileType | null;
  setProfile: React.Dispatch<React.SetStateAction<ProfileType | null>>;
  loading: boolean;
  session: Session | null;
}>({
  profile: null,
  setProfile: () => {},
  loading: true,
  session: null,
} as any);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const pushRegistered = useRef(false);

  // 1. Initialize session + subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) {
          setSession(data.session ?? null);
        }
      } catch (err) {
        console.warn('Failed to get session:', err);
        // Clear any stale/invalid tokens from storage so the user can sign in fresh.
        try {
          await supabase.auth.signOut();
        } catch {}
        if (mounted) setSession(null);
      } finally {
        if (mounted) setInitialized(true);
      }
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      if (event === 'TOKEN_REFRESHED' && !sess) {
        setSession(null);
        return;
      }
      setSession(sess);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // 2. Fetch profile once initialized and whenever session changes
  useEffect(() => {
    if (!initialized) return;

    let mounted = true;

    const loadProfile = async () => {
      setLoading(true);
      try {
        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .single();

          if (!mounted) return;
          if (error) {
            setProfile(null);
          } else {
            setProfile(data ?? null);
          }
        } else {
          if (mounted) setProfile(null);
        }
      } catch (err) {
        console.warn('Failed to load profile:', err);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [session, initialized]);

  // 3. Register for push notifications once profile is loaded
  useEffect(() => {
    if (profile?.user_id && !pushRegistered.current) {
      pushRegistered.current = true;
      registerForPushNotifications(profile.user_id);
    }
    if (!profile) {
      pushRegistered.current = false;
    }
  }, [profile]);

  return (
    <AuthContext.Provider value={{ profile, setProfile, loading, session }}>
      {children}
    </AuthContext.Provider>
  );
};
