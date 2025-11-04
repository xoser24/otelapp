import React, { useEffect, useState, useRef } from 'react';
import { FaUser, FaPhone, FaMoneyBillWave, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaBroom, FaDoorOpen } from 'react-icons/fa';
import { pushNotification } from '../utils/notifications';
import Modal from './Modal';
import { ARCHIVED_GUESTS_KEY, POS_INFO_KEY } from '../utils/endOfDay';
import { markRoomReservedForNextGuest, findReservationsByRoomOnDate, getTomorrow, addReservation, getToday, getReservations, updateReservationStatus } from '../utils/reservations';

export type PaymentStatus = 'received' | 'not_received';
export type PaymentMethod = 'card' | 'cash' | 'iban' | null;

export interface RoomData {
  number: string;
  status: 'available' | 'reserved' | 'occupied' | 'dirty' | 'sold' | 'changing';
  guestName?: string;
  guestNames?: string[];
  phone?: string;
  price?: number;
  checkInDate?: string;
  checkOutDate?: string;
  willContinue?: boolean;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  iban?: string;
  expenses?: { id: string; label: string; amount: number }[];
  payments?: Payment[];
  expectedCheckOutDate?: string;
  stayNights?: number;
  isReservedForNextGuest?: boolean;
  issues?: string[];
  issuePhotos?: string[];
  notes?: string;
}

interface RoomCardProps {
  room: RoomData;
  onChange: (updated: RoomData) => void;
  availableRoomNumbers?: string[];
  onSwitchRoom?: (fromNumber: string, toNumber: string) => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onChange, availableRoomNumbers, onSwitchRoom }) => {
  const [localRoom, setLocalRoom] = useState<RoomData>(room);
  const HK_CLEANING_KEY = 'hk_cleaning_status';
  const [cleaning, setCleaning] = useState<{ inProgress: boolean; startTime?: number; completedAt?: number }>({ inProgress: false });
  const [elapsed, setElapsed] = useState<number>(0);
  const [newGuestName, setNewGuestName] = useState<string>('');
  const [showStayoverModal, setShowStayoverModal] = useState<boolean>(false);
  const [stayoverPref, setStayoverPref] = useState<'requested' | 'not_requested' | 'unspecified'>('unspecified');
  const STAYOVER_PREF_KEY = 'stayover_preference';
  const [isDark, setIsDark] = useState(false);
  const [statusPulse, setStatusPulse] = useState(false);
  const [displayMode, setDisplayMode] = useState<'compact'|'standard'|'xl'>('standard');
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  // Sistem temasını takip et
  useEffect(() => {
    try {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: any) => setIsDark(!!e.matches);
      setIsDark(!!mq?.matches);
      if (mq?.addEventListener) mq.addEventListener('change', handler); else mq?.addListener?.(handler);
      return () => { if (mq?.removeEventListener) mq.removeEventListener('change', handler); else mq?.removeListener?.(handler); };
    } catch {}
  }, []);

  // Statü değişiminde yumuşak vurgu
  useEffect(() => {
    setStatusPulse(true);
    const t = setTimeout(() => setStatusPulse(false), 600);
    return () => clearTimeout(t);
  }, [localRoom.status, cleaning.inProgress]);

  // Prop güncellemelerinde kartı senkronize tut
  useEffect(() => { setLocalRoom(room); }, [room]);

  useEffect(() => {
    const loadCleaning = () => {
      try {
        const raw = localStorage.getItem(HK_CLEANING_KEY);
        const map = raw ? JSON.parse(raw) : {};
        setCleaning(map[room.number] || { inProgress: false });
      } catch { setCleaning({ inProgress: false }); }
    };
    loadCleaning();
    const onStorage = (e: StorageEvent) => { if (e.key === HK_CLEANING_KEY) loadCleaning(); };
    window.addEventListener('storage', onStorage);
    const onCustom = () => loadCleaning();
    window.addEventListener('hk-cleaning-updated', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onCustom as EventListener);
    };
  }, [room.number]);

useEffect(() => {
  let id: any;
  if (cleaning.inProgress && cleaning.startTime) {
    const update = () => setElapsed(Math.floor((Date.now() - (cleaning.startTime || 0)) / 1000));
    update();
    id = setInterval(update, 1000);
  } else {
    setElapsed(0);
  }
  return () => { if (id) clearInterval(id); };
}, [cleaning.inProgress, cleaning.startTime]);

