import { SocialsMap } from '~/src/types/ProfileTypes';

export type NameCardType = {
  name: string;
  bio: string;
};

export type ProfilePayload = {
  name?: string;
  bio?: string;
  socials?: SocialsMap;
  imageUri?: string;
};
