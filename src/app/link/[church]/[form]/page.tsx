// <!-- AGENT: FRONTEND -->
// /link/<church-slug>/<form-slug>: a published HG Link form, resolved within its tenant.
import { notFound, redirect } from 'next/navigation';
import { HgLinkFormPage } from '@/components/hg-link/HgLinkFormPage';
import { resolveConnectForm } from '@/lib/connectFormResolver';
import { resolveFormOptions } from '@/lib/hg-link/formOptions';

export const dynamic = 'force-dynamic';

export default async function HgLinkFormRoute({ params }: { params: Promise<{ church: string; form: string }> }) {
  const { church, form: formSlug } = await params;
  const form = await resolveConnectForm(church, formSlug);
  if (!form) notFound();
  // Forms without a stored definition are legacy fixed-field connect forms.
  if (!form.definition) redirect(`/connect/${encodeURIComponent(church)}/${encodeURIComponent(form.slug)}`);

  const options = await resolveFormOptions(form.churchId, form.definition);
  return (
    <HgLinkFormPage
      title={form.title}
      description={form.description}
      definition={form.definition}
      options={options}
      backHref={`/link/${church}`}
      submitPath={`/api/public/connect-forms/${encodeURIComponent(church)}/${encodeURIComponent(form.slug)}/submit`}
    />
  );
}
