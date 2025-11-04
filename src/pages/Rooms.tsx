import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RoomData } from '../components/RoomCard';
import RoomCardMinimal from '../components/RoomCardMinimal';
import { GoldGlassCard } from '../components/GoldGlassCard';
import { emitRoomsUpdated, onRoomsUpdated } from '../utils/events';
import { ROOMS_KEY } from '../utils/reservations';


const roomNumbers = [
  '101','102','103','104','105','106','107','108','109','110',
  '201','203','204','205','206','207','208','209','210','211','212','213',
  '301','303','304','305','306','307','308','309','310','311','312','313','314','315',
  '402','403'
];

const Rooms: React.FC = () => {
  const initialRooms: RoomData[] = useMemo(() => {
    return roomNumbers.map((num) => ({ number: num, status: 'available' }));
  }, []);

  const [rooms, setRooms] = useState<RoomData[]>(() => {
    try {
      const saved = localStorage.getItem(ROOMS_KEY);
      const base: RoomData[] = saved ? JSON.parse(saved) : initialRooms;
      const allowed = new Set(roomNumbers);
      const filtered = base.filter((r) => allowed.has(r.number));
      const existing = new Set(filtered.map((r) => r.number));
      const additions = roomNumbers
        .filter((n) => !existing.has(n))
        .map((n) => ({ number: n, status: 'available' } as RoomData));
      return [...filtered, ...additions];
    } catch {
      return initialRooms;
    }
  });

  // Kanonik migrasyon: eksikleri ekle, fazlalıkları çıkar
  useEffect(() => {
    try {
      const allowed = new Set(roomNumbers);
      const filtered = rooms.filter((r) => allowed.has(r.number));
      const existing = new Set(filtered.map((r) => r.number));
      const additions = roomNumbers
        .filter((n) => !existing.has(n))
        .map((n) => ({ number: n, status: 'available' } as RoomData));
      const next = [...filtered, ...additions];
      if (next.length !== rooms.length) {
        setRooms(next);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const nextStr = JSON.stringify(rooms);
      const prevStr = localStorage.getItem(ROOMS_KEY) || '';
      // Guard: aynı içerikse yazma ve event yayınlama (döngüyü kır)
      if (prevStr !== nextStr) {
        localStorage.setItem(ROOMS_KEY, nextStr);
        // Diğer sayfalar (Misafirler, HK) anında güncellesin
        emitRoomsUpdated();
        // Mevcut temizlik dinleyicileri için geriye dönük uyumluluk
        window.dispatchEvent(new Event('hk-cleaning-updated'));
      }
    } catch {}
  }, [rooms]);

  // Housekeeping ile senkronizasyon: localStorage değişimlerini takip et
  useEffect(() => {
    const loadRooms = () => {
      try {
        const saved = localStorage.getItem(ROOMS_KEY);
        const next = saved ? JSON.parse(saved) : [];
        // Guard: mevcut state ile aynıysa setRooms çağrısını atla
        setRooms((prev) => {
          const prevStr = JSON.stringify(prev);
          const nextStr = JSON.stringify(next);
          return prevStr === nextStr ? prev : next;
        });
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROOMS_KEY) loadRooms();
    };
    window.addEventListener('storage', onStorage);
    const onHK = () => loadRooms();
    window.addEventListener('hk-cleaning-updated', onHK as EventListener);
    const unsubRooms = onRoomsUpdated(() => loadRooms());
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onHK as EventListener);
      unsubRooms?.();
    };
  }, []);

  const updateRoom = useCallback((updated: RoomData) => {
    setRooms((prev) => prev.map((r) => (r.number === updated.number ? updated : r)));
  }, []);

  const switchRoom = useCallback((fromNumber: string, toNumber: string) => {
    setRooms((prev) => {
      const from = prev.find((r) => r.number === fromNumber);
      const to = prev.find((r) => r.number === toNumber);
      if (!from || !to) return prev;
      if (to.status === 'occupied' || to.status === 'sold') {
        alert('Hedef oda dolu/satılmış, değiştirilemez.');
        return prev;
      }
      const totalPaid = (from.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const lastMethod = (from.payments || []).length ? (from.payments || [])[(from.payments || []).length - 1].method : null;
      const payload = {
        guestName: from.guestName,
        guestNames: Array.isArray(from.guestNames) ? [...from.guestNames] : undefined,
        phone: from.phone,
        price: from.price,
        checkInDate: from.checkInDate || new Date().toISOString(),
        checkOutDate: undefined,
        payments: from.payments ? [...from.payments] : [],
        paymentStatus: totalPaid >= (from.price || 0) ? 'received' : 'not_received',
        paymentMethod: (lastMethod || null) as RoomData['paymentMethod'],
        iban: from.iban,
      } as Partial<RoomData>;

      return prev.map((r) => {
        if (r.number === fromNumber) {
          return {
            ...r,
            status: 'changing',
            checkInDate: undefined,
            checkOutDate: undefined,
            guestName: '',
            guestNames: [],
            phone: '',
            price: undefined,
            payments: [],
            paymentStatus: undefined,
            paymentMethod: null,
            iban: '',
          } as RoomData;
        }
        if (r.number === toNumber) {
          return {
            ...r,
            status: 'occupied',
            ...payload,
          } as RoomData;
        }
        return r;
      });
    });
  }, []);

  const occupiedCount = rooms.filter((r) => r.status === 'occupied').length;
  const availableCount = rooms.length - occupiedCount;

  return (
    <div className="relative min-h-screen p-6 overflow-hidden">
      {/* Ambient gradient & glow layers for visible glass blur */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 w-[380px] h-[380px] rounded-full bg-secondary-600/25 blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-primary-600/25 blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-yellow-400/10 to-pink-500/10 blur-[140px]" />
      </div>
      {/* Header */}
      <GoldGlassCard accent="gold" className="rounded-xl">
        <div className="p-4">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold">Oda Yönetimi</h1>
              <p className="text-secondary text-sm">Check-in / Check-out ve ödeme bilgilerini yönetin</p>
            </div>
            <div className="flex space-x-4">
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Dolu</div>
                <div className="text-lg font-semibold">{occupiedCount}</div>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Müsait</div>
                <div className="text-lg font-semibold">{availableCount}</div>
              </div>
            </div>
          </div>
        </div>
      </GoldGlassCard>

      {/* Room Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {rooms.map((room) => (
          <GoldGlassCard key={room.number} accent={(room.status === 'dirty') ? 'emerald' : (room.status === 'reserved') ? 'royal' : (room.status === 'occupied' || room.status === 'sold' || room.status === 'changing') ? 'gold' : 'neutral'} className="gold-card-hover">
            <div className="p-2">
              <RoomCardMinimal
                room={room}
                onChange={updateRoom}
                availableRoomNumbers={rooms.map((r) => r.number)}
                onSwitchRoom={switchRoom}
              />
            </div>
          </GoldGlassCard>
        ))}
      </div>
    </div>
  );
};

export default Rooms;