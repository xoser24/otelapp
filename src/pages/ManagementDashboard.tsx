import React, { useEffect, useMemo, useState } from 'react';
import { FaChartLine, FaBed, FaMoneyBillWave, FaUserCheck, FaTools } from 'react-icons/fa';
import Sparkline from '../components/Sparkline';
import { getLastNDaysSeries } from '../utils/financeTrends';
import { listSavedEodReports, type EndOfDayReport } from '../utils/endOfDay';
import { generateDailyInsights, forecastNext3Days } from '../ai/aiManagerAssistant';
import { predictOccupancyAndEnergy } from '../ai/aiForecast';

const ManagementDashboard: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [hotelName, setHotelName] = useState<string>('Kent Otel');
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawRooms = localStorage.getItem('hotel_rooms');
      const arrRooms = rawRooms ? JSON.parse(rawRooms) : [];
      setRooms(Array.isArray(arrRooms) ? arrRooms : []);
    } catch {}
    try {
      const rawExpenses = localStorage.getItem('hotel_expenses');
      const arrExp = rawExpenses ? JSON.parse(rawExpenses) : [];
      setExpenses(Array.isArray(arrExp) ? arrExp : []);
    } catch {}
    // Branding
    try {
      const name = localStorage.getItem('hotel_name') || 'Kent Otel';
      const logo = localStorage.getItem('hotel_logo_url');
      setHotelName(name);
      setHotelLogoUrl(logo);
    } catch {
      setHotelName('Kent Otel');
      setHotelLogoUrl(null);
    }
  }, []);

  const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

  const metrics = useMemo(() => {
    const totalRooms = rooms.length || 50; // varsayılan 50 oda
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const checkedInToday = rooms.filter((r) => r.lastAction === 'checkin').length;
    const checkedOutToday = rooms.filter((r) => r.lastAction === 'checkout').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

    const revenueToday = rooms.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const expenseToday = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netToday = revenueToday - expenseToday;

    const maintenanceReports = (JSON.parse(localStorage.getItem('maintenance_reports') || '[]') || []) as any[];
    const maintenanceOpen = maintenanceReports.filter((m: any) => {
      const status = m?.status || '';
      const isResolved = m?.resolved === true || status === 'closed' || status === 'resolved';
      return !isResolved;
    }).length;

    return { totalRooms, occupied, occupancyRate, checkedInToday, checkedOutToday, revenueToday, expenseToday, netToday, maintenanceOpen };
  }, [rooms, expenses]);

  // EOD tabanlı trendler ve AI içgörüleri
  const financeSeries = useMemo(() => getLastNDaysSeries(30), []);
  const financeSparklines = useMemo(() => ({
    income: financeSeries.map(p => p.income),
    expenses: financeSeries.map(p => p.expenses),
    net: financeSeries.map(p => p.net),
  }), [financeSeries]);

  const eodReports = useMemo(() => listSavedEodReports(), []);
  const lastReport = eodReports[eodReports.length - 1];
  const aiNote = useMemo(() => generateDailyInsights(lastReport), [lastReport]);
  const next3 = useMemo(() => forecastNext3Days(), []);
  const forecast = useMemo(() => predictOccupancyAndEnergy(), []);

  const occSeries = useMemo(() => {
    const calcOcc = (r?: EndOfDayReport) => {
      if (!r) return 0;
      const occ = r.operational?.occupiedCount ?? 0;
      const avail = r.operational?.availableCount ?? 0;
      const denom = occ + avail;
      return denom > 0 ? Math.round((occ / denom) * 100) : 0;
    };
    return eodReports.slice(-30).map(r => calcOcc(r));
  }, [eodReports]);

  // Çok ölçekli zaman serileri (gün/hafta/ay/yıl)
  const dailyNet = useMemo(() => financeSparklines.net, [financeSparklines]);
  const weeklyNet = useMemo(() => {
    const points = getLastNDaysSeries(84); // ~12 hafta
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 7) {
      const chunk = points.slice(i, i + 7);
      out.push(chunk.reduce((s, p) => s + p.net, 0));
    }
    return out;
  }, []);
  const monthlyNet = useMemo(() => {
    const reports = listSavedEodReports();
    const byMonth = new Map<string, number>();
    for (const r of reports) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const cash = r.financial?.cashTotal ?? 0;
      const cardNet = r.financial?.cardNetTotal ?? r.financial?.cardTotalNet ?? 0;
      const iban = r.financial?.ibanTotal ?? r.financial?.iban ?? 0;
      const expenses = r.financial?.expenseTotal ?? r.financial?.expensesTotal ?? 0;
      const net = (cash + cardNet + iban) - expenses;
      byMonth.set(key, (byMonth.get(key) || 0) + net);
    }
    const now = new Date();
    const out: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      out.push(byMonth.get(key) || 0);
    }
    return out;
  }, []);
  const yearlyNet = useMemo(() => {
    const reports = listSavedEodReports();
    const byYear = new Map<number, number>();
    for (const r of reports) {
      const y = new Date(r.date).getFullYear();
      const cash = r.financial?.cashTotal ?? 0;
      const cardNet = r.financial?.cardNetTotal ?? r.financial?.cardTotalNet ?? 0;
      const iban = r.financial?.ibanTotal ?? r.financial?.iban ?? 0;
      const expenses = r.financial?.expenseTotal ?? r.financial?.expensesTotal ?? 0;
      const net = (cash + cardNet + iban) - expenses;
      byYear.set(y, (byYear.get(y) || 0) + net);
    }
    const nowY = new Date().getFullYear();
    const out: number[] = [];
    for (let i = 4; i >= 0; i--) {
      const y = nowY - i;
      out.push(byYear.get(y) || 0);
    }
    return out;
  }, []);

  return (
    <div className="p-6">
      {/* Header Strip */}
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="diamond-band">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {hotelLogoUrl ? (
                  <img src={hotelLogoUrl} alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
                ) : (
                  <img src="/logo192.png" alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
                )}
                <h1 className="band-title flex items-center gap-2">
                  <span className="icon-badge animate-band-icon"><FaChartLine /></span>
                  {hotelName}
                </h1>
              </div>
              <p className="text-white/80 text-sm">Anlık durum ve özet metrikler</p>
            </div>
            <div className="flex space-x-4">
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-white/80 text-xs">Dolu</div>
                <div className="text-white text-lg font-semibold">{metrics.occupied}/{metrics.totalRooms}</div>
              </div>
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-white/80 text-xs">Doluluk</div>
                <div className="text-white text-lg font-semibold">%{metrics.occupancyRate}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugünkü Gelir</span>
            <FaMoneyBillWave className="text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(metrics.revenueToday)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugünkü Gider</span>
            <FaMoneyBillWave className="text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(metrics.expenseToday)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Net</span>
            <FaChartLine className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(metrics.netToday)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Açık Arıza</span>
            <FaTools className="text-yellow-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.maintenanceOpen}</div>
        </div>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugün Check-in</span>
            <FaUserCheck className="text-primary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.checkedInToday}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugün Check-out</span>
            <FaBed className="text-secondary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.checkedOutToday}</div>
        </div>
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* AI İçgörüler */}
        <div className="diamond-card p-4">
          <h2 className="text-white text-lg font-semibold mb-2">AI İçgörüler</h2>
          <p className="text-sm text-white/80 mb-3">{aiNote}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {next3.map(n => (
              <div key={n.dayOffset} className="bg-white/10 rounded-xl p-3 border border-white/20">
                <div className="text-xs text-white/70">{n.dayOffset === 0 ? 'Bugün' : n.dayOffset === 1 ? 'Yarın' : '2 Gün Sonra'}</div>
                <div className="text-sm text-white/80">Doluluk: %{Math.round((n.occupancy ?? 0) * 100)}</div>
                <div className="text-sm text-white/80">Gelir: {formatTRY(Math.round(n.income ?? 0))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trendler */}
        <div className="diamond-card p-4">
          <h2 className="text-white text-lg font-semibold mb-2">Trendler (30 gün)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-sm">Net</span>
                <span className="text-white text-sm font-semibold">{formatTRY(financeSeries[financeSeries.length-1]?.net || 0)}</span>
              </div>
              <Sparkline values={financeSparklines.net} color="#10b981" className="bg-white/5 rounded-md" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-sm">Gelir</span>
                <span className="text-white text-sm font-semibold">{formatTRY(financeSeries[financeSeries.length-1]?.income || 0)}</span>
              </div>
              <Sparkline values={financeSparklines.income} color="#60a5fa" className="bg-white/5 rounded-md" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-sm">Gider</span>
                <span className="text-white text-sm font-semibold">{formatTRY(financeSeries[financeSeries.length-1]?.expenses || 0)}</span>
              </div>
              <Sparkline values={financeSparklines.expenses} color="#f87171" className="bg-white/5 rounded-md" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 text-sm">Doluluk</span>
                <span className="text-white text-sm font-semibold">%{occSeries[occSeries.length-1] ?? Math.round((forecast.occupancy ?? 0) * 100)}</span>
              </div>
              <Sparkline values={occSeries.length ? occSeries : [40, 60, 55, 65, 70, 68, 72]} color="#f59e0b" className="bg-white/5 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Zaman Ölçekli Grafikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-sm">Günlük Net (30g)</span>
            <span className="text-white text-sm font-semibold">{formatTRY(dailyNet[dailyNet.length-1] || 0)}</span>
          </div>
          <Sparkline values={dailyNet} color="#10b981" height={48} width={220} animated className="bg-white/5 rounded-md" />
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-sm">Haftalık Net (12h)</span>
            <span className="text-white text-sm font-semibold">{formatTRY(weeklyNet[weeklyNet.length-1] || 0)}</span>
          </div>
          <Sparkline values={weeklyNet} color="#60a5fa" height={48} width={220} animated className="bg-white/5 rounded-md" />
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-sm">Aylık Net (12a)</span>
            <span className="text-white text-sm font-semibold">{formatTRY(monthlyNet[monthlyNet.length-1] || 0)}</span>
          </div>
          <Sparkline values={monthlyNet} color="#f59e0b" height={48} width={220} animated className="bg-white/5 rounded-md" />
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-sm">Yıllık Net (5y)</span>
            <span className="text-white text-sm font-semibold">{formatTRY(yearlyNet[yearlyNet.length-1] || 0)}</span>
          </div>
          <Sparkline values={yearlyNet} color="#ef4444" height={48} width={220} animated className="bg-white/5 rounded-md" />
        </div>
      </div>

      {/* Hızlı Aksiyonlar */}
      <div className="diamond-card p-4">
        <h2 className="text-white text-lg font-semibold mb-2">Hızlı Aksiyonlar</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/management/finance" className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Finans</a>
          <a href="/management/reports" className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Raporlar</a>
          <a href="/housekeeping/dashboard" className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">Housekeeping</a>
        </div>
      </div>
    </div>
  );
};

export default ManagementDashboard;