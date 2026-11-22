// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'page', label: 'Page', href: '/settings/hg-link' },
  { key: 'forms', label: 'Forms', href: '/settings/hg-link/forms' },
  { key: 'submissions', label: 'Submissions', href: '/settings/hg-link/submissions' },
] as const;

interface HgLinkTabsProps {
  active: (typeof TABS)[number]['key'];
  /** Hide tabs the current role cannot open. */
  showEditorTabs: boolean;
}

export function HgLinkTabs({ active, showEditorTabs }: HgLinkTabsProps) {
  const tabs = showEditorTabs ? TABS : TABS.filter((t) => t.key === 'submissions');
  return (
    <nav aria-label="HG Links" className="mb-5 flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
            tab.key === active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-primary'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