const handleField = (field: keyof RoomData, value: any) => {
  // Add a payment record when marking as received
  if (field === 'paymentStatus' && value === 'received') {
    if (localRoom.paymentStatus !== 'received') {
      const selectedMethod = localRoom.paymentMethod || 'cash';
      const price = Number(localRoom.price || 0);
      const currentPaid = (localRoom.payments || []).reduce((s, p: any) => s + (Number(p?.amount) || 0), 0);
      const remaining = Math.max(0, price - currentPaid);
      if (remaining > 0) {
        const newPayment = {
          id: Math.random().toString(36).slice(2),
          method: selectedMethod as any,
          amount: remaining,
          time: new Date().toISOString(),
          reference: selectedMethod === 'iban' ? (localRoom.iban || undefined) : undefined,
        } as any;
        const updated = { ...localRoom, [field]: value, paymentMethod: selectedMethod as any, payments: [ ...(localRoom.payments || []), newPayment ] } as RoomData;
        setLocalRoom(updated);
        onChange(updated);
        return;
      }
    }
  }

  const updated = { ...localRoom, [field]: value } as RoomData;
  setLocalRoom(updated);
  onChange(updated);
};

const handleCheckIn = () => {
  const updated: RoomData = {
    ...localRoom,
    status: 'occupied',
    checkInDate: new Date().toISOString(),
  };
  // Temizlik durumunu sıfırla (tamamlandı/inProgress kaldır)
  try {
    const raw = localStorage.getItem(HK_CLEANING_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[room.number] = { ...(map[room.number] || {}), inProgress: false, completedAt: undefined };
    localStorage.setItem(HK_CLEANING_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('hk-cleaning-updated'));
  } catch {}
  setLocalRoom(updated);
  onChange(updated);
};

const handleCheckOut = () => {
  const nowISO = new Date().toISOString();
  // Misafir kaydını arşive ekle
  try {
    const rawArch = localStorage.getItem(ARCHIVED_GUESTS_KEY);
    const archived = rawArch ? JSON.parse(rawArch) : [];
    archived.push({
      roomNumber: localRoom.number,
      guest: (localRoom.guestNames?.join(', ') || localRoom.guestName || ''),
      checkInDate: localRoom.checkInDate,
      checkOutDate: nowISO,
      price: localRoom.price,
      paymentStatus: localRoom.paymentStatus,
      paymentMethod: localRoom.paymentMethod,
      payments: localRoom.payments || [],
      archivedAt: nowISO,
    });
    localStorage.setItem(ARCHIVED_GUESTS_KEY, JSON.stringify(archived));
  } catch {}

  // Yarın rezervasyon kontrolü
  const hasResTomorrow = (() => {
    try {
      const t = getTomorrow(nowISO);
      return findReservationsByRoomOnDate(localRoom.number, t).length > 0;
    } catch {
      return false;
    }
  })();

  const cleared: RoomData = {
    ...localRoom,
    status: 'dirty',
    guestName: '',
    guestNames: [],
    phone: '',
    price: undefined,
    checkInDate: undefined,
    checkOutDate: undefined,
    willContinue: false,
    paymentStatus: undefined,
    paymentMethod: null,
    iban: '',
    payments: [],
    isReservedForNextGuest: hasResTomorrow,
  };

  // Odayı sonraki misafir için işaretle ve HK’a haber ver
  try { markRoomReservedForNextGuest(localRoom.number, nowISO); } catch {}
  setLocalRoom(cleared);
  onChange(cleared);
  try {
    pushNotification({
      title: 'Yeni Temizlik Gerekiyor',
      message: `Oda ${localRoom.number} check-out yaptı ve 'Kirli' olarak işaretlendi.`,
      type: 'housekeeping',
      priority: 'high',
      recipient: 'housekeeping'
    });
  } catch {}
  // Check-out sonrası temizlik durumunu sıfırla
  try {
    const HK_CLEANING_KEY = 'hk_cleaning_status';
    const raw = localStorage.getItem(HK_CLEANING_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const next = { ...(map[room.number] || {}), inProgress: false, completedAt: undefined };
    map[room.number] = next;
    localStorage.setItem(HK_CLEANING_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('hk-cleaning-updated'));
  } catch {}
};

// Satış sonrası anında arşivleme ve kart temizleme
const finalizeSale = () => {
  const base = localRoom;
  const updated: RoomData = {
    ...base,
    status: 'sold',
    checkInDate: base.checkInDate || new Date().toISOString(),
  } as RoomData;
  setLocalRoom(updated);
  onChange(updated);
};

const autoSoldAppliedRef = useRef(false);
useEffect(() => {
  if (autoSoldAppliedRef.current) return;
  if (
    localRoom.paymentStatus === 'received' &&
    localRoom.status !== 'sold' &&
    (
      localRoom.status === 'occupied' ||
      localRoom.status === 'reserved' ||
      localRoom.status === 'available' ||
      localRoom.status === 'dirty'
    )
  ) {
    const isCardSale = localRoom.paymentMethod === 'card';
    if (isCardSale) {
      try {
        const raw = localStorage.getItem(POS_INFO_KEY);
        const all = raw ? JSON.parse(raw) : {};
        const todayKey = new Date().toISOString().slice(0,10);
        const info = all[todayKey] || {};
        const hasInvoiceOrZ = !!info.invoiceIssued || !!(info.zReportNumber && String(info.zReportNumber).trim());
        if (!hasInvoiceOrZ) {
          // Do not auto-sell yet for card sales without POS/Z info
          return;
        }
      } catch {}
    }
    const updated: RoomData = {
      ...localRoom,
      status: 'sold',
      checkInDate: localRoom.checkInDate || new Date().toISOString(),
    };
    setLocalRoom(updated);
    onChange(updated);
    autoSoldAppliedRef.current = true;
  }
}, [localRoom, onChange]);

// İsim girilince statüyü otomatik 'rezerve' yap
useEffect(() => {
  const hasSingle = !!(localRoom.guestName && localRoom.guestName.trim());
  const hasMultiple = Array.isArray(localRoom.guestNames) && localRoom.guestNames.some(n => n && n.trim());
  const shouldReserve = (hasSingle || hasMultiple) && (localRoom.status === 'available' || localRoom.status === 'dirty');
  if (shouldReserve) {
    const updated: RoomData = { ...localRoom, status: 'reserved' };
    setLocalRoom(updated);
    onChange(updated);
  }
}, [localRoom, onChange]);
 
const startStayoverCleaning = () => {
  try {
    const raw = localStorage.getItem(HK_CLEANING_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const next = { ...(map[room.number] || {}), inProgress: true, startTime: Date.now(), completedAt: undefined };
    map[room.number] = next;
    localStorage.setItem(HK_CLEANING_KEY, JSON.stringify(map));
    setCleaning(next);
    window.dispatchEvent(new Event('hk-cleaning-updated'));
  } catch {}
  handleField('willContinue', true);
  try {
    pushNotification({
      title: `Stayover Temizlik Başladı`,
      message: `Oda ${room.number} için stayover temizlik başlatıldı.`,
      type: 'housekeeping',
      priority: 'medium',
      recipient: 'housekeeping'
    });
  } catch {}
};

const getHeaderGradient = (status: RoomData['status']) => {
  switch (status) {
    case 'sold':
      return 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-xl';
    case 'dirty':
      return 'bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-xl';
    case 'reserved':
      return 'bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-t-xl';
    case 'occupied':
      return 'bg-gradient-to-r from-yellow-600 to-amber-600 text-white rounded-t-xl';
    case 'changing':
      return 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-t-xl';
    default:
      return 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-t-xl';
  }
};

const getHeaderGradientWithCleaning = (status: RoomData['status']) => {
  return 'bg-gradient-to-b from-white to-gray-50 text-gray-900 rounded-t-2xl border-b border-gray-100';
};

const getStatusLabel = (status: RoomData['status']) => {
  switch (status) {
    case 'occupied':
      return 'Dolu';
    case 'dirty':
      return 'Kirli';
    case 'reserved':
      return 'Rezerve';
    case 'sold':
      return 'Satıldı';
    case 'changing':
      return 'Değiştiriliyor';
    default:
      return 'Müsait';
  }
};

const formatGuestNames = (guestNames: any, fallback?: string) => {
  if (Array.isArray(guestNames) && guestNames.length) return guestNames.join(', ');
  if (typeof guestNames === 'string' && guestNames.trim()) return guestNames.trim();
  return fallback || '';
};

const getAccentColor = (status: RoomData['status'], cleaningInProgress: boolean) => {
  if (cleaningInProgress) return 'bg-fuchsia-400';
  switch (status) {
    case 'sold': return 'bg-emerald-400';
    case 'dirty': return 'bg-orange-400';
    case 'reserved': return 'bg-primary-500';
    case 'occupied': return 'bg-amber-400';
    case 'changing': return 'bg-purple-500';
    default: return 'bg-gray-300';
  }
};

// Yeni: Oda numarası rozetine gri/gold ve statüye bağlı pulse
const getRoomNumberBadgeClasses = (status: RoomData['status'], cleaningInProgress: boolean) => {
  const base = 'bg-gradient-to-br from-gray-700 to-gray-800 text-amber-300 ring-2 flex items-center justify-center font-bold';
  if (cleaningInProgress) {
    return `${base} ring-amber-400 animate-pulse`;
  }
  switch (status) {
    case 'dirty':
      return `${base} ring-red-400 animate-pulse`;
    case 'reserved':
      return `${base} ring-amber-400 animate-pulse`;
    case 'changing':
      return `${base} ring-purple-400 animate-pulse`;
    case 'sold':
      return `${base} ring-emerald-400`;
    case 'occupied':
      return `${base} ring-amber-300`;
    default:
      return `${base} ring-gray-300`;
  }
};
const getStatusIcon = (status: RoomData['status']) => {
  switch (status) {
    case 'sold':
      return <FaMoneyBillWave className="text-white text-sm opacity-90" />;
    case 'dirty':
      return <FaBroom className="text-white text-sm opacity-90" />;
    case 'reserved':
      return <FaUser className="text-white text-sm opacity-90" />;
    case 'occupied':
      return <FaUser className="text-white text-sm opacity-90" />;
    case 'changing':
      return <FaExclamationTriangle className="text-white text-sm opacity-90" />;
    default:
      return <FaDoorOpen className="text-white text-sm opacity-90" />;
  }
};

const premiumCard = 'group relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/20 hover:ring-white/30 bg-black/40 backdrop-blur-[32px] text-white';

// Duruma göre kart animasyon sınıfları (RoomData.status birliklerine uyumlu)
const getCardAnimClasses = (status: RoomData['status'], cleaningInProgress: boolean) => {
  if (cleaningInProgress) return 'glow-sky pulse-strong';
  switch (status) {
    case 'available':
      return 'glow-emerald pulse-strong';
    case 'dirty':
      return 'glow-amber pulse-strong';
    case 'reserved':
      return 'glow-sky pulse-strong';
    case 'occupied':
      return 'glow-amber pulse-strong';
    case 'sold':
      return 'glow-emerald pulse-strong';
    case 'changing':
      return 'glow-rose pulse-strong wiggle-soft';
    default:
      return '';
  }
};

const cleaningPercent = Math.min(100, Math.floor(elapsed/60 / 30 * 100));
const cleaningTotalMin = 30;
const minutesElapsed = Math.floor(elapsed/60);
const minutesRemaining = Math.max(0, cleaningTotalMin - minutesElapsed);
const etaLabel = (cleaning.startTime ? new Date(cleaning.startTime + cleaningTotalMin * 60000) : new Date(Date.now() + minutesRemaining * 60000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const etaText = `Tahmini bitiş: ${etaLabel} (~${minutesRemaining}dk)`;
const showGuest = localRoom.status === 'occupied' || localRoom.status === 'reserved' || localRoom.status === 'sold';
const headerPadding = displayMode==='xl' ? 'p-5' : displayMode==='compact' ? 'p-3' : 'p-4';
const bodyPadding = displayMode==='xl' ? 'p-5' : displayMode==='compact' ? 'p-3' : 'p-4';
const roomBadgeSizeClass = displayMode==='xl' ? 'h-16 w-16 text-xl' : displayMode==='compact' ? 'h-10 w-10 text-sm' : 'h-14 w-14 text-lg';

// Hızlı aksiyonlar
const handleQuickCall = () => {
  if (localRoom.phone) {
    window.location.href = `tel:${localRoom.phone}`;
  } else {
    try {
      pushNotification({ title: 'Telefon bulunamadı', message: `Oda ${localRoom.number} için telefon mevcut değil.`, type: 'system', priority: 'low', recipient: 'reception' });
    } catch {}
  }
};
const handleQuickPayment = () => { handleField('paymentStatus', localRoom.paymentStatus === 'received' ? 'not_received' : 'received'); };
const [newIssueName, setNewIssueName] = useState('');
const handleQuickAlert = () => {
  try {
    pushNotification({ title: `Oda ${localRoom.number} için uyarı`, message: 'Lütfen kontrol edin', type: 'system', priority: 'medium', recipient: 'housekeeping' });
  } catch {}
};

return (
  <>
  <div className={`group ${premiumCard} ${getCardAnimClasses(room.status, cleaning.inProgress)} ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white'}`}>
    <div className={`absolute left-0 top-0 h-full w-1 ${getAccentColor(localRoom.status, cleaning.inProgress)} opacity-90 transition-all duration-300 group-hover:w-2 group-hover:shadow-xl`}>
      <div className={`absolute inset-0 ${statusPulse ? 'opacity-30' : 'opacity-15'} animate-shimmer bg-gradient-to-b from-transparent via-white/30 to-transparent`}></div>
    </div>
  <div className={`group ${getHeaderGradient(localRoom.status)} ring-1 ring-white/10 hover:ring-cyan-300/40 relative ${headerPadding} overflow-hidden cursor-pointer transition-all duration-300`} onClick={() => setShowDetailsModal(true)}>
      {/* İnce gradient üst çizgi ve soft sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/20 to-transparent opacity-60"></div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 opacity-5 hover:opacity-20 transition-opacity"></div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-300/12 via-transparent to-indigo-300/18 opacity-5 group-hover:opacity-20 transition-opacity"></div>
      {/* Diamond facet overlay: ince kesim çizgileri */}
      <div className="pointer-events-none absolute inset-0 opacity-5 group-hover:opacity-20 transition-opacity bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_6px)]"></div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
-          <div className={`${roomBadgeSizeClass} rounded-lg bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center font-bold text-gray-900`}>{room.number}</div>
           <div className={`${roomBadgeSizeClass} rounded-xl ${getRoomNumberBadgeClasses(localRoom.status, cleaning.inProgress)} ring-2 ring-cyan-400/50 group-hover:ring-cyan-400/70 drop-shadow-[0_0_16px_rgba(165,243,252,0.35)] transition`}>{room.number}</div>
           <div className="flex flex-col">
            <span className="text-xs text-white/70">Oda</span>
            <div className={`flex items-center gap-2 text-base font-semibold`}>
              {/* İkon rengi daha nötr */}
              {localRoom.status === 'sold' ? <FaMoneyBillWave className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />
               : localRoom.status === 'dirty' ? <FaBroom className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />
               : localRoom.status === 'reserved' ? <FaUser className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />
               : localRoom.status === 'occupied' ? <FaUser className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />
               : localRoom.status === 'changing' ? <FaExclamationTriangle className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />
               : <FaDoorOpen className="text-white text-sm drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />}
              <span>{cleaning.inProgress ? `Temizleniyor (${Math.floor(elapsed/60)}dk)` : getStatusLabel(localRoom.status)}</span>
            </div>
            {cleaning.inProgress && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/10 ring-1 ring-white/20 text-white">
                %{cleaningPercent}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(localRoom.isReservedForNextGuest) && (
            <span className="px-2.5 py-1 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs flex items-center space-x-1 transition-all duration-300 hover:bg-white/20 hover:ring-cyan-300/40 hover:shadow-[0_0_16px_rgba(165,243,252,0.20)]">
              <FaExclamationTriangle className="text-yellow-300" />
              <span>Yarın rezervasyon</span>
            </span>
          )}
          {showGuest && (localRoom.guestNames?.length || localRoom.guestName) && (
            <div className="flex flex-wrap gap-1 max-w-[380px]">
              {((localRoom.guestNames && localRoom.guestNames.length > 0) ? localRoom.guestNames : (localRoom.guestName ? [localRoom.guestName] : []))
                .filter(Boolean)
                .map((nm, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs transition-all duration-300 hover:bg-white/20 hover:ring-cyan-300/40 hover:shadow-[0_0_16px_rgba(165,243,252,0.20)]">{nm}</span>
                ))}
            </div>
          )}
          {Array.isArray(localRoom.issues) && localRoom.issues.length > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-rose-600/20 ring-1 ring-rose-400/40 text-rose-100 text-xs flex items-center space-x-1">
              <FaExclamationTriangle className="text-rose-300" />
              <span>Arıza: {localRoom.issues.length}</span>
            </span>
          )}
          {localRoom.paymentStatus && (
            <span className={`px-2.5 py-1 rounded-md text-xs flex items-center space-x-1 ring-1 bg-white/10 ring-white/20 text-white`}>
              {localRoom.paymentStatus==='received' ? <FaCheckCircle className="text-emerald-300" /> : <FaTimesCircle className="text-rose-300" />}
              <span>{localRoom.paymentStatus==='received' ? 'Alındı' : 'Alınmadı'}</span>
            </span>
          )}
          {localRoom.paymentMethod && (
            <span className="px-2.5 py-1 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs transition-all duration-300 hover:bg-white/20 hover:ring-cyan-300/40 hover:shadow-[0_0_16px_rgba(165,243,252,0.20)]">{localRoom.paymentMethod==='card' ? 'Kart' : localRoom.paymentMethod==='cash' ? 'Nakit' : 'IBAN'}</span>
          )}
        </div>
      </div>
      {cleaning.inProgress && (
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-primary-400" style={{ width: `${cleaningPercent}%` }}></div>
        </div>
      )}
      {cleaning.inProgress && (
        <div className="mt-1 text-xs text-white/70">{etaText}</div>
      )}
    </div>

    <div className={`${bodyPadding} grid grid-cols-1 gap-2`}>
      {/* Misafir Bilgileri (Tek ve Çoklu isim) */}
      <div className="space-y-3 bg-black/30 backdrop-blur-glass rounded-2xl p-4 border border-amber-200/20 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center space-x-2">
            <FaUser className="text-primary-600" />
            <input
              type="text"
              placeholder="Misafir adı (tek)"
              value={localRoom.guestName || ''}
              onChange={(e) => handleField('guestName', e.target.value)}
              className="w-full rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30"
            />
          </div>
          <div className="flex items-center space-x-2">
            <FaPhone className="text-primary-600" />
            <input
              type="tel"
              placeholder="Telefon"
              value={localRoom.phone || ''}
              onChange={(e) => handleField('phone', e.target.value)}
              className="w-full rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30"
            />
          </div>
        </div>

        {showGuest && (
          <div className="bg-black/30 backdrop-blur-glass border border-amber-200/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Misafir İsimleri (çoklu)</span>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Yeni isim"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30"
                />
                <button
                  onClick={() => {
                    const name = newGuestName.trim();
                    if (!name) return;
                    const existing = Array.isArray(localRoom.guestNames) ? localRoom.guestNames : [];
                    const updated = { ...localRoom, guestNames: [...existing, name] } as RoomData;
                    setLocalRoom(updated);
                    onChange(updated);
                    setNewGuestName('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
                >
                  Ekle
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {(localRoom.guestNames || []).map((nm, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nm}
                    onChange={(e) => {
                      const arr = [...(localRoom.guestNames || [])];
                      arr[idx] = e.target.value;
                      const updated = { ...localRoom, guestNames: arr } as RoomData;
                      setLocalRoom(updated);
                      onChange(updated);
                    }}
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30"
                  />
                  <button
                    onClick={() => {
                      const arr = (localRoom.guestNames || []).filter((_, i) => i !== idx);
                      const updated = { ...localRoom, guestNames: arr } as RoomData;
                      setLocalRoom(updated);
                      onChange(updated);
                    }}
                    className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Arızalar */}
      <div className="bg-white/50 border border-white/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold flex items-center gap-2"><FaExclamationTriangle className="text-red-600" /> Arızalar</span>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Yeni arıza"
              value={newIssueName}
              onChange={(e) => setNewIssueName(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
            <button
              onClick={() => {
                const txt = newIssueName.trim();
                if (!txt) return;
                const existing = Array.isArray(localRoom.issues) ? localRoom.issues : [];
                const updated = { ...localRoom, issues: [...existing, txt] } as RoomData;
                setLocalRoom(updated);
                onChange(updated);
                setNewIssueName('');
              }}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
            >
              Ekle
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {(localRoom.issues || []).map((issue, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={issue}
                onChange={(e) => {
                  const arr = [...(localRoom.issues || [])];
                  arr[idx] = e.target.value;
                  const updated = { ...localRoom, issues: arr } as RoomData;
                  setLocalRoom(updated);
                  onChange(updated);
                }}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const arr = (localRoom.issues || []).filter((_, i) => i !== idx);
                  const updated = { ...localRoom, issues: arr } as RoomData;
                  setLocalRoom(updated);
                  onChange(updated);
                }}
                className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs hover:bg-rose-700"
              >
                Sil
              </button>
            </div>
          ))}
          {(localRoom.issues || []).length === 0 && (
            <div className="text-xs text-gray-600">Arıza kaydı yok.</div>
          )}
        </div>
      </div>

      {/* Ücret ve Ödeme Durumu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/30 backdrop-blur-glass rounded-2xl p-4 border border-amber-200/20 text-white">
        <div className="flex items-center space-x-2">
          <FaMoneyBillWave className="text-primary-600" />
          <input
            type="number"
            placeholder="Ücret (₺)"
            value={localRoom.price ?? ''}
            onChange={(e) => handleField('price', Number(e.target.value))}
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30"
          />
        </div>

        <div className="flex items-center space-x-2">
          {localRoom.paymentStatus === 'received' ? (
            <FaCheckCircle className="text-green-600" />
          ) : (
            <FaTimesCircle className="text-red-600" />
          )}
          <select
            value={localRoom.paymentStatus || ''}
            onChange={(e) => handleField('paymentStatus', e.target.value as PaymentStatus)}
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white border border-amber-200/30"
          >
            <option value="">Ödeme Durumu</option>
            <option value="received">Alındı</option>
            <option value="not_received">Alınmadı</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={localRoom.paymentMethod || ''}
            onChange={(e) => handleField('paymentMethod', (e.target.value || null) as PaymentMethod)}
            disabled={localRoom.paymentStatus !== 'received'}
            className="w-full rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-400/20 focus:outline-none bg-black/30 backdrop-blur-glass text-white border border-amber-200/30 disabled:bg-black/20"
          >
            <option value="">Ödeme Yöntemi</option>
            <option value="card">Kart</option>
            <option value="cash">Nakit</option>
            <option value="iban">IBAN</option>
          </select>
        </div>
      </div>

      {localRoom.paymentStatus === 'received' && localRoom.paymentMethod === 'iban' && (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="IBAN Referansı"
            value={localRoom.iban || ''}
            onChange={(e) => handleField('iban', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900"
          />
        </div>
      )}

      {/* Giderler bölümü kaldırıldı: işlemler artık Raporlar sayfasında yönetiliyor */}

      {/* Oda Değiştir */}
      {availableRoomNumbers && onSwitchRoom && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <select
              onChange={(e) => {
                const toNumber = e.target.value;
                if (!toNumber) return;
                handleField('status', 'changing');
                onSwitchRoom(localRoom.number, toNumber);
              }}
              defaultValue=""
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900"
            >
              <option value="">Oda Değiştir (Seçiniz)</option>
              {availableRoomNumbers.map((num: string) => (
                num !== localRoom.number ? <option key={num} value={num}>{num}</option> : null
              ))}
            </select>
          </div>
          <div>
            <span className="text-xs text-gray-500">Değiştir: başka odaya aktar</span>
          </div>
        </div>
      )}

      {/* Tarihler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="text-sm text-gray-600">
          Check-in: {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkInDate ? new Date(localRoom.checkInDate).toLocaleString() : '—'}
        </div>
        <div className="text-sm text-gray-600">
          Check-out: {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkOutDate ? new Date(localRoom.checkOutDate).toLocaleString() : '—'}
        </div>
      </div>
      {/* Planlanan Çıkış / Gece Sayısı */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={(localRoom.expectedCheckOutDate || '').slice(0,10)}
            onChange={(e) => {
              const val = e.target.value; // YYYY-MM-DD
              handleField('expectedCheckOutDate', val ? val : undefined);
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">Planlanan çıkış</span>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            min={1}
            value={typeof localRoom.stayNights === 'number' ? localRoom.stayNights : ''}
            onChange={(e) => handleField('stayNights', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">Toplam gece</span>
        </div>
      </div>
      {(localRoom.status === 'occupied' || localRoom.status === 'reserved') && (
        <>
          {/* Not */}
          <label className="block text-sm font-medium text-gray-700 mb-1">Not</label>
          <textarea
            value={localRoom.notes || ''}
            onChange={(e) => handleField('notes', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
            placeholder="Oda ile ilgili not"
            rows={3}
          />
        </>
      )}

    </div>

    </div>

    {showStayoverModal && (
      <Modal isOpen={true} onClose={() => setShowStayoverModal(false)} maxWidthClass="max-w-md">
        <div className="bg-gradient-to-r from-primary-700 to-secondary-800 text-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Devam Etme Tercihi</h3>
            <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30" onClick={() => setShowStayoverModal(false)}>Kapat</button>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input type="radio" name="stayoverPref" checked={stayoverPref==='requested'} onChange={() => setStayoverPref('requested')} />
              <span>Temizlik isteniyor</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" name="stayoverPref" checked={stayoverPref==='not_requested'} onChange={() => setStayoverPref('not_requested')} />
              <span>Temizlik istenmiyor</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" name="stayoverPref" checked={stayoverPref==='unspecified'} onChange={() => setStayoverPref('unspecified')} />
              <span>Belirsiz</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button onClick={() => setShowStayoverModal(false)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300">İptal</button>
            <button
              onClick={() => {
                try {
                  const raw = localStorage.getItem(STAYOVER_PREF_KEY);
                  const map = raw ? JSON.parse(raw) : {};
                  map[room.number] = stayoverPref;
                  localStorage.setItem(STAYOVER_PREF_KEY, JSON.stringify(map));
                  window.dispatchEvent(new Event('stayover-preference-updated'));
                } catch {}
                try {
                  const prefText = stayoverPref === 'requested' ? 'Temizlik isteniyor' : stayoverPref === 'not_requested' ? 'Temizlik istenmiyor' : 'Belirsiz';
                  pushNotification({
                    title: `Devam Etme Tercihi`,
                    message: `Oda ${room.number} için tercih: ${prefText}.`,
                    type: 'housekeeping',
                    priority: 'medium',
                    recipient: 'housekeeping'
                  });
                } catch {}
                const updated = { ...localRoom, willContinue: true } as RoomData;
                setLocalRoom(updated);
                onChange(updated);
                setShowStayoverModal(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
            >Kaydet</button>
          </div>
        </div>
      </Modal>
    )}
    {showDetailsModal && (
      <Modal isOpen={true} onClose={() => setShowDetailsModal(false)} maxWidthClass="max-w-lg">
        <div className="bg-gradient-to-r from-primary-700 to-secondary-800 text-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Oda {localRoom.number} Detayları</h3>
            <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30" onClick={() => setShowDetailsModal(false)}>Kapat</button>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Durum:</span> <span className="font-medium">{getStatusLabel(localRoom.status)}</span></div>
            <div><span className="text-gray-500">Fiyat:</span> <span className="font-medium">{localRoom.price != null ? `₺${localRoom.price} TL` : '—'}</span></div>
            <div><span className="text-gray-500">Misafir:</span> <span className="font-medium">{formatGuestNames(localRoom.guestNames as any, localRoom.guestName) || '—'}</span></div>
            <div><span className="text-gray-500">Telefon:</span> <span className="font-medium">{localRoom.phone || '—'}</span></div>
            <div><span className="text-gray-500">Check-in:</span> <span className="font-medium">{(localRoom.status==='occupied'||localRoom.status==='sold') && localRoom.checkInDate ? new Date(localRoom.checkInDate).toLocaleString() : '—'}</span></div>
            <div><span className="text-gray-500">Planlanan Çıkış:</span> <span className="font-medium">{localRoom.expectedCheckOutDate || '—'}</span></div>
          </div>
          {cleaning.inProgress && (
            <div className="mt-2">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500" style={{ width: `${cleaningPercent}%` }}></div>
              </div>
              <div className="mt-1 text-xs text-gray-600">{etaText}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {(() => {
              const hasGuest = !!(localRoom.guestName || (localRoom.guestNames && localRoom.guestNames.length > 0));
              const hasDate = !!localRoom.expectedCheckOutDate;
              const canReserve = hasGuest || hasDate;
              if (localRoom.status === 'reserved') {
                return (
                  <button
                    className="px-3 py-1.5 rounded-lg bg-gray-300 text-gray-800 text-sm hover:bg-gray-200"
                    onClick={() => {
                      // Rezerveyi kaldır
                      const updated: RoomData = { 
                        ...localRoom, 
                        status: 'available', 
                        phone: '',
                        guestName: '',
                        guestNames: [],
                        expectedCheckOutDate: undefined,
                      };
                      setLocalRoom(updated);
                      onChange(updated);
                      // ilgili bugünkü rezervasyonu iptal etmeye çalış
                      try {
                        const today = getToday();
                        const match = getReservations().find(r => r.roomNumber === localRoom.number && r.status === 'upcoming' && r.checkInDate === today);
                        if (match) updateReservationStatus(match.id, 'cancelled');
                      } catch {}
                      try {
                        pushNotification({ title: 'Rezervasyon Kaldırıldı', message: `Oda ${localRoom.number} tekrar müsait.`, type: 'reception', priority: 'low', recipient: 'reception' });
                      } catch {}
                    }}
                  >
                    Rezerveyi Kaldır
                  </button>
                );
              }
              if (localRoom.status === 'available' || localRoom.status === 'dirty') {
                return (
                  <button
                    className={`px-3 py-1.5 rounded-lg text-sm ${canReserve ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-amber-200 text-amber-800 cursor-not-allowed'}`}
                    disabled={!canReserve}
                    onClick={() => {
                      if (!canReserve) {
                        try { pushNotification({ title: 'Eksik Bilgi', message: 'Rezerve için misafir adı veya çıkış tarihi girin.', type: 'reception', priority: 'medium', recipient: 'reception' }); } catch {}
                        return;
                      }
                      // Rezervasyon kaydı oluştur
                      try {
                        const today = getToday();
                        const co = (localRoom.expectedCheckOutDate && localRoom.expectedCheckOutDate.slice(0,10)) || getTomorrow(today);
                        const guest = (localRoom.guestNames && localRoom.guestNames.length > 0 ? localRoom.guestNames.join(', ') : (localRoom.guestName || 'Rezervasyon'));
                        addReservation({ guestName: guest, roomNumber: localRoom.number, checkInDate: today, checkOutDate: co, phone: localRoom.phone, dailyRate: localRoom.price, status: 'upcoming' });
                      } catch {}
                      const updated: RoomData = { ...localRoom, status: 'reserved', checkInDate: undefined, checkOutDate: undefined };
                      setLocalRoom(updated);
                      onChange(updated);
                      try { pushNotification({ title: 'Oda Rezerve Edildi', message: `Oda ${localRoom.number} rezerveye alındı.`, type: 'reception', priority: 'low', recipient: 'reception' }); } catch {}
                    }}
                  >
                    Rezerve
                  </button>
                );
              }
              return null;
            })()}
            <button className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700" onClick={handleCheckIn}>Check-in</button>
            <button className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700" onClick={handleCheckOut}>Check-out</button>
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700" onClick={finalizeSale}>Satış Tamamla</button>
            <button className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-sm hover:bg-fuchsia-700" onClick={startStayoverCleaning}>Stayover Temizlik</button>
            <button className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300" onClick={handleQuickCall}>Hızlı Ara</button>
            <button className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300" onClick={handleQuickPayment}>Ödeme Durumu Değiştir</button>
          </div>
        </div>
      </Modal>
    )}
   </>
 );
};
 
 export default RoomCard;
 
 // Ödeme nesnesi: bir odada yapılan tekil tahsilatları temsil eder
export type Payment = {
  id: string;
  method: Exclude<PaymentMethod, null>; // 'card' | 'cash' | 'iban'
  amount: number;
  time: string; // ISO timestamp
  reference?: string; // IBAN referansı / slip no
  cashier?: string; // tahsil eden personel
  notes?: string;
};