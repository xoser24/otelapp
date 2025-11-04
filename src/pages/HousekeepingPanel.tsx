import React, { useEffect, useMemo, useState } from 'react';
import { FaPlus, FaShareSquare, FaCheck, FaSearch, FaSyncAlt, FaMagic } from 'react-icons/fa';
import { pushNotification } from '../utils/notifications';
import { getCleaningMap, startCleaning, finalizeCleaning, HK_CLEANING_KEY, Checklist } from '../utils/hkCleaning';
import type { RoomData } from '../components/RoomCard';
import { emitRoomsUpdated, onRoomsUpdated } from '../utils/events';
import { ROOMS_KEY } from '../utils/reservations';

// Örnek veri
const initialTasks = [
  { 
    id: 1, 
    roomNumber: '302', 
    status: 'pending', 
    priority: 'high', 
    assignedTo: null, 
    checkOut: true,
    lateCheckOut: false,
    estimatedTime: 14,
    notes: 'Check-out temizliği'
  },
  { 
    id: 2, 
    roomNumber: '215', 
    status: 'in_progress', 
    priority: 'medium', 
    assignedTo: 'Ayşe Y.', 
    checkOut: false,
    lateCheckOut: false,
    estimatedTime: 10,
    notes: 'Günlük temizlik'
  },
  { 
    id: 3, 
    roomNumber: '118', 
    status: 'completed', 
    priority: 'low', 
    assignedTo: 'Mehmet K.', 
    checkOut: false,
    lateCheckOut: false,
    estimatedTime: 12,
    notes: 'Günlük temizlik'
  },
  { 
    id: 4, 
    roomNumber: '305', 
    status: 'pending', 
    priority: 'medium', 
    assignedTo: null, 
    checkOut: false,
    lateCheckOut: true,
    estimatedTime: 15,
    notes: 'Geç çıkış yapacak'
  },
  { 
    id: 5, 
    roomNumber: '401', 
    status: 'pending', 
    priority: 'high', 
    assignedTo: null, 
    checkOut: true,
    lateCheckOut: false,
    estimatedTime: 18,
    notes: 'VIP misafir check-out'
  }
];

const staff = [
  { id: 1, name: 'Ayşe Y.', performance: 95, tasksCompleted: 120, avgTime: 12 },
  { id: 2, name: 'Mehmet K.', performance: 88, tasksCompleted: 105, avgTime: 15 },
  { id: 3, name: 'Fatma S.', performance: 92, tasksCompleted: 110, avgTime: 13 }
];

// Gündelik Plan tipi
type DailyPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  staff: string;
  title: string;
  roomNumber?: string;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  shared?: boolean;
  createdAt: string; // ISO
};

