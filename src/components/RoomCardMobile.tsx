import React from 'react';
import type { RoomData } from './RoomCard';

type Props = {
  room: RoomData;
  onChange: (updated: RoomData) => void;
};

const statusLabel = (s: RoomData['status']) => {
  switch (s) {
    case 'occupied': return 'Dolu';
    case 'dirty': return 'Kirli';
    case 'reserved': return 'Rezerve';
    case 'sold': return 'Satıldı';
    case 'changing': return 'Temizleniyor';
    default: return 'Müsait';
  }
};

const statusColor = (s: RoomData['status']) => {
  switch (s) {
    case 'occupied': return 'bg-red-500';
    case 'dirty': return 'bg-amber-800';
    case 'changing': return 'bg-yellow-500';
    case 'sold': return 'bg-emerald-600';
    case 'reserved': return 'bg-indigo-600';
    default: return 'bg-gray-500';
  }
};

const RoomCardMobile: React.FC<Props> = ({ room }) => {
  const color = statusColor(room.status);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${color} shadow-inner`} />
        <div>
          <div className="text-lg font-semibold">Oda {room.number}</div>
          <div className="text-sm opacity-80">{statusLabel(room.status)}</div>
          {room.status === 'changing' && (
            <div className="mt-1 h-2 w-28 rounded bg-white/10 overflow-hidden">
              <div className="h-full w-1/2 bg-yellow-400 animate-pulse" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(room.status === 'dirty') && (
          <span className="px-3 py-1 rounded bg-white/10 text-xs">Temizleme Başlat</span>
        )}
        {(room.status === 'changing') && (
          <span className="px-3 py-1 rounded bg-white/10 text-xs">Devam ediyor</span>
        )}
      </div>
    </div>
  );
};

export default RoomCardMobile;