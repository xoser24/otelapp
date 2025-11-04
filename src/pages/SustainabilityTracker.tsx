import React, { useEffect, useMemo, useState } from 'react';
import Sparkline from '../components/Sparkline';
import { calculateSustainabilityScore, type SustainabilityMetrics } from '../ai/aiSustainability';
import { generateSustainabilityPDF } from '../utils/sustainability';
import { getReservations } from '../utils/reservations';
import GoldModal from '../components/GoldModal';

type Report = {
  dateISO: string;
  energyKwh: number;
  waterLiters: number;
  wasteKg: number;
  fuelKg: number;
  fuelType?: 'coal' | 'pellet' | 'wood' | 'gas' | 'hazelnut';
  renewableProductionKwh?: number; // kWh
  fuelCostPerKg?: number;
  fuelSupplier?: string;
  renewablePercent?: number; // %
  recyclingPercent?: number; // %
  organicWasteKg?: number; // kg
  plasticReductionPercent?: number; // %
  occupancy: number; // doluluk %
  guests: number;
  co2Ton: number;
  score: number;
  notes?: string;
};

type MonthlyRecord = {
  month: string; // YYYY-MM
  energyKwh: number;
  waterLiters: number;
  wasteKg: number;
  fuelKg: number;
  renewableProductionKwh?: number;
  renewablePercent?: number;
  recyclingPercent?: number;
  organicWasteKg?: number;
  plasticReductionPercent?: number;
  occupancy?: number;
  guests: number;
  co2Ton: number;
  score?: number;
};

const STORAGE_KEY = 'SUSTAINABILITY_REPORTS';
const MONTHLY_STORAGE_KEY = 'SUSTAINABILITY_MONTHLY';
const REMINDER_KEY = 'SUSTAINABILITY_LAST_REMINDER_MONTH';

