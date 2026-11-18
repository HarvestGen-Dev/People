'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HgLinkHome } from '@/components/hg-link/HgLinkHome';
import type { HgLinkContent } from '@/lib/hg-link/contentSchema';
import { cn } from '@/lib/utils';

export function PreviewPane({ content }: { content: HgLinkContent }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  return (
    <section aria-labelledby="preview-heading" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="preview-heading" className="text-base font-semibold">Preview (unsaved changes included)</h2>
        <div role="group" aria-label="Preview size" className="flex gap-1">
          <Button size="sm" variant={device === 'desktop' ? 'default' : 'outline'} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor /> Desktop</Button>
          <Button size="sm" variant={device === 'mobile' ? 'default' : 'outline'} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone /> Mobile</Button>
        </div>
      </div>
      <div
        className={cn(
          'max-h-[75vh] overflow-auto rounded-2xl border bg-[#fdf6ef] shadow-sm',
          device === 'mobile' && 'mx-auto w-[390px] max-w-full'
        )}
      >
        <HgLinkHome content={content} formHref={() => '#'} preview compact={device === 'mobile'} />
      </div>
    </section>
  );
}
