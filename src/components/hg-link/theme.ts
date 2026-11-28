// <!-- AGENT: FRONTEND -->
// Controlled design options. Class names are written out in full so Tailwind
// can see them; administrators only ever pick a key, never type CSS.
import { Baby, Church, Coffee, Droplets, Globe, HandHeart, Heart, Sparkles, type LucideIcon } from 'lucide-react';
import type { Accent, CardIcon, CardTheme } from '@/lib/hg-link/contentSchema';

export const ICON_COMPONENTS: Record<Exclude<CardIcon, 'none'>, LucideIcon> = {
  heart: Heart,
  sparkles: Sparkles,
  droplets: Droplets,
  'hand-heart': HandHeart,
  coffee: Coffee,
  baby: Baby,
  globe: Globe,
  church: Church,
};

export const ICON_LABELS: Record<CardIcon, string> = {
  none: 'No icon', heart: 'Heart', sparkles: 'Sparkles', droplets: 'Water drops',
  'hand-heart': 'Serving hands', coffee: 'Coffee', baby: 'Kids', globe: 'Globe', church: 'Church',
};

export const ACCENT_STYLES: Record<Accent, { label: string; banner: string; swatch: string; dark: string; circleA: string; circleB: string; ring: string }> = {
  navy: { label: 'Navy', banner: 'bg-[#344f66]', swatch: 'bg-[#344f66]', dark: 'bg-[#344f66]', circleA: 'bg-[#a3bfd9]', circleB: 'bg-[#d95f3b]', ring: 'focus-visible:outline-[#344f66]' },
  terracotta: { label: 'Terracotta', banner: 'bg-[#a8472b]', swatch: 'bg-[#a8472b]', dark: 'bg-[#a8472b]', circleA: 'bg-[#f1d4bd]', circleB: 'bg-[#344f66]', ring: 'focus-visible:outline-[#a8472b]' },
  forest: { label: 'Forest', banner: 'bg-[#2f5d46]', swatch: 'bg-[#2f5d46]', dark: 'bg-[#2f5d46]', circleA: 'bg-[#cfe2c6]', circleB: 'bg-[#d95f3b]', ring: 'focus-visible:outline-[#2f5d46]' },
  plum: { label: 'Plum', banner: 'bg-[#5b3a63]', swatch: 'bg-[#5b3a63]', dark: 'bg-[#5b3a63]', circleA: 'bg-[#e2dfef]', circleB: 'bg-[#efc1ae]', ring: 'focus-visible:outline-[#5b3a63]' },
};

export const CARD_THEME_STYLES: Record<CardTheme, { label: string; card: string; text: string; swatch: string }> = {
  sand: { label: 'Sand', card: 'bg-[#f1d4bd]', text: 'text-[#3a3a3a]', swatch: 'bg-[#f1d4bd]' },
  wheat: { label: 'Wheat', card: 'bg-[#eee0c6]', text: 'text-[#3a3a3a]', swatch: 'bg-[#eee0c6]' },
  lavender: { label: 'Lavender', card: 'bg-[#e2dfef]', text: 'text-[#3a3a3a]', swatch: 'bg-[#e2dfef]' },
  sky: { label: 'Sky', card: 'bg-[#a3bfd9]', text: 'text-[#3a3a3a]', swatch: 'bg-[#a3bfd9]' },
  blush: { label: 'Blush', card: 'bg-[#efc1ae]', text: 'text-[#3a3a3a]', swatch: 'bg-[#efc1ae]' },
  mist: { label: 'Mist', card: 'bg-[#dbe4f0]', text: 'text-[#3a3a3a]', swatch: 'bg-[#dbe4f0]' },
  // "navy" follows the page accent colour, like the original Serve card.
  navy: { label: 'Accent (dark)', card: '', text: 'text-[#fdf6ef]', swatch: 'bg-[#344f66]' },
};
