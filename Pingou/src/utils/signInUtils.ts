import { supabase } from '../lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

interface AuthResult {
  success: boolean;
  error: any;
}

// Supabase returns the session tokens (implicit flow) in the URL fragment, and
// any provider errors as query params. Collect both into a flat map.
const extractAuthParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const collect = (segment: string) => {
    segment.split('&').forEach((pair) => {
      if (!pair) return;
      const [key, value] = pair.split('=');
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
    });
  };

  if (queryIndex !== -1) {
    const end = hashIndex === -1 ? undefined : hashIndex;
    collect(url.substring(queryIndex + 1, end));
  }
  if (hashIndex !== -1) collect(url.substring(hashIndex + 1));

  return params;
};

export const handleLoginUtil = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
};

export const handleLoginWithAppleAuthUtil = async (): Promise<AuthResult> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: new Error('No identity token from Apple') };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: any) {
    if (err.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: new Error('Apple sign-in was cancelled') };
    }
    return { success: false, error: err };
  }
};

export const handleLoginWithGoogleUtil = async (): Promise<AuthResult> => {
  try {
    // e.g. pingou://auth-callback — must be added to Supabase's allowed
    // redirect URLs (Authentication → URL Configuration).
    const redirectTo = Linking.createURL('auth-callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // We open the browser ourselves so we can capture the redirect.
        skipBrowserRedirect: true,
      },
    });
    if (error) return { success: false, error };
    if (!data?.url) {
      return { success: false, error: new Error('No OAuth URL returned from Supabase') };
    }

    // Opens the system browser (ASWebAuthenticationSession / Custom Tabs) and
    // resolves once it redirects back to our scheme.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: new Error('Google sign-in was cancelled') };
    }
    if (result.type !== 'success' || !result.url) {
      return { success: false, error: new Error('Google sign-in failed') };
    }

    const params = extractAuthParams(result.url);
    if (params.error) {
      return {
        success: false,
        error: new Error(params.error_description || params.error),
      };
    }

    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) {
      return { success: false, error: new Error('No session tokens returned from Google sign-in') };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) return { success: false, error: sessionError };

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
};
