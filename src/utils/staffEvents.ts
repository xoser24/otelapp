export type StaffEventType = 'advance' | 'bonus' | 'penalty' | 'expense' | 'leave';

export type StaffEvent = {
  id: string;
  staffId: string;
  type: StaffEventType;
  date: string; // ISO date/time
  amount?: number; // ₺, advance/bonus/penalty/expense
  description?: string;
  endDate?: string; // optional end date for leave ranges
};

export const STAFF_EVENTS_KEY = 'hotel_staff_events';

const readJSON = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const writeJSON = <T,>(key: string, value: T) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

export function getEvents(): StaffEvent[] { return readJSON<StaffEvent[]>(STAFF_EVENTS_KEY, []); }
export function setEvents(list: StaffEvent[]) { writeJSON(STAFF_EVENTS_KEY, list); try { window.dispatchEvent(new Event('staff-events-updated')); } catch {} }
export function getEventsForStaff(staffId: string): StaffEvent[] { return getEvents().filter(e => e.staffId === staffId).sort((a,b)=> (a.date < b.date ? -1 : 1)); }

export function addEvent(evt: Omit<StaffEvent, 'id' | 'date'> & { date?: string }) {
  const list = getEvents();
  const now = new Date().toISOString();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const rec: StaffEvent = { id, date: evt.date || now, staffId: evt.staffId, type: evt.type, amount: evt.amount, description: evt.description, endDate: evt.endDate };
  setEvents([rec, ...list]);
  return rec;
}

export function removeEventsForStaff(staffId: string) {
  const filtered = getEvents().filter(e => e.staffId !== staffId);
  setEvents(filtered);
}

export function resetStaffEvents() { try { localStorage.removeItem(STAFF_EVENTS_KEY); } catch {} }