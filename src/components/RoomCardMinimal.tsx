import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { POS_INFO_KEY } from '../utils/endOfDay';
import { FaUser, FaPhone, FaMoneyBillWave, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaBroom, FaDoorOpen } from 'react-icons/fa';
import { pushNotification } from '../utils/notifications';
import { addReservation, getToday, getTomorrow, getReservations, updateReservationStatus } from '../utils/reservations';
import { startCleaning } from '../utils/hkCleaning';
import type { RoomData } from './RoomCard';
import Modal from './Modal';
// rezervasyon yardımcıları kullanılmıyor, import etmiyoruz


interface RoomCardProps {
  room: RoomData;
  onChange: (updated: RoomData) => void;
  availableRoomNumbers?: string[];
  onSwitchRoom?: (fromNumber: string, toNumber: string) => void;
  mode?: 'admin' | 'hk';
  onFinalizeCleaning?: (room: RoomData) => void;
}

const RoomCardMinimal: React.FC<RoomCardProps> = ({ room, onChange, availableRoomNumbers, onSwitchRoom, mode = 'admin', onFinalizeCleaning }) => {
  const [localRoom, setLocalRoom] = useState<RoomData>(room);
  const HK_CLEANING_KEY = 'hk_cleaning_status';
  const [cleaning, setCleaning] = useState<{ inProgress: boolean; startTime?: number; completedAt?: number }>({ inProgress: false });
  const [elapsed, setElapsed] = useState<number>(0);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [posForm, setPosForm] = useState<{ zReportNumber?: string; invoiceIssued?: boolean; receiptCount?: number }>({});
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [issueText, setIssueText] = useState<string>('');
  const [issueUploadDataUrls, setIssueUploadDataUrls] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const readFilesAsDataUrls = async (files: FileList | File[]): Promise<string[]> => {
    const arr = Array.from(files || []);
    const readers = arr.map(file => new Promise<string>((resolve, reject) => {
      try {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      } catch (e) { resolve(''); }
    }));
    const results = await Promise.all(readers);
    return results.filter(Boolean);
  };

  const openCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!stream) throw new Error('Kamera erişimi sağlanamadı.');
      streamRef.current = stream;
      if (videoRef.current) {
        (videoRef.current as any).srcObject = stream;
        videoRef.current.play?.();
      }
      setCameraOpen(true);
    } catch (e: any) {
      setCameraError(e?.message || 'Kamera açılırken bir hata oluştu.');
    }
  };

  const closeCamera = () => {
    try {
      const s = streamRef.current;
      s?.getTracks?.().forEach(t => t.stop());
      streamRef.current = null;
    } catch {}
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    try {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const url = canvas.toDataURL('image/jpeg', 0.9);
      if (url) setIssueUploadDataUrls(prev => [...prev, url]);
    } catch (e: any) {
      setCameraError(e?.message || 'Fotoğraf çekilemedi.');
    }
  };

  // Küçük alan güncelleme yardımcı fonksiyonu
  const handleField = (field: keyof RoomData, value: any) => {
    // Intercept paymentStatus toggle to create a payment record when marking as received
    if (field === 'paymentStatus' && value === 'received') {
      // Prevent duplicate additions if already received
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
  const [showPosModal, setShowPosModal] = useState<boolean>(false);

  const [posModalShown, setPosModalShown] = useState<boolean>(false);
  const [statusPulse, setStatusPulse] = useState(false);
  const [displayMode] = useState<'compact'|'standard'|'xl'>('standard');
  const autoSoldAppliedRef = useRef(false);
  const autoReserveAppliedRef = useRef(false);

  // Statü değişiminde yumuşak vurgu
  useEffect(() => {
    setStatusPulse(true);
    const t = setTimeout(() => setStatusPulse(false), 600);
    return () => clearTimeout(t);
  }, [localRoom.status, cleaning.inProgress]);

  // Statü değişimi animasyonu için state
  const [statusChanging, setStatusChanging] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(localRoom.status);

  // Temizlik progress animasyonu için state
  const [progressAnimating, setProgressAnimating] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    checkIn: false,
    checkOut: false,
    cleaning: false
  });
  const [newIssueName, setNewIssueName] = useState('');



  // Statü değişimi animasyonu
  useEffect(() => {
    if (previousStatus !== localRoom.status) {
      setStatusChanging(true);
      const timer = setTimeout(() => {
        setStatusChanging(false);
        setPreviousStatus(localRoom.status);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [localRoom.status, previousStatus]);

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

  // Prop değişiminde localRoom'u senkronize et (oda verisi değiştiğinde)
  useEffect(() => {
    setLocalRoom(room);
  }, [room]);

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









  useEffect(() => {
    if (autoSoldAppliedRef.current) return;
    // Ödeme alındıysa otomatik "sold" yap.
    // Kart satışında POS/Fatura bilgisi şart.
    // Not: Artık 'available' ve 'dirty' durumlarında da satış sonrası otomatik 'sold' yapılır.
    const paymentReceived = localRoom.paymentStatus === 'received';
    const isEligibleStatus = (
      localRoom.status !== 'sold' &&
      (
        localRoom.status === 'occupied' ||
        localRoom.status === 'reserved' ||
        localRoom.status === 'available' ||
        localRoom.status === 'dirty'
      )
    );
    if (paymentReceived && isEligibleStatus) {
      const isCardSaleAuto = localRoom.paymentMethod === 'card';
      if (isCardSaleAuto) {
        try {
          const raw = localStorage.getItem(POS_INFO_KEY);
          const all = raw ? JSON.parse(raw) : {};
          const todayKey = new Date().toISOString().slice(0,10);
          const info = all[todayKey] || {};
          const hasInvoiceOrZ = !!info.invoiceIssued || !!(info.zReportNumber && String(info.zReportNumber).trim());
          if (!hasInvoiceOrZ) {
            if (!posModalShown) {
              setShowPosModal(true);
              setPosModalShown(true);
            }
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
  }, [localRoom.paymentStatus, localRoom.status, localRoom.paymentMethod, posModalShown]);



   useEffect(() => {
     if (autoReserveAppliedRef.current) return;
    // Misafir adı girildiğinde oda statüsünü otomatik rezerve yap (bir kez)
    const hasSingle = !!(localRoom.guestName && localRoom.guestName.trim());
    const hasMultiple = Array.isArray(localRoom.guestNames) && localRoom.guestNames.some(n => n && n.trim());
    const statusAllowsReserve = (localRoom.status === 'available' || localRoom.status === 'dirty');
    const shouldReserve = (hasSingle || hasMultiple) && statusAllowsReserve && !localRoom.checkOutDate;
    if (shouldReserve) {
      const updated: RoomData = { ...localRoom, status: 'reserved' };
      setLocalRoom(updated);
      onChange(updated);
      autoReserveAppliedRef.current = true;
    }
  }, [localRoom.guestName, localRoom.guestNames, localRoom.status, localRoom.checkOutDate]);


  const getAccentColor = (status: RoomData['status'], cleaningInProgress: boolean) => {
    if (cleaningInProgress) return 'from-amber-400 to-gold';
    switch (status) {
      case 'sold': return 'from-emerald-600 to-emerald-700';
      case 'dirty': return 'from-rose-600 to-rose-700';
      case 'reserved': return 'from-amber-400 to-gold';
      case 'occupied': return 'from-amber-400 to-gold';
      case 'changing': return 'from-amber-400 to-gold';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRoomNumberBadgeClasses = (status: RoomData['status'], cleaningInProgress: boolean) => {
    const base = 'rounded-lg bg-antrasit/80 backdrop-blur-glass text-offwhite ring-2 ring-white/10 flex items-center justify-center font-semibold shadow-goldGlow';
    if (cleaningInProgress) {
      return `${base} ring-amber-400/50 animate-pulse`;
    }
    switch (status) {
      case 'dirty':
        return `${base} ring-rose-400/50`;
      case 'reserved':
        return `${base} ring-amber-400/50`;
      case 'changing':
        return `${base} ring-amber-400/50`;
      case 'sold':
        return `${base} ring-emerald-400/50`;
      case 'occupied':
        return `${base} ring-amber-400/50`;
      default: // available
        return `${base} ring-gray-400/50`;
    }
  };
  const getStatusBadgeClasses = (status: RoomData['status']) => {
    switch (status) {
      case 'sold': return 'bg-emerald-600/80 backdrop-blur-glass text-offwhite ring-2 ring-emerald-400/40';
      case 'dirty': return 'bg-rose-600/80 backdrop-blur-glass text-offwhite ring-2 ring-rose-400/40';
      case 'reserved': return 'bg-amber-500/80 backdrop-blur-glass text-offwhite ring-2 ring-amber-400/40';
      case 'occupied': return 'bg-amber-500/80 backdrop-blur-glass text-offwhite ring-2 ring-amber-400/40';
      case 'changing': return 'bg-amber-500/80 backdrop-blur-glass text-offwhite ring-2 ring-amber-400/40';
      default: return 'bg-coolgray/80 backdrop-blur-glass text-offwhite ring-2 ring-gray-400/40';
    }
  };

  const getStatusIcon = (status: RoomData['status']) => {
    const wrap = (el: React.ReactNode, ring: string) => (
      <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/80 backdrop-blur-md ${ring} text-current shadow-lg hover:scale-125 hover:rotate-12 transition-all duration-300 transform-gpu hover:shadow-xl active:scale-95 active:rotate-0 cursor-pointer ${statusChanging ? 'animate-bounce scale-125' : ''}`}>{el}</span>
    );
    switch (status) {
      case 'sold':
        return wrap(<FaMoneyBillWave className="text-emerald-700 text-xs hover:text-emerald-600 transition-colors duration-200" />, 'ring-2 ring-emerald-400/50 hover:ring-emerald-500/70');
      case 'dirty':
        return wrap(<FaBroom className="text-orange-700 text-xs hover:text-orange-600 transition-colors duration-200" />, 'ring-2 ring-orange-400/50 hover:ring-orange-500/70');
      case 'reserved':
        return wrap(<FaUser className="text-indigo-700 text-xs hover:text-indigo-600 transition-colors duration-200" />, 'ring-2 ring-indigo-400/50 hover:ring-indigo-500/70');
      case 'occupied':
        return wrap(<FaUser className="text-amber-700 text-xs hover:text-amber-600 transition-colors duration-200" />, 'ring-2 ring-amber-400/50 hover:ring-amber-500/70');
      case 'changing':
        return wrap(<FaExclamationTriangle className="text-violet-700 text-xs hover:text-violet-600 transition-colors duration-200" />, 'ring-2 ring-violet-400/50 hover:ring-violet-500/70');
      default:
        return wrap(<FaDoorOpen className="text-sky-700 text-xs hover:text-sky-600 transition-colors duration-200" />, 'ring-2 ring-sky-400/50 hover:ring-sky-500/70');
    }
  };

const premiumCard = 'group relative overflow-hidden rounded-xl shadow-lg ring-1 ring-white/20 hover:ring-cyan-300/40 bg-black/40 hover:bg-gradient-to-br hover:from-cyan-300/10 hover:via-transparent hover:to-indigo-300/15 backdrop-blur-[32px] text-white transition-all duration-300 hover:shadow-[0_0_24px_rgba(165,243,252,0.15)]';

// Duruma göre kart animasyon sınıfları (RoomData.status birliklerine uyumlu)
const getCardAnimClasses = (status: RoomData['status'], cleaningInProgress: boolean) => {
  if (cleaningInProgress) return 'glow-sky pulse-strong'; // Temizlik devam ediyorsa mavi parıltı
  switch (status) {
    case 'available':
      return 'glow-emerald pulse-strong'; // Müsait odalar yeşil parıltı
    case 'dirty':
      return 'glow-amber pulse-strong'; // Kirli odalar amber parıltı
    case 'reserved':
      return 'glow-sky pulse-strong'; // Rezerveli odalar mavi parıltı
    case 'occupied':
      return 'glow-amber pulse-strong'; // Dolu odalarda sıcak vurgu
    case 'sold':
      return 'glow-emerald pulse-strong'; // Satılmış odalar yeşil parıltı
    case 'changing':
      return 'glow-rose pulse-strong wiggle-soft'; // Değişim durumunda dikkat vurgusu
    default:
      return '';
  }
};

  const cleaningPercent = Math.min(100, Math.floor(elapsed/60 / 30 * 100));
  const cleaningTotalMin = 30;
  const minutesElapsed = Math.floor(elapsed/60);
  const minutesRemaining = Math.max(0, cleaningTotalMin - minutesElapsed);
  const etaLabel = (cleaning.startTime ? new Date(cleaning.startTime + cleaningTotalMin * 60000) : new Date(Date.now() + minutesRemaining * 60000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Progress animasyonu tetikleyici
  useEffect(() => {
    if (cleaning.inProgress) {
      setProgressAnimating(true);
      const timer = setTimeout(() => setProgressAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [cleaning.inProgress, cleaningPercent]);
  const etaText = `Tahmini bitiş: ${etaLabel} (~${minutesRemaining}dk)`;
  const isHK = mode === 'hk';
  const showGuest = !isHK && (localRoom.status === 'occupied' || localRoom.status === 'reserved' || localRoom.status === 'sold');
  const headerPadding = displayMode==='xl' ? 'p-5' : displayMode==='compact' ? 'p-3' : 'p-4';
  const roomBadgeSizeClass = displayMode==='xl' ? 'h-16 w-16 text-xl' : displayMode==='compact' ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base';

  return (
    <>
  <div className={`${premiumCard} ${getCardAnimClasses(room.status, cleaning.inProgress)}`} onClick={isHK ? undefined : () => setShowDetailsModal(true)}>
        {/* Sol aksan çubuğu: modern gradient + shimmer animasyon */}
        <div className={`absolute left-0 top-0 h-full w-2 bg-gradient-to-b ${getAccentColor(localRoom.status, cleaning.inProgress)} ${statusPulse ? 'opacity-90 animate-pulse' : 'opacity-100'} shadow-lg transition-all duration-300 group-hover:w-3 group-hover:shadow-xl`}>
          <div className={`absolute inset-0 ${cleaning.inProgress ? 'opacity-40' : 'opacity-20'} animate-shimmer bg-gradient-to-b from-transparent via-white/30 to-transparent`}></div>
        </div>
        {/* Header */}
        <div className={`bg-gradient-to-br from-cyan-300/20 via-transparent to-indigo-300/25 relative ${headerPadding} overflow-hidden transition-all duration-300 group-hover:opacity-90`}>
          {/* Üst ince gradient hat */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/60 via-cyan-300/60 to-transparent opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:h-0.5"></div>
          {/* Diamond facet overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-5 group-hover:opacity-20 transition-opacity bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_6px)]"></div>
          {/* Animated background particles */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500">
            <div className="absolute top-2 left-4 w-1 h-1 bg-white rounded-full animate-ping animation-delay-100"></div>
            <div className="absolute top-6 right-8 w-0.5 h-0.5 bg-white rounded-full animate-ping animation-delay-300"></div>
            <div className="absolute bottom-4 left-12 w-0.5 h-0.5 bg-white rounded-full animate-ping animation-delay-500"></div>
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-3">
              <div className={`${roomBadgeSizeClass} ${getRoomNumberBadgeClasses(localRoom.status, cleaning.inProgress)} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 transform-gpu`}>{room.number}</div>
              <div className="flex items-center gap-2">
                <div className="transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 transform-gpu drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]">
                  {getStatusIcon(localRoom.status)}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs ${getStatusBadgeClasses(localRoom.status)} ${statusPulse ? 'pulse-soft animate-bounce' : ''} ${statusChanging ? 'animate-pulse scale-110 shadow-lg' : ''} transition-all duration-300 group-hover:scale-105 transform-gpu text-white`}>
                  {cleaning.inProgress ? (
                    <span className="inline-flex items-center">
                      <FaBroom className="mr-1 text-amber-200 animate-spin" style={{ animationDuration: '1.2s' }} />
                      {`Temizleniyor (${Math.floor(elapsed/60)}dk)`}
                    </span>
                  ) : (
                    isHK ? (localRoom.status === 'occupied' || localRoom.status === 'sold' ? 'Dolu' : 'Boş') : getStatusLabel(localRoom.status)
                  )}
                </span>
                {cleaning.inProgress && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded bg-white/10 ring-1 ring-white/20 text-white animate-pulse transition-all duration-300 group-hover:scale-105 transform-gpu">%{cleaningPercent}</span>
                )}
                {Array.isArray(localRoom.issues) && localRoom.issues.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-md text-xs bg-rose-600/70 ring-2 ring-rose-400/40 text-white shadow-lg">
                    Arıza: {localRoom.issues.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isHK && localRoom.price != null && (
                <span className="px-2 py-1 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs transition-all duration-300 group-hover:scale-105 group-hover:bg-white group-hover:shadow-md transform-gpu">₺{localRoom.price} TL</span>
              )}
              {!isHK && localRoom.paymentStatus && (
                <span className={`px-2.5 py-1 rounded-md text-xs flex items-center space-x-1 ring-1 transition-all duration-300 group-hover:scale-105 transform-gpu bg-white/10 ring-white/20 text-white`}>
                  <div className={`transition-all duration-300 ${localRoom.paymentStatus==='received' ? 'group-hover:animate-spin' : 'group-hover:animate-bounce'}`}>
                    {localRoom.paymentStatus==='received' ? <FaCheckCircle className="text-emerald-300" /> : <FaTimesCircle className="text-rose-300" />}
                  </div>
                  <span>{localRoom.paymentStatus==='received' ? 'Alındı' : 'Alınmadı'}</span>
                </span>
              )}
            </div>
          </div>
          {cleaning.inProgress && (
            <div className="mt-3 h-2 bg-antrasit/50 backdrop-blur-glass rounded-full overflow-hidden transition-all duration-300 group-hover:h-3 relative">
              <div 
                 className={`h-full bg-gradient-to-r from-amber-400 to-gold shadow-sm transition-all duration-500 relative ${progressAnimating ? 'animate-pulse' : ''}`} 
                 style={{ width: `${cleaningPercent}%` }}
               >
                 {/* Progress shimmer effect */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                 {/* Progress pulse dots */}
                 <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-1 bg-white rounded-full animate-ping"></div>
               </div>
               {/* Background animated dots */}
               <div className="absolute inset-0 flex items-center justify-center space-x-1 opacity-30">
                 <div className="w-0.5 h-0.5 bg-white rounded-full animate-bounce animation-delay-100"></div>
                 <div className="w-0.5 h-0.5 bg-white rounded-full animate-bounce animation-delay-200"></div>
                 <div className="w-0.5 h-0.5 bg-white rounded-full animate-bounce animation-delay-300"></div>
               </div>
             </div>
           )}
           {cleaning.inProgress && (
             <div className="mt-1 text-xs text-white transition-all duration-300 flex items-center gap-2">
               <div className="flex space-x-1">
                 <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce animation-delay-100"></div>
                 <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce animation-delay-200"></div>
                 <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce animation-delay-300"></div>
               </div>
               {etaText}
             </div>
           )}
        </div>
        {/* Summary body (hidden in HK mode) */}
        {!isHK && (
          <div className="p-4 transition-all duration-300 group-hover:bg-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-white transition-all duration-300 group-hover:translate-x-1 transform-gpu">
                  <FaUser className="text-primary-600 transition-all duration-300 group-hover:scale-110 group-hover:text-primary-700 transform-gpu" />
                  <span className="font-medium truncate">{showGuest ? formatGuestNames(localRoom.guestNames as any, localRoom.guestName) : '—'}</span>
                </div>
                <div className="flex items-center space-x-2 text-white/70 transition-all duration-300 group-hover:translate-x-1 transform-gpu animation-delay-100">
                  <FaPhone className="text-primary-600 transition-all duration-300 group-hover:scale-110 group-hover:text-primary-700 transform-gpu" />
                  <span className="truncate">{localRoom.phone || '—'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                {localRoom.price != null && <span className="px-2 py-1 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs transition-all duration-300 group-hover:scale-105 group-hover:bg-white/20 group-hover:shadow-md transform-gpu">₺{localRoom.price} TL</span>}
                {localRoom.paymentMethod && <span className="px-2 py-1 rounded-md bg-white/10 ring-1 ring-white/20 text-white text-xs transition-all duration-300 group-hover:scale-105 group-hover:bg-white/20 group-hover:shadow-md transform-gpu">{localRoom.paymentMethod==='card' ? 'Kart' : localRoom.paymentMethod==='cash' ? 'Nakit' : 'IBAN'}</span>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-white/70 transition-all duration-300">
              <div className="transition-all duration-300 group-hover:translate-x-1 transform-gpu">Check-in: {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkInDate ? new Date(localRoom.checkInDate).toLocaleString() : '—'}</div>
              <div className="transition-all duration-300 group-hover:translate-x-1 transform-gpu animation-delay-100">Check-out: {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkOutDate ? new Date(localRoom.checkOutDate).toLocaleString() : '—'}</div>
            </div>
          </div>
        )}
        {/* Footer action bar */}
        <div className="px-4 pb-4 transition-all duration-300 group-hover:bg-white/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {!isHK && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDetailsModal(true); }}
                  className="px-3 py-1.5 rounded-lg bg-white/60 backdrop-blur-md text-gray-800 text-sm hover:bg-white/80 ring-2 ring-white/30 hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl transform-gpu hover:rotate-1"
                  title="Detayları Aç"
                >
                  Detay
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isHK && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setLoadingStates(prev => ({ ...prev, checkIn: true }));
                  setStatusChanging(true);
                  
                  // Simulate loading delay for better UX
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  const updated: RoomData = { ...localRoom, status: 'occupied', checkInDate: new Date().toISOString() };
                  setLocalRoom(updated);
                  onChange(updated);
                  try { pushNotification({ title:'Check-in Yapıldı', message:`Oda ${room.number} check-in yapıldı.`, type:'reception', priority:'medium', recipient:'management' }); } catch {}
                  
                  setLoadingStates(prev => ({ ...prev, checkIn: false }));
                }}
                className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-sm ring-2 ring-indigo-400/30 shadow-lg hover:from-indigo-700 hover:to-purple-800 hover:scale-110 hover:rotate-1 transition-all duration-300 hover:shadow-xl transform-gpu active:scale-95 active:rotate-0 relative overflow-hidden ${loadingStates.checkIn ? 'animate-pulse cursor-not-allowed' : ''}`}
                title="Check-in"
              >
                {loadingStates.checkIn && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-purple-800 flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-100"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-200"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-300"></div>
                    </div>
                  </div>
                )}
                Check-in
              </button>
              )}
              {!isHK && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setLoadingStates(prev => ({ ...prev, checkOut: true }));
                  setStatusChanging(true);
                  
                  // Simulate loading delay for better UX
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  const updated: RoomData = {
                    ...localRoom,
                    status: 'dirty',
                    checkOutDate: new Date().toISOString(),
                    guestName: '',
                    guestNames: [],
                    phone: '',
                    price: undefined,
                    paymentStatus: undefined,
                    paymentMethod: undefined,
                    checkInDate: undefined,
                  };
                  setLocalRoom(updated);
                  onChange(updated);
                  try { pushNotification({ title:'Check-out Yapıldı', message:`Oda ${room.number} check-out yapıldı ve oda kirli olarak işaretlendi.`, type:'reception', priority:'medium', recipient:'management' }); } catch {}
                  try { pushNotification({ title:'Yeni Temizlik Gerekiyor', message:`Oda ${room.number} için temizlik gerekli (check-out).`, type:'housekeeping', priority:'high', recipient:'housekeeping' }); } catch {}
                  
                  setLoadingStates(prev => ({ ...prev, checkOut: false }));
                }}
                className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-red-700 text-white text-sm ring-2 ring-orange-400/30 shadow-lg hover:from-orange-700 hover:to-red-800 hover:scale-110 hover:rotate-1 transition-all duration-300 hover:shadow-xl transform-gpu active:scale-95 active:rotate-0 relative overflow-hidden ${loadingStates.checkOut ? 'animate-pulse cursor-not-allowed' : ''}`}
                title="Check-out"
              >
                {loadingStates.checkOut && (
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-700 to-red-800 flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-100"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-200"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-300"></div>
                    </div>
                  </div>
              )}
              Check-out
              </button>
              )}
              {isHK && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowIssueModal(true); }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-700 text-white text-sm ring-2 ring-rose-400/30 shadow-lg hover:from-rose-700 hover:to-red-800 hover:scale-110 hover:rotate-1 transition-all duration-300 hover:shadow-xl transform-gpu active:scale-95 active:rotate-0"
                  title="Arıza bildir"
                >
                  Arıza bildir
                </button>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setLoadingStates(prev => ({ ...prev, cleaning: true }));
                  
                  // Simulate loading delay for better UX
                  await new Promise(resolve => setTimeout(resolve, 300));
                  
                  try { startCleaning(room.number); } catch {}
                  try { pushNotification({ title:'Temizlik Başladı', message:`Oda ${room.number} için temizlik başlatıldı.`, type:'housekeeping', priority:'medium', recipient:'housekeeping' }); } catch {}
                  
                  setLoadingStates(prev => ({ ...prev, cleaning: false }));
                }}
                className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-700 text-white text-sm ring-2 ring-cyan-400/30 shadow-lg hover:from-cyan-700 hover:to-blue-800 hover:scale-110 hover:rotate-1 transition-all duration-300 hover:shadow-xl transform-gpu active:scale-95 active:rotate-0 relative overflow-hidden ${(loadingStates.cleaning || cleaning.inProgress) ? 'animate-pulse cursor-not-allowed opacity-70' : ''}`}
                title="Temizliği Başlat"
                disabled={loadingStates.cleaning || cleaning.inProgress}
              >
                {loadingStates.cleaning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-700 to-blue-800 flex items-center justify-center">
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-100"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-200"></div>
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce animation-delay-300"></div>
                    </div>
                  </div>
                )}
                Temizlik
              </button>
              {isHK && cleaning.inProgress && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFinalizeCleaning && onFinalizeCleaning(localRoom); }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm ring-2 ring-emerald-300/40 shadow-lg hover:from-emerald-600 hover:to-green-700 hover:scale-110 hover:rotate-1 transition-all duration-300 hover:shadow-xl transform-gpu active:scale-95 active:rotate-0"
                  title="Temizliği Bitir"
                >
                  Bitir
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDetailsModal && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-glass animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-black/40 backdrop-blur-glass border border-amber-200/30 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300 text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-amber-200/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {room.number}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Oda Detayları</h2>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(localRoom.status)}`}>
                    {getStatusLabel(localRoom.status)}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-amber-200/30 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 hover:scale-105"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Misafir Bilgileri */}
              <div className="bg-black/30 backdrop-blur-glass rounded-2xl p-5 border border-amber-200/20 shadow-lg text-white">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaUser className="text-amber-600" />
                  Misafir Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-white/80 mb-2">Misafir Adları</label>
                     <textarea 
                       value={localRoom.guestName || ''} 
                       onChange={(e) => handleField('guestName', e.target.value)}
                       className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200 resize-none"
                       placeholder="Misafir adlarını girin&#10;(Her satıra bir isim)"
                       rows={3}
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-white/80 mb-2">Telefon</label>
                     <input 
                       type="tel"
                       value={localRoom.phone || ''} 
                       onChange={(e) => handleField('phone', e.target.value)}
                       className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200"
                       placeholder="Telefon numarası"
                     />
                   </div>
                 </div>
              </div>

              {/* Ödeme ve İşlemler */}
              <div className="bg-black/30 backdrop-blur-glass rounded-2xl p-5 border border-amber-200/20 shadow-lg text-white">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <FaMoneyBillWave className="text-amber-600" />
                  Ödeme ve İşlemler
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Ödeme Yöntemi</label>
                    <select 
                      value={localRoom.paymentMethod || ''} 
                      onChange={(e) => handleField('paymentMethod', (e.target.value || null) as any)}
                      className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-glass text-white border border-amber-200/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200"
                    >
                      <option value="">Seçiniz</option>
                      <option value="cash">💵 Nakit</option>
                      <option value="card">💳 Kart</option>
                      <option value="iban">🏦 IBAN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Ödeme Durumu</label>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleField('paymentStatus', 'received')} 
                        className={`${localRoom.paymentStatus === 'received' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-black/30 text-white ring-1 ring-white/10 hover:bg-black/40'} px-4 py-2 rounded-xl text-sm transition-all duration-200`}
                      >
                        ✅ Alındı
                      </button>
                      <button 
                        onClick={() => handleField('paymentStatus', 'not_received')} 
                        className={`${localRoom.paymentStatus === 'not_received' ? 'bg-red-600 text-white shadow-lg' : 'bg-black/30 text-white ring-1 ring-white/10 hover:bg-black/40'} px-4 py-2 rounded-xl text-sm transition-all duration-200`}
                      >
                        ❌ Alınmadı
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-white/80 mb-2">Fiyat</label>
                  <input
                    type="number"
                    value={localRoom.price ?? ''}
                    onChange={(e) => handleField('price', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-glass text-white placeholder-white/70 border border-amber-200/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200"
                    placeholder="₺ Fiyat"
                  />
                </div>
                {localRoom.paymentMethod === 'card' && localRoom.paymentStatus !== 'received' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-800 flex items-center gap-3">
                    <FaExclamationTriangle className="text-red-600" />
                    <div className="text-sm">
                      Kart ile ödeme seçildi ancak ödeme alınmadı. Lütfen POS işlemini ve fiş/fatura kontrolünü tamamlayın.
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                   {/* Satışı Tamamla butonu kaldırıldı */}
                   {/* “Satışı Tamamla” butonu kaldırıldı */}
                    {(() => {
                      const hasGuest = !!(localRoom.guestName || (localRoom.guestNames && localRoom.guestNames.length > 0));
                      const hasDate = !!localRoom.expectedCheckOutDate;
                      const canReserve = hasGuest || hasDate;
                      if (localRoom.status === 'reserved') {
                        return (
                          <button
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
                              // İlgili bugünkü rezervasyonu iptal etmeyi dene
                              try {
                                const today = getToday();
                                const match = getReservations()
                                  .find(r => r.roomNumber === localRoom.number && r.status === 'upcoming' && r.checkInDate === today);
                                if (match) updateReservationStatus(match.id, 'cancelled');
                              } catch {}
                              try { pushNotification({ title:'Rezervasyon Kaldırıldı', message:`Oda ${room.number} tekrar müsait.`, type:'reception', priority:'low', recipient:'reception' }); } catch {}
                            }}
                            className="px-6 py-3 bg-gradient-to-r from-gray-300 to-gray-200 hover:from-gray-200 hover:to-gray-100 text-gray-800 font-medium rounded-xl shadow hover:shadow-md transition-all duration-200"
                          >
                            ❌ Rezerveyi Kaldır
                          </button>
                        );
                      }
                      if (localRoom.status === 'available' || localRoom.status === 'dirty') {
                        return (
                          <button
                            onClick={() => {
                              if (!canReserve) {
                                try { pushNotification({ title:'Eksik Bilgi', message:'Rezerve için misafir adı veya çıkış tarihi girin.', type:'reception', priority:'medium', recipient:'reception' }); } catch {}
                                return;
                              }
                              // Rezervasyon kaydı oluştur
                              try {
                                const today = getToday();
                                const co = (localRoom.expectedCheckOutDate && localRoom.expectedCheckOutDate.slice(0,10)) || getTomorrow(today);
                                const guest = (localRoom.guestNames && localRoom.guestNames.length > 0 ? localRoom.guestNames.join(', ') : (localRoom.guestName || 'Rezervasyon'));
                                addReservation({
                                  guestName: guest,
                                  roomNumber: localRoom.number,
                                  checkInDate: today,
                                  checkOutDate: co,
                                  phone: localRoom.phone,
                                  dailyRate: localRoom.price,
                                  status: 'upcoming',
                                });
                              } catch {}
                              const updated: RoomData = { 
                                ...localRoom, 
                                status: 'reserved',
                                // Rezervasyonda check-in henüz yapılmadı, çıkış tarihi de temizlenir
                                checkInDate: undefined,
                                checkOutDate: undefined,
                              };
                              setLocalRoom(updated);
                              onChange(updated);
                              try { pushNotification({ title:'Oda Rezerve Edildi', message:`Oda ${room.number} rezerveye alındı.`, type:'reception', priority:'low', recipient:'reception' }); } catch {}
                            }}
                            className={`px-6 py-3 ${canReserve ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl hover:scale-105' : 'bg-amber-200 text-amber-800 cursor-not-allowed'} font-medium rounded-xl transition-all duration-200`}
                            disabled={!canReserve}
                          >
                            📅 Rezerve
                          </button>
                        );
                      }
                      return null;
                    })()}
                    
                     <button 
                       onClick={() => {
                         const updated: RoomData = { ...localRoom, status: 'occupied', checkInDate: new Date().toISOString() };
                         setLocalRoom(updated);
                         onChange(updated);
                         try { pushNotification({ title:'Check-in Yapıldı', message:`Oda ${room.number} check-in yapıldı.`, type:'reception', priority:'medium', recipient:'management' }); } catch {}
                       }}
                       className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                     >
                       🏨 Check-in
                     </button>
                     <button 
                       onClick={() => {
                         const updated: RoomData = {
                           ...localRoom,
                           status: 'dirty',
                           checkOutDate: new Date().toISOString(),
                           // Oda kartını sıfırla
                           guestName: '',
                           guestNames: [],
                           phone: '',
                           price: undefined,
                           paymentStatus: undefined,
                           paymentMethod: undefined,
                           checkInDate: undefined
                         };
                         setLocalRoom(updated);
                         onChange(updated);
                         try { pushNotification({ title:'Check-out Yapıldı', message:`Oda ${room.number} check-out yapıldı ve oda kirli olarak işaretlendi.`, type:'reception', priority:'medium', recipient:'management' }); } catch {}
                       }}
                       className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                     >
                       🚪 Check-out
                     </button>
                 </div>
              </div>

              {/* Oda Değişimi */}
              {availableRoomNumbers && availableRoomNumbers.length > 0 && onSwitchRoom && (
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-amber-200/20 shadow-lg">
                  <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
                    <FaDoorOpen className="text-amber-600" />
                    Oda Değişimi
                  </h3>
                  <div className="mb-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200/30">
                    <p className="text-sm text-amber-800">
                      <strong>Not:</strong> Oda değişimi sonrası yeni oda temizlik gerektirebilir. 
                      Temizlik durumu HK ekibi tarafından kontrol edilecektir.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select 
                      id="switch-target" 
                      className="flex-1 px-4 py-3 rounded-xl bg-white/50 backdrop-blur-sm border border-amber-200/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200 text-gray-900"
                    >
                      {availableRoomNumbers.map(n => <option key={n} value={n}>Oda {n}</option>)}
                    </select>
                    <button 
                      onClick={() => {
                        const el = document.getElementById('switch-target') as HTMLSelectElement | null;
                        const to = el?.value;
                        if (to) onSwitchRoom(localRoom.number, to);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                      🔄 Taşı
                    </button>
                  </div>
                </div>
              )}

              {/* Arızalar */}
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-rose-200/30 shadow-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <FaExclamationTriangle className="text-rose-600" />
                  Arızalar
                </h3>
                {Array.isArray(localRoom.issues) && localRoom.issues.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {localRoom.issues.map((iss, idx) => (
                      <li key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/40 border border-rose-200/40">
                        <span className="text-gray-800">{iss}</span>
                        <button
                          onClick={() => {
                            const updatedIssues = (localRoom.issues || []).filter((_, i) => i !== idx);
                            const updated = { ...localRoom, issues: updatedIssues } as RoomData;
                            setLocalRoom(updated);
                            onChange(updated);
                          }}
                          className="text-xs px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-md"
                        >
                          Sil
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mb-4 p-3 rounded-lg bg-white/40 border border-gray-200/40 text-gray-700">Bu odada kayıtlı arıza yok.</div>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Arıza adı"
                    value={newIssueName}
                    onChange={(e) => setNewIssueName(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/50 backdrop-blur-sm border border-rose-200/30 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 outline-none transition-all duration-200 text-gray-800"
                  />
                  <button
                    onClick={() => {
                      const trimmed = newIssueName.trim();
                      if (!trimmed) return;
                      const updatedIssues = [ ...(localRoom.issues || []), trimmed ];
                      const updated = { ...localRoom, issues: updatedIssues } as RoomData;
                      setLocalRoom(updated);
                      onChange(updated);
                      setNewIssueName('');
                      try { pushNotification({ title: 'Arıza Eklendi', message: `Oda ${localRoom.number}: ${trimmed}`, type: 'maintenance', priority: 'medium', recipient: 'management' }); } catch {}
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    ➕ Ekle
                  </button>
                </div>
                {Array.isArray(localRoom.issuePhotos) && localRoom.issuePhotos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2">Fotoğraflar</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {localRoom.issuePhotos!.map((src, idx) => (
                        <div key={idx} className="relative">
                          <img src={src} alt={`Arıza foto ${idx+1}`} className="w-full h-24 object-cover rounded-lg border border-rose-200/40" />
                          <button
                            onClick={() => {
                              const list = (localRoom.issuePhotos || []).filter((_, i) => i !== idx);
                              const updated = { ...localRoom, issuePhotos: list } as RoomData;
                              setLocalRoom(updated);
                              onChange(updated);
                            }}
                            className="absolute top-1 right-1 bg-rose-600 text-white text-xs px-1.5 py-0.5 rounded"
                          >Sil</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Özet Bilgiler */}
              <div className="bg-gradient-to-br from-amber-50/50 to-yellow-50/50 backdrop-blur-sm rounded-2xl p-5 border border-amber-200/30 shadow-lg">
                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center gap-2">
                  <FaCheckCircle className="text-amber-600" />
                  Özet Bilgiler
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Misafir:</span>
                      <span className="font-medium text-gray-800">{formatGuestNames(localRoom.guestNames as any, localRoom.guestName) || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Telefon:</span>
                      <span className="font-medium text-gray-800">{localRoom.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fiyat:</span>
                      <span className="font-medium text-gray-800">{localRoom.price != null ? `₺${localRoom.price} TL` : '—'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ödeme:</span>
                      <span className="font-medium text-gray-800">
                        {localRoom.paymentStatus ? (localRoom.paymentStatus === 'received' ? '✅ Alındı' : '❌ Alınmadı') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Check-in:</span>
                      <span className="font-medium text-gray-800">
                        {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkInDate 
                          ? new Date(localRoom.checkInDate).toLocaleDateString() 
                          : '—'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Check-out:</span>
                      <span className="font-medium text-gray-800">
                        {(localRoom.status === 'occupied' || localRoom.status === 'sold') && localRoom.checkOutDate 
                          ? new Date(localRoom.checkOutDate).toLocaleDateString() 
                          : '—'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>, document.body
      )}

      {/* POS/Z Bilgi Modalı */}
      {showPosModal && (
        <Modal isOpen={showPosModal} onClose={()=>setShowPosModal(false)} maxWidthClass="max-w-md">
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Kart Satışı için POS/Fatura Bilgisi</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!posForm.invoiceIssued} onChange={(e)=>setPosForm({ ...posForm, invoiceIssued: e.target.checked })} />
              <span>Fatura Kesildi</span>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-xs text-gray-500">Z Raporu No</span>
              <input className="border border-gray-300 rounded px-2 py-1" value={posForm.zReportNumber || ''} onChange={(e)=>setPosForm({ ...posForm, zReportNumber: e.target.value })} />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-xs text-gray-500">Fiş Sayısı</span>
              <input type="number" className="border border-gray-300 rounded px-2 py-1" value={posForm.receiptCount ?? ''} onChange={(e)=>setPosForm({ ...posForm, receiptCount: Number(e.target.value) })} />
            </label>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={()=>setShowPosModal(false)}>İptal</button>
              <button className="px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700" onClick={()=>{
                try {
                  const raw = localStorage.getItem(POS_INFO_KEY);
                  const all = raw ? JSON.parse(raw) : {};
                  const key = new Date().toISOString().slice(0,10);
                  all[key] = { ...(all[key] || {}), invoiceIssued: !!posForm.invoiceIssued, zReportNumber: (posForm.zReportNumber || '').trim(), receiptCount: typeof posForm.receiptCount === 'number' ? posForm.receiptCount : undefined };
                  localStorage.setItem(POS_INFO_KEY, JSON.stringify(all));
                } catch {}
                setShowPosModal(false);
                try { pushNotification({ title:'POS/Z bilgisi kaydedildi', message:`Oda ${room.number} için POS/Z bilgisi güncellendi.`, type:'reception', priority:'medium', recipient:'management' }); } catch {}
              }}>Kaydet</button>
            </div>
          </div>
        </Modal>
      )}
      {showIssueModal && (
        <Modal isOpen={showIssueModal} onClose={()=>{ closeCamera(); setShowIssueModal(false); }} maxWidthClass="max-w-md">
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Arıza bildir</h3>
            <input
              type="text"
              value={issueText}
              onChange={(e)=>setIssueText(e.target.value)}
              placeholder="Örn: Klima çalışmıyor"
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <div className="space-y-2">
              <label className="block text-sm text-gray-600">Fotoğraf ekle (opsiyonel)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={async (e)=>{
                  const files = e.target.files;
                  if (files && files.length) {
                    const urls = await readFilesAsDataUrls(files);
                    setIssueUploadDataUrls(urls);
                  } else {
                    setIssueUploadDataUrls([]);
                  }
                }}
                className="w-full"
              />
              <div className="mt-2 space-y-2">
                {!cameraOpen ? (
                  <button
                    type="button"
                    onClick={openCamera}
                    className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >📷 Kamerayı aç</button>
                ) : (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-40 object-cover rounded-lg border border-gray-200" />
                    <div className="flex gap-2">
                      <button type="button" onClick={capturePhoto} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">📸 Fotoğrafı çek</button>
                      <button type="button" onClick={closeCamera} className="px-3 py-2 rounded bg-gray-600 text-white hover:bg-gray-700">Kapat</button>
                    </div>
                  </div>
                )}
                {cameraError && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">{cameraError}</div>}
              </div>
              {issueUploadDataUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {issueUploadDataUrls.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img src={src} alt={`Arıza foto ${idx+1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          setIssueUploadDataUrls(issueUploadDataUrls.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 bg-gray-800/70 text-white text-xs px-1.5 py-0.5 rounded"
                      >Sil</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={()=>setShowIssueModal(false)}>İptal</button>
              <button className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700" onClick={()=>{
                const trimmed = issueText.trim();
                if (!trimmed) return;
                const updatedIssues = [ ...(localRoom.issues || []), trimmed ];
                const mergedPhotos = [ ...(localRoom.issuePhotos || []), ...(issueUploadDataUrls || []) ];
                const updated = { ...localRoom, issues: updatedIssues, issuePhotos: mergedPhotos } as RoomData;
                setLocalRoom(updated);
                onChange(updated);
                setIssueText('');
                setIssueUploadDataUrls([]);
                setShowIssueModal(false);
                try { pushNotification({ title: 'Arıza Bildirildi', message: `Oda ${localRoom.number}: ${trimmed}`, type: 'maintenance', priority: 'medium', recipient: 'management' }); } catch {}
              }}>Kaydet</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default RoomCardMinimal;

// Safe formatter for guestNames that tolerates wrong runtime types
const formatGuestNames = (guestNames: any, fallback?: string) => {
  if (Array.isArray(guestNames) && guestNames.length) return guestNames.join(', ');
  if (typeof guestNames === 'string' && guestNames.trim()) return guestNames.trim();
  return fallback || '';
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
