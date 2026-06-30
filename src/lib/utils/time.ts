export function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffInMs = d.getTime() - now.getTime();
  const diffInSec = Math.round(diffInMs / 1000);
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  const absDiff = Math.abs(diffInSec);
  
  if (absDiff < 60) return rtf.format(diffInSec, 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffInSec / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffInSec / 3600), 'hour');
  if (absDiff < 2592000) return rtf.format(Math.round(diffInSec / 86400), 'day');
  if (absDiff < 31536000) return rtf.format(Math.round(diffInSec / 2592000), 'month');
  
  return rtf.format(Math.round(diffInSec / 31536000), 'year');
}
