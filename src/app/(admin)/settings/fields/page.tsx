// <!-- AGENT: FRONTEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { FieldsManager } from '@/components/settings/FieldsManager';
import { requireTenantContext } from '@/lib/tenant-context';

export const metadata = {
  title: 'Custom Fields | Settings',
};

export default async function FieldsSettingsPage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();

  const { data: fields } = await supabase
    .from('field_definitions')
    .select('*')
    .eq('church_id', churchId)
    .order('position');

  return (
    <>
      <Topbar title="Custom fields" />
      <div className="mx-auto max-w-5xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <FieldsManager initialFields={fields || []} />
      </div>
    </>
  );
}
// <!-- AGENT: FRONTEND -->
