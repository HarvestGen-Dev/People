import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { CalendarPreview } from '../../../../../booking-room/src/components/CalendarPreview';
import '../../../../../booking-room/src/components/calendar.css';
import '../../../(admin)/workspace.css';

export default function OfficePreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <AdminShell userEmail="Fictional preview" role="owner" isPlatformAdmin={false}>
      <CalendarPreview office />
    </AdminShell>
  );
}
