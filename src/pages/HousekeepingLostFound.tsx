import React, { useEffect, useState } from 'react';
import { addLostItem, getLostItems, LostItem } from '../utils/lostfound';
import { FaPlus } from 'react-icons/fa';

const HousekeepingLostFound: React.FC = () => {
  const [items, setItems] = useState<LostItem[]>([]);
  const [form, setForm] = useState<Partial<LostItem>>({ date: new Date().toISOString().slice(0,10), storageLocation: '' });

  useEffect(() => {
    const load = () => setItems(getLostItems());
    load();
    const onUpdate = () => load();
    window.addEventListener('hk-lost-found-updated', onUpdate as EventListener);
    return () => window.removeEventListener('hk-lost-found-updated', onUpdate as EventListener);
  }, []);

  const handleAdd = () => {
    if (!form.roomNumber || !form.date || !form.storageLocation) {
      alert('Oda numarası, tarih ve saklama yeri zorunlu');
      return;
    }
    addLostItem({
      roomNumber: String(form.roomNumber),
      date: String(form.date),
      storageLocation: String(form.storageLocation),
      description: form.description || ''
    });
    setForm({ date: new Date().toISOString().slice(0,10), storageLocation: '' });
    setItems(getLostItems());
  };

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-teal">
          <h1 className="text-2xl font-bold">Unutulan Eşya</h1>
          <p className="text-white/80 text-sm">HK: Eşya kaydı ekleme ve listeleme</p>
        </div>
      </div>

      {/* Form */}
      <div className="premium-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Oda Numarası"
            value={form.roomNumber || ''}
            onChange={(e) => setForm(f => ({ ...f, roomNumber: e.target.value }))}
          />
          <input
            type="date"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={form.date as string}
            onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
          />
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Saklama Yeri (Bagaj Odası vb.)"
            value={form.storageLocation || ''}
            onChange={(e) => setForm(f => ({ ...f, storageLocation: e.target.value }))}
          />
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Açıklama (opsiyonel)"
            value={form.description || ''}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="mt-3">
          <button onClick={handleAdd} className="px-4 py-2 bg-secondary-700 hover:bg-secondary-800 text-white rounded-lg text-sm flex items-center">
            <FaPlus className="mr-2" /> Ekle
          </button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="premium-card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Oda {item.roomNumber}</div>
              <div className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</div>
            </div>
            <div className="mt-2 text-sm text-gray-700">Saklama: {item.storageLocation}</div>
            {item.description && <div className="mt-1 text-sm text-gray-600">{item.description}</div>}
            {item.delivered ? (
              <div className="mt-2 text-xs text-green-700">Teslim edildi {item.ownerName || ''} {item.ownerSurname || ''} ({item.deliveredDate ? new Date(item.deliveredDate).toLocaleString() : ''})</div>
            ) : (
              <div className="mt-2 text-xs text-orange-700">Teslim edilmedi</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousekeepingLostFound;