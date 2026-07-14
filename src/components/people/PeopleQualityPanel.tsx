// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  ImageOff,
  MailX,
  MapPinOff,
  PhoneOff,
  TriangleAlert,
} from 'lucide-react';
import type { PeopleQualityMetrics } from '@/lib/queries/people';

type QualityItem = {
  key: keyof PeopleQualityMetrics;
  filter: string;
  label: string;
  detail: string;
  tone: string;
  icon: typeof TriangleAlert;
};

const qualityItems: QualityItem[] = [
  {
    key: 'missingContact',
    filter: 'missing_contact',
    label: 'No contact',
    detail: 'Email and phone missing',
    tone: 'bg-red-100 text-red-700',
    icon: TriangleAlert,
  },
  {
    key: 'missingEmail',
    filter: 'missing_email',
    label: 'No email',
    detail: 'Cannot receive email',
    tone: 'bg-amber-100 text-amber-700',
    icon: MailX,
  },
  {
    key: 'missingPhone',
    filter: 'missing_phone',
    label: 'No phone',
    detail: 'Harder to follow up',
    tone: 'bg-sky-100 text-sky-700',
    icon: PhoneOff,
  },
  {
    key: 'missingCampus',
    filter: 'missing_campus',
    label: 'No campus',
    detail: 'Reporting gap',
    tone: 'bg-violet-100 text-violet-700',
    icon: MapPinOff,
  },
  {
    key: 'missingPhoto',
    filter: 'missing_photo',
    label: 'No photo',
    detail: 'Profile incomplete',
    tone: 'bg-slate-100 text-slate-700',
    icon: ImageOff,
  },
];

interface PeopleQualityPanelProps {
  metrics: PeopleQualityMetrics;
  currentQuality?: string;
}

function qualityHref(filter: string) {
  const params = new URLSearchParams({ quality: filter });
  return `/people?${params.toString()}`;
}

export function PeopleQualityPanel({
  metrics,
  currentQuality,
}: PeopleQualityPanelProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {qualityItems.map((item) => {
        const Icon = item.icon;
        const count = metrics[item.key];
        const isActive = currentQuality === item.filter;

        return (
          <Link
            key={item.filter}
            href={qualityHref(item.filter)}
            className={`group rounded-2xl border bg-white p-4 transition-all hover:border-emerald-200 hover:shadow-sm ${
              isActive
                ? 'border-emerald-300 ring-2 ring-emerald-100'
                : 'border-slate-200/80'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
              </div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold tracking-tight text-slate-950">
                {count.toLocaleString()}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 transition-colors group-hover:text-emerald-600">
                Review
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
