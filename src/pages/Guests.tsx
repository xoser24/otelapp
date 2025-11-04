import React, { useEffect, useMemo, useState } from 'react';
import { RoomData, Payment } from '../components/RoomCard';
import { FaUser, FaPhone, FaCalendarCheck, FaCalendarTimes, FaClock, FaBed, FaClipboardList, FaMoneyBillWave, FaCheckCircle, FaTimesCircle, FaSortAmountDown, FaSortAmountUp, FaEdit } from 'react-icons/fa';
import { upsertGuestFromRoom } from '../utils/guestList';
import { emitRoomsUpdated, onRoomsUpdated } from '../utils/events';
import { ROOMS_KEY } from '../utils/reservations';

// localStorage anahtarı

interface GuestItem {
  roomNumber: string;
  guestName?: string;
  phone?: string;
  checkIn?: string;
  checkOut?: string;
  expectedCheckOutDate?: string;
  stayNights?: number;
  price?: number;
  sumPaid?: number;
  paymentStatus?: RoomData['paymentStatus'];
  status: RoomData['status'];
}

function getDayCount(checkIn?: string, checkOut?: string) {
  if (!checkIn || !checkOut) return 0;
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  const diffMs = outDate.getTime() - inDate.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function getRemainingDays(checkIn?: string, expectedCheckOut?: string, stayNights?: number) {
  // Öncelik: expectedCheckOut -> hesaplanan check-in + stayNights
  const today = new Date();
  today.setHours(0,0,0,0);
  let plannedOut: Date | null = null;
  if (expectedCheckOut) {
    plannedOut = new Date(expectedCheckOut);
    plannedOut.setHours(0,0,0,0);
  } else if (checkIn && typeof stayNights === 'number') {
    const d = new Date(checkIn);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + stayNights);
    plannedOut = d;
  }
  if (!plannedOut) return undefined;
  const diff = Math.ceil((plannedOut.getTime() - today.getTime()) / (1000*60*60*24));
  return diff; // negatif olabilir: geç kalmış
}

function getRemainingClass(r?: number) {
  if (r == null) return 'text-gray-500';
  if (r < 0) return 'text-red-600 font-semibold';
  if (r === 0) return 'text-orange-600 font-semibold';
  if (r <= 2) return 'text-yellow-600';
  return 'text-green-600';
}

function getStatusGradient(status: RoomData['status']) {
  switch (status) {
    case 'sold':
      return 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-xl';
    case 'reserved':
      return 'bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-t-xl';
    case 'occupied':
      return 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-t-xl';
    default:
      return 'bg-gradient-to-r from-secondary-600 to-primary-600 text-white rounded-t-xl';
  }
}

