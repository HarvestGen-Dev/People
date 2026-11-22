// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import type { FormDefinition, ResolvedOptions } from '@/lib/hg-link/formSchema';
import { cn } from '@/lib/utils';
import { HgLinkForm } from './HgLinkForm';
import { bricolage, inter } from './fonts';

interface HgLinkFormPageProps {
  title: string;
  description?: string | null;
  definition: FormDefinition;
  options: ResolvedOptions;
  backHref: string;
  submitPath?: string;
  preview?: boolean;
}

export function HgLinkFormPage({ title, description, definition, options, backHref, submitPath, preview = false }: HgLinkFormPageProps) {
  return (
    <div className={cn(bricolage.variable, inter.variable, 'min-h-full bg-[#fdf6ef] font-[family-name:var(--font-hg-body)] text-[#3a3a3a]')}>
      <main id="hg-link-main" className="mx-auto w-[min(100%-2rem,43rem)] py-4 sm:py-10">
        {preview ? (
          <span className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-wide">← HG Links</span>
        ) : (
          <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-wide underline-offset-4 hover:underline">
            ← HG Links
          </Link>
        )}
        <h1 className="mb-2 mt-3 font-[family-name:var(--font-hg-display)] text-4xl font-semibold leading-[1.06] tracking-[-0.05em] text-balance sm:text-6xl">
          {title}
        </h1>
        {description && <p className="mb-5 text-[#625a53]">{description}</p>}
        <div className="mt-5">
          <HgLinkForm definition={definition} options={options} submitPath={submitPath} preview={preview} />
        </div>
      </main>
    </div>
  );
}
