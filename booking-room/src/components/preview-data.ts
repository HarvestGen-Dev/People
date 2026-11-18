export const rooms = ['Foyer room', 'Hall room', 'KidsGen room', 'Hospitality room'];

export type Reservation = {
  id: string;
  occurrenceId: string;
  room: string;
  event: string;
  start: string;
  end: string;
  allDay: boolean;
  contact: string;
  phone: string;
  email: string;
  purpose: string;
  cancelled: boolean;
  published: boolean;
};

// These strings represent Kuala Lumpur wall-clock times throughout the preview.
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function examples(day: string): Reservation[] {
  return [
    ['Welcome team briefing', 'Foyer room', '09:00', '10:00'],
    ['Worship rehearsal', 'Hall room', '09:00', '11:30'],
    ['KidsGen setup', 'KidsGen room', '13:00', '14:30'],
  ].map(([event, room, start, end], index) => ({
    id: 'example-' + index, occurrenceId: 'example-' + index, event, room, start: day + 'T' + start, end: day + 'T' + end,
    allDay: false, contact: 'Alex Lee', phone: '+60 12 000 0000',
    email: 'alex@example.com', purpose: 'Volunteer preparation', cancelled: false, published: index === 1,
  }));
}

export function intersects(item: Reservation, day: string) {
  return item.start < addDays(day, 1) + 'T00:00' && item.end > day + 'T00:00';
}

export function timeLabel(item: Reservation) {
  return item.allDay ? 'All day' : item.start.slice(11) + '–' + item.end.slice(11);
}

export function timestamp(value: string) {
  return new Date(value + 'Z').getTime();
}

export function wallTime(value: number) {
  return new Date(value).toISOString().slice(0, 16);
}

export function calendarGroups(items: Reservation[]) {
  const groups = new Map<string, Reservation[]>();
  for (const item of items) {
    const key = JSON.stringify([item.occurrenceId, item.event, item.start, item.end]);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
