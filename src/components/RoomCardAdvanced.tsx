import React, { useState } from 'react';
import { 
  FaUser, FaClock, FaBroom, FaWrench, FaWifi, FaSnowflake, 
  FaTv, FaBed, FaPhone, FaExclamationTriangle, FaCheckCircle,
  FaTimesCircle, FaHourglass, FaUserTie, FaCalendarAlt
} from 'react-icons/fa';

import Modal from './Modal';

interface Guest {
  name: string;
  checkIn: string;
  checkOut: string;
  preferences?: string[];
  vip?: boolean;
}

interface RoomData {
  number: string;
  floor: number;
  type: 'standard' | 'deluxe' | 'suite' | 'presidential';
  status: 'clean' | 'dirty' | 'maintenance' | 'occupied' | 'reserved' | 'out-of-order';
  cleaningStatus: 'pending' | 'in-progress' | 'completed' | 'inspected';
  guest?: Guest;
  amenities: string[];
  lastCleaned?: string;
  nextMaintenance?: string;
  issues?: string[];
  revenue?: number;
  notes?: string;
  housekeepingAssigned?: string;
  estimatedCleaningTime?: number;
}

interface RoomCardAdvancedProps {
  room: RoomData;
  onStatusChange?: (roomNumber: string, newStatus: string) => void;
  onAssignHousekeeper?: (roomNumber: string, housekeeper: string) => void;
  compact?: boolean;
}

