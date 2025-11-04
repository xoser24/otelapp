import { RoomData } from '../components/RoomCard';

export type GuestRecordStatus = 'active' | 'checked_out';
export type GuestRecord = {
  id: string;
  roomNumber: string;
  guest: string;
  phone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  price?: number;
  paymentStatus?: RoomData['paymentStatus'];
  paymentMethod?: RoomData['paymentMethod'];
  payments?: RoomData['payments'];
  status: GuestRecordStatus;
  createdAt: string;
  updatedAt?: string;
};

export const GUESTS_KEY = 'hotel:guests';
export const GUESTS_ARCHIVE_KEY = 'hotel:guests_archive';
export const SOFT_CHECKOUT_FLAG_KEY = 'hotel:soft_checkout';

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJSON<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function getSoftCheckoutEnabled(): boolean {
  const raw = localStorage.getItem(SOFT_CHECKOUT_FLAG_KEY);
  if (raw == null) return true; // default true
  return raw !== 'false';
}

export function getGuests(): GuestRecord[] { return readJSON<GuestRecord[]>(GUESTS_KEY, []); }
export function setGuests(list: GuestRecord[]) { writeJSON(GUESTS_KEY, list); try { window.dispatchEvent(new Event('guest-list-updated')); } catch {} }
export function getArchivedGuests(): GuestRecord[] { return readJSON<GuestRecord[]>(GUESTS_ARCHIVE_KEY, []); }
export function setArchivedGuests(list: GuestRecord[]) { writeJSON(GUESTS_ARCHIVE_KEY, list); }

function makeId(roomNumber: string, checkInDate?: string) { return `${roomNumber}:${checkInDate || new Date().toISOString().slice(0,10)}`; }
function formatGuestNames(names?: string[] | null, single?: string | null): string { return (names && names.length ? names.join(', ') : (single || '')).trim(); }

export function upsertGuestFromRoom(room: RoomData): GuestRecord {
  const guests = getGuests();
  const name = formatGuestNames(room.guestNames as any, room.guestName || null);
  const id = makeId(room.number, room.checkInDate);
  const existingIdx = guests.findIndex(g => g.roomNumber === room.number && g.status === 'active');
  const now = new Date().toISOString();
  const base: GuestRecord = {
    id,
    roomNumber: room.number,
    guest: name,
    phone: room.phone,
    checkInDate: room.checkInDate,
    checkOutDate: room.checkOutDate,
    price: room.price,
    paymentStatus: room.paymentStatus,
    paymentMethod: room.paymentMethod,
    payments: room.payments || [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  if (existingIdx >= 0) {
    const updated: GuestRecord = { ...guests[existingIdx], ...base, id: guests[existingIdx].id, createdAt: guests[existingIdx].createdAt, updatedAt: now };
    guests[existingIdx] = updated;
  } else {
    guests.push(base);
  }
  setGuests(guests);
  return existingIdx >= 0 ? guests[existingIdx] : base;
}

export function markCheckedOutFromRoom(room: RoomData): GuestRecord | null {
  const guests = getGuests();
  const idx = guests.findIndex(g => g.roomNumber === room.number && g.status === 'active');
  const now = new Date().toISOString();
  if (idx >= 0) {
    const updated = { ...guests[idx], status: 'checked_out', checkOutDate: now, updatedAt: now } as GuestRecord;
    guests[idx] = updated;
    setGuests(guests);
    return updated;
  } else {
    // If not found, create a new checked_out record
    const name = formatGuestNames(room.guestNames as any, room.guestName || null);
    const id = makeId(room.number, room.checkInDate);
    const rec: GuestRecord = {
      id,
      roomNumber: room.number,
      guest: name,
      phone: room.phone,
      checkInDate: room.checkInDate,
      checkOutDate: now,
      price: room.price,
      paymentStatus: room.paymentStatus,
      paymentMethod: room.paymentMethod,
      payments: room.payments || [],
      status: 'checked_out',
      createdAt: now,
      updatedAt: now,
    };
    guests.push(rec);
    setGuests(guests);
    return rec;
  }
}

export function archiveCheckedOutGuestsInWindow(windowStart: Date, windowEnd: Date): { archived: GuestRecord[]; count: number } {
  const guests = getGuests();
  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= windowStart.getTime() && t < windowEnd.getTime();
  };
  const toArchive = guests.filter(g => g.status === 'checked_out' && inWindow(g.checkOutDate));
  const remaining = guests.filter(g => !(g.status === 'checked_out' && inWindow(g.checkOutDate)));
  const archivedPrev = getArchivedGuests();
  const nextArchived = [...archivedPrev, ...toArchive.map(g => ({ ...g, updatedAt: new Date().toISOString() }))];
  setArchivedGuests(nextArchived);
  setGuests(remaining);
  return { archived: toArchive, count: toArchive.length };
}