const SustainabilityTracker: React.FC = () => {
  const todayISO = useMemo(() => new Date().toISOString().slice(0,10), []);
  const [dateISO, setDateISO] = useState<string>(todayISO);
  const [monthKey, setMonthKey] = useState<string>(todayISO.slice(0,7));
  const [metrics, setMetrics] = useState<Report>({
    dateISO: todayISO,
    energyKwh: 1240,
    waterLiters: 45000,
    wasteKg: 120,
    fuelKg: 80,
    fuelType: 'coal',
    fuelCostPerKg: 12.5,
    fuelSupplier: '',
    renewableProductionKwh: 320,
    renewablePercent: 35,
    recyclingPercent: 65,
    organicWasteKg: 30,
    plasticReductionPercent: 10,
    occupancy: 78,
    guests: 198,
    co2Ton: 0,
    score: 80,
    notes: '',
  });
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [showReminder, setShowReminder] = useState(false);
  const [showQna, setShowQna] = useState(false);
  const [qnaStep, setQnaStep] = useState<number>(0);
  const [qnaDraft, setQnaDraft] = useState<{ energyKwh?: number; waterLiters?: number; wasteKg?: number; fuelKg?: number; notes?: string }>({});

  const readAllReports = (): Report[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const monthsAvailable = useMemo(() => {
    const all = readAllReports();
    const set = new Set<string>();
    all.forEach(r => set.add(r.dateISO.slice(0,7)));
    const list = Array.from(set);
    list.sort();
    if (!list.includes(monthKey)) list.push(monthKey);
    return list;
  }, [monthKey]);

  const monthReports = useMemo(() => {
    const all = readAllReports();
    return all.filter(r => r.dateISO.slice(0,7) === monthKey).sort((a,b)=>a.dateISO.localeCompare(b.dateISO));
  }, [monthKey]);

  const computeMonthlyAggregate = (reports: Report[]): MonthlyRecord | null => {
    if (!reports.length) return null;
    const month = monthKey;
    const sum = (arr: number[]) => arr.reduce((a,b)=>a+b,0);
    const avg = (arr: number[]) => arr.length ? Math.round((sum(arr)/arr.length)*100)/100 : undefined;
    const energyKwh = sum(reports.map(r=>r.energyKwh||0));
    const waterLiters = sum(reports.map(r=>r.waterLiters||0));
    const wasteKg = sum(reports.map(r=>r.wasteKg||0));
    const fuelKg = sum(reports.map(r=>r.fuelKg||0));
    const renewableProductionKwh = sum(reports.map(r=>r.renewableProductionKwh||0));
    const renewablePercent = avg(reports.map(r=>r.renewablePercent||0).filter(n=>typeof n==='number'));
    const recyclingPercent = avg(reports.map(r=>r.recyclingPercent||0).filter(n=>typeof n==='number'));
    const organicWasteKg = sum(reports.map(r=>r.organicWasteKg||0));
    const plasticReductionPercent = avg(reports.map(r=>r.plasticReductionPercent||0).filter(n=>typeof n==='number'));
    const occupancy = avg(reports.map(r=>r.occupancy||0));
    const guests = sum(reports.map(r=>r.guests||0));
    const co2Ton = Math.round(sum(reports.map(r=>r.co2Ton||0))*1000)/1000;
    const score = avg(reports.map(r=>r.score||0));
    return { month, energyKwh, waterLiters, wasteKg, fuelKg, renewableProductionKwh, renewablePercent, recyclingPercent, organicWasteKg, plasticReductionPercent, occupancy, guests, co2Ton, score };
  };

  const saveMonthlyAggregate = () => {
    const agg = computeMonthlyAggregate(monthReports);
    if (!agg) return;
    try {
      const raw = localStorage.getItem(MONTHLY_STORAGE_KEY);
      const prev: MonthlyRecord[] = raw ? JSON.parse(raw) : [];
      const rest = prev.filter(m=>m.month !== agg.month);
      const next = [...rest, agg].sort((a,b)=>a.month.localeCompare(b.month));
      localStorage.setItem(MONTHLY_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Basit emisyon katsayıları (örnek):
  // elektrik 0.00042 ton/kWh, su 0.0000003 ton/L, atık 0.0015 ton/kg
  const FACTORS = { elecTonPerKwh: 0.00042, waterTonPerLiter: 0.0000003, wasteTonPerKg: 0.0015 };

  // Yakıt türüne göre ton/kg CO2 faktörü (yaklaşık örnek değerler)
  const fuelFactorByType = (t: Report['fuelType'] | undefined) => {
    switch (t) {
      case 'pellet': return 0.0018;
      case 'wood': return 0.0011;
      case 'gas': return 0.0020;
      case 'hazelnut': return 0.0016; // fındık kabuğu (biyokütle)
      case 'coal':
      default: return 0.0024;
    }
  };

  // Yakıt tipi için Türkçe etiket
  const fuelLabelByType = (t: Report['fuelType'] | undefined) => {
    switch (t) {
      case 'pellet': return 'Pelet';
      case 'wood': return 'Odun';
      case 'gas': return 'Doğal Gaz';
      case 'hazelnut': return 'Fındık Kabuğu';
      case 'coal':
      default: return 'Kömür';
    }
  };

  useEffect(() => {
    const last = localStorage.getItem(REMINDER_KEY);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if (last !== monthKey && now.getDate() === 1) {
      setShowReminder(true);
      localStorage.setItem(REMINDER_KEY, monthKey);
    }
  }, []);

  // CO2 ve skor hesaplama
  const recompute = (next: Partial<Report>) => {
    const m = { ...metrics, ...next };
    // Yenilenebilir üretim girildiyse, orandan otomatik hesapla
    if (typeof m.renewableProductionKwh === 'number' && m.energyKwh > 0) {
      m.renewablePercent = Math.round(Math.max(0, Math.min(100, (m.renewableProductionKwh / m.energyKwh) * 100)));
    }
    const renewableRatio = Math.max(0, Math.min(100, m.renewablePercent || 0)) / 100;
    const effectiveEnergyKwh = m.energyKwh * (1 - renewableRatio);
    const co2Ton = +(
      effectiveEnergyKwh * FACTORS.elecTonPerKwh +
      m.waterLiters * FACTORS.waterTonPerLiter +
      m.wasteKg * FACTORS.wasteTonPerKg +
      m.fuelKg * fuelFactorByType(m.fuelType)
    ).toFixed(3);
    const score = calculateSustainabilityScore({ energyKwh: m.energyKwh, cleanedRooms: Math.round(m.occupancy/100*m.guests), totalRooms: m.guests } as SustainabilityMetrics);
    setMetrics({ ...m, co2Ton, score });
  };

  const saveReport = () => {
    const prev: Report[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const rest = prev.filter(r => r.dateISO !== metrics.dateISO);
    const next = [...rest, { ...metrics, dateISO }].sort((a,b) => a.dateISO.localeCompare(b.dateISO));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMonthKey(dateISO.slice(0,7));
  };

  const exportCSV = () => {
    const headers = ['Tarih','Enerji(kWh)','Yenilenebilir(%)','Su(L)','Atık(kg)','Geri Dönüşüm(%)','Organik Atık(kg)','Plastik Azaltımı(%)','Yakıt Tipi','Yakıt(kg)','Yakıt Maliyeti(₺/kg)','Tedarikçi','Doluluk(%)','Misafir','CO2(ton)','Skor','Not'];
    const row = [
      dateISO,
      metrics.energyKwh,
      metrics.renewablePercent ?? '',
      metrics.waterLiters,
      metrics.wasteKg,
      metrics.recyclingPercent ?? '',
      metrics.organicWasteKg ?? '',
      metrics.plasticReductionPercent ?? '',
      fuelLabelByType(metrics.fuelType),
      metrics.fuelKg,
      metrics.fuelCostPerKg ?? '',
      metrics.fuelSupplier ?? '',
      metrics.occupancy,
      metrics.guests,
      metrics.co2Ton,
      metrics.score,
      (metrics.notes||'')
    ];
    const csv = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sustainability_${dateISO}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    await generateSustainabilityPDF({ ...metrics, dateISO });
  };

  const runAi = async () => {
    // Basit, yerel sezgisel öneri seti; OpenAI anahtarı eklenirse istemci tarafında genişletilebilir
    const advice = [] as string[];
    if (metrics.energyKwh > 1100) advice.push('Enerji tüketimi hedefin üzerinde. Ortak alanlarda sensör ve zamanlayıcıları artırın.');
    if (metrics.waterLiters > 50000) advice.push('Su tüketimi yüksek. Çamaşırhane yük optimizasyonu ve düşük akışlı armatürleri kontrol edin.');
    if (metrics.wasteKg > 100) advice.push('Atık seviyesi yüksek. Organik atık kompost ve geri dönüşüm kutularının konumlarını iyileştirin.');
    if (metrics.fuelKg > 100) advice.push('Katı yakıt tüketimi yüksek. Kazan verimliliği, izolasyon ve bakım takvimini gözden geçirin.');
    if (metrics.occupancy > 85) advice.push('Yüksek dolulukta housekeeping planını “stayover” opsiyonuyla optimize edin.');
    if (advice.length === 0) advice.push('Metrikler hedeflere yakın görünüyor. Mevcut uygulamaları sürdürün ve haftalık mini denetimler yapın.');
    setAiAdvice(advice.join('\n• '));
  };

  // Ay başı ve sonu hesapla (seçili tarihin ayı)
  const getMonthRange = (iso: string): { start: string; end: string; days: number } => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = d.getMonth();
    const startD = new Date(y, m, 1);
    const endD = new Date(y, m + 1, 1); // end exclusive
    const days = Math.round((endD.getTime() - startD.getTime()) / (1000*60*60*24));
    const toStr = (t: Date) => `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    return { start: toStr(startD), end: toStr(endD), days };
  };

  // Tarih aralığı çakışma yardımcısı
  const overlapNights = (checkIn: string, checkOut: string, start: string, endExclusive: string): number => {
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    const s = new Date(start);
    const e = new Date(endExclusive);
    const aStart = ci > s ? ci : s;
    const aEnd = co < e ? co : e;
    const diff = Math.round((aEnd.getTime() - aStart.getTime()) / (1000*60*60*24));
    return Math.max(0, diff);
  };

  const autoFillFromSystem = () => {
    try {
      const { start, end, days } = getMonthRange(dateISO);
      const reservations = getReservations();
      const roomsRaw = localStorage.getItem('hotel_rooms');
      const rooms = roomsRaw ? JSON.parse(roomsRaw) : [];
      const roomCount = Array.isArray(rooms) ? rooms.length : 0;

      let occupiedRoomNights = 0;
      let totalGuests = 0;
      reservations.forEach(r => {
        if (r.status !== 'cancelled' && r.status !== 'no-show') {
          const nights = overlapNights(r.checkInDate, r.checkOutDate, start, end);
          occupiedRoomNights += nights;
          const ppl = typeof r.peopleCount === 'number' ? r.peopleCount : 2;
          // Tahmini: konaklama gecesi başına kişi sayısı sabit değil, ancak toplam kişi ay bazında giriş yapan sayıya yakın olsun.
          // Burada basitçe kişi sayısını 1 kez sayıyoruz (giriş bazlı). Daha gelişmiş hesap için kişi-gece metriği eklenebilir.
          totalGuests += ppl;
        }
      });

      const totalRoomNights = roomCount > 0 ? roomCount * days : Math.max(1, days * 20); // oda sayısı yoksa 20 oda varsayımı
      const occPct = Math.round((occupiedRoomNights / Math.max(1, totalRoomNights)) * 100);

      // Basit heuristiklerle tahmini enerji/su/atık
      const estEnergy = Math.round(totalGuests * 5 + occPct * 10); // kWh
      const estWater = Math.round(totalGuests * 150); // litre
      const estWaste = Math.round(totalGuests * 1.2); // kg
      const estFuel = Math.round(totalGuests * 0.8); // kg (katı yakıt için basit tahmin)

      recompute({ occupancy: occPct, guests: totalGuests, energyKwh: estEnergy, waterLiters: estWater, wasteKg: estWaste, fuelKg: estFuel });
      alert(`Aylık otomatik doldurma tamamlandı. Doluluk ~%${occPct}, Misafir ~${totalGuests}. Enerji/ Su/ Atık tahmini değerlerle güncellendi.`);
    } catch (err) {
      alert('Otomatik doldurma sırasında hata oluştu.');
    }
  };

  const openQna = () => {
    const baseSuggest = (() => {
      // İpucu önerileri mevcut metriklere göre
      const occ = metrics.occupancy;
      const guests = metrics.guests;
      const estEnergy = Math.round(guests * 5 + occ * 10);
      const estWater = Math.round(guests * 150);
      const estWaste = Math.round(guests * 1.2);
      const estFuel = Math.round(guests * 0.8);
      return { energyKwh: estEnergy, waterLiters: estWater, wasteKg: estWaste, fuelKg: estFuel };
    })();
    setQnaDraft(baseSuggest);
    setQnaStep(0);
    setShowQna(true);
  };

  const applyQna = () => {
    recompute({
      energyKwh: typeof qnaDraft.energyKwh === 'number' ? qnaDraft.energyKwh : metrics.energyKwh,
      waterLiters: typeof qnaDraft.waterLiters === 'number' ? qnaDraft.waterLiters : metrics.waterLiters,
      wasteKg: typeof qnaDraft.wasteKg === 'number' ? qnaDraft.wasteKg : metrics.wasteKg,
      fuelKg: typeof qnaDraft.fuelKg === 'number' ? qnaDraft.fuelKg : metrics.fuelKg,
      notes: typeof qnaDraft.notes === 'string' ? qnaDraft.notes : metrics.notes,
    });
    setShowQna(false);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Başlık ve kontrol şeridi */}
      <div className="diamond-band rounded-2xl mb-4">
        <div className="flex items-center gap-3">
          <div className="icon-badge animate-band-icon">🌿</div>
          <div className="band-title">Sürdürülebilirlik Takibi</div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="form-base" value={dateISO} onChange={(e)=>{ setDateISO(e.target.value); recompute({ dateISO: e.target.value }); }} />
          <button className="btn-diamond" onClick={runAi}>AI Analiz</button>
          <button className="btn-diamond" onClick={openQna}>Form Asistanı</button>
          <button className="btn-diamond" onClick={autoFillFromSystem}>Otomatik Doldur (Ay)</button>
          <button className="btn-diamond" onClick={exportPDF}>PDF</button>
          <button className="btn-diamond" onClick={exportCSV}>CSV</button>
        </div>
      </div>

      {/* Genel Bakış */}
      <div className="diamond-card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Genel Sürdürülebilirlik Puanı</h2>
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle className="text-white/20 stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent"></circle>
              <circle className="text-emerald-400 stroke-current" strokeWidth="10" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" 
                strokeDasharray="251.2" strokeDashoffset={`${251.2 * (1 - metrics.score/100)}`}></circle>
            </svg>
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
              <span className="text-3xl font-bold">{metrics.score}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Politikalar */}
      <div className="diamond-card p-6 mb-6">
        <h2 className="text-xl font-bold mb-3">Otel Sürdürülebilirlik Politikası</h2>
        <p className="text-sm text-gray-700 mb-3">Kent Otel olarak çevreye duyarlı ve kaynakları verimli kullanan bir yaklaşım benimsiyoruz. Misafirlerimizin katkılarıyla sürdürülebilir hedeflerimize daha hızlı ulaşıyoruz.</p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
          <li>Su tasarrufu: isteğe bağlı temizlik ve düşük akışlı armatürler</li>
          <li>Enerji verimliliği: LED aydınlatma ve akıllı sensörler</li>
          <li>Atık azaltımı: tek kullanımlık plastikleri minimumda tutma, geri dönüşüm kutuları</li>
          <li>Yerel tedarik: mevsimlik ve sürdürülebilir ürünler</li>
        </ul>
      </div>
      
      {/* Ana Metrikler ve Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Enerji Yönetimi */}
        <div className="diamond-card p-6 mb-6 break-words overflow-hidden">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-yellow-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold">Enerji Yönetimi</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Günlük Enerji Tüketimi</span>
                <input className="form-base w-32" type="number" value={metrics.energyKwh} onChange={(e)=>recompute({ energyKwh: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: 1,100 kWh</span>
                <span>{metrics.energyKwh > 1100 ? '% Fazla' : '% Uygun'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.energyKwh/1100)*100)}%` }}></div>
              </div>
            </div>
            
            {/** Yakıt girişi ayrı kartta gösterilecek */}

            <div>
              <div className="flex justify-between mb-1">
                <span>Yenilenebilir Enerji Oranı (%)</span>
                <input className="form-base w-24" type="number" value={metrics.renewablePercent ?? 0} onChange={(e)=>recompute({ renewablePercent: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: %40</span>
                <span>{(metrics.renewablePercent ?? 0) >= 40 ? '% Uygun' : '% Az'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.renewablePercent ?? 0))}%` }}></div>
              </div>
            </div>
            
            <div className="pt-2">
              <h3 className="font-medium mb-2">Enerji Tasarrufu İpuçları</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Kullanılmayan alanlarda ışıkları kapatın</li>
                <li>Oda sıcaklığını 22-24°C arasında tutun</li>
                <li>Enerji verimli LED aydınlatma kullanın</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Yakıt Yönetimi */}
        <div className="diamond-card p-6 mb-6 break-words">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-orange-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2a7 7 0 00-7 7v5a7 7 0 0014 0V9a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">Yakıt Yönetimi</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm">Yakıt Tipi</label>
              <select className="form-base w-full sm:w-40" value={metrics.fuelType || 'coal'} onChange={(e)=>recompute({ fuelType: e.target.value as any })}>
                <option value="coal">Kömür</option>
                <option value="pellet">Pelet</option>
                <option value="wood">Odun</option>
                <option value="gas">Doğal Gaz</option>
                <option value="hazelnut">Fındık Kabuğu</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between mb-1 flex-wrap items-center">
                <span className="break-words">Günlük Yakıt Tüketimi (kg)</span>
                <input className="form-base w-full sm:w-32" type="number" value={metrics.fuelKg} onChange={(e)=>recompute({ fuelKg: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: 100 kg</span>
                <span>{metrics.fuelKg > 100 ? '% Fazla' : '% Uygun'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.fuelKg/100)*100)}%` }}></div>
              </div>
              <div className="text-xs text-gray-600 mt-2">CO₂ faktörü: {fuelFactorByType(metrics.fuelType).toFixed(4)} ton/kg</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between mb-1 flex-wrap items-center">
                  <span className="break-words">Yakıt Maliyeti (₺/kg)</span>
                  <input className="form-base w-full sm:w-24" type="number" value={metrics.fuelCostPerKg ?? 0} onChange={(e)=>recompute({ fuelCostPerKg: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1 flex-wrap items-center">
                  <span className="break-words">Tedarikçi</span>
                  <input className="form-base w-full sm:w-40" type="text" value={metrics.fuelSupplier ?? ''} onChange={(e)=>recompute({ fuelSupplier: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600">Aylık tahmini yakıt maliyeti: ₺{(((metrics.fuelKg||0) * 30) * (metrics.fuelCostPerKg||0)).toFixed(2)}</div>
          </div>
        </div>

        {/* Su Yönetimi */}
        <div className="diamond-card p-6 break-words">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold">Su Yönetimi</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Günlük Su Tüketimi</span>
                <input className="form-base w-32" type="number" value={metrics.waterLiters} onChange={(e)=>recompute({ waterLiters: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: 50,000 L</span>
                <span>{metrics.waterLiters <= 50000 ? '% Uygun' : '% Fazla'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.waterLiters/50000)*100)}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Geri Dönüştürülen Su</span>
                <span className="font-medium">%25</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: %30</span>
                <span>%5 Az</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '83.3%' }}></div>
              </div>
            </div>
            
            <div className="pt-2">
              <h3 className="font-medium mb-2">Su Tasarrufu İpuçları</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Düşük akışlı duş başlıkları kullanın</li>
                <li>Çamaşırları tam yükle yıkayın</li>
                <li>Bahçe sulamasını sabah erken saatlerde yapın</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Atık Yönetimi */}
         <div className="diamond-card p-6 break-words">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-green-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold">Atık Yönetimi</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Günlük Atık Miktarı</span>
                <input className="form-base w-32" type="number" value={metrics.wasteKg} onChange={(e)=>recompute({ wasteKg: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: 100 kg</span>
                <span>{metrics.wasteKg > 100 ? '% Fazla' : '% Uygun'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, (metrics.wasteKg/100)*100)}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span>Geri Dönüşüm Oranı (%)</span>
                <input className="form-base w-24" type="number" value={metrics.recyclingPercent ?? 0} onChange={(e)=>recompute({ recyclingPercent: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: %70</span>
                <span>{(metrics.recyclingPercent ?? 0) >= 70 ? '% Uygun' : '% Az'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.recyclingPercent ?? 0))}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>Organik Atık (kg)</span>
                <input className="form-base w-32" type="number" value={metrics.organicWasteKg ?? 0} onChange={(e)=>recompute({ organicWasteKg: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: 25 kg</span>
                <span>{(metrics.organicWasteKg ?? 0) <= 25 ? '% Uygun' : '% Fazla'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((metrics.organicWasteKg ?? 0)/25)*100)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>Tek Kullanımlık Plastik Azaltımı (%)</span>
                <input className="form-base w-24" type="number" value={metrics.plasticReductionPercent ?? 0} onChange={(e)=>recompute({ plasticReductionPercent: Number(e.target.value) })} />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Hedef: %50</span>
                <span>{(metrics.plasticReductionPercent ?? 0) >= 50 ? '% Uygun' : '% Az'}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.plasticReductionPercent ?? 0))}%` }}></div>
              </div>
            </div>
            
            <div className="pt-2">
              <h3 className="font-medium mb-2">Atık Azaltma İpuçları</h3>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Tek kullanımlık plastikleri azaltın</li>
                <li>Organik atıkları kompost yapın</li>
                <li>Geri dönüşüm kutularını tüm alanlara yerleştirin</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Yenilenebilir Enerji */}
        <div className="diamond-card p-6 break-words">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-emerald-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2l3 7h7l-5.5 4 2.5 7L12 16l-7 5 2.5-7L2 9h7z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold">Yenilenebilir Enerji</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Güneş Üretimi (kWh)</span>
                <input className="form-base w-28" type="number" value={metrics.renewableProductionKwh ?? 0} onChange={(e)=>recompute({ renewableProductionKwh: Number(e.target.value) })} />
              </div>
              <div className="text-xs text-gray-600">Otomatik oran: üretim / günlük enerji</div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Yenilenebilir Oran (%)</span>
                <span className="font-medium">%{metrics.renewablePercent ?? 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, metrics.renewablePercent ?? 0))}%` }}></div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Hedef: %40</span>
                <span>{(metrics.renewablePercent ?? 0) >= 40 ? '% Uygun' : '% Az'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enerji Yoğunluğu */}
        <div className="diamond-card p-6 break-words">
          <div className="flex items-center mb-4">
            <div className="p-3 bg-purple-100 rounded-full mr-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0-6a10 10 0 100 20 10 10 0 000-20z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold">Enerji Yoğunluğu</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span>Kişi Başına Enerji (kWh)</span>
                <span className="font-medium">{(metrics.energyKwh / Math.max(1, metrics.guests)).toFixed(1)} kWh</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (metrics.energyKwh / Math.max(1, metrics.guests)) / 5 * 100))}%` }}></div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Hedef: ≤ 5 kWh/kişi</span>
                <span>{(metrics.energyKwh / Math.max(1, metrics.guests)) <= 5 ? '% Uygun' : '% Fazla'}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Kişi Başına Su (L)</span>
                <span className="font-medium">{(metrics.waterLiters / Math.max(1, metrics.guests)).toFixed(0)} L</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (metrics.waterLiters / Math.max(1, metrics.guests)) / 150 * 100))}%` }}></div>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Hedef: ≤ 150 L/kişi</span>
                <span>{(metrics.waterLiters / Math.max(1, metrics.guests)) <= 150 ? '% Uygun' : '% Fazla'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sürdürülebilirlik Hedefleri ve Raporlama */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="diamond-card p-6">
          <h2 className="text-xl font-bold mb-4">Sürdürülebilirlik Hedefleri</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input type="checkbox" checked className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3" readOnly />
              <div>
                <p className="font-medium">Enerji tüketimini %15 azalt</p>
                <p className="text-sm text-gray-500">Hedef Tarih: Aralık 2023 - İlerleme: %60</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3" readOnly />
              <div>
                <p className="font-medium">Yenilenebilir enerji kullanımını %50'ye çıkar</p>
                <p className="text-sm text-gray-500">Hedef Tarih: Haziran 2024 - İlerleme: %35</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3" readOnly />
              <div>
                <p className="font-medium">Tek kullanımlık plastikleri tamamen kaldır</p>
                <p className="text-sm text-gray-500">Hedef Tarih: Mart 2024 - İlerleme: %75</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3" readOnly />
              <div>
                <p className="font-medium">Su tüketimini %20 azalt</p>
                <p className="text-sm text-gray-500">Hedef Tarih: Eylül 2023 - İlerleme: %90</p>
              </div>
            </div>
            <div className="pt-2">
              <label className="text-sm text-gray-700 block mb-1">Notlar</label>
              <textarea className="form-base w-full" rows={3} value={metrics.notes} onChange={(e)=>recompute({ notes: e.target.value })} />
              <div className="mt-2 flex gap-2">
                <button className="btn-diamond" onClick={saveReport}>Kaydet</button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="diamond-card p-6">
          <h2 className="text-xl font-bold mb-4">Karbon Ayak İzi</h2>
          <div className="h-28 rounded flex items-center justify-between mb-4 p-3 bg-white/5 border border-white/10">
            <div>
              <div className="text-sm text-white/80">Toplam CO2 (ton)</div>
              <div className="text-2xl font-bold text-white">{metrics.co2Ton}</div>
            </div>
            <Sparkline values={[metrics.energyKwh/20, metrics.waterLiters/1000, metrics.wasteKg*0.8, metrics.fuelKg*2, metrics.co2Ton*50]} width={260} height={48} color="#10b981" />
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-medium">Toplam CO2 Emisyonu</p>
              <p className="text-2xl font-bold">{metrics.co2Ton} ton</p>
              <p className="text-green-500">Hedefe göre dinamik durum</p>
            </div>
            <div>
              <p className="font-medium">Kişi Başı CO2 Emisyonu</p>
              <p className="text-2xl font-bold">{(metrics.co2Ton*1000 / Math.max(1, metrics.guests)).toFixed(1)} kg</p>
              <p className="text-green-500">Geçen yıla göre kıyas için depolama gerekli</p>
            </div>
          </div>
          {aiAdvice && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/30 text-white whitespace-pre-line">
              <div className="font-semibold mb-2">AI Önerileri</div>
              <div>• {aiAdvice}</div>
            </div>
          )}
        </div>
      </div>

      {/* Misafir Katkıları ve İpuçları */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Misafir Katkıları</h2>
          <p className="text-sm text-green-800 mb-3">Bugün temizlik istemeyerek su ve deterjan kullanımını azaltmaya destek olabilirsiniz. Stayover tercihleri çevresel etkiyi doğrudan iyileştirir.</p>
          <ul className="list-disc list-inside text-sm text-green-900 space-y-1">
            <li>Günlük temizlik talebini ihtiyaca göre yapın</li>
            <li>Havlu/çarşaf değişimini azaltarak çamaşır suyunu azaltın</li>
            <li>Oda ışıklarını kullanmadığınızda kapatın</li>
          </ul>
        </div>
        <div className="diamond-card p-6">
          <h2 className="text-lg font-semibold mb-2">Pratik İpuçları</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Duş süresini kısaltarak su tüketimini azaltın</li>
            <li>Klima ayarını 22-24°C aralığında tutun</li>
            <li>Geri dönüşüm kutularını kullanmayı alışkanlık haline getirin</li>
          </ul>
        </div>
      </div>

      {/* Aylık Hatırlatma Modalı */}
      {showReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={()=>setShowReminder(false)}>
          <div className="diamond-card p-6 w-[520px] animate-pop-in" onClick={(e)=>e.stopPropagation()}>
            <div className="text-xl font-semibold mb-2">Aylık Sürdürülebilirlik Hatırlatması</div>
            <p className="text-white/80 text-sm">Yeni ay başladı. Aylık CO2 ve kaynak kullanım raporunuzu güncellemeyi unutmayın.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-diamond" onClick={()=>setShowReminder(false)}>Tamam</button>
            </div>
          </div>
      </div>
      )}

      {/* Aylık Kayıtlar */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="diamond-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold">Aylık Kayıtlar</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm">Ay Filtresi</label>
              <select className="form-base w-40" value={monthKey} onChange={(e)=>setMonthKey(e.target.value)}>
                {monthsAvailable.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button className="btn-diamond" onClick={saveMonthlyAggregate}>Aylık Kaydı Güncelle</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {computeMonthlyAggregate(monthReports) ? (
              (() => {
                const agg = computeMonthlyAggregate(monthReports)!;
                return (
                  <>
                    <div className="bg-white/5 border border-white/10 rounded p-4">
                      <div className="text-sm text-white/70">Toplam Enerji (kWh)</div>
                      <div className="text-2xl font-bold text-white">{agg.energyKwh}</div>
                      <div className="mt-2 text-sm text-white/70">Toplam Su (L): {agg.waterLiters}</div>
                      <div className="mt-1 text-sm text-white/70">Toplam CO₂ (ton): {agg.co2Ton}</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded p-4">
                      <div className="text-sm text-white/70">Atık (kg): {agg.wasteKg}</div>
                      <div className="mt-1 text-sm text-white/70">Yakıt (kg): {agg.fuelKg}</div>
                      <div className="mt-1 text-sm text-white/70">Yenilenebilir Üretim (kWh): {agg.renewableProductionKwh ?? '-'}</div>
                      <div className="mt-1 text-sm text-white/70">Yenilenebilir Oran (%): {agg.renewablePercent ?? '-'}</div>
                      <div className="mt-1 text-sm text-white/70">Geri Dönüşüm (%): {agg.recyclingPercent ?? '-'}</div>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="text-sm text-gray-600">Bu ay için günlük kayıt bulunamadı.</div>
            )}
          </div>

          {/* Günlük Kayıt Listesi */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Tarih</th>
                  <th className="p-2">Enerji</th>
                  <th className="p-2">Su</th>
                  <th className="p-2">Atık</th>
                  <th className="p-2">Yakıt</th>
                  <th className="p-2">CO₂</th>
                </tr>
              </thead>
              <tbody>
                {monthReports.map(r => (
                  <tr key={r.dateISO} className="border-t border-white/10">
                    <td className="p-2">{r.dateISO}</td>
                    <td className="p-2">{r.energyKwh}</td>
                    <td className="p-2">{r.waterLiters}</td>
                    <td className="p-2">{r.wasteKg}</td>
                    <td className="p-2">{r.fuelKg}</td>
                    <td className="p-2">{r.co2Ton}</td>
                  </tr>
                ))}
                {monthReports.length === 0 && (
                  <tr>
                    <td className="p-2 text-gray-600" colSpan={6}>Seçilen ay için kayıt yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Soru-Cevap Modalı */}
      <GoldModal open={showQna} onClose={()=>setShowQna(false)} title="Form Asistanı">
        <div className="space-y-4">
          {qnaStep === 0 && (
            <div>
              <div className="font-semibold mb-1">Enerji (kWh)</div>
              <p className="text-sm text-gray-600 mb-2">Öneri: {qnaDraft.energyKwh} kWh (misafir ve doluluk bazlı)</p>
              <input type="number" className="form-base w-full" value={qnaDraft.energyKwh ?? metrics.energyKwh} onChange={(e)=>setQnaDraft({ ...qnaDraft, energyKwh: Number(e.target.value) })} />
            </div>
          )}
          {qnaStep === 1 && (
            <div>
              <div className="font-semibold mb-1">Su (L)</div>
              <p className="text-sm text-gray-600 mb-2">Öneri: {qnaDraft.waterLiters} L (kişi başı ~150L)</p>
              <input type="number" className="form-base w-full" value={qnaDraft.waterLiters ?? metrics.waterLiters} onChange={(e)=>setQnaDraft({ ...qnaDraft, waterLiters: Number(e.target.value) })} />
            </div>
          )}
          {qnaStep === 2 && (
            <div>
              <div className="font-semibold mb-1">Atık (kg)</div>
              <p className="text-sm text-gray-600 mb-2">Öneri: {qnaDraft.wasteKg} kg (kişi başı ~1.2kg)</p>
              <input type="number" className="form-base w-full" value={qnaDraft.wasteKg ?? metrics.wasteKg} onChange={(e)=>setQnaDraft({ ...qnaDraft, wasteKg: Number(e.target.value) })} />
            </div>
          )}
          {qnaStep === 3 && (
            <div>
              <div className="font-semibold mb-1">Katı Yakıt (kg)</div>
              <p className="text-sm text-gray-600 mb-2">Öneri: kişi başı ~0.8kg (mevsime göre değişir)</p>
              <input type="number" className="form-base w-full" value={qnaDraft.fuelKg ?? metrics.fuelKg} onChange={(e)=>setQnaDraft({ ...qnaDraft, fuelKg: Number(e.target.value) as any })} />
            </div>
          )}
          {qnaStep === 4 && (
            <div>
              <div className="font-semibold mb-1">Notlar</div>
              <textarea rows={3} className="form-base w-full" placeholder="Gözlemler, aksiyonlar, özel durumlar" value={qnaDraft.notes ?? metrics.notes} onChange={(e)=>setQnaDraft({ ...qnaDraft, notes: e.target.value })} />
            </div>
          )}

          <div className="flex justify-between">
            <div>
              <button className="btn-diamond" onClick={()=>setQnaStep(s => Math.max(0, s-1))} disabled={qnaStep===0}>Geri</button>
            </div>
            <div className="flex gap-2">
              {qnaStep < 4 ? (
                <button className="btn-diamond" onClick={()=>setQnaStep(s => Math.min(4, s+1))}>İleri</button>
              ) : (
                <button className="btn-diamond" onClick={applyQna}>Uygula</button>
              )}
            </div>
          </div>
        </div>
      </GoldModal>
    </div>
  );
};

export default SustainabilityTracker;