const RoomCardAdvanced: React.FC<RoomCardAdvancedProps> = ({ 
  room, 
  onStatusChange, 
  onAssignHousekeeper,
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState<{ guestName: string; phone: string; checkIn: string; checkOut: string; price: number; paymentMethod: 'card'|'cash'|'iban'; paymentStatus: 'received'|'not_received'; finalizeStatus: 'reserved'|'occupied' }>(
    { guestName: room.guest?.name || '', phone: '', checkIn: '', checkOut: '', price: room.revenue || 0, paymentMethod: 'cash', paymentStatus: 'not_received', finalizeStatus: 'reserved' }
  );

  // Durum bazlı renk ve animasyon sınıfları
  const getStatusStyles = () => {
    const baseClasses = "transition-all duration-300 transform hover:scale-105";
    
    switch (room.status) {
      case 'clean':
        return `${baseClasses} bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300 shadow-emerald-200/50`;
      case 'dirty':
        return `${baseClasses} bg-gradient-to-br from-red-50 to-red-100 border-red-300 shadow-red-200/50 animate-pulse`;
      case 'maintenance':
        return `${baseClasses} bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 shadow-orange-200/50`;
      case 'occupied':
        return `${baseClasses} bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 shadow-blue-200/50`;
      case 'reserved':
        return `${baseClasses} bg-gradient-to-br from-purple-50 to-purple-100 border-purple-300 shadow-purple-200/50 animate-pulse`;
      case 'out-of-order':
        return `${baseClasses} bg-gradient-to-br from-gray-100 to-gray-200 border-gray-400 shadow-gray-300/50`;
      default:
        return `${baseClasses} bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 shadow-gray-200/50`;
    }
  };

  const getRoomNumberBadgeStyles = () => {
    const baseClasses = "inline-flex items-center justify-center w-16 h-16 rounded-2xl font-bold text-lg shadow-lg";
    
    switch (room.status) {
      case 'clean':
        return `${baseClasses} bg-gradient-to-br from-emerald-500 to-emerald-600 text-white`;
      case 'dirty':
        return `${baseClasses} bg-gradient-to-br from-red-500 to-red-600 text-white animate-pulse`;
      case 'maintenance':
        return `${baseClasses} bg-gradient-to-br from-orange-500 to-orange-600 text-white`;
      case 'occupied':
        return `${baseClasses} bg-gradient-to-br from-blue-500 to-blue-600 text-white`;
      case 'reserved':
        return `${baseClasses} bg-gradient-to-br from-purple-500 to-purple-600 text-white animate-pulse`;
      case 'out-of-order':
        return `${baseClasses} bg-gradient-to-br from-gray-500 to-gray-600 text-white`;
      default:
        return `${baseClasses} bg-gradient-to-br from-amber-500 to-amber-600 text-white`;
    }
  };

  const getStatusIcon = () => {
    switch (room.status) {
      case 'clean': return <FaCheckCircle className="text-emerald-600" />;
      case 'dirty': return <FaBroom className="text-red-600" />;
      case 'maintenance': return <FaWrench className="text-orange-600" />;
      case 'occupied': return <FaUser className="text-blue-600" />;
      case 'reserved': return <FaCalendarAlt className="text-purple-600" />;
      case 'out-of-order': return <FaTimesCircle className="text-gray-600" />;
      default: return <FaHourglass className="text-amber-600" />;
    }
  };

  const getStatusText = () => {
    switch (room.status) {
      case 'clean': return 'Temiz';
      case 'dirty': return 'Temizlenmeli';
      case 'maintenance': return 'Bakımda';
      case 'occupied': return 'Dolu';
      case 'reserved': return 'Rezerveli';
      case 'out-of-order': return 'Hizmet Dışı';
      default: return 'Bilinmiyor';
    }
  };

  const getRoomTypeText = () => {
    switch (room.type) {
      case 'standard': return 'Standart';
      case 'deluxe': return 'Deluxe';
      case 'suite': return 'Suit';
      case 'presidential': return 'Başkanlık Süiti';
      default: return 'Standart';
    }
  };

  if (compact) {
    return (
      <div className={`rounded-xl border-2 p-4 shadow-lg cursor-pointer ${getStatusStyles()}`}
           onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className={getRoomNumberBadgeStyles()}>
            {room.number}
          </div>
          <div className="flex-1 ml-4">
            <div className="flex items-center space-x-2 mb-1">
              {getStatusIcon()}
              <span className="font-semibold text-gray-800">{getStatusText()}</span>
            </div>
            {room.guest && (
              <div className="text-sm text-gray-600 flex items-center">
                <FaUser className="mr-1" />
                {room.guest.name}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
            <div className={`group relative overflow-hidden rounded-2xl ring-1 ring-white/20 hover:ring-white/30 bg-black/40 hover:bg-white/10 backdrop-blur-[32px] text-white shadow-xl transition-all duration-300`} 
         onClick={() => setIsExpanded(!isExpanded)}>
      
      {/* Header */}
    <div className="flex items-start justify-between mb-4 px-4 py-3 bg-black/20 backdrop-blur-glass rounded-t-2xl">
        <div className="flex items-center space-x-4">
          <div className={getRoomNumberBadgeStyles()}>
            {room.number}
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              {getStatusIcon()}
              <span className="font-bold text-lg text-white">{getStatusText()}</span>
              {room.guest?.vip && (
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                  VIP
                </span>
              )}
            </div>
            <div className="text-sm text-white/70">
              {getRoomTypeText()} • {room.floor}. Kat
            </div>
          </div>
        </div>
        
        {/* Gelir bilgisi header’dan kaldırıldı; ödeme bilgileri kart içinde yönetilir */}
      </div>

      {/* Misafir Bilgileri */}
      {room.guest && (
        <div className="bg-black/30 rounded-xl p-4 mb-4 backdrop-blur-glass ring-1 ring-white/10 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <FaUser className="text-blue-600" />
              <span className="font-semibold text-white">{room.guest.name}</span>
              {room.guest.vip && <FaUserTie className="text-yellow-500" />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-white/70">
            <div className="flex items-center space-x-1">
              <FaClock className="text-green-500" />
              <span>Giriş: {room.guest.checkIn}</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaClock className="text-red-500" />
              <span>Çıkış: {room.guest.checkOut}</span>
            </div>
          </div>
          {room.guest.preferences && (
            <div className="mt-2">
              <div className="text-xs text-white/60 mb-1">Tercihler:</div>
              <div className="flex flex-wrap gap-1">
                {room.guest.preferences.map((pref, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Temizlik Durumu */}
      <div className="group relative bg-black/30 rounded-xl p-4 mb-4 backdrop-blur-[32px] ring-1 ring-white/10 hover:ring-cyan-300/40 text-white transition-all duration-300 hover:bg-gradient-to-br hover:from-cyan-300/10 hover:via-transparent hover:to-indigo-300/15 hover:shadow-[0_0_24px_rgba(165,243,252,0.15)]">
        {/* Diamond facet overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_1px,transparent_1px,transparent_6px)]"></div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FaBroom className="text-purple-600" />
            <span className="font-semibold text-white">Temizlik Durumu</span>
          </div>
          {room.estimatedCleaningTime && (
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
              ~{room.estimatedCleaningTime} dk
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-white/70">Durum: </span>
            <span className="font-medium">{room.cleaningStatus === 'completed' ? 'Tamamlandı' : 'Bekliyor'}</span>
          </div>
          {room.housekeepingAssigned && (
            <div>
              <span className="text-white/70">Atanan: </span>
              <span className="font-medium">{room.housekeepingAssigned}</span>
            </div>
          )}
        </div>
        {room.lastCleaned && (
          <div className="text-xs text-white/60 mt-1">
            Son temizlik: {room.lastCleaned}
          </div>
        )}
      </div>

      {/* Olanaklar */}
      <div className="bg-black/30 rounded-xl p-4 mb-4 backdrop-blur-glass ring-1 ring-white/10 text-white">
        <div className="flex items-center space-x-2 mb-3">
          <FaBed className="text-indigo-600" />
          <span className="font-semibold text-white">Olanaklar</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {room.amenities.includes('wifi') && (
            <div className="flex flex-col items-center p-2 bg-black/30 backdrop-blur-glass ring-1 ring-white/10 rounded-lg">
              <FaWifi className="text-blue-400 mb-1" />
              <span className="text-xs text-white/80">WiFi</span>
            </div>
          )}
          {room.amenities.includes('ac') && (
            <div className="flex flex-col items-center p-2 bg-black/30 backdrop-blur-glass ring-1 ring-white/10 rounded-lg">
              <FaSnowflake className="text-cyan-400 mb-1" />
              <span className="text-xs text-white/80">Klima</span>
            </div>
          )}
          {room.amenities.includes('tv') && (
            <div className="flex flex-col items-center p-2 bg-black/30 backdrop-blur-glass ring-1 ring-white/10 rounded-lg">
              <FaTv className="text-purple-400 mb-1" />
              <span className="text-xs text-white/80">TV</span>
            </div>
          )}
          {room.amenities.includes('phone') && (
            <div className="flex flex-col items-center p-2 bg-black/30 backdrop-blur-glass ring-1 ring-white/10 rounded-lg">
              <FaPhone className="text-green-400 mb-1" />
              <span className="text-xs text-white/80">Telefon</span>
            </div>
          )}
        </div>
      </div>

      {/* Sorunlar ve Notlar */}
      {(room.issues?.length || room.notes) && (
        <div className="bg-black/30 rounded-xl p-4 mb-4 backdrop-blur-glass ring-1 ring-white/10 text-white">
          {room.issues?.length && (
            <div className="mb-3">
              <div className="flex items-center space-x-2 mb-2">
                <FaExclamationTriangle className="text-red-600" />
                <span className="font-semibold text-white">Sorunlar</span>
              </div>
              {room.issues.map((issue, index) => (
                <div key={index} className="bg-red-600/20 border border-red-400/40 rounded-lg p-2 mb-1">
                  <span className="text-red-100 text-sm">{issue}</span>
                </div>
              ))}
            </div>
          )}
          {room.notes && (
            <div>
              <div className="text-sm text-white/70 mb-1">Notlar:</div>
              <div className="bg-yellow-600/20 border border-yellow-400/40 rounded-lg p-2">
                <span className="text-yellow-100 text-sm">{room.notes}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Genişletilmiş Bilgiler */}
      {isExpanded && (
        <div className="bg-black/30 rounded-xl p-4 backdrop-blur-glass ring-1 ring-white/10 text-white animate-fadeIn">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {room.nextMaintenance && (
              <div>
                <span className="text-white/70">Sonraki Bakım: </span>
                <span className="font-medium">{room.nextMaintenance}</span>
              </div>
            )}
            <div>
              <span className="text-white/70">Oda Tipi: </span>
              <span className="font-medium">{getRoomTypeText()}</span>
            </div>
          </div>
          
          {/* Hızlı Aksiyonlar */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors">
              Temiz İşaretle
            </button>
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm transition-colors" onClick={(e) => { e.stopPropagation(); setShowAssignModal(true); }}>
              Temizlik Ata
            </button>
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-sm transition-colors">
              Bakım Talep Et
            </button>
            <button className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-lg text-sm transition-colors">
              Detayları Gör
            </button>
            <button className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-sm transition-colors" onClick={(e) => { e.stopPropagation(); setShowSaleModal(true); }}>
              Satış Yap
            </button>
          </div>
        </div>
      )}

      {/* Temizlik Atama Modalı */}
      {showAssignModal && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} maxWidthClass="max-w-md">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Temizlik Atama</h3>
            <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30" onClick={() => setShowAssignModal(false)}>Kapat</button>
          </div>
          <div className="p-4 space-y-3">
            <label className="text-sm text-gray-700">Görevli Seç</label>
            <select className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30">
              <option>Ayşe Yılmaz</option>
              <option>Fatma Demir</option>
              <option>Ali Koç</option>
              <option>Mehmet Çetin</option>
            </select>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm" onClick={() => setShowAssignModal(false)}>İptal</button>
              <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm" onClick={() => { try { onAssignHousekeeper?.(room.number, 'Ayşe Yılmaz'); } catch {}; setShowAssignModal(false); }}>Ata</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Satış Modalı */}
      {showSaleModal && (
        <Modal isOpen={showSaleModal} onClose={() => setShowSaleModal(false)} maxWidthClass="max-w-lg">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Satış / Rezervasyon</h3>
            <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30" onClick={() => setShowSaleModal(false)}>Kapat</button>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Misafir Adı</label>
                <input value={saleForm.guestName} onChange={(e)=>setSaleForm({ ...saleForm, guestName: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input value={saleForm.phone} onChange={(e)=>setSaleForm({ ...saleForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giriş</label>
                <input type="datetime-local" value={saleForm.checkIn} onChange={(e)=>setSaleForm({ ...saleForm, checkIn: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Çıkış</label>
                <input type="datetime-local" value={saleForm.checkOut} onChange={(e)=>setSaleForm({ ...saleForm, checkOut: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat</label>
                <input type="number" value={saleForm.price} onChange={(e)=>setSaleForm({ ...saleForm, price: Number(e.target.value||0) })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Yöntemi</label>
                <select value={saleForm.paymentMethod} onChange={(e)=>setSaleForm({ ...saleForm, paymentMethod: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30">
                  <option value="cash">Nakit</option>
                  <option value="card">Kart</option>
                  <option value="iban">IBAN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Durumu</label>
                <select value={saleForm.paymentStatus} onChange={(e)=>setSaleForm({ ...saleForm, paymentStatus: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200/30">
                  <option value="received">Alındı</option>
                  <option value="not_received">Alınmadı</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tipi</label>
              <div className="flex gap-2">
                <button className={`px-3 py-1.5 rounded-lg text-sm ${saleForm.finalizeStatus==='reserved' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-800'}`} onClick={()=>setSaleForm({ ...saleForm, finalizeStatus: 'reserved' })}>Rezervasyon</button>
                <button className={`px-3 py-1.5 rounded-lg text-sm ${saleForm.finalizeStatus==='occupied' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-800'}`} onClick={()=>setSaleForm({ ...saleForm, finalizeStatus: 'occupied' })}>Walk-in (Dolu)</button>
              </div>
            </div>
            {saleForm.paymentMethod==='card' && saleForm.paymentStatus!=='received' && (
              <div className="mt-1 p-3 rounded-xl bg-red-500/15 border border-red-400/40 text-red-800 text-sm">
                Kart seçildi, ödeme alınmadı. POS/Z bilgilerini girme uyarısı.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 text-sm" onClick={() => setShowSaleModal(false)}>İptal</button>
              <button className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm" onClick={() => { try { onStatusChange?.(room.number, saleForm.finalizeStatus); } catch {}; setShowSaleModal(false); }}>Kaydet</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default RoomCardAdvanced;