const Guests: React.FC = () => {
  const [rooms, setRooms] = useState<RoomData[]>(() => {
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'dueToday' | 'occupied' | 'reserved' | 'sold'>('all');
  const [sortMode, setSortMode] = useState<'none' | 'asc' | 'desc'>('none');
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(ROOMS_KEY);
        setRooms(raw ? JSON.parse(raw) : []);
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROOMS_KEY) load();
    };
    window.addEventListener('storage', onStorage);
    const onHK = () => load();
    window.addEventListener('hk-cleaning-updated', onHK as EventListener);
    const onRoomsUpdated = () => load();
    window.addEventListener('rooms-updated', onRoomsUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onHK as EventListener);
      window.removeEventListener('rooms-updated', onRoomsUpdated as EventListener);
    };
  }, []);

  const counts = useMemo(() => {
    const occ = rooms.filter(r => r.status === 'occupied').length;
    const res = rooms.filter(r => r.status === 'reserved').length;
    const sold = rooms.filter(r => r.status === 'sold').length;
    const dueToday = rooms.filter(r => {
      const rem = getRemainingDays(r.checkInDate, r.expectedCheckOutDate, r.stayNights);
      return rem === 0;
    }).length;
    const all = rooms.filter(r => r.status === 'occupied' || r.status === 'reserved' || r.status === 'sold').length;
    return { all, occ, res, sold, dueToday };
  }, [rooms]);

  const items: GuestItem[] = useMemo(() => {
    return rooms.filter(r => r.status === 'occupied' || r.status === 'reserved' || r.status === 'sold')
      .map(r => {
        const sumPaid = (r.payments || []).reduce((s: number, p: Payment) => s + (p?.amount || 0), 0);
        return {
          roomNumber: r.number,
          guestName: formatGuestNames(r.guestNames as any, r.guestName),
          phone: r.phone,
          checkIn: r.checkInDate,
          checkOut: r.checkOutDate,
          expectedCheckOutDate: r.expectedCheckOutDate,
          stayNights: r.stayNights,
          price: r.price || 0,
          sumPaid,
          paymentStatus: r.paymentStatus,
          status: r.status,
        } as GuestItem;
      });
  }, [rooms]);

  const displayItems = useMemo(() => {
    let arr = items.slice();
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(it =>
        (it.guestName || '').toLowerCase().includes(q) ||
        (it.roomNumber || '').toLowerCase().includes(q) ||
        (it.phone || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'dueToday') {
      arr = arr.filter(it => (getRemainingDays(it.checkIn, it.expectedCheckOutDate, it.stayNights) ?? -9999) === 0);
    } else if (filterStatus !== 'all') {
      arr = arr.filter(it => it.status === filterStatus);
    }
    if (sortMode !== 'none') {
      arr.sort((a, b) => {
        const ra = getRemainingDays(a.checkIn, a.expectedCheckOutDate, a.stayNights);
        const rb = getRemainingDays(b.checkIn, b.expectedCheckOutDate, b.stayNights);
        const va = ra == null ? 9999 : ra;
        const vb = rb == null ? 9999 : rb;
        return sortMode === 'asc' ? va - vb : vb - va;
      });
    }
    return arr;
  }, [items, filterStatus, sortMode, query]);

  function openEdit(roomNumber: string, currentName?: string) {
    setEditingRoom(roomNumber);
    setNameInput(currentName || '');
  }

  function handleSave() {
    if (!editingRoom) return;
    const names = nameInput.split(',').map(s => s.trim()).filter(Boolean);

    setRooms(prev => {
      const updated = prev.map(r => {
        if (r.number !== editingRoom) return r;
        const next = { ...r, guestNames: names, guestName: names[0] || '' } as RoomData;
        return next;
      });
      try { localStorage.setItem(ROOMS_KEY, JSON.stringify(updated)); } catch {}
      try {
        // Gerçek zamanlı odalar senkronizasyonu
        emitRoomsUpdated();
        // Eski dinleyiciler için geriye dönük
        window.dispatchEvent(new Event('hk-cleaning-updated'));
      } catch {}
      const updatedRoom = updated.find(r => r.number === editingRoom);
      if (updatedRoom) {
        try { upsertGuestFromRoom(updatedRoom); } catch {}
      }
      return updated;
    });
    setEditingRoom(null);
    setNameInput('');
  }

  // Admin/HK tarafında oda güncellemelerini anında yansıt
  useEffect(() => {
    const unsub = onRoomsUpdated(() => {
      try {
        const raw = localStorage.getItem(ROOMS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        setRooms(arr);
      } catch {}
    });
    return () => { unsub?.(); };
  }, []);

  return (
    <div className="p-6">
      {/* Başlık bandı */}
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-blue">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold">Misafirler</h1>
              <p className="text-white/80 text-sm">Durum, kalan gün ve ödeme özetleri</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtre, arama ve sıralama çubuğu */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2 transition ${filterStatus==='all' ? 'bg-primary-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
          <FaClipboardList /> Tümü <span className="ml-1 text-xs opacity-70">({counts.all})</span>
        </button>
        <button onClick={() => setFilterStatus('dueToday')} className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2 transition ${filterStatus==='dueToday' ? 'bg-orange-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
          <FaClock /> Bugün Çıkacak <span className="ml-1 text-xs opacity-70">({counts.dueToday})</span>
        </button>
        <button onClick={() => setFilterStatus('occupied')} className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2 transition ${filterStatus==='occupied' ? 'bg-yellow-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
          <FaBed /> Konaklayan <span className="ml-1 text-xs opacity-70">({counts.occ})</span>
        </button>
        <button onClick={() => setFilterStatus('reserved')} className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2 transition ${filterStatus==='reserved' ? 'bg-primary-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
          <FaCalendarCheck /> Rezerve <span className="ml-1 text-xs opacity-70">({counts.res})</span>
        </button>
        <button onClick={() => setFilterStatus('sold')} className={`px-3 py-1.5 rounded-full text-sm inline-flex items-center gap-2 transition ${filterStatus==='sold' ? 'bg-emerald-600 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
          <FaMoneyBillWave /> Satış <span className="ml-1 text-xs opacity-70">({counts.sold})</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ara: isim, oda, telefon"
            className="px-3 py-1.5 rounded-full bg-white border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex bg-gray-100 rounded-full overflow-hidden">
            <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 text-sm ${viewMode==='cards' ? 'bg-white shadow' : 'text-gray-700'}`}>Kartlar</button>
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-sm ${viewMode==='table' ? 'bg-white shadow' : 'text-gray-700'}`}>Tablo</button>
          </div>
          <span className="text-sm text-gray-700">Sırala:</span>
          <button onClick={() => setSortMode(sortMode==='asc' ? 'desc' : 'asc')} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm inline-flex items-center gap-2 transition">
            {sortMode==='asc' ? <FaSortAmountDown /> : <FaSortAmountUp />} Kalan Gün ({sortMode==='none' ? 'Yok' : sortMode==='asc' ? 'Artan' : 'Azalan'})
          </button>
          <button onClick={() => setSortMode('none')} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm">Temizle</button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-2">Oda</th>
                <th className="text-left px-4 py-2">Misafir(ler)</th>
                <th className="text-left px-4 py-2">Telefon</th>
                <th className="text-left px-4 py-2">Durum</th>
                <th className="text-left px-4 py-2">Check-in</th>
                <th className="text-left px-4 py-2">Check-out</th>
                <th className="text-left px-4 py-2">Kalan Gün</th>
                <th className="text-left px-4 py-2">Ödeme</th>
                <th className="text-left px-4 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((it, idx) => {
                const remaining = getRemainingDays(it.checkIn, it.expectedCheckOutDate, it.stayNights);
                const remainingText = remaining == null ? '—' : `${remaining}`;
                const debt = (it.price || 0) - (it.sumPaid || 0);
                const payText = debt > 0 ? `Eksik ₺${debt}` : 'Tamam';
                return (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{it.roomNumber}</td>
                    <td className="px-4 py-2">{it.guestName || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{it.phone || '—'}</td>
                    <td className="px-4 py-2">{it.status === 'sold' ? 'Satış' : it.status === 'reserved' ? 'Rezerve' : 'Dolu'}</td>
                    <td className="px-4 py-2">{it.checkIn ? new Date(it.checkIn).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2">{it.checkOut ? new Date(it.checkOut).toLocaleDateString() : '—'}</td>
                    <td className={`px-4 py-2 ${getRemainingClass(remaining)}`}>{remainingText}</td>
                    <td className="px-4 py-2">{payText}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => openEdit(it.roomNumber, it.guestName)}
                        className="px-2 py-1 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700 inline-flex items-center gap-1"
                      >
                        <FaEdit /> Düzenle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kart grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {displayItems.map((it, idx) => {
          const dayCount = getDayCount(it.checkIn, it.checkOut);
          const remaining = getRemainingDays(it.checkIn, it.expectedCheckOutDate, it.stayNights);
          const remainingText = remaining == null ? '—' : `${remaining}`;
          const debt = (it.price || 0) - (it.sumPaid || 0);
          const isPaid = it.paymentStatus === 'received' || debt <= 0;
          const payText = isPaid ? 'Tamam' : `Eksik ₺${debt}`;

          const statusIcon = it.status==='sold' ? <FaMoneyBillWave className="text-white/90" /> : it.status==='reserved' ? <FaCalendarCheck className="text-white/90" /> : <FaBed className="text-white/90" />;
          const statusLabel = it.status==='sold' ? 'Satış' : it.status==='reserved' ? 'Rezerve' : 'Dolu';

          return (
            <div key={idx} className="group rounded-2xl shadow-xl border border-white/20 ring-1 ring-black/5 bg-white/70 backdrop-blur-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all">
              {/* Başlık */}
              <div className={`${getStatusGradient(it.status)} p-3 flex items-center justify-between`}>
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">{it.roomNumber}</div>
                  <div>
                    <p className="text-xs opacity-90">Oda</p>
                    <div className="flex items-center space-x-2">
                      {statusIcon}
                      <p className="text-base font-semibold">{statusLabel}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${remaining != null && remaining <= 0 ? 'bg-orange-500/30 text-white' : 'bg-white/20 text-white'}`}>
                    <FaClock /> Kalan: {remainingText}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-xs inline-flex items-center gap-1 ${isPaid ? 'bg-green-500/30 text-white' : 'bg-red-500/30 text-white'}`}>
                    {isPaid ? <FaCheckCircle /> : <FaTimesCircle />} Ödeme: {payText}
                  </span>
                  <button
                    onClick={() => openEdit(it.roomNumber, it.guestName)}
                    className="px-2 py-1 rounded-lg text-xs inline-flex items-center gap-1 bg-white/20 text-white hover:bg-white/30 transition"
                    title="İsim Düzenle"
                  >
                    <FaEdit /> Düzenle
                  </button>
                </div>
              </div>

              {/* Gövde */}
              <div className="p-4">
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <FaUser className="text-primary-600" />
                    <span className="font-medium">{it.guestName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaPhone className="text-primary-600" />
                    <span className="whitespace-nowrap">{it.phone || '—'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <FaCalendarCheck className="text-primary-600" />
                      <span>Check-in: {it.checkIn ? new Date(it.checkIn).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCalendarTimes className="text-primary-600" />
                      <span>Check-out: {it.checkOut ? new Date(it.checkOut).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-600">Toplam Gün: <span className="font-semibold">{dayCount}</span></div>
                  <div className={`text-xs ${getRemainingClass(remaining)}`}>Kalan Gün: <span className="font-semibold">{remainingText}</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Misafir Adı(ları) Düzenle — Oda {editingRoom}</h3>
            <p className="text-sm text-gray-600 mb-3">Birden fazla adı virgül ile ayırabilirsiniz.</p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Örn: Ali Veli, Ayşe Yılmaz"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditingRoom(null); setNameInput(''); }} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200">Vazgeç</button>
              <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Guests;

// Safe formatter for guestNames that tolerates wrong runtime types
const formatGuestNames = (guestNames: any, fallback?: string) => {
  if (Array.isArray(guestNames) && guestNames.length) return guestNames.join(', ');
  if (typeof guestNames === 'string' && guestNames.trim()) return guestNames.trim();
  return fallback || '';
};