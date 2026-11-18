'use client';

import { useRef } from 'react';
import { addDays, intersects, rooms, type Reservation } from './preview-data';
import type { Selection } from './ReservationForm';

function slotTime(slot: number) {
  const minutes = (slot * 30) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

export function RoomGrid({ day, items, book, details }: {
  day: string; items: Reservation[];
  book: (selection: Selection) => void;
  details: (item: Reservation) => void;
}) {
  const drag = useRef<{ room: string; slot: number } | null>(null);
  const dayItems = items.filter((item) => intersects(item, day));
  const slots = Array.from({ length: 48 }, (_, index) => index);
  function select(room: string, first: number, last: number) {
    book({ day, room, start: slotTime(Math.min(first, last)), end: slotTime(Math.max(first, last) + 1) });
  }

  return (
    <div className="calendar-scroll" onPointerCancel={() => { drag.current = null; }}>
      <table className="room-grid">
        <thead><tr><th scope="col">Time</th>{rooms.map((room) => <th scope="col" key={room}>{room}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">All day</th>{rooms.map((room) => (
            <td key={room}>{dayItems.filter((item) => item.room === room && item.allDay).map((item) => (
              <button className="calendar-event" key={item.id} onClick={() => details(item)}>{item.event}</button>
            ))}</td>
          ))}</tr>
          {slots.map((slot) => (
            <tr key={slot}><th scope="row">{slotTime(slot)}</th>{rooms.map((room) => {
              const start = day + 'T' + slotTime(slot);
              const end = slot === 47 ? addDays(day, 1) + 'T00:00' : day + 'T' + slotTime(slot + 1);
              const occupied = dayItems.filter((item) => item.room === room && !item.allDay && item.start < end && item.end > start);
              return <td key={room}>{occupied.length ? occupied.map((item) => (
                <button className="calendar-event" key={item.id} onClick={() => details(item)}>{item.event}</button>
              )) : (
                <button className="calendar-slot" aria-label={'Book ' + room + ' at ' + slotTime(slot)}
                  onDragStart={(event) => event.preventDefault()}
                  onPointerDown={(event) => { if (event.pointerType === 'mouse' && event.button === 0) drag.current = { room, slot }; }}
                  onPointerUp={() => {
                    const first = drag.current;
                    drag.current = null;
                    if (first?.room === room && first.slot !== slot) select(room, first.slot, slot);
                  }}
                  onClick={() => select(room, slot, slot)}>+</button>
              )}</td>;
            })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
