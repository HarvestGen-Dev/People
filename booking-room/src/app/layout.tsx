import type { ReactNode } from 'react';
import '../components/calendar.css';

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en-MY"><body className="booking-page">{children}</body></html>;
}
