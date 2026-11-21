// <!-- AGENT: FRONTEND -->
import { notFound, redirect } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { createServiceClient } from '@/lib/supabase/server';
import { TenantContextError, requireTenantContext } from '@/lib/tenant-context';
import { formDefinitionSchema } from '@/lib/hg-link/formSchema';
import { HgLinkTabs } from '../../HgLinkTabs';
import { FormBuilder } from './FormBuilder';

export const metadata = { title: 'Edit form | HG Link' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let churchId: string;
  try {
    ({ churchId } = await requireTenantContext({ requireManager: true }));
  } catch (error) {
    if (error instanceof TenantContextError && error.status === 403) redirect('/settings/hg-link/submissions');
    throw error;
  }

  const supabase = createServiceClient();
  const [{ data: form }, { data: tags }, { data: workflows }, { data: lists }] = await Promise.all([
    supabase.from('connect_forms').select('id, title, description, is_active, target_tag_id, target_workflow_id, notify_email, definition, draft_definition').eq('id', id).eq('church_id', churchId).maybeSingle(),
    supabase.from('tags').select('id, name').eq('church_id', churchId).order('name'),
    supabase.from('workflows').select('id, name').eq('church_id', churchId).order('name'),
    supabase.from('lists').select('id, name').eq('church_id', churchId).eq('type', 'static').order('name'),
  ]);
  if (!form) notFound();

  const source = form.draft_definition ?? form.definition;
  const parsed = source ? formDefinitionSchema.safeParse(source) : null;
  if (!parsed?.success) {
    return (
      <>
        <Topbar title={form.title as string} />
        <div className="mx-auto max-w-3xl p-5 sm:p-8">
          <HgLinkTabs active="forms" showEditorTabs />
          <p className="rounded-xl border bg-card p-6 text-sm">This form uses the original fixed fields and has no editable definition. Create the standard forms from the Forms tab to get editable versions.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={form.title as string} />
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <HgLinkTabs active="forms" showEditorTabs />
        <FormBuilder
          formId={id}
          hasDraft={Boolean(form.draft_definition)}
          initialDefinition={parsed.data}
          initialSettings={{
            title: form.title as string,
            description: (form.description as string | null) ?? '',
            isActive: Boolean(form.is_active),
            targetTagId: (form.target_tag_id as string | null) ?? '',
            targetWorkflowId: (form.target_workflow_id as string | null) ?? '',
            notifyEmail: (form.notify_email as string | null) ?? '',
          }}
          tags={(tags ?? []) as { id: string; name: string }[]}
          workflows={(workflows ?? []) as { id: string; name: string }[]}
          lists={(lists ?? []) as { id: string; name: string }[]}
        />
      </div>
    </>
  );
}
