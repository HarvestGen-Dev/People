import { notFound } from 'next/navigation';
import { CalendarPreview } from '../../components/CalendarPreview';

export default function PreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main><CalendarPreview /></main>;
}
