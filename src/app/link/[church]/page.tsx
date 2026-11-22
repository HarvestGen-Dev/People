// <!-- AGENT: FRONTEND -->
// /link/<church-slug>: published HG Link for exactly that church.
import { notFound } from 'next/navigation';
import { HgLinkHome } from '@/components/hg-link/HgLinkHome';
import { loadPublishedContent, resolveChurchBySlug } from '@/lib/hg-link/content';

export const dynamic = 'force-dynamic';

export default async function HgLinkChurchPage({ params }: { params: Promise<{ church: string }> }) {
  const { church: churchSlug } = await params;
  const church = await resolveChurchBySlug(churchSlug);
  if (!church) notFound();
  const content = await loadPublishedContent(church.id);
  return <HgLinkHome content={content} formHref={(form) => `/link/${church.slug}/${form}`} />;
}