const HousekeepingPanel: React.FC = () => {
  const [tasks] = useState(initialTasks);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  // Housekeeping panel state
  const STAYOVER_PREF_KEY = 'stayover_preference';
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [cleaning, setCleaning] = useState(getCleaningMap());
  const [stayoverMap, setStayoverMap] = useState<Record<string, 'requested' | 'not_requested' | 'unspecified'>>({});
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all'|'clean'|'dirty'|'stayover'|'reserved'|'occupied'>('all');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // Malzeme kullanımı durumları (görevler yerine)
  const MATERIALS_KEY = 'hk:materials:usage';
  type MaterialItem = { key: string; name: string; unit: string; defaultPerClean?: number; defaultPerStayover?: number; defaultPerOccupied?: number };
  const defaultMaterials: MaterialItem[] = [
    { key: 'towel', name: 'Havlu', unit: 'adet', defaultPerClean: 2, defaultPerStayover: 1 },
    { key: 'sheet', name: 'Çarşaf', unit: 'adet', defaultPerClean: 1 },
    { key: 'pillowcase', name: 'Yastık Kılıfı', unit: 'adet', defaultPerClean: 2 },
    { key: 'shampoo', name: 'Şampuan', unit: 'adet', defaultPerClean: 1, defaultPerStayover: 1 },
    { key: 'soap', name: 'Sabun', unit: 'adet', defaultPerClean: 1 },
    { key: 'toilet_paper', name: 'Tuvalet Kağıdı', unit: 'rulo', defaultPerClean: 0.3, defaultPerOccupied: 0.2 },
    { key: 'water', name: 'Su Şişesi', unit: 'adet', defaultPerOccupied: 2 },
    { key: 'slippers', name: 'Terlik', unit: 'çift', defaultPerClean: 2 }
  ];
  const [planDate, setPlanDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [materials, setMaterials] = useState<MaterialItem[]>(defaultMaterials);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const readHistory = (): Record<string, Record<string, number>> => {
    try { const raw = localStorage.getItem(MATERIALS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  };
  const writeHistory = (h: Record<string, Record<string, number>>) => {
    try { localStorage.setItem(MATERIALS_KEY, JSON.stringify(h)); } catch {}
  };
  const loadUsageForDate = (d: string) => {
    const h = readHistory();
    setUsage(h[d] || {});
  };
  useEffect(() => { loadUsageForDate(planDate); }, [planDate]);

  // Malzeme stok verileri
  const STOCK_KEY = 'hk:materials:stock';
  type StockRow = { current: number; min: number; target: number };
  const [stock, setStock] = useState<Record<string, StockRow>>({});
  const defaultStock: Record<string, StockRow> = Object.fromEntries(defaultMaterials.map(m => [m.key, { current: 100, min: 20, target: 120 }]));
  const readStock = (): Record<string, StockRow> => {
    try { const raw = localStorage.getItem(STOCK_KEY); return raw ? JSON.parse(raw) : defaultStock; } catch { return defaultStock; }
  };
  const writeStock = (s: Record<string, StockRow>) => { try { localStorage.setItem(STOCK_KEY, JSON.stringify(s)); } catch {} };
  useEffect(() => { setStock(readStock()); }, []);
  const setStockField = (key: string, field: keyof StockRow, value: number) => {
    setStock(prev => ({ ...prev, [key]: { ...prev[key], [field]: Math.max(0, Number.isFinite(value) ? value : 0) } }));
  };
  const saveStock = () => { writeStock(stock); try { pushNotification({ title: 'Stok Kaydedildi', message: 'Malzeme stok tablosu güncellendi.', type: 'housekeeping', priority: 'low', recipient: 'management' }); } catch {} };
  const suggestedOrder = (key: string) => {
    const row = stock[key] || { current: 0, min: 0, target: 0 };
    return Math.max(0, Math.ceil(row.target - row.current));
  };

  // Loaders and subscriptions
  const loadRooms = () => {
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setRooms(Array.isArray(arr) ? arr : []);
    } catch { setRooms([]); }
  };
  const loadCleaning = () => setCleaning(getCleaningMap());
  const loadStayover = () => {
    try {
      const raw = localStorage.getItem(STAYOVER_PREF_KEY);
      const map = raw ? JSON.parse(raw) : {};
      setStayoverMap(map);
    } catch { setStayoverMap({}); }
  };

  useEffect(() => {
    loadRooms();
    loadCleaning();
    loadStayover();
    const onStorage = (e: StorageEvent) => {
      if (e.key === ROOMS_KEY) loadRooms();
      if (e.key === HK_CLEANING_KEY) loadCleaning();
      if (e.key === STAYOVER_PREF_KEY) loadStayover();
    };
    window.addEventListener('storage', onStorage);
    const onCustom = () => loadCleaning();
    window.addEventListener('hk-cleaning-updated', onCustom as EventListener);
    const unsubRooms = onRoomsUpdated(() => loadRooms());
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onCustom as EventListener);
      unsubRooms?.();
    };
  }, []);

  useEffect(() => {
    let id: any;
    if (autoRefreshEnabled) {
      id = setInterval(() => {
        loadRooms();
        loadCleaning();
        loadStayover();
      }, 15 * 60 * 1000);
    }
    return () => { if (id) clearInterval(id); };
  }, [autoRefreshEnabled]);

  const handleRefreshNow = () => {
    loadRooms();
    loadCleaning();
    loadStayover();
  };

  // Metrics
  const dirtyCount = useMemo(() => rooms.filter(r => r.status === 'dirty').length, [rooms]);
  const stayoverRequestedCount = useMemo(() => rooms.filter(r => (r.status === 'occupied') && stayoverMap[r.number] === 'requested').length, [rooms, stayoverMap]);
  const cleanedTodayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    return Object.values(cleaning).filter(c => c.completedAt && new Date(c.completedAt).toISOString().slice(0,10) === today).length;
  }, [cleaning]);
  const completionRate = useMemo(() => {
    const denom = Math.max(1, dirtyCount + stayoverRequestedCount);
    return Math.round((cleanedTodayCount / denom) * 100);
  }, [dirtyCount, stayoverRequestedCount, cleanedTodayCount]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    // 'sold' durumunu HK tarafında dolu olarak kabul ediyoruz;
    // bu nedenle listelemeyi tüm odalar üzerinden yapalım
    let list = rooms;
    if (filterStatus !== 'all') {
      list = list.filter(r => {
        if (filterStatus === 'clean') return !!cleaning[r.number]?.completedAt && r.status === 'available';
        if (filterStatus === 'dirty') return r.status === 'dirty';
        if (filterStatus === 'reserved') return r.status === 'reserved';
        // 'occupied' filtresinde 'sold' odaları da dahil et
        if (filterStatus === 'occupied') return r.status === 'occupied' || r.status === 'sold';
        if (filterStatus === 'stayover') return (r.status === 'occupied') && stayoverMap[r.number] === 'requested';
        return true;
      });
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(r => r.number.toLowerCase().includes(q) || (r.guestName || '').toLowerCase().includes(q));
    }
    return list;
  }, [rooms, filterStatus, searchText, cleaning, stayoverMap]);

  // AI destekli malzeme miktarı doldurma
  const occupiedCount = useMemo(() => rooms.filter(r => r.status === 'occupied' || r.status === 'sold').length, [rooms]);
  const setUsageValue = (key: string, val: number) => {
    setUsage(prev => ({ ...prev, [key]: Math.max(0, Number.isFinite(val) ? val : 0) }));
  };
  const aiFillUsage = () => {
    const next: Record<string, number> = {};
    materials.forEach(m => {
      let qty = 0;
      if (m.defaultPerClean) qty += m.defaultPerClean * cleanedTodayCount;
      if (m.defaultPerStayover) qty += m.defaultPerStayover * stayoverRequestedCount;
      if (m.defaultPerOccupied) qty += m.defaultPerOccupied * occupiedCount;
      next[m.key] = Math.ceil(qty);
    });
    setUsage(next);
  };

  const saveUsage = () => {
    const h = readHistory();
    h[planDate] = usage;
    writeHistory(h);
    try {
      pushNotification({ title: 'Malzeme Kullanımı Kaydedildi', message: `${planDate} için malzeme kullanımı güncellendi.`, type: 'housekeeping', priority: 'low', recipient: 'management' });
    } catch {}
  };
  // AI önerisi oluştur
  const generateAiSuggestion = () => {
    // Gerçek uygulamada burada bir API çağrısı olacak
    // Şimdilik basit bir mantıkla öneri oluşturalım
    
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    
    if (pendingTasks.length === 0) {
      setAiSuggestion("Tüm görevler tamamlandı veya devam ediyor. Harika iş!");
      return;
    }
    
    // Check-out odalarına öncelik ver
    const checkOutTasks = pendingTasks.filter(task => task.checkOut);
    
    if (checkOutTasks.length > 0) {
      // Geç çıkış yapacak odaları kontrol et
      const lateCheckoutTasks = tasks.filter(task => task.lateCheckOut);
      
      if (lateCheckoutTasks.length > 0) {
        const roomNumbers = lateCheckoutTasks.map(t => t.roomNumber).join(', ');
        setAiSuggestion(`${roomNumbers} numaralı odalar geç çıkış yapacak. Önce ${checkOutTasks[0].roomNumber} numaralı odayı temizlemenizi öneririm.`);
      } else {
        setAiSuggestion(`${checkOutTasks[0].roomNumber} numaralı oda check-out yaptı. Bu odaya öncelik vermenizi öneririm.`);
      }
    } else {
      // En yüksek öncelikli görevi bul
      const highPriorityTasks = pendingTasks.filter(task => task.priority === 'high');
      
      if (highPriorityTasks.length > 0) {
        setAiSuggestion(`${highPriorityTasks[0].roomNumber} numaralı oda yüksek öncelikli. Bu odaya öncelik vermenizi öneririm.`);
      } else {
        setAiSuggestion(`${pendingTasks[0].roomNumber} numaralı odayı temizlemenizi öneririm.`);
      }
    }
  };

  // Cleaning actions
  const handleStartCleaning = (room: RoomData) => {
    startCleaning(room.number);
    setCleaning(getCleaningMap());
    try { pushNotification({ title: 'Temizlik Başladı', message: `Oda ${room.number} temizleniyor.`, type: 'housekeeping', priority: 'medium', recipient: 'reception' }); } catch {}
  };
  const defaultChecklist: Checklist = { remotesOk: true, minibarOk: true, floorsClean: true, towelsStocked: true, toiletriesStocked: true, slippersPresent: true };
  const handleCompleteCleaning = (room: RoomData) => {
    finalizeCleaning(room.number, defaultChecklist, {} as any);
    try {
      const rawRooms = localStorage.getItem(ROOMS_KEY);
      const arr = rawRooms ? JSON.parse(rawRooms) : [];
      const updated = arr.map((r: any) => r.number === room.number ? { ...r, status: r.status === 'dirty' ? 'available' : r.status } : r);
      localStorage.setItem(ROOMS_KEY, JSON.stringify(updated));
      setRooms(updated);
      // Gerçek zamanlı senkronizasyon için yayın
      emitRoomsUpdated();
      // Eski dinleyiciler için geriye dönük
      window.dispatchEvent(new Event('hk-cleaning-updated'));
    } catch {}
    try {
      pushNotification({
        title: 'Oda Temizlendi',
        message: `Oda ${room.number} temizlendi ve 'Boş' olarak işaretlendi.`,
        type: 'housekeeping',
        priority: 'medium',
        recipient: 'reception'
      });
    } catch {}
    setCleaning(getCleaningMap());
  };
  

  

  

  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Housekeeping Yönetimi</h1>
      {/* Üst bant: arama ve kontroller */}
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="diamond-band">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="icon-badge animate-float">🧹</span>
              <div>
                <h1 className="band-title">Kent Otel – Housekeeping</h1>
                <p className="text-white/80 text-sm">Günlük özet, filtreler ve oda grid</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/15 backdrop-blur px-2 py-1 rounded-lg">
                <FaSearch className="text-white/70 mr-2" />
                <input value={searchText} onChange={(e)=>setSearchText(e.target.value)} placeholder="Oda veya misafir ara" className="bg-transparent text-white placeholder-white/60 text-sm focus:outline-none" />
              </div>
              <button onClick={handleRefreshNow} className="btn-outline hover-tilt flex items-center"><FaSyncAlt className="mr-1" /> Yenile</button>
            </div>
          </div>
        </div>
      </div>

      {/* Günlük özet kartları (Görev kartı kaldırıldı) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between"><span className="text-white/80">Temizlenen Odalar (Bugün)</span><span className="text-emerald-400">🧹</span></div>
          <div className="mt-2 text-2xl font-bold text-white">{cleanedTodayCount}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between"><span className="text-white/80">Kirli Odalar</span><span className="text-rose-500">🚪</span></div>
          <div className="mt-2 text-2xl font-bold text-white">{dirtyCount}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between"><span className="text-white/80">Stayover</span><span className="text-amber-400">🛏️</span></div>
          <div className="mt-2 text-2xl font-bold text-white">{stayoverRequestedCount}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between"><span className="text-white/80">Tamamlanma Oranı</span><span className="text-primary-400">✅</span></div>
          <div className="mt-2 text-2xl font-bold text-white">%{completionRate}</div>
          <div className="w-full bg-white/20 rounded-full h-2 mt-2 overflow-hidden"><div className="h-2 bg-primary-600" style={{ width: `${completionRate}%` }} /></div>
        </div>
      </div>

      {/* Oda grid kaldırıldı: Malzeme listesi odasız gösterilir */}
      
      {/* AI Asistanı kaldırıldı */}
      
      {/* Malzeme Listesi (görevler kaldırıldı) */}
      <div className="premium-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Malzeme Listesi</h2>
          <div className="flex items-center space-x-2">
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
            <span className="text-xs text-gray-500">Gün seç</span>
          </div>
        </div>

        <div className="mb-4 flex gap-2 justify-end">
          <button onClick={aiFillUsage} className="px-4 py-2 rounded bg-secondary-700 text-white text-sm hover:bg-secondary-800 flex items-center"><FaMagic className="mr-2"/> AI ile Doldur</button>
          <button onClick={saveUsage} className="px-4 py-2 rounded bg-primary-600 text-white text-sm hover:bg-primary-700 flex items-center"><FaCheck className="mr-2"/> Kaydet</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Malzeme</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Birim</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Bugün Kullanılan</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(mat => (
                <tr key={mat.key} className="border-t">
                  <td className="px-3 py-2">{mat.name}</td>
                  <td className="px-3 py-2 text-gray-600">{mat.unit}</td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={1} value={usage[mat.key] ?? 0} onChange={(e)=>setUsageValue(mat.key, parseFloat(e.target.value))} className="border border-gray-300 rounded px-3 py-2 text-sm w-32" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stok Durumu */}
      <div className="premium-card p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Malzeme Stok Durumu</h2>
          <button onClick={saveStock} className="px-4 py-2 rounded bg-primary-600 text-white text-sm hover:bg-primary-700 flex items-center"><FaCheck className="mr-2"/> Kaydet</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Malzeme</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Mevcut Stok</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Asgari</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Hedef</th>
                <th className="text-left px-3 py-2 text-sm text-gray-700">Önerilen Sipariş</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(mat => (
                <tr key={mat.key} className="border-t">
                  <td className="px-3 py-2">{mat.name}</td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={1} value={stock[mat.key]?.current ?? 0} onChange={(e)=>setStockField(mat.key,'current', parseFloat(e.target.value))} className="border border-gray-300 rounded px-3 py-2 text-sm w-28" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={1} value={stock[mat.key]?.min ?? 0} onChange={(e)=>setStockField(mat.key,'min', parseFloat(e.target.value))} className="border border-gray-300 rounded px-3 py-2 text-sm w-28" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={1} value={stock[mat.key]?.target ?? 0} onChange={(e)=>setStockField(mat.key,'target', parseFloat(e.target.value))} className="border border-gray-300 rounded px-3 py-2 text-sm w-28" />
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">{suggestedOrder(mat.key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HousekeepingPanel;