import React, { useState } from 'react';
import {
  FaUser,
  FaDoorOpen,
  FaCheckCircle,
  FaTimesCircle,
  FaBroom,
  FaToolbox,
  FaCalendarCheck,
  FaWifi,
  FaSnowflake,
  FaTv,
  FaCoffee,
  FaBolt,
  FaStar
} from 'react-icons/fa';
import Modal from '../components/Modal';

type Status = 'bos' | 'dolu' | 'temizlik' | 'bakim';

const statusStyles: Record<Status, { label: string; badge: string; accentBar: string; headerText?: string; iconColor?: string; pulse?: boolean }> = {
  bos: {
    label: 'Müsait',
    badge: 'bg-lime-100 text-lime-800 ring-1 ring-lime-300',
    accentBar: 'bg-gradient-to-r from-lime-400 via-cyan-400 to-fuchsia-400',
    headerText: 'bg-gradient-to-r from-lime-600 via-cyan-600 to-fuchsia-600',
    iconColor: 'text-lime-600'
  },
  dolu: {
    label: 'Dolu',
    badge: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300',
    accentBar: 'bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500',
    headerText: 'bg-gradient-to-r from-indigo-700 via-violet-700 to-pink-700',
    iconColor: 'text-indigo-600',
    pulse: true
  },
  temizlik: {
    label: 'Temizlik',
    badge: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
    accentBar: 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400',
    headerText: 'bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600',
    iconColor: 'text-amber-600',
    pulse: true
  },
  bakim: {
    label: 'Bakım',
    badge: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300',
    accentBar: 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-500',
    headerText: 'bg-gradient-to-r from-rose-700 via-red-700 to-orange-700',
    iconColor: 'text-rose-600',
    pulse: true
  }
};

interface DetailedCardProps {
  roomNo: string;
  status: Status;
  guestName?: string;
  occupants?: number;
  checkIn?: string;
  checkOut?: string;
  cleaningProgress?: number; // 0-100
  notes?: string;
}

const DetailedCard: React.FC<DetailedCardProps> = ({ roomNo, status, guestName, occupants = 0, checkIn, checkOut, cleaningProgress = 0, notes }) => {
  const [open, setOpen] = useState(false);
  const st = statusStyles[status];
  const showCleaning = status === 'temizlik';
  const iconByStatus = status === 'temizlik' ? <FaBroom className={st.iconColor} /> : status === 'bakim' ? <FaToolbox className={st.iconColor} /> : <FaDoorOpen className={st.iconColor} />;

  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white shadow-md hover:shadow-xl transition transform hover:scale-[1.02]">
      {/* Üst şerit - canlı gradient ve nabız */}
      <div className={`h-2 ${st.accentBar} rounded-t-2xl ${st.pulse ? 'animate-pulse' : ''}`} />

      {/* Başlık */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">Oda</div>
          <div className={`text-2xl font-extrabold bg-clip-text text-transparent ${st.headerText}`}>{roomNo}</div>
          <div className="text-sm text-gray-700 flex items-center gap-1">
            <FaUser className="text-gray-500" />
            {guestName ? guestName : '—'}
            {occupants > 0 && <span className="ml-1 text-gray-500">({occupants})</span>}
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm ${st.badge}`}>{st.label}</span>
      </div>

      {/* İçerik */}
      <div className="px-5 pb-5 space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-800">
          <div className="flex items-center gap-2">{iconByStatus}<span>Durum</span></div>
          <div className="flex items-center gap-2">
            {checkIn && <span className="flex items-center gap-1 text-gray-700"><FaCalendarCheck className="text-emerald-600" /> Giriş: {checkIn}</span>}
            {checkOut && <span className="flex items-center gap-1 text-gray-700"><FaCalendarCheck className="text-indigo-600" /> Çıkış: {checkOut}</span>}
          </div>
        </div>

        {/* İkon satırı - olanaklar */}
        <div className="flex items-center gap-3 text-gray-600">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"><FaWifi /> Wi‑Fi</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-200"><FaSnowflake /> Klima</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 ring-1 ring-purple-200"><FaTv /> TV</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 ring-1 ring-amber-200"><FaCoffee /> Kahve</span>
        </div>

        {showCleaning && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Temizlik İlerleme</span>
              <span>%{cleaningProgress}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded overflow-hidden">
              {/* Şeritli hareketli bar */}
              <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 animate-[pulse_1.5s_ease_in_out_infinite]" style={{ width: `${Math.min(Math.max(cleaningProgress, 0), 100)}%` }} />
            </div>
          </div>
        )}

        {notes && (
          <div className="text-xs text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2"><FaStar className="text-yellow-500" /> {notes}</div>
          </div>
        )}

        {/* Aksiyonlar */}
        <div className="pt-2 flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-300" onClick={() => setOpen(true)}>Detay</button>
          <button className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm flex items-center gap-1 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-300"><FaCheckCircle className="animate-pulse" /> Check-in</button>
          <button className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm flex items-center gap-1 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300"><FaTimesCircle /> Check-out</button>
          <button className="ml-auto px-3 py-1.5 rounded-md bg-fuchsia-600 text-white hover:bg-fuchsia-700 text-sm flex items-center gap-1 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-fuchsia-300"><FaBolt /> Hızlı İşlem</button>
        </div>
      </div>

      {/* Detay Modal */}
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <div className="max-w-md">
          <h3 className="text-lg font-semibold text-gray-900">Oda {roomNo} Detay</h3>
          <div className="mt-2 text-sm text-gray-800">Durum: {st.label}</div>
          <div className="mt-1 text-sm text-gray-800">Misafir: {guestName || '—'}</div>
          {occupants > 0 && <div className="mt-1 text-sm text-gray-800">Kişi: {occupants}</div>}
          {checkIn && <div className="mt-1 text-sm text-gray-800">Giriş: {checkIn}</div>}
          {checkOut && <div className="mt-1 text-sm text-gray-800">Çıkış: {checkOut}</div>}
          {notes && <div className="mt-2 text-sm text-gray-800">Not: {notes}</div>}
          {showCleaning && (
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">Temizlik İlerleme</div>
              <div className="h-2 bg-gray-100 rounded overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 animate-[pulse_1.5s_ease_in_out_infinite]" style={{ width: `${Math.min(Math.max(cleaningProgress, 0), 100)}%` }} />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm transition active:scale-95" onClick={() => setOpen(false)}>Kapat</button>
            <button className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm transition active:scale-95">Düzenle</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const CardDesignPlayground: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Deneme: Canlı Renkler ve Animasyonlu Kartlar</h1>
        <p className="text-gray-700 mt-1">Gradient şerit, ikon satırı, mikro etkileşim ve hareketli bar.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <DetailedCard roomNo="101" status="bos" occupants={0} checkIn="—" checkOut="—" notes="Pencere bakımı hafta içi yapılacak." />
          <DetailedCard roomNo="205" status="dolu" guestName="Mehmet Özkan" occupants={2} checkIn="27 Eki" checkOut="30 Eki" />
          <DetailedCard roomNo="312" status="temizlik" cleaningProgress={65} notes="Nevresimler değişecek." />
          <DetailedCard roomNo="408" status="bakim" notes="Klima filtresi değişimi." />
          <DetailedCard roomNo="508" status="dolu" guestName="Ayşe Yılmaz" occupants={1} checkIn="28 Eki" checkOut="31 Eki" />
          <DetailedCard roomNo="702" status="bos" />
        </div>
      </div>
    </div>
  );
};

export default CardDesignPlayground;