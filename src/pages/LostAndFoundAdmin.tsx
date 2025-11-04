import React, { useEffect, useState } from 'react';
import { getLostItems, updateLostItem, LostItem, removeLostItem } from '../utils/lostfound';

const LostAndFoundAdmin: React.FC = () => {
  const [items, setItems] = useState<LostItem[]>([]);

  useEffect(() => {
    const load = () => setItems(getLostItems());
    load();
    const onUpdate = () => load();
    window.addEventListener('hk-lost-found-updated', onUpdate as EventListener);
    return () => window.removeEventListener('hk-lost-found-updated', onUpdate as EventListener);
  }, []);

  const handleUpdate = (id: string, field: keyof LostItem, value: any) => {
    const updates: Partial<LostItem> = { [field]: value } as any;
    updateLostItem(id, updates);
    setItems(getLostItems());
  };

  const toggleDelivered = (item: LostItem) => {
    const delivered = !item.delivered;
    if (delivered) {
      // Teslim edilen eşya sistemden düşsün
      removeLostItem(item.id);
    } else {
      // Güvenli: normalde tekrar görünmez, ancak akış bütünlüğü için
      updateLostItem(item.id, { delivered: false, deliveredDate: undefined });
    }
    setItems(getLostItems());
  };

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-blue">
          <h1 className="text-2xl font-bold">Unutulan Eşya (Resepsiyon)</h1>
          <p className="text-white/80 text-sm">Kayıtları görüntüleyin ve teslim/kişi bilgilerini yönetin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="premium-card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Oda {item.roomNumber}</div>
              <div className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</div>
            </div>
            <div className="mt-2 text-sm text-gray-700">Saklama: {item.storageLocation}</div>
            {item.description && <div className="mt-1 text-sm text-gray-600">{item.description}</div>}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="İsim"
                value={item.ownerName || ''}
                onChange={(e) => handleUpdate(item.id, 'ownerName', e.target.value)}
              />
              <input
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Soyisim"
                value={item.ownerSurname || ''}
                onChange={(e) => handleUpdate(item.id, 'ownerSurname', e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-600">{item.deliveredDate ? `Teslim: ${new Date(item.deliveredDate).toLocaleString()}` : 'Teslim bilgisi yok'}</div>
              <button
                onClick={() => toggleDelivered(item)}
                className={`px-3 py-1 rounded-lg text-white text-xs ${item.delivered ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                {item.delivered ? 'Teslim edildi' : 'Teslim et'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LostAndFoundAdmin;