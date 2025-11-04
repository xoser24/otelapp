import { RoomData } from '../components/RoomCard';

const ROOMS_KEY = 'hotel_rooms';

type QA = { question: string; answer: string; timestamp: string };

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function getRooms(): RoomData[] {
  return readJSON<RoomData[]>(ROOMS_KEY, []);
}

function getEodWindow(dateISO: string) {
  const base = new Date(dateISO);
  const start = new Date(base);
  start.setHours(7, 0, 0, 0); // 07:00 today
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(7, 0, 0, 0); // 07:00 next day
  return { start, end };
}

function inWindow(iso: string | undefined, start: Date, end: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function getUnpaidGuests(): { room: string; guest?: string; amountDue?: number }[] {
  const rooms = getRooms();
  const sumPaid = (r: RoomData) => (r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return rooms
    .filter(r => (r.status === 'occupied' || r.status === 'sold') && ((Number(r.price) || 0) > sumPaid(r)))
    .map(r => ({ room: r.number, guest: (r.guestNames?.join(', ') || r.guestName), amountDue: Number(((Number(r.price) || 0) - sumPaid(r)).toFixed(2)) }));
}

export function getEmptyRooms(): string[] {
  const rooms = getRooms();
  return rooms.filter(r => r.status === 'available' || r.status === 'reserved').map(r => r.number);
}

export function getTodayCheckIns(): { room: string; guest?: string; checkIn?: string }[] {
  const rooms = getRooms();
  const { start, end } = getEodWindow(new Date().toISOString());
  const inDay = (iso?: string) => inWindow(iso || '', start, end);
  return rooms.filter(r => inDay(r.checkInDate)).map(r => ({ room: r.number, guest: (r.guestNames?.join(', ') || r.guestName), checkIn: r.checkInDate }));
}

export function getCardPaymentsTotal(): number {
  const rooms = getRooms();
  const { start, end } = getEodWindow(new Date().toISOString());
  const inDay = (iso?: string) => inWindow(iso || '', start, end);
  const paymentsWindow = rooms.flatMap(r => (r.payments || []).filter(p => inDay(p.time)));
  return paymentsWindow.filter(p => p.method === 'card').reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

export function answerReceptionQuery(query: string): QA {
  const q = query.trim().toLowerCase();
  const nowISO = new Date().toISOString();
  if (q.includes('kim giriş yaptı') || q.includes('giriş yaptı')) {
    const list = getTodayCheckIns();
    const text = list.length
      ? list.map(i => `Oda ${i.room}: ${i.guest || '—'} (${new Date(i.checkIn || '').toLocaleString('tr-TR')})`).join('\n')
      : 'Bugün giriş yapan bulunamadı.';
    return { question: query, answer: text, timestamp: nowISO };
  }
  if (q.includes('kart') && (q.includes('toplam') || q.includes('ne kadar') || q.includes('tutar'))) {
    const total = getCardPaymentsTotal();
    return { question: query, answer: `Kart ödemesi toplamı: ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(total)}`, timestamp: nowISO };
  }
  if (q.includes('hangi odalar boş') || (q.includes('odalar') && q.includes('boş'))) {
    const empty = getEmptyRooms();
    const text = empty.length ? `Boş odalar: ${empty.join(', ')}` : 'Boş oda yok.';
    return { question: query, answer: text, timestamp: nowISO };
  }
  if (q.includes('ödemesi olmayan') || q.includes('borç')) {
    const debts = getUnpaidGuests();
    const text = debts.length
      ? debts.map(d => `Oda ${d.room}: ${d.guest || '—'} • Borç: ${(d.amountDue || 0).toLocaleString('tr-TR')}`).join('\n')
      : 'Ödemesi eksik misafir yok.';
    return { question: query, answer: text, timestamp: nowISO };
  }
  return { question: query, answer: 'Soruyu anlayamadım. Örnek: “Bugün kim giriş yaptı?” / “Kart ödemesi toplamı nedir?” / “Hangi odalar boş?”', timestamp: nowISO };
}