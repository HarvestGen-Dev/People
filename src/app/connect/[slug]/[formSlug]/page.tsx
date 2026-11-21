// <!-- AGENT: FRONTEND -->
// Tenant-scoped URL: /connect/<church-slug>/<form-slug>
import { notFound } from 'next/navigation';
import { ConnectFormShell } from '@/components/connect-forms/ConnectFormShell';
import { resolveConnectForm } from '@/lib/connectFormResolver';

export const dynamic = 'force-dynamic';

export default async function ConnectFormPage({
  params,
}: {
  params: Promise<{ slug: string; formSlug: string }>;
}) {
  const { slug: churchSlug, formSlug } = await params;
  const form = await resolveConnectForm(churchSlug, formSlug);
  if (!form) notFound();
  return (
    <ConnectFormShell
      form={form}
      submitPath={`/api/public/connect-forms/${encodeURIComponent(churchSlug)}/${encodeURIComponent(form.slug)}/submit`}
    />
  );
}
