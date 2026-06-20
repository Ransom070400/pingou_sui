import { supabase } from '../lib/supabase';

interface AuthResult {
  success: boolean;
  error: any;
}

export const handleUserSignUp = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
};
