import type { RoomData, Payment } from '../components/RoomCard';
import { addReservation, getTomorrow } from './reservations';
import { emitRoomsUpdated } from './events';

const ROOMS_KEY = 'hotel_rooms';
const MANUAL_SALES_KEY = 'manual_sales';
const EXPENSES_KEY = 'hotel_expenses';
const POS_INFO_KEY = 'pos_info';

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

function randomName(i: number): string {
  const names = ['Ahmet', 'Ayşe', 'Mehmet', 'Fatma', 'Can', 'Elif', 'Efe', 'Zeynep'];
  return names[i % names.length];
}

export async function runFullTestSeed(opts?: { basePrice?: number }) {
  const basePrice = opts?.basePrice || 500;
  let rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
  if (!Array.isArray(rooms) || rooms.length === 0) {
    // Admin/HK ile aynı varsayılan oda setini kur ve devam et
    const DEFAULT_ROOM_NUMBERS = [
      '101','102','103','104','105','106','107','108','109','110',
      '201','203','204','205','206','207','208','209','210','211','212','213',
      '301','303','304','305','306','307','308','309','310','311','312','313','314','315',
      '402','403'
    ];
    rooms = DEFAULT_ROOM_NUMBERS.map((n) => ({ number: n, status: 'available' } as RoomData));
    writeJSON(ROOMS_KEY, rooms);
  }

  const now = new Date();
  const todayKey = now.toISOString().slice(0,10);

  // Seed room sales with 1/2/3 occupancy and payment cycles cash/card/iban
  const updatedRooms: RoomData[] = rooms.map((room, idx) => {
    const occupancy = (idx % 3) + 1; // 1,2,3 döngüsü
    const methodCycle = (idx % 3);
    const method = methodCycle === 0 ? 'cash' : methodCycle === 1 ? 'card' : 'iban';
    const price = basePrice * occupancy;
    const guestList = Array.from({ length: occupancy }, (_, j) => `${randomName(idx + j)} Test`);
    const checkInISO = new Date(now.getTime() - (idx % 5) * 60 * 60 * 1000).toISOString();
    const payment: Payment = {
      id: Math.random().toString(36).slice(2),
      method: method as any,
      amount: price,
      time: new Date(new Date(checkInISO).getTime() + 5 * 60 * 1000).toISOString(),
      reference: method === 'iban' ? 'TR00TESTIBAN000000000000' : undefined,
      cashier: 'Test User',
      notes: 'Test satış'
    };
    const next: RoomData = {
      ...room,
      status: 'sold',
      guestName: occupancy === 1 ? guestList[0] : undefined,
      guestNames: occupancy > 1 ? guestList : undefined,
      phone: '0500 000 00 00',
      price,
      checkInDate: checkInISO,
      paymentStatus: 'received',
      paymentMethod: method as any,
      iban: method === 'iban' ? 'TR00TESTIBAN000000000000' : '',
      payments: [ ...(room.payments || []), payment ],
      stayNights: 1,
    } as RoomData;
    return next;
  });

  writeJSON(ROOMS_KEY, updatedRooms);

  // Ensure POS info for today so card auto-sold logic is satisfied
  try {
    const all = readJSON<Record<string, { invoiceIssued?: boolean; zReportNumber?: string; receiptCount?: number; storeName?: string; posTerminal?: string }>>(POS_INFO_KEY, {});
    all[todayKey] = {
      invoiceIssued: true,
      zReportNumber: `TST-${todayKey}`,
      receiptCount: updatedRooms.length,
      storeName: 'Test Şube',
      posTerminal: 'TEST-POS-01'
    };
    writeJSON(POS_INFO_KEY, all);
  } catch {}

  // Manual sales covering all payment types
  const manualSales = readJSON<any[]>(MANUAL_SALES_KEY, []);
  const msNow = now.toISOString();
  manualSales.push(
    { amount: 150, date: msNow, title: 'Mini Bar', customerName: 'Test Müşteri', isDebt: false, note: 'İçecek & Atıştırmalık', paymentType: 'cash' },
    { amount: 220, date: msNow, title: 'Restoran', customerName: 'Test Müşteri', isDebt: false, note: 'Akşam yemeği', paymentType: 'card' },
    { amount: 310, date: msNow, title: 'Otopark', customerName: 'Test Müşteri', isDebt: false, note: 'Günlük ücret', paymentType: 'iban' },
    { amount: 80,  date: msNow, title: 'Çamaşırhane', customerName: 'Test Müşteri', isDebt: true,  note: 'Sonradan ödenecek', paymentType: 'other' },
  );
  writeJSON(MANUAL_SALES_KEY, manualSales);

  // Expenses
  const expenses = readJSON<any[]>(EXPENSES_KEY, []);
  expenses.push(
    { amount: 200, date: msNow, title: 'Elektrik', note: 'Günlük tüketim' },
    { amount: 340, date: msNow, title: 'Temizlik Malzemesi', note: 'Aylık stok alımı (kart)' },
    { amount: 120, date: msNow, title: 'Bakım', note: 'Küçük tamirat (havale)' },
  );
  writeJSON(EXPENSES_KEY, expenses);

  // Create upcoming reservations for tomorrow for each room
  const tomorrow = getTomorrow(now.toISOString());
  updatedRooms.forEach((r, idx) => {
    const occupancy = (idx % 3) + 1;
    try {
      addReservation({
        guestName: `RezMisafir ${idx + 1}`,
        roomNumber: r.number,
        checkInDate: tomorrow,
        checkOutDate: tomorrow, // basit tek gece
        phone: '0500 000 00 00',
        peopleCount: occupancy,
        dailyRate: basePrice * occupancy,
        source: 'phone',
        status: 'upcoming',
        createdAt: msNow,
      } as any);
    } catch {}
  });

  // Fire storage event to update listening UIs
  try { window.dispatchEvent(new Event('storage')); } catch {}
  // Explicitly emit rooms-updated so HK ve odalar anında yenilensin
  try { emitRoomsUpdated({ source: 'test-seed' }); } catch {}
  // Geriye dönük dinleyiciler için hk-cleaning-updated yayınla
  try { window.dispatchEvent(new Event('hk-cleaning-updated')); } catch {}

  return true;
}