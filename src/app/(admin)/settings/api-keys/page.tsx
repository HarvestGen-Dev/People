import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { ApiKeysManager } from '@/components/settings/ApiKeysManager';

export const metadata = {
  title: 'API Keys | Settings',
};

export default async function ApiKeysSettingsPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const churchSlug = user?.user_metadata?.church_slug || 'harvestgen';

  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('slug', churchSlug)
    .single();

  const churchId = church?.id;

  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  return (
    <>
      <Topbar title="API keys" />
      <div className="p-8 max-w-5xl animate-in fade-in-50 duration-300">
        <ApiKeysManager initialKeys={apiKeys || []} churchId={churchId} />
      </div>
    </>
  );
}
