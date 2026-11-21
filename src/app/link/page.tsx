// <!-- AGENT: FRONTEND -->
// /link: the HG Link home for the church named by HG_LINK_CHURCH_SLUG.
import { notFound } from 'next/navigation';
import { HgLinkHome } from '@/components/hg-link/HgLinkHome';
import { defaultChurchSlug, loadPublishedContent, resolveChurchBySlug } from '@/lib/hg-link/content';

export const dynamic = 'force-dynamic';

export default async function HgLinkDefaultPage() {
  const slug = defaultChurchSlug();
  if (!slug) notFound();
  const church = await resolveChurchBySlug(slug);
  if (!church) notFound();
  const content = await loadPublishedContent(church.id);
  return <HgLinkHome content={content} formHref={(form) => `/link/${church.slug}/${form}`} />;
}
