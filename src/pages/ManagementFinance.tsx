import React, { useEffect, useMemo, useState } from 'react';
import { FaMoneyBillWave, FaChartLine, FaReceipt } from 'react-icons/fa';
import { sumLastNDays } from '../utils/financeTrends';

const formatTRY = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val || 0);

const ManagementFinance: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

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
  }, []);

  const summary = useMemo(() => {
    const revenueToday = rooms.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const expenseToday = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netToday = revenueToday - expenseToday;

    // Son 30 gün için EOD raporlarından gerçekçi toplamlar (varsa)
    const last30 = sumLastNDays(30);
    const monthlyRevenue = last30.income;
    const monthlyExpenses = last30.expenses;
    const monthlyNet = last30.net;

    return { revenueToday, expenseToday, netToday, monthlyRevenue, monthlyExpenses, monthlyNet };
  }, [rooms, expenses]);

  return (
    <div className="p-6">
      <div className="diamond-band mb-6">
        <div className="flex items-center gap-2">
          <div className="icon-badge animate-band-icon">₺</div>
          <div className="band-title">Finans Özeti</div>
        </div>
        <p className="text-white/80 text-sm">Günlük ve aylık gelir/gider tahmini</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugünkü Gelir</span>
            <FaMoneyBillWave className="text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(summary.revenueToday)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bugünkü Gider</span>
            <FaReceipt className="text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(summary.expenseToday)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Net</span>
            <FaChartLine className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{formatTRY(summary.netToday)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="diamond-card p-4">
          <div className="text-sm text-white/80">Aylık Gelir Tahmini</div>
          <div className="mt-1 text-xl font-bold text-white">{formatTRY(summary.monthlyRevenue)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="text-sm text-white/80">Aylık Gider Tahmini</div>
          <div className="mt-1 text-xl font-bold text-white">{formatTRY(summary.monthlyExpenses)}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="text-sm text-white/80">Aylık Net</div>
          <div className="mt-1 text-xl font-bold text-white">{formatTRY(summary.monthlyNet)}</div>
        </div>
      </div>

      <div className="mt-6 diamond-card p-4">
        <div className="text-sm text-white/80">Not: Aylık özet, kayıtlı gün sonu (EOD) raporlarına göre hesaplanır; veri yoksa 0 gösterir.</div>
      </div>
    </div>
  );
};

export default ManagementFinance;