'use client';

// <!-- AGENT: FRONTEND -->
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CARD_THEMES, ICONS, type HgLinkCard } from '@/lib/hg-link/contentSchema';
import { normalizeSafeExternalUrl } from '@/lib/hg-link/safeUrl';
import { CARD_THEME_STYLES, ICON_LABELS } from '@/components/hg-link/theme';

const selectClass = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';

interface CardEditorProps {
  card: HgLinkCard;
  forms: { slug: string; title: string }[];
  onChange: (card: HgLinkCard) => void;
}

export function CardEditor({ card, forms, onChange }: CardEditorProps) {
  const id = (name: string) => `${card.id}-${name}`;
  const patch = (partial: Partial<HgLinkCard>) => onChange({ ...card, ...partial });
  const destination = card.destination;
  const urlInvalid = destination.type === 'external' && normalizeSafeExternalUrl(destination.url) === null;

  return (
    <div className="space-y-3 border-t bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label htmlFor={id('title')}>Title</Label>
        <Input id={id('title')} value={card.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('description')}>Short description (optional)</Label>
        <Input id={id('description')} value={card.description} maxLength={200} onChange={(e) => patch({ description: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('button')}>Button label (optional)</Label>
        <Input id={id('button')} value={card.buttonLabel} maxLength={40} onChange={(e) => patch({ buttonLabel: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={id('icon')}>Icon</Label>
          <select id={id('icon')} className={selectClass} value={card.icon} onChange={(e) => patch({ icon: e.target.value as HgLinkCard['icon'] })}>
            {ICONS.map((icon) => <option key={icon} value={icon}>{ICON_LABELS[icon]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id('theme')}>Card colour</Label>
          <select id={id('theme')} className={selectClass} value={card.theme} onChange={(e) => patch({ theme: e.target.value as HgLinkCard['theme'] })}>
            {CARD_THEMES.map((theme) => <option key={theme} value={theme}>{CARD_THEME_STYLES[theme].label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('dest-type')}>Opens</Label>
        <select
          id={id('dest-type')}
          className={selectClass}
          value={destination.type}
          onChange={(e) =>
            patch({
              destination: e.target.value === 'form'
                ? { type: 'form', formSlug: forms[0]?.slug ?? '' }
                : { type: 'external', url: 'https://' },
            })
          }
        >
          <option value="form" disabled={forms.length === 0}>A form on this site</option>
          <option value="external">An external website</option>
        </select>
      </div>
      {destination.type === 'form' ? (
        <div className="space-y-1.5">
          <Label htmlFor={id('form')}>Form</Label>
          <select id={id('form')} className={selectClass} value={destination.formSlug}
            onChange={(e) => patch({ destination: { type: 'form', formSlug: e.target.value } })}>
            {forms.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
            {!forms.some((f) => f.slug === destination.formSlug) && <option value={destination.formSlug}>{destination.formSlug || 'Choose a form'} (not found)</option>}
          </select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={id('url')}>Website address</Label>
          <Input id={id('url')} type="url" inputMode="url" value={destination.url} aria-invalid={urlInvalid}
            aria-describedby={urlInvalid ? id('url-error') : undefined}
            onChange={(e) => patch({ destination: { type: 'external', url: e.target.value } })} />
          {urlInvalid && <p id={id('url-error')} className="text-sm text-destructive">Use a public address that starts with https://</p>}
        </div>
      )}
    </div>
  );
}
