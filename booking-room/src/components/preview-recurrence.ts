export type Frequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'annual';

type Rule = {
  frequency: Frequency;
  interval: number;
  weekdays: number[];
  lastStart?: string;
};

const dayMs = 86_400_000;

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function cutoffDate(today: string) {
  const date = new Date(today + 'T00:00:00Z');
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return dayString(date);
}

export function occurrenceDates(start: string, cutoff: string, rule: Rule) {
  if (rule.frequency === 'none') return [start];
  const dates = [];
  const first = new Date(start + 'T00:00:00Z');
  const firstWeekday = (first.getUTCDay() + 6) % 7;
  const last = new Date([cutoff, rule.lastStart ?? cutoff].sort()[0] + 'T00:00:00Z');
  for (let candidate = first.getTime(); candidate <= last.getTime(); candidate += dayMs) {
    const date = new Date(candidate);
    const elapsed = (candidate - first.getTime()) / dayMs;
    const years = date.getUTCFullYear() - first.getUTCFullYear();
    const months = 12 * years + date.getUTCMonth() - first.getUTCMonth();
    switch (rule.frequency) {
      case 'daily':
        if (elapsed % rule.interval !== 0) continue;
        break;
      case 'weekly':
        if (Math.floor((elapsed + firstWeekday) / 7) % rule.interval !== 0
          || !rule.weekdays.includes(date.getUTCDay())) continue;
        break;
      case 'monthly':
        if (months % rule.interval !== 0 || date.getUTCDate() !== first.getUTCDate()) continue;
        break;
      case 'annual':
        if (years % rule.interval !== 0 || date.getUTCMonth() !== first.getUTCMonth()
          || date.getUTCDate() !== first.getUTCDate()) continue;
        break;
    }
    dates.push(dayString(date));
  }
  return dates;
}
