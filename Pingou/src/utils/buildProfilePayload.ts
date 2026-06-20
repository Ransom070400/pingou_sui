import { NameCardType, ProfilePayload } from '~/types/types';
import { SocialsMap } from '~/src/types/ProfileTypes';

export const buildProfilePayload = (
  name?: NameCardType,
  socials?: SocialsMap,
  imageUri?: string
): ProfilePayload => ({
  ...(name ? { name: name.name, bio: name.bio } : {}),
  ...(socials ? { socials } : {}),
  ...(imageUri ? { imageUri } : {}),
});
