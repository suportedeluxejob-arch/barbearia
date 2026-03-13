/**
 * BookingEngine — Handles all slot availability logic
 * 
 * Business rules:
 * - MAX_CONCURRENT: how many barbers can serve clients simultaneously
 * - TIME_SLOT_DURATION_MIN: duration of each slot in minutes
 * - All slots for a given day/time are queried from Firestore
 */

export const TIME_SLOT_DURATION_MIN = 30; // minutes per slot
export const MAX_CONCURRENT_PER_SLOT = 2;  // how many bookings allowed per exact time slot

export const TIME_SLOTS: Record<string, string[]> = {
  'Manhã':  ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  'Tarde':  ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
  'Noite':  ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'],
};

export const ALL_SLOTS = Object.values(TIME_SLOTS).flat();

/** Parse ISO date string to YYYY-MM-DD key */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse string YYYY-MM-DD back to a Date at midnight local */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Convert time to minutes since midnight for comparisons */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type SlotMap = Record<string, number>;  // time -> booking count

/**
 * Given a list of existing appointments for a day, returns a map
 * of time -> count of confirmed/pending bookings.
 */
export function buildSlotMap(appointments: { time: string }[]): SlotMap {
  const map: SlotMap = {};
  for (const appt of appointments) {
    if (!appt.time) continue;
    map[appt.time] = (map[appt.time] || 0) + 1;
  }
  return map;
}

/**
 * Returns true if a slot is fully booked.
 */
export function isSlotFull(slotMap: SlotMap, time: string): boolean {
  return (slotMap[time] || 0) >= MAX_CONCURRENT_PER_SLOT;
}

/**
 * Returns true if all slots in a day are fully booked.
 */
export function isDayFull(slotMap: SlotMap): boolean {
  return ALL_SLOTS.every(slot => isSlotFull(slotMap, slot));
}

/**
 * Given bookings on the chosen slot, compute queue position and estimated arrival.
 * Returns: { queuePosition, estimatedWait (min), estimatedArrival (HH:MM) }
 */
export function getQueueInfo(slotMap: SlotMap, time: string, serviceDurationMin: number) {
  const countBefore = slotMap[time] || 0;
  const slotStart = timeToMinutes(time);
  const estimatedWait = countBefore * serviceDurationMin;
  const estimatedArrivalMin = slotStart + estimatedWait;
  return {
    queuePosition: countBefore + 1,
    estimatedWait,
    estimatedArrival: minutesToTime(estimatedArrivalMin),
  };
}

/** Generate all calendar days for a month grid (including padding) */
export function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Pad from Sunday
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}
