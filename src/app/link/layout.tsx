// <!-- AGENT: FRONTEND -->
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'HG Link · HarvestGen',
  description: 'Ways to connect with Harvest Generation Church.',
};

export default function HgLinkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#hg-link-main"
        className="fixed left-2 top-2 z-50 -translate-y-[200%] rounded bg-[#fdf6ef] p-2.5 text-[#3a3a3a] focus:translate-y-0"
      >
        Skip to content
      </a>
      {children}
    </>
  );
}
