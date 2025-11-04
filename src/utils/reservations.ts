// Reservations utility: storage, queries, and workflow helpers
import type { RoomData } from '../components/RoomCard';
import { pushNotification } from './notifications';
import { emitRoomsUpdated } from './events';

export type ReservationStatus = 'upcoming' | 'checked-in' | 'cancelled' | 'completed' | 'checked-in-pending' | 'no-show';

export type ReservationRecord = {
  id: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  note?: string;
  peopleCount?: number; // 1-4
  dailyRate?: number; // ₺
  paymentState?: 'deposit' | 'unpaid' | 'paid';
  source?: 'phone' | 'otelz' | 'internet' | 'walk-in' | string;
  status: ReservationStatus;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
};

export const RESERVATIONS_KEY = 'hotel:reservations';
export const ROOMS_KEY = 'hotel_rooms';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function getReservations(): ReservationRecord[] {
  return readJSON<ReservationRecord[]>(RESERVATIONS_KEY, []);
}

export function setReservations(next: ReservationRecord[]) {
  writeJSON(RESERVATIONS_KEY, next);
  try { window.dispatchEvent(new Event('reservations-updated')); } catch {}
}

export function addReservation(rec: Omit<ReservationRecord, 'id' | 'createdAt'> & Partial<Pick<ReservationRecord,'createdAt'>>) {
  const list = getReservations();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const createdAt = rec.createdAt || new Date().toISOString();
  const item: ReservationRecord = {
    paymentState: 'unpaid',
    peopleCount: 2,
    ...({} as ReservationRecord),
    ...rec,
    id,
    createdAt,
  } as ReservationRecord;
  setReservations([item, ...list]);
  // oda statüsünü rezerveye geçir (geleceğe yönelik)
  try {
    const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
    const updated = rooms.map(r => r.number === item.roomNumber ? { ...r, status: r.status === 'available' ? 'reserved' : r.status } : r);
    writeJSON(ROOMS_KEY, updated);
    try { emitRoomsUpdated(); } catch {}
  } catch {}
  // HK bilgilendirme (yaklaşan rezervasyon)
  try {
    pushNotification({
      title: `Rezervasyon Oluşturuldu`,
      message: `Oda ${rec.roomNumber} için ${rec.checkInDate} tarihinde ${rec.guestName} giriş yapacak.`,
      type: 'housekeeping', priority: 'low', recipient: 'housekeeping'
    });
  } catch {}
  return item;
}

export function updateReservationStatus(id: string, status: ReservationStatus) {
  const list = getReservations();
  const next = list.map(r => r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r);
  setReservations(next);
}

export function findReservationsByRoomOnDate(roomNumber: string, dateYYYYMMDD: string) {
  return getReservations().filter(r => r.roomNumber === roomNumber && r.checkInDate === dateYYYYMMDD && r.status !== 'cancelled' && r.status !== 'completed');
}

export function getReservationsForDay(dateYYYYMMDD: string) {
  return getReservations().filter(r => r.checkInDate === dateYYYYMMDD && r.status !== 'cancelled');
}

export function getTomorrow(dateISO?: string) {
  const base = dateISO ? new Date(dateISO) : new Date();
  base.setHours(0,0,0,0);
  const t = new Date(base);
  t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0,10);
}

export function getToday(dateISO?: string) {
  const base = dateISO ? new Date(dateISO) : new Date();
  base.setHours(0,0,0,0);
  return base.toISOString().slice(0,10);
}

// Basit çakışma kontrolü (YYYY-MM-DD aralığı)
export function isOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || bEnd < aStart);
}

// Tarih aralığına uygun odaları döndür (mevcut oda durumuna göre basit kontrol)
export function getAvailableRoomsForRange(start: string, end: string): string[] {
  const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
  const reservations = getReservations();
  const busyByReservation = new Set<string>();
  reservations.forEach(r => {
    if (r.status !== 'cancelled' && r.status !== 'completed' && r.status !== 'no-show') {
      if (isOverlap(r.checkInDate, r.checkOutDate, start, end)) busyByReservation.add(r.roomNumber);
    }
  });
  return rooms
    .filter(r => (r.status === 'available' || r.status === 'dirty' || r.status === 'reserved') && !busyByReservation.has(r.number))
    .map(r => r.number);
}

// No-show işaretle: oda tekrar boş olur ve rezervasyon raporlara no-show olarak geçer
export function markNoShow(id: string) {
  const list = getReservations();
  const target = list.find(r => r.id === id);
  if (!target) return;
  const next = list.map(r => r.id === id ? { ...r, status: 'no-show' as ReservationStatus, updatedAt: new Date().toISOString() } : r);
  setReservations(next);
  try {
    const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
    const updated = rooms.map(room => room.number === target.roomNumber ? { ...room, status: room.status === 'reserved' ? 'available' : room.status, isReservedForNextGuest: false } as RoomData : room);
    writeJSON(ROOMS_KEY, updated);
    try { emitRoomsUpdated(); } catch {}
  } catch {}
}

