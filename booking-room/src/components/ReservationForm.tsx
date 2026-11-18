'use client';

import { useState, type FormEvent } from 'react';
import { addDays, localToday, rooms, timestamp, wallTime, type Reservation } from './preview-data';
import { cutoffDate, occurrenceDates, type Frequency } from './preview-recurrence';

export type Selection = { day: string; room?: string; start?: string; end?: string; reservation?: Reservation; group?: Reservation[] };

export function ReservationForm({ selection, save }: {
  selection: Selection;
  save: (items: Reservation[]) => string | undefined;
}) {
  const editing = selection.reservation;
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [whole, setWhole] = useState(false);
  const [error, setError] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('none');
  const today = localToday();
  const cutoff = cutoffDate(today);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    const selected = whole ? rooms : data.getAll('room').map(String);
    const start = value('startDate') + 'T' + (allDay ? '00:00' : value('startTime'));
    const end = allDay
      ? addDays(value('endDate'), 1) + 'T00:00'
      : value('endDate') + 'T' + value('endTime');
    if (!selected.length || end <= start || (allDay && value('endDate') < value('startDate'))) {
      return setError('Select at least one room and enter a valid date and time range.');
    }
    if (!value('event') || !value('contact') || !value('phone') || !value('purpose')) {
      return setError('Fill in all required details.');
    }
    const interval = Number(value('interval'));
    const lastStart = value('lastStart');
    const weekdays = data.getAll('weekday').map(Number);
    if (!editing && value('startDate') < today) return setError('Select today or a future date.');
    if (!editing && (value('startDate') > cutoff || value('endDate') > cutoff)) {
      return setError('Reservations can be made up to ' + cutoff + '.');
    }
    if (!editing && frequency !== 'none' && (
      !Number.isInteger(interval) || interval < 1 || interval > 52
      || (lastStart && lastStart < value('startDate'))
      || (frequency === 'weekly' && weekdays.length === 0)
    )) {
      return setError('Enter a valid recurrence interval, weekday selection and optional last start.');
    }
    const details = {
      event: value('event'), contact: value('contact'), phone: value('phone'),
      email: value('email'), purpose: value('purpose'), cancelled: false,
    };
    if (editing && selection.group) {
      const shift = timestamp(start) - timestamp(editing.start);
      const duration = timestamp(end) - timestamp(start);
      const incoming = selection.group.filter((item) => selected.includes(item.id)).map((item) => {
        const shiftedStart = timestamp(item.start) + shift;
        if (allDay && wallTime(shiftedStart).slice(11) !== '00:00') return null;
        return { ...item, ...details, allDay, start: wallTime(shiftedStart), end: wallTime(shiftedStart + duration) };
      });
      if (incoming.some((item) => item === null)) {
        return setError('An all-day edit requires all selected rooms to begin at midnight after the shift.');
      }
      return setError(save(incoming.filter((item) => item !== null)) ?? '');
    }
    const duration = timestamp(end) - timestamp(start);
    const starts = editing ? [start.slice(0, 10)] : occurrenceDates(start.slice(0, 10), cutoff, {
      frequency, interval, weekdays, lastStart,
    });
    const incoming = starts.flatMap((day) => {
      const occurrenceId = editing?.occurrenceId ?? crypto.randomUUID();
      const occurrenceStart = day + start.slice(10);
      const occurrenceEnd = wallTime(timestamp(occurrenceStart) + duration);
      const inclusiveEnd = allDay ? addDays(occurrenceEnd.slice(0, 10), -1) : occurrenceEnd.slice(0, 10);
      if (!editing && inclusiveEnd > cutoff) return [];
      return selected.map((room) => ({
        id: editing?.id ?? crypto.randomUUID(), occurrenceId, room, start: occurrenceStart,
        end: occurrenceEnd, allDay, ...details, published: editing?.published ?? false,
      }));
    });
    if (!incoming.length) return setError('No occurrences fit within the selected dates and booking window.');
    setError(save(incoming) ?? '');
  }

  return (
    <form className="calendar-form" onSubmit={submit}>
      <label>Event name<input name="event" required defaultValue={editing?.event} /></label>
      <fieldset>
        <legend>Rooms</legend>
        {!editing && <label><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Whole church</label>}
        {selection.group ? selection.group.map((item) => (
          <label key={item.id}><input type="checkbox" name="room" value={item.id} defaultChecked /> {item.room} · {item.start.replace('T', ' ')}</label>
        )) : rooms.map((room) => (
          <label key={room}><input type={editing ? 'radio' : 'checkbox'} name="room" value={room}
            disabled={whole} defaultChecked={room === (editing?.room ?? selection.room)} /> {room}</label>
        ))}
      </fieldset>
      <label><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day</label>
      <div className="calendar-fields">
        <label>Start date<input type="date" name="startDate" required defaultValue={editing?.start.slice(0, 10) ?? selection.day} /></label>
        <label>End date<input type="date" name="endDate" required defaultValue={editing
          ? addDays(editing.end.slice(0, 10), editing.allDay ? -1 : 0)
          : addDays(selection.day, !allDay && selection.end === '00:00' ? 1 : 0)} /></label>
        {!allDay && <>
          <label>Start time<input type="time" name="startTime" required defaultValue={editing?.start.slice(11) ?? selection.start ?? '09:00'} /></label>
          <label>End time<input type="time" name="endTime" required defaultValue={editing?.end.slice(11) ?? selection.end ?? '10:00'} /></label>
        </>}
        <label>Contact person<input name="contact" required defaultValue={editing?.contact} /></label>
        <label>Phone<input name="phone" type="tel" required defaultValue={editing?.phone} /></label>
        <label>Email<input name="email" type="email" required defaultValue={editing?.email} /></label>
      </div>
      {!editing && <fieldset>
        <legend>Recurrence</legend>
        <label>Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
          <option value="none">Does not repeat</option><option value="daily">Daily</option>
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select></label>
        {frequency !== 'none' && <>
          <div className="calendar-fields">
            <label>Repeat every<input type="number" name="interval" min="1" max="52" defaultValue="1" required /></label>
            <label>Last start date (optional)<input type="date" name="lastStart" /></label>
          </div>
          {frequency === 'weekly' && <fieldset>
            <legend>Days of the week</legend>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name, index) => (
              <label key={name}><input type="checkbox" name="weekday" value={(index + 1) % 7} /> {name}</label>
            ))}
          </fieldset>}
          <p>Leave the last start date blank for an ongoing series. This preview shows occurrences within the next 12 months.</p>
        </>}
      </fieldset>}
      <label>Purpose<input name="purpose" required defaultValue={editing?.purpose} /></label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="calendar-primary">Save preview reservation</button>
    </form>
  );
}
