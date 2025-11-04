import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaBroom, FaTools, FaClock, FaCheck } from 'react-icons/fa';
import { pushNotification } from '../utils/notifications';
import { HK_CLEANING_KEY, getCleaningMap, startCleaning, finalizeCleaning, Checklist } from '../utils/hkCleaning';
import { RoomData } from '../components/RoomCard';
import { emitRoomsUpdated, onRoomsUpdated } from '../utils/events';
import { ROOMS_KEY } from '../utils/reservations';
import RoomCardMinimal from '../components/RoomCardMinimal';
import { GoldGlassCard } from '../components/GoldGlassCard';
import { isDemoMode } from '../utils/appMode';

const STAYOVER_PREF_KEY = 'stayover_preference';

// Admin Rooms ile aynı sayı setini kullanarak HK için varsayılan odalar
// 300 serisi odalar kaldırıldı (talep üzerine)
const DEFAULT_ROOM_NUMBERS = [
  '101','102','103','104','105','106','107','108','109','110',
  '201','203','204','205','206','207','208','209','210','211','212','213',
  '301','303','304','305','306','307','308','309','310','311','312','313','314','315',
  '402','403'
];

const HKRooms: React.FC = () => {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [cleaning, setCleaning] = useState(getCleaningMap());
  const [stayoverMap, setStayoverMap] = useState<Record<string, 'requested' | 'not_requested' | 'unspecified'>>({});
  const [hotelName, setHotelName] = useState<string>('Kent Otel');
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null);
  const [modalRoom, setModalRoom] = useState<RoomData | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({
    remotesOk: false,
    minibarOk: false,
    floorsClean: false,
    towelsStocked: false,
    toiletriesStocked: false,
    slippersPresent: false,
  });
  // Görevli alanları kaldırıldı: günlük görevlere entegre edilecek
  const [lastMaintenanceRoom, setLastMaintenanceRoom] = useState<string | null>(null);
  const [maintenanceModalRoom, setMaintenanceModalRoom] = useState<RoomData | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState<string>('');
  const [maintenanceImage, setMaintenanceImage] = useState<string>('');
  const MAINTENANCE_KEY = 'maintenance_reports';

  // initialRooms: Varsayılan oda listesine göre seed verisi
  const initialRooms: RoomData[] = useMemo(() => {
    return DEFAULT_ROOM_NUMBERS.map((num) => ({ number: num, status: 'available' }));
  }, []);
  const updateRoom = (updated: RoomData) => {
    setRooms((prev) => {
      const next = prev.map((r) => (r.number === updated.number ? updated : r));
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(next)); } catch {}
      emitRoomsUpdated();
      return next;
    });
  };
  const switchRoom = (fromNumber: string, toNumber: string) => {
    setRooms((prev) => {
      const fromIdx = prev.findIndex((r) => r.number === fromNumber);
      const toIdx = prev.findIndex((r) => r.number === toNumber);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const tmp = next[fromIdx].number;
      next[fromIdx] = { ...next[fromIdx], number: next[toIdx].number };
      next[toIdx] = { ...next[toIdx], number: tmp };
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(next)); } catch {}
      emitRoomsUpdated();
      return next;
    });
  };
  useEffect(() => {
    const loadRooms = () => {
      try {
        const saved = localStorage.getItem(ROOMS_KEY);
        if (saved) {
          const arr: RoomData[] = JSON.parse(saved);
          if (isDemoMode()) {
            // Demo modunda varsayılan eksikleri ekle
            const existing = new Set(arr.map(r => r.number));
            const additions = DEFAULT_ROOM_NUMBERS
              .filter(n => !existing.has(n))
              .map(n => ({ number: n, status: 'available' } as RoomData));
            if (additions.length > 0) {
              const next = [...arr, ...additions];
              localStorage.setItem(ROOMS_KEY, JSON.stringify(next));
              setRooms(next);
              emitRoomsUpdated();
            } else {
              setRooms(arr);
            }
          } else {
            // Prod: var olanı yükle, otomatik oda ekleme yok
            setRooms(arr);
          }
        } else {
          if (isDemoMode()) {
            // Demo: seed rooms if not present
            localStorage.setItem(ROOMS_KEY, JSON.stringify(initialRooms));
            setRooms(initialRooms);
            emitRoomsUpdated();
          } else {
            // Prod: boş başla, harici veri entegrasyonu bekleniyor
            setRooms([]);
          }
        }
      } catch { setRooms(initialRooms); }
    };
    // Kanonik set: eksik varsayılanları ekle, mevcut olmayanları asla silme
    const pruneRooms = () => {
      try {
        const saved = localStorage.getItem(ROOMS_KEY);
        const current: RoomData[] = saved ? JSON.parse(saved) : initialRooms;
        if (isDemoMode()) {
          const existing = new Set(current.map(r => r.number));
          const additions = DEFAULT_ROOM_NUMBERS
            .filter(n => !existing.has(n))
            .map(n => ({ number: n, status: 'available' } as RoomData));
          const next = additions.length ? [...current, ...additions] : current;
          if (next.length !== current.length) {
            localStorage.setItem(ROOMS_KEY, JSON.stringify(next));
            setRooms(next);
            emitRoomsUpdated();
          }
        }
      } catch {}
    };
    const loadStayover = () => {
      try {
        const raw = localStorage.getItem(STAYOVER_PREF_KEY);
        const map = raw ? JSON.parse(raw) : {};
        setStayoverMap(map);
      } catch { setStayoverMap({}); }
    };
    loadRooms();
    pruneRooms();
    loadStayover();
    // Branding
    try {
      const name = localStorage.getItem('hotel_name') || 'Kent Otel';
      const logo = localStorage.getItem('hotel_logo_url');
      setHotelName(name);
      setHotelLogoUrl(logo);
    } catch {
      setHotelName('Kent Otel');
      setHotelLogoUrl(null);
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROOMS_KEY) loadRooms();
      if (e.key === HK_CLEANING_KEY) setCleaning(getCleaningMap());
      if (e.key === STAYOVER_PREF_KEY) loadStayover();
    };
    window.addEventListener('storage', onStorage);
    // Bazı akışlar geriye dönük olarak sadece 'hk-cleaning-updated' yayınlıyor.
    // Bu durumda temizlik haritasıyla birlikte oda listesini de yeniden yükleyelim
    const onCustom = () => {
      setCleaning(getCleaningMap());
      loadRooms();
    };
    window.addEventListener('hk-cleaning-updated', onCustom as EventListener);
    const unsubRooms = onRoomsUpdated(() => loadRooms());
    const onStayover = () => loadStayover();
    window.addEventListener('stayover-preference-updated', onStayover as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onCustom as EventListener);
      unsubRooms?.();
      window.removeEventListener('stayover-preference-updated', onStayover as EventListener);
    };
  }, [initialRooms]);

  // Ek onarım: kanonik listedeki tüm odalar mevcut değilse ekle
  useEffect(() => {
    try {
      if (isDemoMode()) {
        const allowed = new Set(DEFAULT_ROOM_NUMBERS);
        const existing = new Set(rooms.map(r => r.number));
        const additions = DEFAULT_ROOM_NUMBERS
          .filter(n => !existing.has(n))
          .map(n => ({ number: n, status: 'available' } as RoomData));
        if (additions.length > 0) {
          const next = [...rooms, ...additions];
          localStorage.setItem(ROOMS_KEY, JSON.stringify(next));
          setRooms(next);
          emitRoomsUpdated();
        }
      }
    } catch {}
  }, [rooms]);

  const occupiedCount = useMemo(() => rooms.filter(r => r.status === 'occupied' || r.status === 'sold').length, [rooms]);
  const availableCount = useMemo(() => rooms.filter(r => r.status === 'available').length, [rooms]);
  const cleaningCount = useMemo(() => Object.values(cleaning).filter(c => c.inProgress).length, [cleaning]);

  const getHeaderClass = (room: RoomData) => {
    const c = cleaning[room.number];
    // Renkler: 🟥 Dolu, 🟧 Kirli, 🟨 Temizleniyor, 🟩 Temiz (Boş)
    if (c?.inProgress) return 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-t-xl';
    if (room.status === 'dirty') return 'bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-t-xl';
    if (c?.completedAt || room.status === 'available') return 'bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-t-xl';
    if (room.status === 'occupied' || room.status === 'sold') return 'bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-t-xl';
    if (room.status === 'reserved') return 'bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-t-xl';
    return 'bg-gradient-to-r from-secondary-600 to-secondary-700 text-white rounded-t-xl';
  };

  const getCardClass = (room: RoomData) => {
    const c = cleaning[room.number];
    if (c?.inProgress) return 'rounded-xl shadow-xl border border-yellow-200 ring-1 ring-yellow-100 bg-yellow-50 backdrop-blur-lg';
    if (room.status === 'dirty') return 'rounded-xl shadow-xl border border-orange-200 ring-1 ring-orange-100 bg-orange-50 backdrop-blur-lg';
    if (room.status === 'available' || cleaning[room.number]?.completedAt) return 'rounded-xl shadow-xl border border-green-200 ring-1 ring-green-100 bg-green-50 backdrop-blur-lg';
    if (room.status === 'occupied' || room.status === 'sold') return 'rounded-xl shadow-xl border border-rose-200 ring-1 ring-rose-100 bg-rose-50 backdrop-blur-lg';
    return 'rounded-xl shadow-xl border border-white/20 ring-1 ring-black/5 bg-white/60 backdrop-blur-lg';
  };

  const handleStart = (room: RoomData) => {
    startCleaning(room.number);
    pushNotification({
      title: `Temizlik Başladı` ,
      message: `Oda ${room.number} temizleniyor.`,
      type: 'housekeeping',
      priority: 'medium',
      recipient: 'reception'
    });
    setCleaning(getCleaningMap());
  };

  const openFinalizeModal = (room: RoomData) => {
    setModalRoom(room);
  };

  const canFinalize = useMemo(() => {
    const allChecked = Object.values(checklist).every(Boolean);
    return allChecked;
  }, [checklist]);

  const submitFinalize = () => {
    if (!modalRoom) return;
    finalizeCleaning(modalRoom.number, checklist, {} as any);
    pushNotification({
      title: 'Temizlik Tamamlandı',
      message: `Oda ${modalRoom.number} checklist onaylandı ve temizlik bitti.`,
      type: 'housekeeping',
      priority: 'medium',
      recipient: 'reception'
    });
    // Oda durumunu kirliyse 'müsait' olacak şekilde güncelle
    try {
      const rawRooms = localStorage.getItem(ROOMS_KEY);
      const arr = rawRooms ? JSON.parse(rawRooms) : [];
      const updated = arr.map((r: any) => {
        if (r.number === modalRoom.number) {
          if (r.status === 'dirty') {
            return { ...r, status: 'available' };
          }
        }
        return r;
      });
      localStorage.setItem(ROOMS_KEY, JSON.stringify(updated));
      // Gerçek zamanlı senkronizasyon için yayın
      emitRoomsUpdated();
      // Eski dinleyiciler için geriye dönük
      window.dispatchEvent(new Event('hk-cleaning-updated'));
    } catch {}
    setCleaning(getCleaningMap());
    // reset modal state
    setModalRoom(null);
    setChecklist({
      remotesOk: false,
      minibarOk: false,
      floorsClean: false,
      towelsStocked: false,
      toiletriesStocked: false,
      slippersPresent: false,
    });
  };

  const handleMaintenance = (room: RoomData) => {
    setMaintenanceModalRoom(room);
    setMaintenanceNote('');
    setMaintenanceImage('');
  };

  const getStatusText = (room: RoomData) => {
    const c = cleaning[room.number];
    if (c?.inProgress) return 'Temizleniyor';
    if (c?.completedAt) return 'Boş';
    if (room.status === 'occupied' || room.status === 'sold' || room.status === 'reserved') return 'Dolu';
    if (room.status === 'available' && room.checkOutDate) return 'Çıkış yaptı';
    if (room.status === 'dirty') return 'Kirli';
    return 'Boş';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-teal">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              {hotelLogoUrl ? (
                <img src={hotelLogoUrl} alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
              ) : (
                <img src="/logo192.png" alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
              )}
              <div>
                <h1 className="band-title flex items-center gap-2">{hotelName} <span className="icon-badge animate-float">🧹</span></h1>
                <p className="text-white/80 text-sm">Sadece oda kartları, misafir bilgisi olmadan</p>
                <div className="flex items-center gap-2 mt-3">
                  <a href="/housekeeping/tasks" className="btn-outline hover-tilt">Görevler</a>
                  <a href="/housekeeping/rooms" className="btn-outline hover-tilt">Odalar</a>
                  <a href="/housekeeping/notifications" className="btn-outline hover-tilt">Bildirimler</a>
                </div>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Dolu</div>
                <div className="text-lg font-semibold">{occupiedCount}</div>
              </div>
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Boş</div>
                <div className="text-lg font-semibold">{availableCount}</div>
              </div>
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Temizleniyor</div>
                <div className="text-lg font-semibold">{cleaningCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                mode="hk"
                onFinalizeCleaning={openFinalizeModal}
              />
            </div>
          </GoldGlassCard>
        ))}
      </div>
      {modalRoom && createPortal(
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <div className="premium-card w-full max-w-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Oda {modalRoom.number} - Temizlik Kontrol Listesi</h2>
              <button onClick={() => setModalRoom(null)} className="text-sm text-gray-600 hover:text-gray-800">İptal</button>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-sm">
              Bu liste zorunludur. Tüm maddeleri işaretlemeden temizlik tamamlanamaz.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.remotesOk ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.remotesOk} onChange={(e) => setChecklist(c => ({...c, remotesOk: e.target.checked}))} /><span>Kumandalar tam</span></label>
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.minibarOk ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.minibarOk} onChange={(e) => setChecklist(c => ({...c, minibarOk: e.target.checked}))} /><span>Minibar tam</span></label>
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.floorsClean ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.floorsClean} onChange={(e) => setChecklist(c => ({...c, floorsClean: e.target.checked}))} /><span>Yerler temiz</span></label>
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.towelsStocked ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.towelsStocked} onChange={(e) => setChecklist(c => ({...c, towelsStocked: e.target.checked}))} /><span>Havlu tam</span></label>
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.toiletriesStocked ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.toiletriesStocked} onChange={(e) => setChecklist(c => ({...c, toiletriesStocked: e.target.checked}))} /><span>Banyo ürünleri tam</span></label>
              <label className={`flex items-center space-x-2 p-2 rounded-lg border ${checklist.slippersPresent ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}`}><input type="checkbox" checked={checklist.slippersPresent} onChange={(e) => setChecklist(c => ({...c, slippersPresent: e.target.checked}))} /><span>Terlik var</span></label>
            </div>
            {/* Görevli alanları kaldırıldı */}
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setModalRoom(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">İptal</button>
              <button onClick={submitFinalize} disabled={!canFinalize} className={`px-4 py-2 rounded-lg text-sm text-white ${canFinalize ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}>Onayla ve Bitir</button>
            </div>
          </div>
        </div>, document.body
      )}
      {maintenanceModalRoom && createPortal(
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
          <div className="premium-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Oda {maintenanceModalRoom.number} - Arıza Bildir</h2>
              <button onClick={() => setMaintenanceModalRoom(null)} className="text-sm text-gray-600 hover:text-gray-800">İptal</button>
            </div>
            <div className="mt-4 space-y-3">
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={4} placeholder="Arıza notu" value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} />
              <div>
                <label className="text-sm font-medium">Görsel ekle</label>
                <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setMaintenanceImage(String(reader.result || '')); reader.readAsDataURL(file); }} />
                {maintenanceImage && (<img src={maintenanceImage} alt="Arıza görseli" className="mt-2 max-h-40 rounded" />)}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setMaintenanceModalRoom(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">İptal</button>
              <button onClick={() => {
                if (!maintenanceModalRoom) return;
                const ts = new Date().toISOString();
                try {
                  const raw = localStorage.getItem(MAINTENANCE_KEY);
                  const arr = raw ? JSON.parse(raw) : [];
                  const report = { id: `${maintenanceModalRoom.number}-${Date.now()}`, roomNumber: maintenanceModalRoom.number, note: maintenanceNote, image: maintenanceImage, timestamp: ts, status: 'open' };
                  localStorage.setItem(MAINTENANCE_KEY, JSON.stringify([...arr, report]));
                } catch {}
                try {
                  pushNotification({ title: `Arıza Bildirimi - Oda ${maintenanceModalRoom.number}`, message: maintenanceNote || 'Arıza bildirildi', type: 'maintenance', priority: 'high', recipient: 'maintenance' });
                } catch {}
                setLastMaintenanceRoom(maintenanceModalRoom.number);
                setMaintenanceModalRoom(null);
                setTimeout(() => setLastMaintenanceRoom(null), 2000);
              }} className="px-4 py-2 rounded-lg bg-yellow-600 text-white text-sm">Gönder</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default HKRooms;
 
// Modal UI
// Not: Basit bir inline modal, ayrı bir bileşene ayrılmadı
// Çünkü mevcut sayfaya minimal dokunuşla gereksinimleri karşılıyoruz.
// Modal, checklist ve görev atanmasını zorunlu kılar.

// Inject modal at end (portal yok, basit fixed overlay)
// We append JSX right above export default in render, but since this is a functional component,
// we add conditional block inside the return. To minimize patch complexity, we render modal here.