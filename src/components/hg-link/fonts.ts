// <!-- AGENT: FRONTEND -->
// Self-hosted HG Link fonts (licences alongside the files in ./fonts).
import localFont from 'next/font/local';

export const bricolage = localFont({
  src: './fonts/bricolage-grotesque-latin.woff2',
  variable: '--font-hg-display',
  weight: '200 800',
  display: 'swap',
});

export const inter = localFont({
  src: './fonts/inter-latin.woff2',
  variable: '--font-hg-body',
  weight: '100 900',
  display: 'swap',
});
