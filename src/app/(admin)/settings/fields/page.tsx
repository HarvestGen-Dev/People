import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { FieldsManager } from '@/components/settings/FieldsManager';

export const metadata = {
  title: 'Custom Fields | Settings',
};

export default async function FieldsSettingsPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const churchSlug = user?.user_metadata?.church_slug || 'harvestgen';

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single();

  const churchId = church?.id;

  const { data: fields } = await supabase
    .from('field_definitions')
    .select('*')
    .eq('church_id', churchId)
    .order('position');

  return (
    <>
      <Topbar title="Custom fields" />
      <div className="p-8 max-w-4xl animate-in fade-in-50 duration-300">
        <FieldsManager initialFields={fields || []} churchId={churchId} />
      </div>
    </>
  );
}
