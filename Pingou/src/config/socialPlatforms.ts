import {
  Linkedin,
  Github,
  Dribbble,
  PenLine,
  Globe,
  Briefcase,
  Instagram,
  Twitter,
  Video,
  Youtube,
  Camera,
  Hash,
  Phone,
  Mail,
  MessageCircle,
  Send,
  Smartphone,
  Music,
  Figma,
  Twitch,
  Gamepad,
  Link,
} from 'lucide-react-native';

export type SocialPlatform = {
  id: string;
  label: string;
  description: string;
  category: 'professional' | 'social' | 'messaging' | 'contact';
  icon: any;
  color: string;
  placeholder: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  // Professional
  {
    id: 'linkedin',
    label: 'LinkedIn',
    description: 'Professional networking',
    category: 'professional',
    icon: Linkedin,
    color: '#0A66C2',
    placeholder: 'https://linkedin.com/in/username',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Code & open source',
    category: 'professional',
    icon: Github,
    color: '#333333',
    placeholder: 'https://github.com/username',
  },
  {
    id: 'behance',
    label: 'Behance',
    description: 'Creative portfolio',
    category: 'professional',
    icon: Briefcase,
    color: '#1769FF',
    placeholder: 'https://behance.net/username',
  },
  {
    id: 'dribbble',
    label: 'Dribbble',
    description: 'Design showcase',
    category: 'professional',
    icon: Dribbble,
    color: '#EA4C89',
    placeholder: 'https://dribbble.com/username',
  },
  {
    id: 'figma',
    label: 'Figma',
    description: 'Design collaboration',
    category: 'professional',
    icon: Figma,
    color: '#F24E1E',
    placeholder: 'https://figma.com/@username',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Blog & articles',
    category: 'professional',
    icon: PenLine,
    color: '#000000',
    placeholder: 'https://medium.com/@username',
  },
  {
    id: 'website',
    label: 'Portfolio / Website',
    description: 'Personal site',
    category: 'professional',
    icon: Globe,
    color: '#6B7280',
    placeholder: 'https://yoursite.com',
  },

  // Social
  {
    id: 'instagram',
    label: 'Instagram',
    description: 'Photos & reels',
    category: 'social',
    icon: Instagram,
    color: '#E4405F',
    placeholder: 'https://instagram.com/username',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    description: 'Thoughts & threads',
    category: 'social',
    icon: Twitter,
    color: '#1DA1F2',
    placeholder: 'https://x.com/username',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    description: 'Short-form video',
    category: 'social',
    icon: Video,
    color: '#000000',
    placeholder: 'https://tiktok.com/@username',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Video content',
    category: 'social',
    icon: Youtube,
    color: '#FF0000',
    placeholder: 'https://youtube.com/@username',
  },
  {
    id: 'snapchat',
    label: 'Snapchat',
    description: 'Ephemeral messaging',
    category: 'social',
    icon: Camera,
    color: '#FFFC00',
    placeholder: 'username',
  },
  {
    id: 'threads',
    label: 'Threads',
    description: 'Text-based social',
    category: 'social',
    icon: Hash,
    color: '#000000',
    placeholder: 'https://threads.net/@username',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    description: 'Live streaming',
    category: 'social',
    icon: Twitch,
    color: '#9146FF',
    placeholder: 'https://twitch.tv/username',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    description: 'Music profile',
    category: 'social',
    icon: Music,
    color: '#1DB954',
    placeholder: 'https://open.spotify.com/user/username',
  },

  // Messaging
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Messaging',
    category: 'messaging',
    icon: MessageCircle,
    color: '#25D366',
    placeholder: '+1234567890',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'Messaging & channels',
    category: 'messaging',
    icon: Send,
    color: '#0088CC',
    placeholder: 'https://t.me/username',
  },
  {
    id: 'discord',
    label: 'Discord',
    description: 'Communities & servers',
    category: 'messaging',
    icon: Gamepad,
    color: '#5865F2',
    placeholder: 'username#1234',
  },
  {
    id: 'signal',
    label: 'Signal',
    description: 'Private messaging',
    category: 'messaging',
    icon: Smartphone,
    color: '#3A76F0',
    placeholder: '+1234567890',
  },

  // Contact
  {
    id: 'phone',
    label: 'Phone',
    description: 'Direct call or text',
    category: 'contact',
    icon: Phone,
    color: '#10B981',
    placeholder: '+1234567890',
  },
  {
    id: 'email',
    label: 'Email',
    description: 'Additional email',
    category: 'contact',
    icon: Mail,
    color: '#6366F1',
    placeholder: 'you@example.com',
  },
  {
    id: 'other',
    label: 'Other Link',
    description: 'Any other URL',
    category: 'contact',
    icon: Link,
    color: '#6B7280',
    placeholder: 'https://...',
  },
];

export const CATEGORIES = [
  { key: 'professional' as const, label: 'Professional' },
  { key: 'social' as const, label: 'Social' },
  { key: 'messaging' as const, label: 'Messaging' },
  { key: 'contact' as const, label: 'Contact' },
];

export const getPlatformById = (id: string) =>
  SOCIAL_PLATFORMS.find((p) => p.id === id);
