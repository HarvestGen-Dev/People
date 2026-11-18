// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantContextError, requireTenantContext } from '@/lib/tenant-context';
import { defaultFormSeeds } from '@/lib/hg-link/formSchema';
import { HgLinkTabs } from '../HgLinkTabs';
import { CreateStandardForms } from './CreateStandardForms';

export const metadata = { title: 'HG Link forms | Settings' };
export const dynamic = 'force-dynamic';

export default async function HgLinkFormsPage() {
  let churchId: string;
  try {
    ({ churchId } = await requireTenantContext({ requireManager: true }));
  } catch (error) {
    if (error instanceof TenantContextError && error.status === 403) redirect('/settings/hg-link/submissions');
    throw error;
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('connect_forms')
    .select('id, slug, title, is_active, definition, draft_definition, definition_version')
    .eq('church_id', churchId)
    .order('title');
  const forms = data ?? [];
  const existing = new Set(forms.map((f) => f.slug as string));
  const missing = defaultFormSeeds().filter((s) => !existing.has(s.slug)).length;

  return (
    <>
      <Topbar title="HG Link forms" />
      <div className="mx-auto max-w-4xl p-5 sm:p-8">
        <HgLinkTabs active="forms" showEditorTabs />
        {missing > 0 && <CreateStandardForms missing={missing} />}
        {forms.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No forms yet.</p>
        ) : (
          <ul className="space-y-2">
            {forms.map((form) => (
              <li key={form.id as string}>
                <Link href={`/settings/hg-link/forms/${form.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card p-4 hover:border-primary">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{form.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      /{form.slug as string}
                      {!form.definition && ' · uses the original fixed fields'}
                      {form.draft_definition ? ' · unpublished draft' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">{form.is_active ? 'Active' : 'Inactive'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
