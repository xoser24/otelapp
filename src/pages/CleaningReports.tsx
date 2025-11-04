import React, { useEffect, useMemo, useState } from 'react';
import { FaClock, FaBroom, FaStopwatch, FaChartLine, FaExclamationTriangle } from 'react-icons/fa';
import { HK_CLEANING_KEY, getCleaningMap } from '../utils/hkCleaning';
import { GoldGlassCard } from '../components/GoldGlassCard';
import Sparkline from '../components/Sparkline';

type CleaningEntry = {
  startTime?: number;
  completedAt?: number;
  inProgress?: boolean;
  roomNumber?: string;
  type?: 'stayover' | 'checkout' | string;
};

const msToMin = (ms: number) => Math.round(ms / 60000);

const CleaningReports: React.FC = () => {
  const [map, setMap] = useState<Record<string, CleaningEntry>>({});

  // Aşırı değer eşiği (dakika): bunun üzeri uyarı etiketi alır
  const OUTLIER_MINUTES = 90;

  const load = () => {
    try { setMap(getCleaningMap() as any); } catch {
      try { const raw = localStorage.getItem(HK_CLEANING_KEY); setMap(raw ? JSON.parse(raw) : {}); } catch { setMap({}); }
    }
  };

  useEffect(() => {
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === HK_CLEANING_KEY) load(); };
    window.addEventListener('storage', onStorage);
    const onCustom = () => load();
    window.addEventListener('hk-cleaning-updated', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('hk-cleaning-updated', onCustom as EventListener);
    };
  }, []);

  const records = useMemo(() => {
    const list: { room: string; start: number; end: number; minutes: number; type?: string }[] = [];
    Object.keys(map || {}).forEach(room => {
      const c = map[room];
      if (c?.startTime && c?.completedAt) {
        const mins = msToMin(c.completedAt - c.startTime);
        if (Number.isFinite(mins) && mins >= 0) list.push({ room, start: c.startTime!, end: c.completedAt!, minutes: mins, type: c.type });
      }
    });
    // Yeni olanlar önce
    return list.sort((a, b) => b.end - a.end);
  }, [map]);

  const todayISO = new Date().toISOString().slice(0,10);
  const isSameDay = (ts: number, dayISO: string) => new Date(ts).toISOString().slice(0,10) === dayISO;

  const today = useMemo(() => records.filter(r => isSameDay(r.end, todayISO)), [records, todayISO]);
  const last7 = useMemo(() => {
    const from = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return records.filter(r => r.end >= from);
  }, [records]);
  const last30 = useMemo(() => {
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return records.filter(r => r.end >= from);
  }, [records]);

  const summarize = (arr: { minutes: number }[]) => {
    const nums = arr.map(x => x.minutes).sort((a,b)=>a-b);
    const count = nums.length;
    const avg = count ? Math.round(nums.reduce((s,n)=>s+n,0)/count) : 0;
    const med = count ? nums[Math.floor(count/2)] : 0;
    const min = count ? nums[0] : 0;
    const max = count ? nums[count-1] : 0;
    return { count, avg, med, min, max };
  };

  const sToday = summarize(today);
  const s7 = summarize(last7);
  const s30 = summarize(last30);

  // Son 30 gün trend serisi (dakika)
  const trendSeries = useMemo(() => {
    const arr = last30.map(r => Math.max(0, r.minutes));
    return arr.length > 0 ? arr : [0];
  }, [last30]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><FaClock/> Temizlik Süre Raporları</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GoldGlassCard className="p-4">
          <div className="flex items-center gap-2 text-primary-700"><FaStopwatch/><span>Bugün</span></div>
          <div className="mt-2 text-sm">Temizlik sayısı: <b>{sToday.count}</b></div>
          <div className="mt-1 text-sm">Ortalama süre: <b>{sToday.avg} dk</b></div>
          <div className="mt-1 text-sm">Medyan: <b>{sToday.med} dk</b></div>
          <div className="mt-1 text-sm">En hızlı: <b>{sToday.min} dk</b> • En yavaş: <b>{sToday.max} dk</b></div>
        </GoldGlassCard>
        <GoldGlassCard className="p-4">
          <div className="flex items-center gap-2 text-primary-700"><FaChartLine/><span>Son 7 Gün</span></div>
          <div className="mt-2 text-sm">Temizlik sayısı: <b>{s7.count}</b></div>
          <div className="mt-1 text-sm">Ortalama süre: <b>{s7.avg} dk</b></div>
          <div className="mt-1 text-sm">Medyan: <b>{s7.med} dk</b></div>
          <div className="mt-1 text-sm">En hızlı: <b>{s7.min} dk</b> • En yavaş: <b>{s7.max} dk</b></div>
        </GoldGlassCard>
        <GoldGlassCard className="p-4">
          <div className="flex items-center gap-2 text-primary-700"><FaBroom/><span>Son 30 Gün</span></div>
          <div className="mt-2 text-sm">Temizlik sayısı: <b>{s30.count}</b></div>
          <div className="mt-1 text-sm">Ortalama süre: <b>{s30.avg} dk</b></div>
          <div className="mt-1 text-sm">Medyan: <b>{s30.med} dk</b></div>
          <div className="mt-1 text-sm">En hızlı: <b>{s30.min} dk</b> • En yavaş: <b>{s30.max} dk</b></div>
        </GoldGlassCard>
      </div>

      {/* Trend grafiği */}
      <GoldGlassCard className="mt-6 p-4">
        <div className="flex items-center gap-2 text-primary-700"><FaChartLine/><span>Son 30 Gün Trend</span></div>
        <div className="mt-3">
          <Sparkline values={trendSeries} animated />
        </div>
      </GoldGlassCard>

      <GoldGlassCard className="mt-6 p-4">
        <div className="flex items-center gap-2 text-primary-700"><FaBroom/><span>Detaylı Kayıtlar</span></div>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Oda</th>
                <th className="py-2 pr-3">Başlangıç</th>
                <th className="py-2 pr-3">Bitiş</th>
                <th className="py-2 pr-3">Süre (dk)</th>
                <th className="py-2 pr-3">Tür</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr><td className="py-3" colSpan={5}>Kayıt bulunamadı.</td></tr>
              )}
              {records.map((r) => (
                <tr key={`${r.room}-${r.end}`} className="border-b">
                  <td className="py-2 pr-3 font-medium">{r.room}</td>
                  <td className="py-2 pr-3">{new Date(r.start).toLocaleString()}</td>
                  <td className="py-2 pr-3">{new Date(r.end).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {r.minutes}
                    {r.minutes >= OUTLIER_MINUTES && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs">
                        <FaExclamationTriangle /> Uzun
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.type || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GoldGlassCard>
    </div>
  );
};

export default CleaningReports;