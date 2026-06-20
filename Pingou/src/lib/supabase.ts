import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase env vars. The Supabase client is inert — only the Sui path ' +
      '(EXPO_PUBLIC_SUI_ENABLED=true) will work.'
  );
}

// `createClient('', '')` THROWS at import time, which would crash every screen that
// imports this file (the whole app, transitively). When Supabase env is absent —
// e.g. the clean-break Sui build — fall back to a syntactically-valid placeholder so
// import succeeds. Nothing in Sui mode calls this client, so it's inert.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
