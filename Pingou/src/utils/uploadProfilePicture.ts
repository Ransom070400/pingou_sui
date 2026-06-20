import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

/**
 * Uploads a local image to Supabase Storage and returns a signed URL.
 * Overwrites any existing file for the same user.
 */
export const uploadProfilePicture = async (
  imageUri: string,
  userId: string
): Promise<string | null> => {
  try {
    const base64 = await readAsStringAsync(imageUri, {
      encoding: EncodingType.Base64,
    });

    const filePath = `${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('pfp')
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError.message);
      return null;
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('pfp')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

    if (urlError) {
      console.error('Signed URL error:', urlError.message);
      return null;
    }

    return urlData.signedUrl;
  } catch (err) {
    console.error('uploadProfilePicture failed:', err);
    return null;
  }
};
