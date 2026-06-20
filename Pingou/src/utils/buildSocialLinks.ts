import { ProfileType } from '~/src/types/ProfileTypes';
import { getPlatformById } from '~/src/config/socialPlatforms';

export interface SocialLinkItem {
  id: string;
  label: string;
  url: string;
  color: string;
}

const normalizeUrl = (raw: string) => {
  if (!raw) return '';
  return /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`;
};

export const buildSocialLinks = (p: ProfileType): SocialLinkItem[] => {
  const list: SocialLinkItem[] = [];

  // New format: socials JSONB
  if (p.socials && typeof p.socials === 'object') {
    for (const [key, value] of Object.entries(p.socials)) {
      if (!value || !value.trim()) continue;
      // Skip phone/email — shown separately in ContactInfo
      if (key === 'phone' || key === 'email') continue;

      const platform = getPlatformById(key);
      list.push({
        id: key,
        label: platform?.label ?? key,
        url: normalizeUrl(value),
        color: platform?.color ?? '#6B7280',
      });
    }
  }

  // Legacy fallback: individual columns
  if (list.length === 0) {
    if (p.instagram) list.push({ id: 'instagram', label: 'Instagram', url: normalizeUrl(p.instagram), color: '#E4405F' });
    if (p.twitter) list.push({ id: 'twitter', label: 'X / Twitter', url: normalizeUrl(p.twitter), color: '#1DA1F2' });
    if (p.linkedin) list.push({ id: 'linkedin', label: 'LinkedIn', url: normalizeUrl(p.linkedin), color: '#0A66C2' });
    if (p.website) list.push({ id: 'website', label: 'Website', url: normalizeUrl(p.website), color: '#6B7280' });
    if (p.extras?.length) {
      p.extras.forEach((u, i) => {
        list.push({ id: `extra-${i}`, label: `Link ${i + 1}`, url: normalizeUrl(u), color: '#6B7280' });
      });
    }
  }

  return list;
};
