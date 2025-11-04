import React, { useEffect, useState } from 'react';
import { createEndOfDayReport, getCurrentShiftId, ensureShiftInitialized, handoverShift, acceptShift, EOD_REPORTS_KEY, HANDOVER_INFO_KEY, SHIFT_STATUS_KEY, isManualEodWindow, canHandover, generateGuestListPDF, generateFinancePDF, archiveCheckedOutGuests } from '../utils/endOfDay';
import { activateTomorrowReservationsOnEod } from '../utils/reservations';

const ShiftControl: React.FC = () => {
  const [shiftId, setShiftId] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [latestReport, setLatestReport] = useState<any>(null);
  const [fromName, setFromName] = useState<string>('');
  const [toName, setToName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [manualAllowed, setManualAllowed] = useState<boolean>(false);
  const [canHandoverFlag, setCanHandoverFlag] = useState<boolean>(true);
  const [eodWarning, setEodWarning] = useState<boolean>(false);

  useEffect(() => {
    ensureShiftInitialized();
    const id = getCurrentShiftId();
    setShiftId(id);

    const loadReports = () => {
      try {
        const rawReports = localStorage.getItem(EOD_REPORTS_KEY);
        const reports = rawReports ? JSON.parse(rawReports) : [];
        setLatestReport(reports[reports.length - 1] || null);
      } catch {}
    };

    const loadHandInfo = () => {
      try {
        const rawHand = localStorage.getItem(HANDOVER_INFO_KEY);
        const info = rawHand ? JSON.parse(rawHand) : null;
        if (info) {
          setFromName(info.fromName || '');
          setToName(info.toName || '');
        }
      } catch {}
    };

    const loadStatus = () => {
      try {
        const rawStatus = localStorage.getItem(SHIFT_STATUS_KEY);
        const st = rawStatus || 'active';
        setStatus(st);
      } catch {}
    };

    const updateManualAndHandover = () => {
      setManualAllowed(isManualEodWindow());
      setCanHandoverFlag(canHandover(new Date()));
      setEodWarning(false);
    };

    loadReports();
    loadHandInfo();
    loadStatus();
    updateManualAndHandover();

    const onEodUpdated = () => { loadReports(); updateManualAndHandover(); };
    const onShiftUpdated = () => { loadStatus(); loadHandInfo(); updateManualAndHandover(); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === EOD_REPORTS_KEY) { loadReports(); updateManualAndHandover(); }
      if (e.key === SHIFT_STATUS_KEY) { loadStatus(); updateManualAndHandover(); }
      if (e.key === HANDOVER_INFO_KEY) loadHandInfo();
    };

    window.addEventListener('eod-reports-updated', onEodUpdated as EventListener);
    window.addEventListener('shift-status-updated', onShiftUpdated as EventListener);
    window.addEventListener('storage', onStorage);

    const intervalId = setInterval(updateManualAndHandover, 60 * 1000);
    return () => {
      window.removeEventListener('eod-reports-updated', onEodUpdated as EventListener);
      window.removeEventListener('shift-status-updated', onShiftUpdated as EventListener);
      window.removeEventListener('storage', onStorage);
      clearInterval(intervalId);
    };
  }, []);

  const onHandover = () => {
    setLoading(true);
    try {
      const info = { fromName, toName };
      try { localStorage.setItem(HANDOVER_INFO_KEY, JSON.stringify(info)); } catch {}
      handoverShift();
      const rawStatus = localStorage.getItem(SHIFT_STATUS_KEY);
      setStatus(rawStatus || 'handed_over');
    } finally {
      setLoading(false);
    }
  };

  const onAccept = () => {
    setLoading(true);
    try {
      acceptShift();
      const rawStatus = localStorage.getItem(SHIFT_STATUS_KEY);
      setStatus(rawStatus || 'active');
    } finally {
      setLoading(false);
    }
  };

  const onManualEod = async () => {
    setLoading(true);
    try {
      const shift = getCurrentShiftId();
      const recep = fromName && toName ? `${fromName} - ${toName}` : undefined;
      const dateISO = new Date().toISOString();
      const report = createEndOfDayReport(recep, dateISO, shift);
      setLatestReport(report);
      activateTomorrowReservationsOnEod(dateISO);
      await generateGuestListPDF(report.date, recep, report.shiftId);
      await generateFinancePDF(report);
      archiveCheckedOutGuests(report.date);
    } finally {
      setLoading(false);
    }
  };

  // Son rapor için resepsiyon isimlerini (from-to) elde et
  const receptionistDisplay = (() => {
    if (!latestReport) return '';
    const saved = latestReport?.financial?.receptionist;
    if (saved) return saved;
    try {
      const raw = localStorage.getItem(HANDOVER_INFO_KEY);
      if (!raw) return '';
      const info = JSON.parse(raw);
      if (info?.fromName && info?.toName) return `${info.fromName} - ${info.toName}`;
      return info?.fromName || info?.toName || '';
    } catch {
      return '';
    }
  })();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-white/10 border border-white/20">
          <h3 className="text-white text-lg font-semibold mb-2">Devir Kontrol</h3>
          <div className="space-y-2">
            <label className="block text-white/80 text-sm">Teslim Eden</label>
            <select value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full p-2 rounded bg-white/10 text-white border border-white/30 placeholder-white/70 appearance-none">
              <option value="">Seçiniz</option>
              <option value="Selami Polat">Selami Polat</option>
              <option value="Ünver Düşürmek">Ünver Düşürmek</option>
            </select>
            <label className="block text-white/80 text-sm mt-2">Devralan</label>
            <select value={toName} onChange={(e) => setToName(e.target.value)} className="w-full p-2 rounded bg-white/10 text-white border border-white/30 placeholder-white/70 appearance-none">
              <option value="">Seçiniz</option>
              <option value="Selami Polat">Selami Polat</option>
              <option value="Ünver Düşürmek">Ünver Düşürmek</option>
            </select>
            <div className="flex space-x-2 mt-3">
              <button onClick={onHandover} disabled={!fromName || !toName || loading || !canHandoverFlag} className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">Devir Et</button>
              <button onClick={onAccept} disabled={loading} className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50">Devral</button>
            </div>
            {!canHandoverFlag && (
              <p className="text-yellow-300 text-xs mt-2">Gün sonu tamamlanmadan devir yapılamaz.</p>
            )}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white/10 border border-white/20">
          <h3 className="text-white text-lg font-semibold mb-2">Manuel Gün Sonu</h3>
          <p className="text-white/70 text-sm mb-2">Gün sonu raporunu manuel oluşturabilirsiniz.</p>
          <p className="text-white/80 text-xs mb-2">Vardiya ID: #{shiftId}</p>
          <button onClick={onManualEod} disabled={loading || !manualAllowed} className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50">Gün Sonu Oluştur</button>
          {!manualAllowed && (
            <p className="text-white/60 text-xs mt-2">Manuel Gün Sonu butonu 07:00–12:00 arası aktiftir.</p>
          )}
          {eodWarning && (
            <p className="text-yellow-300 text-xs mt-2">Uyarı (12:30): Gün sonu henüz tamamlanmadı.</p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white/10 border border-white/20">
        <h3 className="text-white text-lg font-semibold mb-2">Son Rapor</h3>
        {latestReport ? (
          <div className="text-white/80 text-sm space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <p><span className="text-white/60">Vardiya:</span> {latestReport.shiftId || '-'}</p>
                <p><span className="text-white/60">Oluşturulma:</span> {new Date(latestReport.createdAt).toLocaleString()}</p>
                <p><span className="text-white/60">Resepsiyon:</span> {receptionistDisplay || '-'}</p>
              </div>
              <div>
                <p><span className="text-white/60">Tarih:</span> {latestReport.date}</p>
                <p><span className="text-white/60">Durum:</span> {status}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="bg-white/5 p-3 rounded border border-white/10">
                <p className="font-semibold">Finansal</p>
                <p>Genel Toplam: {latestReport.financial?.generalTotal ?? 0}</p>
                <p>Nakit: {latestReport.financial?.cashTotal ?? 0}</p>
                <p>IBAN: {latestReport.financial?.ibanTotal ?? 0}</p>
                <p>Pos Net: {latestReport.financial?.cardNetTotal ?? 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/10">
                <p className="font-semibold">Operasyonel</p>
                <p>Dolu Oda: {latestReport.operational?.occupiedCount ?? 0}</p>
                <p>Müsait Oda: {latestReport.operational?.availableCount ?? 0}</p>
                <p>Giriş: {latestReport.operational?.checkInCount ?? 0}</p>
                <p>Çıkış: {latestReport.operational?.checkOutCount ?? 0}</p>
              </div>
              <div className="bg-white/5 p-3 rounded border border-white/10">
                <p className="font-semibold">Sürdürülebilirlik</p>
                <p>Skor: {latestReport.sustainability?.score ?? 0}</p>
                <p>Politika Kabul: {latestReport.sustainability?.policyAcceptedRatio ?? 0}</p>
                <p>Stayover Azaltım: {latestReport.sustainability?.stayoverReductionRatio ?? 0}</p>
                <p>Yeşil Tercih: {latestReport.sustainability?.greenPreferenceRatio ?? 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm">Henüz rapor bulunmuyor.</p>
        )}
      </div>
    </div>
  );
};

export default ShiftControl;