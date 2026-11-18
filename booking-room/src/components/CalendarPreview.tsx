'use client';

// <!-- AGENT: FRONTEND -->
import { useEffect, useRef, useState } from 'react';
import { ReservationForm, type Selection } from './ReservationForm';
import { RoomGrid } from './RoomGrid';
import { addDays, calendarGroups, dateKey, examples, intersects, localToday, rooms, timeLabel, type Reservation } from './preview-data';

function changeMonth(day: string, offset: number) {
  const date = new Date(day.slice(0, 7) + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return dateKey(date);
}

export function CalendarPreview({ office = false }: { office?: boolean }) {
  const [day, setDay] = useState(localToday);
  const [items, setItems] = useState(() => examples(day));
  const [view, setView] = useState(office ? 'Internal Calendar' : 'Month');
  const [selection, setSelection] = useState<Selection>();
  const [selectedId, setSelectedId] = useState<string>();
  const [cancelRooms, setCancelRooms] = useState<string[]>();
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = items.find((item) => item.id === selectedId);
  const occurrence = selected && office
    ? items.filter((item) => item.occurrenceId === selected.occurrenceId && !item.cancelled)
    : [];
  const modal = Boolean(selection || selected);
  useEffect(() => {
    const element = dialog.current;
    if (modal && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [modal]);

  const views = office ? ['Internal Calendar', 'Public Calendar', 'Tables'] : ['Month', 'Rooms', 'My Bookings'];
  const visible = items.filter((item) => !item.cancelled && (view !== 'Public Calendar' || item.published));
  const first = changeMonth(day, 0);
  const monday = addDays(first, -((new Date(first + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => addDays(monday, index));
  const rows = items.filter((item) => (!room || item.room === room)
    && (!status || (status === 'Cancelled') === item.cancelled)
    && (!filterDay || intersects(item, filterDay))
    && [item.event, item.contact, item.email, item.purpose].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const visiblePage = Math.min(page, pageCount - 1);

  function close() {
    setSelection(undefined);
    setSelectedId(undefined);
    setCancelRooms(undefined);
  }

  function save(incoming: Reservation[]) {
    const untouched = items.filter((item) => !incoming.some((entry) => entry.id === item.id));
    if (incoming.some((entry, index) => [...untouched, ...incoming.slice(0, index)].some((existing) => !existing.cancelled
      && existing.room === entry.room && existing.start < entry.end && existing.end > entry.start))) {
      return 'At least one selected room is already booked for that time.';
    }
    setItems([...untouched, ...incoming]);
    close();
  }

  function modify(ids: string[], patch: Partial<Reservation>) {
    setItems(items.map((item) => ids.includes(item.id) ? { ...item, ...patch } : item));
    close();
  }

  const table = view === 'Tables' || view === 'My Bookings';
  return (
    <section className={'calendar-preview' + (office ? ' calendar-office' : '')}>
      <header>
        <h1>{office ? 'Event Calendar' : 'Booking Room'}</h1>
        <p>Development preview · Fictional reservations reset on reload.</p>
      </header>
      <nav className="calendar-controls" aria-label="Calendar views">
        {views.map((name) => <button key={name} aria-pressed={view === name} onClick={() => { setView(name); setPage(0); }}>{name}</button>)}
        <button className="calendar-primary" onClick={() => setSelection({ day })}>New booking</button>
      </nav>
      {table ? (
        <>
          <div className="calendar-controls" aria-label="Reservation filters">
            <input aria-label="Search reservations" placeholder="Search reservations" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            <select aria-label="Room" value={room} onChange={(e) => { setRoom(e.target.value); setPage(0); }}>
              <option value="">All rooms</option>{rooms.map((name) => <option key={name}>{name}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <option value="">All statuses</option><option>Confirmed</option><option>Cancelled</option>
            </select>
            <input type="date" aria-label="Filter by date" value={filterDay} onChange={(e) => { setFilterDay(e.target.value); setPage(0); }} />
            <button onClick={() => { setSearch(''); setRoom(''); setStatus(''); setFilterDay(''); setPage(0); }}>Clear filters</button>
          </div>
          <div className="calendar-scroll">
            <table className="reservation-table">
              <thead><tr>{['Event', 'Room', 'Start', 'End', 'Contact', 'Purpose', 'Status'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
              <tbody>{rows.slice(visiblePage * 10, visiblePage * 10 + 10).map((item) => (
                <tr key={item.id}>
                  <td><button onClick={() => setSelectedId(item.id)}>{item.event}</button></td>
                  <td>{item.room}</td><td>{item.start.replace('T', ' ')}</td><td>{item.end.replace('T', ' ')}</td>
                  <td>{item.contact}<br />{item.phone}<br />{item.email}</td><td>{item.purpose}</td>
                  <td>{item.cancelled ? 'Cancelled' : 'Confirmed'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {rows.length === 0 && <p role="status">No reservations match these filters.</p>}
          {pageCount > 1 && <div className="calendar-controls">
            <button disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous page</button>
            <span>Page {visiblePage + 1} of {pageCount}</span>
            <button disabled={visiblePage + 1 === pageCount} onClick={() => setPage(visiblePage + 1)}>Next page</button>
          </div>}
        </>
      ) : (
        <>
          <div className="calendar-controls">
            <button onClick={() => setDay(view === 'Rooms' ? addDays(day, -1) : changeMonth(day, -1))}>Previous {view === 'Rooms' ? 'day' : 'month'}</button>
            <input type="date" aria-label="Calendar date" value={day} onChange={(e) => { if (e.target.validity.valid && e.target.value) setDay(e.target.value); }} />
            <button onClick={() => setDay(view === 'Rooms' ? addDays(day, 1) : changeMonth(day, 1))}>Next {view === 'Rooms' ? 'day' : 'month'}</button>
            <button onClick={() => setDay(localToday())}>Today</button>
          </div>
          {view === 'Rooms' ? <RoomGrid day={day} items={visible} book={setSelection} details={(item) => setSelectedId(item.id)} /> : (
            <div className="calendar-scroll">
              <table className="month-grid">
                <caption>{new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(first + 'T00:00:00Z'))}</caption>
                <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
                <tbody>{Array.from({ length: 6 }, (_, week) => (
                  <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((date) => (
                    <td key={date} data-outside={date.slice(0, 7) !== day.slice(0, 7)}>
                      <button className="calendar-day" aria-label={'Book on ' + date} onClick={() => setSelection({ day: date })}>{Number(date.slice(8))}</button>
                      {calendarGroups(visible.filter((item) => intersects(item, date))).map(([item, ...otherRooms]) => (
                        <button className="calendar-event" key={item.id} onClick={() => setSelectedId(item.id)}>
                          <strong>{item.event}</strong><span>{timeLabel(item)} · {[item, ...otherRooms].map((entry) => entry.room).join(', ')}</span>
                        </button>
                      ))}
                    </td>
                  ))}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      <dialog ref={dialog} aria-labelledby="calendar-dialog-title" onCancel={close}>
        <div className="calendar-controls">
          <h2 id="calendar-dialog-title">{selection ? (selection.reservation ? 'Edit reservation' : 'New booking') : selected?.event}</h2>
          <button onClick={close}>Close</button>
        </div>
        {selection ? <ReservationForm selection={selection} save={save} /> : selected && (
          <>
            <p>{table ? selected.room : calendarGroups(visible).find((group) => group.some((item) => item.id === selected.id))?.map((item) => item.room).join(', ')}</p>
            <p>{selected.start.replace('T', ' ')} to {selected.end.replace('T', ' ')} (Kuala Lumpur)</p>
            {(!office || table) && <p>{selected.contact} · {selected.phone} · {selected.email}<br />{selected.purpose}</p>}
            {!selected.cancelled && (cancelRooms ? (
              <fieldset>
                <legend>Choose rooms to cancel</legend>
                {occurrence.map((item) => <label className="block" key={item.id}>
                  <input type="checkbox" checked={cancelRooms.includes(item.id)} onChange={(event) => {
                    setCancelRooms(event.target.checked ? [...cancelRooms, item.id] : cancelRooms.filter((id) => id !== item.id));
                  }} /> {item.room}
                </label>)}
                <button disabled={!cancelRooms.length} onClick={() => modify(cancelRooms, { cancelled: true })}>Confirm cancellation</button>
              </fieldset>
            ) : <div className="calendar-controls">
              <button onClick={() => setSelection({
                day: selected.start.slice(0, 10), reservation: selected,
                group: office && !table ? occurrence : undefined,
              })}>Edit</button>
              <button onClick={() => {
                if (office && !table) setCancelRooms(occurrence.map((item) => item.id));
                else modify([selected.id], { cancelled: true });
              }}>Cancel reservation</button>
              {office && <button onClick={() => modify(occurrence.map((item) => item.id), { published: !selected.published })}>{selected.published ? 'Unpublish' : 'Publish'}</button>}
            </div>)}
          </>
        )}
      </dialog>
    </section>
  );
}
