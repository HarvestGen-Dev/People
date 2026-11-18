// <!-- AGENT: FRONTEND -->
// One renderer for the public page AND the admin preview, so what an
// administrator previews is exactly what visitors get.
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HgLinkCard, HgLinkContent } from '@/lib/hg-link/contentSchema';
import { cn } from '@/lib/utils';
import { bricolage, inter } from './fonts';
import { ACCENT_STYLES, CARD_THEME_STYLES, ICON_COMPONENTS } from './theme';

interface HgLinkHomeProps {
  content: HgLinkContent;
  /** Builds the URL for an internal form card. */
  formHref: (formSlug: string) => string;
  /** In preview, cards are inert so editing never navigates away. */
  preview?: boolean;
  /** Preview-only: render at phone width regardless of the browser window. */
  compact?: boolean;
}

export function HgLinkHome({ content, formHref, preview = false, compact = false }: HgLinkHomeProps) {
  const accent = ACCENT_STYLES[content.accent];
  const cards = content.cards.filter((card) => card.visible);
  const list = content.layout === 'list' || compact;

  return (
    <div className={cn(bricolage.variable, inter.variable, 'min-h-full bg-[#fdf6ef] font-[family-name:var(--font-hg-body)] text-[#3a3a3a]')}>
      <main id="hg-link-main" className={cn('mx-auto w-[min(100%-2rem,64rem)] py-4 sm:py-8', !compact && 'sm:w-[min(100%-5rem,64rem)]')}>
        <header className={cn('relative isolate flex min-h-44 items-center overflow-hidden rounded-3xl p-6 text-[#fdf6ef] sm:min-h-60 sm:p-12', accent.banner)}>
          <span aria-hidden="true" className={cn('absolute -right-[11%] -top-[58%] -z-10 h-[135%] w-1/2 rounded-full', accent.circleA)} />
          <span aria-hidden="true" className={cn('absolute -bottom-[65%] -right-[8%] -z-10 h-[125%] w-2/5 rounded-full', accent.circleB)} />
          <div className="relative min-w-0">
            <p className="mb-2 text-sm font-bold">{content.wordmark}</p>
            <h1 className="font-[family-name:var(--font-hg-display)] text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-balance sm:text-7xl">
              {content.title}
            </h1>
            {content.description && (
              <p className="mt-3 max-w-xl text-base leading-6 text-[#fdf6ef]/90">{content.description}</p>
            )}
          </div>
        </header>

        {content.heroImageUrl && (
          <Image
            src={content.heroImageUrl}
            alt=""
            width={1024}
            height={480}
            unoptimized
            className="mt-3.5 h-auto max-h-72 w-full rounded-3xl object-cover"
          />
        )}

        {cards.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white/60 p-6 text-center text-[#625a53]">
            There are no links to show yet.
          </p>
        ) : (
          <section
            aria-label="Ways to connect"
            className={cn('mt-3.5 grid gap-3.5', list ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}
          >
            {cards.map((card) => (
              <CardLink key={card.id} card={card} accentDark={accent.dark} preview={preview} formHref={formHref} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function CardLink({ card, accentDark, preview, formHref }: { card: HgLinkCard; accentDark: string; preview: boolean; formHref: (slug: string) => string }) {
  const theme = CARD_THEME_STYLES[card.theme];
  const external = card.destination.type === 'external';
  const Icon = card.icon === 'none' ? null : ICON_COMPONENTS[card.icon];
  const className = cn(
    'flex min-h-[4.75rem] items-center justify-between gap-3 rounded-[1.15rem] p-4 no-underline sm:min-h-26 sm:p-5',
    card.theme === 'navy' ? accentDark : theme.card,
    theme.text,
    !preview && 'transition-shadow hover:shadow-[0_6px_14px_#3a3a3a20] focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#344f66]'
  );

  const body: ReactNode = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {Icon && <Icon aria-hidden="true" className="size-6 shrink-0" />}
        <span className="min-w-0">
          <span className="block font-[family-name:var(--font-hg-display)] text-xl font-semibold leading-[1.1] tracking-[-0.025em] text-balance sm:text-2xl">
            {card.title}
          </span>
          {card.description && <span className="mt-1 block text-sm leading-5 opacity-85">{card.description}</span>}
          {card.buttonLabel && <span className="mt-2 inline-block rounded-full bg-white/50 px-3 py-1 text-sm font-semibold">{card.buttonLabel}</span>}
        </span>
      </span>
      <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full text-xl', theme.arrow)}>
        {external ? '↗' : '→'}
      </span>
    </>
  );

  if (preview) return <div className={className}>{body}</div>;
  if (card.destination.type === 'external') {
    return (
      <a className={className} href={card.destination.url} rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  return <Link className={className} href={formHref(card.destination.formSlug)}>{body}</Link>;
}
