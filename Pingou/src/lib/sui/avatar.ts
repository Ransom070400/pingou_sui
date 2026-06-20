/**
 * Avatar handling for Sui mode.
 *
 * We keep the avatar INLINE in the (Seal-encrypted) profile JSON as a small data
 * URI rather than a separate blob — so it's exactly as private as the rest of the
 * card (only your connections can decrypt it) with one encrypt / one Walrus blob.
 * The key is downscaling to a thumbnail so the encrypted profile stays small.
 */
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const AVATAR_PX = 256;
const AVATAR_QUALITY = 0.6;

/**
 * Let the user pick + crop a square photo, downscale it to a thumbnail, and return
 * a `data:image/jpeg;base64,...` URI (≈10–25 KB). Returns null if cancelled.
 */
export async function pickAvatarDataUri(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]?.uri) return null;

  const out = await manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: AVATAR_PX, height: AVATAR_PX } }],
    { compress: AVATAR_QUALITY, format: SaveFormat.JPEG, base64: true }
  );
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}
