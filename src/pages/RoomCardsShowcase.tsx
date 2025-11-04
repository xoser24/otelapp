import React, { useMemo, useState } from 'react';
import RoomCardMinimal from '../components/RoomCardMinimal';
import type { RoomData } from '../components/RoomCard';

const initialRooms: RoomData[] = [
  { number: '101', status: 'available' },
  { number: '102', status: 'reserved', guestName: 'Ayşe Yılmaz', phone: '+90 555 111 22 33', price: 850 },
  { number: '205', status: 'occupied', guestName: 'Mehmet Özkan', phone: '+90 532 444 55 66', price: 1200, paymentStatus: 'received', paymentMethod: 'card', checkInDate: new Date().toISOString() },
  { number: '312', status: 'dirty', guestName: '', price: undefined },
  { number: '408', status: 'sold', guestName: 'Dr. Ahmet Kaya', phone: '+90 533 777 88 99', price: 2500, paymentStatus: 'received', paymentMethod: 'cash', checkInDate: new Date().toISOString(), checkOutDate: new Date().toISOString() },
];

const statusLabel = (s: RoomData['status'] | 'all') => {
  switch (s) {
    case 'available': return 'Müsait';
    case 'reserved': return 'Rezerve';
    case 'occupied': return 'Dolu';
    case 'dirty': return 'Kirli';
    case 'sold': return 'Satıldı';
    case 'changing': return 'Değiştiriliyor';
    default: return 'Hepsi';
  }
};

const RoomCardsShowcase: React.FC = () => {
  const [rooms, setRooms] = useState<RoomData[]>(initialRooms);
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid');
  const [filter, setFilter] = useState<'all' | RoomData['status']>('all');

  const filtered = useMemo(() => {
    return filter === 'all' ? rooms : rooms.filter(r => r.status === filter);
  }, [rooms, filter]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { all: rooms.length };
    ['available','reserved','occupied','dirty','sold','changing'].forEach(s => {
      byStatus[s] = rooms.filter(r => r.status === s).length;
    });
    return byStatus;
  }, [rooms]);

  const handleChange = (updated: RoomData) => {
    setRooms(prev => prev.map(r => r.number === updated.number ? updated : r));
  };

  return (
    <div className="relative min-h-screen p-6 overflow-hidden">
      {/* Ambient gradient & glow layers for visible glass blur */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 w-[360px] h-[360px] rounded-full bg-secondary-600/25 blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-primary-600/25 blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-yellow-400/10 to-pink-500/10 blur-[140px]" />
      </div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Oda Kartları Demo</h1>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          >
            {(['all','available','reserved','occupied','dirty','sold','changing'] as const).map(opt => (
              <option key={opt} value={opt}>{statusLabel(opt)} ({counts[opt] ?? 0})</option>
            ))}
          </select>
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-300">
            <button
              className={`px-3 py-2 text-sm ${viewMode==='grid' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('grid')}
            >Grid</button>
            <button
              className={`px-3 py-2 text-sm ${viewMode==='list' ? 'bg-gray-200' : 'bg-white'}`}
              onClick={() => setViewMode('list')}
            >Liste</button>
          </div>
        </div>
      </div>

      <div className={viewMode==='grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
        {filtered.map(room => (
          <RoomCardMinimal key={room.number} room={room} onChange={handleChange} />
        ))}
      </div>
    </div>
  );
};

export default RoomCardsShowcase;