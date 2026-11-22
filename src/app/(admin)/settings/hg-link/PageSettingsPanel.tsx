'use client';

// <!-- AGENT: FRONTEND -->
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ACCENTS, LAYOUTS, type HgLinkContent } from '@/lib/hg-link/contentSchema';
import { ACCENT_STYLES } from '@/components/hg-link/theme';
import { cn } from '@/lib/utils';

interface PageSettingsPanelProps {
  content: HgLinkContent;
  onChange: (next: HgLinkContent) => void;
}

export function PageSettingsPanel({ content, onChange }: PageSettingsPanelProps) {
  const patch = (partial: Partial<HgLinkContent>) => onChange({ ...content, ...partial });
  return (
    <section aria-labelledby="page-settings-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <h2 id="page-settings-heading" className="text-base font-semibold">Page text and look</h2>
      <div className="space-y-1.5">
        <Label htmlFor="hg-title">Page title</Label>
        <Input id="hg-title" value={content.title} maxLength={80} onChange={(e) => patch({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hg-wordmark">Welcome text above the title</Label>
        <Input id="hg-wordmark" value={content.wordmark} maxLength={60} onChange={(e) => patch({ wordmark: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hg-description">Introduction (optional)</Label>
        <Textarea id="hg-description" value={content.description} maxLength={300} rows={3} onChange={(e) => patch({ description: e.target.value })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Accent colour</legend>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((accent) => (
            <label key={accent} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm', content.accent === accent && 'border-primary ring-2 ring-primary/30')}>
              <input type="radio" name="accent" className="sr-only" checked={content.accent === accent} onChange={() => patch({ accent })} />
              <span aria-hidden="true" className={cn('size-4 rounded-full', ACCENT_STYLES[accent].swatch)} />
              {ACCENT_STYLES[accent].label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Layout</legend>
        <div className="flex gap-2">
          {LAYOUTS.map((layout) => (
            <label key={layout} className={cn('flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm', content.layout === layout && 'border-primary ring-2 ring-primary/30')}>
              <input type="radio" name="layout" className="sr-only" checked={content.layout === layout} onChange={() => patch({ layout })} />
              {layout === 'grid' ? 'Grid of cards' : 'Single column'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="hg-hero">Banner image address (optional)</Label>
        <Input id="hg-hero" type="url" inputMode="url" placeholder="https://" value={content.heroImageUrl ?? ''}
          onChange={(e) => patch({ heroImageUrl: e.target.value.trim() === '' ? null : e.target.value })} />
        <p className="text-xs text-muted-foreground">Must start with https://</p>
      </div>
    </section>
  );
}
