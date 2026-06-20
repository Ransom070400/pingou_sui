// Socials stored as a flat key-value map: { instagram: "url", github: "url", ... }
export type SocialsMap = Record<string, string>;

export interface ProfileType {
  user_id: string;
  email: string;
  nickname: string;
  fullname: string;
  bio?: string;
  phone?: string;
  profile_url?: string;
  socials: SocialsMap;
  push_token?: string;
  created_at: string;
  updated_at: string;

  // Legacy fields (kept for backward compatibility during migration)
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
  extras?: string[];
}
