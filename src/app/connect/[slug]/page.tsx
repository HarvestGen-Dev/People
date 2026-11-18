// <!-- AGENT: FRONTEND -->
// Legacy slug-only URL. Resolves only when the slug is unique across churches.
import { notFound } from 'next/navigation';
import { ConnectFormShell } from '@/components/connect-forms/ConnectFormShell';
import { resolveLegacyConnectForm } from '@/lib/connectFormResolver';

export const dynamic = 'force-dynamic';

export default async function LegacyConnectFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await resolveLegacyConnectForm(slug);
  if (!form) notFound();
  return (
    <ConnectFormShell
      form={form}
      submitPath={`/api/public/connect-forms/${encodeURIComponent(form.slug)}/submit`}
    />
  );
}
