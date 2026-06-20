import { supabase } from '../lib/supabase';
import { ProfilePayload } from '~/types/types';
import { ProfileType } from '../types/ProfileTypes';
import { uploadProfilePicture } from './uploadProfilePicture';

/**
 * Creates a new profile in the `profiles` table after onboarding.
 * Uploads the profile picture if provided.
 * Returns the created profile or null on failure.
 */
export const uploadOnboarding = async (
  payload: ProfilePayload
): Promise<{ profile: ProfileType | null; error: any }> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { profile: null, error: userError ?? new Error('No authenticated user') };
    }

    const user = userData.user;
    let profileUrl: string | null = null;

    if (payload.imageUri) {
      profileUrl = await uploadProfilePicture(payload.imageUri, user.id);
    }

    // Extract phone from socials if present
    const phone = payload.socials?.phone ?? null;

    const profileRow = {
      user_id: user.id,
      email: user.email ?? '',
      fullname: payload.name ?? '',
      nickname: payload.name?.split(' ')[0]?.toLowerCase() ?? '',
      bio: payload.bio ?? '',
      phone,
      socials: payload.socials ?? {},
      profile_url: profileUrl,
    };

    // Upsert so retries don't fail with duplicate key errors
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileRow, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return { profile: null, error };
    return { profile: data, error: null };
  } catch (err) {
    return { profile: null, error: err };
  }
};