// Zamanlanmış bildirimler: 07:00 check-in hatırlatma, 20:00 no-show kontrolü
export function scheduleReservationNotifications() {
  const check = () => {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const today = getToday();
    if (hh === 7 && mm === 0) {
      const todays = getReservations().filter(r => r.checkInDate === today && r.status !== 'cancelled' && r.status !== 'no-show');
      const rooms = todays.map(t => t.roomNumber).join(' / ');
      try { if (todays.length > 0) pushNotification({ title: 'Bugünkü Girişler', message: `Bugün ${todays.length} rezervasyon girişi var: ${rooms}.`, type: 'reception', priority: 'medium', recipient: 'reception' }); } catch {}
    }
    if (hh === 20 && mm === 0) {
      const pending = getReservations().filter(r => r.checkInDate === today && (r.status === 'upcoming' || r.status === 'checked-in-pending'));
      if (pending.length > 0) {
        try { pushNotification({ title: 'No-show Kontrolü', message: `${pending.length} rezervasyon giriş yapmadı. No-show olarak işaretlemek ister misiniz?`, type: 'reception', priority: 'high', recipient: 'reception' }); } catch {}
      }
    }
  };
  check();
  const id = setInterval(check, 60 * 1000);
  return () => clearInterval(id);
}

// Checkout sonrası: yarın için rezervasyon varsa işaretle ve HK’a haber ver
export function markRoomReservedForNextGuest(roomNumber: string, dateISO?: string) {
  try {
    const tomorrow = getTomorrow(dateISO);
    const matches = findReservationsByRoomOnDate(roomNumber, tomorrow);
    const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
    const updated = rooms.map(r => {
      if (r.number === roomNumber) {
        const isResNext = matches.length > 0;
        return { ...r, isReservedForNextGuest: isResNext } as RoomData;
      }
      return r;
    });
    writeJSON(ROOMS_KEY, updated);
    try { emitRoomsUpdated(); } catch {}
    if (matches.length > 0) {
      const g = matches[0];
      try {
        pushNotification({
          title: `Yarın Rezervasyon Var`,
          message: `Oda ${roomNumber} yarın ${g.guestName} için rezerve edildi. Öncelikli temizlik önerilir.`,
          type: 'housekeeping', priority: 'high', recipient: 'housekeeping'
        });
      } catch {}
    }
  } catch {}
}

// Gün sonu: yarın girişli rezervasyonları aktive et
export function activateTomorrowReservationsOnEod(dateISO: string) {
  const tomorrow = getTomorrow(dateISO);
  const reservations = getReservations();
  const target = reservations.filter(r => r.checkInDate === tomorrow && r.status !== 'cancelled');
  const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
  const nextRooms = rooms.map(r => {
    const has = target.some(t => t.roomNumber === r.number);
    if (has && (r.status === 'dirty' || r.status === 'available')) {
      return { ...r, status: 'reserved', isReservedForNextGuest: true } as RoomData;
    }
    return r;
  });
  writeJSON(ROOMS_KEY, nextRooms);
  try { emitRoomsUpdated(); } catch {}
  const nextRes: ReservationRecord[] = reservations.map(r => {
    if (r.checkInDate === tomorrow && r.status === 'upcoming') {
      return { ...r, status: 'checked-in-pending' as ReservationStatus, updatedAt: new Date().toISOString() };
    }
    return r;
  });
  setReservations(nextRes);
  // Bildirimler
  try {
    const count = target.length;
    if (count > 0) {
      pushNotification({ title: 'Yarın Girişler Aktif', message: `Yarın ${count} rezervasyon rezerve edildi.`, type: 'reception', priority: 'medium', recipient: 'reception' });
      pushNotification({ title: 'Öncelikli Temizlik', message: `Yarın girişli odalar önceliklendirildi.`, type: 'housekeeping', priority: 'high', recipient: 'housekeeping' });
    }
  } catch {}
}

// Sabah check-in işlemi: tek tıkla odayı doldur ve misafir ekle
export function checkInReservation(id: string) {
  const reservations = getReservations();
  const res = reservations.find(r => r.id === id);
  if (!res) return;
  updateReservationStatus(id, 'checked-in');
  try {
    const rooms = readJSON<RoomData[]>(ROOMS_KEY, []);
    const next = rooms.map(r => {
      if (r.number === res.roomNumber) {
        return {
          ...r,
          status: 'occupied',
          guestName: res.guestName,
          phone: res.phone,
          checkInDate: new Date().toISOString(),
          isReservedForNextGuest: false,
        } as RoomData;
      }
      return r;
    });
    writeJSON(ROOMS_KEY, next);
    try { emitRoomsUpdated(); } catch {}
  } catch {}
}