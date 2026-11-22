// <!-- AGENT: ARCHITECT -->
// Versioned, structured HG Links page content. This is the only shape the
// editor can save, so administrators can never inject HTML, CSS, or script.
import { z } from 'zod';
import { normalizeSafeExternalUrl } from './safeUrl.ts';

export const HG_LINK_CONTENT_VERSION = 1;

export const CARD_THEMES = [
  'sand', 'wheat', 'lavender', 'navy', 'sky', 'blush', 'mist',
] as const;
export const ACCENTS = ['navy', 'terracotta', 'forest', 'plum'] as const;
export const ICONS = [
  'none', 'heart', 'sparkles', 'droplets', 'hand-heart', 'coffee', 'baby', 'globe', 'church',
] as const;
export const LAYOUTS = ['grid', 'list'] as const;

export type CardTheme = (typeof CARD_THEMES)[number];
export type Accent = (typeof ACCENTS)[number];
export type CardIcon = (typeof ICONS)[number];
export type Layout = (typeof LAYOUTS)[number];

const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => normalizeSafeExternalUrl(value) !== null, {
    message: 'Use a public https:// address',
  })
  .transform((value) => normalizeSafeExternalUrl(value) as string);

const formSlug = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

export const cardSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(1, 'Add a title').max(80),
  description: z.string().trim().max(200).default(''),
  icon: z.enum(ICONS).default('none'),
  theme: z.enum(CARD_THEMES).default('sand'),
  buttonLabel: z.string().trim().max(40).default(''),
  visible: z.boolean().default(true),
  destination: z.discriminatedUnion('type', [
    z.object({ type: z.literal('form'), formSlug }),
    z.object({ type: z.literal('external'), url: safeUrl }),
  ]),
});

export const contentSchema = z
  .object({
    version: z.literal(HG_LINK_CONTENT_VERSION).default(HG_LINK_CONTENT_VERSION),
    wordmark: z.string().trim().max(60).default('Harvest Generation'),
    title: z.string().trim().min(1, 'Add a page title').max(80),
    description: z.string().trim().max(300).default(''),
    accent: z.enum(ACCENTS).default('navy'),
    layout: z.enum(LAYOUTS).default('grid'),
    heroImageUrl: safeUrl.nullable().default(null),
    cards: z.array(cardSchema).max(24),
  })
  .strict()
  .superRefine((content, ctx) => {
    const seen = new Set<string>();
    content.cards.forEach((card, index) => {
      if (seen.has(card.id)) {
        ctx.addIssue({ code: 'custom', path: ['cards', index, 'id'], message: 'Duplicate card id' });
      }
      seen.add(card.id);
    });
  });

export type HgLinkCard = z.infer<typeof cardSchema>;
export type HgLinkContent = z.infer<typeof contentSchema>;

/** The default cards for churches without a published revision. */
export function defaultHgLinkContent(): HgLinkContent {
  return {
    version: HG_LINK_CONTENT_VERSION,
    wordmark: 'Harvest Generation',
    title: 'HG Links',
    description: '',
    accent: 'navy',
    layout: 'grid',
    heroImageUrl: null,
    cards: [
      { id: 'drip-and-brew', title: 'Drip & Brew', description: '', icon: 'none', theme: 'sky', buttonLabel: '', visible: true, destination: { type: 'external', url: 'https://dripnbrew.harvestgen.org/' } },
      { id: 'new-to-church', title: 'I’m New To Church!', description: '', icon: 'none', theme: 'sand', buttonLabel: '', visible: true, destination: { type: 'form', formSlug: 'new-to-church' } },
      { id: 'became-a-christian', title: 'I Just Became A Christian', description: '', icon: 'none', theme: 'wheat', buttonLabel: '', visible: true, destination: { type: 'form', formSlug: 'became-a-christian' } },
      { id: 'water-baptism', title: 'I Want To Be Water Baptised', description: '', icon: 'none', theme: 'lavender', buttonLabel: '', visible: true, destination: { type: 'form', formSlug: 'water-baptism' } },
      { id: 'serve', title: 'I Want To Serve', description: '', icon: 'none', theme: 'navy', buttonLabel: '', visible: true, destination: { type: 'form', formSlug: 'serve' } },
      { id: 'kids-gen', title: 'Kids Gen', description: '', icon: 'none', theme: 'blush', buttonLabel: '', visible: true, destination: { type: 'external', url: 'https://harvestgen.framer.website/visit#kidsgen' } },
      { id: 'more-on-harvestgen', title: 'More on HarvestGen', description: '', icon: 'none', theme: 'mist', buttonLabel: '', visible: true, destination: { type: 'external', url: 'https://harvestgen.framer.website/' } },
    ],
  };
}
