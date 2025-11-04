import React, { useEffect, useMemo, useState } from 'react';
import {
  FiFileText, FiCalendar, FiSearch, FiClock, FiBarChart2, FiTrendingUp,
  FiCreditCard, FiPlus, FiTrash2, FiUsers, FiDollarSign, FiDownload,
  FiFile, FiAlertCircle, FiCheckCircle
} from 'react-icons/fi';
import { FaMoneyBillWave, FaBuilding, FaWallet, FaReceipt } from 'react-icons/fa';
import {
  LAST_EOD_PDFS_KEY,
  EOD_REPORTS_KEY,
  EXPENSES_KEY,
  HANDOVER_INFO_KEY,
  getCurrentShiftId,
  createEndOfDayReport,
  generateGuestListPDF,
  generateGuestListBlankTemplatePDF,
  generateFinancePDF,
  generateFinanceBlankTemplatePDF,
  generatePaymentMethodsPDF,
  generateDailyTwoPageReportPDF,
  type EndOfDayReport,
  listSavedEodReports,
  filterEodReports,
} from '../utils/endOfDay';
import { runFullTestSeed } from '../utils/testSeed';
import { isDemoMode } from '../utils/appMode';

const ReportsPage: React.FC = () => {
  const [latestReport, setLatestReport] = useState<EndOfDayReport | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [manualSales, setManualSales] = useState<any[]>([]);
  const [msForm, setMsForm] = useState<{ amount: string; customerName: string; note: string; isDebt: boolean; paymentType: 'cash'|'card'|'iban'|'other' }>({ amount: '', customerName: '', note: '', isDebt: false, paymentType: 'cash' });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expForm, setExpForm] = useState<{ amount: string; title: string; note: string }>({ amount: '', title: '', note: '' });
  const [reportList, setReportList] = useState<EndOfDayReport[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // UI State
  const [pdfTab, setPdfTab] = useState<'guest' | 'finance'>('guest');
  const [salesExpensesTab, setSalesExpensesTab] = useState<'sales' | 'expenses'>('sales');

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const shiftId = useMemo(() => getCurrentShiftId(), []);

  useEffect(() => {
    const readLatest = () => {
      try {
        const raw = localStorage.getItem(EOD_REPORTS_KEY);
        const reports = raw ? JSON.parse(raw) : [];
        const last = reports[reports.length - 1] || null;
        setLatestReport(last);
        setReportList(Array.isArray(reports) ? reports : []);
      } catch {
        setLatestReport(null);
        setReportList([]);
      }
      try {
        const rawPdf = localStorage.getItem(LAST_EOD_PDFS_KEY);
        setPdfInfo(rawPdf ? JSON.parse(rawPdf) : {});
      } catch {
        setPdfInfo({});
      }
      try {
        const rawMs = localStorage.getItem('manual_sales');
        const arr = rawMs ? JSON.parse(rawMs) : [];
        setManualSales(Array.isArray(arr) ? arr : []);
      } catch { setManualSales([]); }
      try {
        const rawEx = localStorage.getItem(EXPENSES_KEY);
        const arrEx = rawEx ? JSON.parse(rawEx) : [];
        setExpenses(Array.isArray(arrEx) ? arrEx : []);
      } catch { setExpenses([]); }
    };
    readLatest();
    const onStorage = () => readLatest();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const receptionistNames = useMemo(() => {
    try {
      const raw = localStorage.getItem(HANDOVER_INFO_KEY);
      if (!raw) return '';
      const info = JSON.parse(raw);
      if (info?.fromName && info?.toName) return `${info.fromName} - ${info.toName}`;
      return info?.fromName || info?.toName || '';
    } catch {
      return '';
    }
  }, []);

  const ensureReport = async (): Promise<EndOfDayReport> => {
    if (latestReport && (latestReport.date || '').slice(0,10) === todayISO) return latestReport;
    const created = await createEndOfDayReport(receptionistNames || undefined, todayISO, shiftId);
    setLatestReport(created);
    return created;
  };

  const addManualSale = () => {
    const amt = Number(msForm.amount || '0');
    if (!amt || isNaN(amt)) { alert('Tutar giriniz.'); return; }
    const item = {
      amount: amt,
      date: new Date().toISOString(),
      title: 'Ekstra Satış',
      customerName: msForm.customerName || undefined,
      isDebt: !!msForm.isDebt,
      note: msForm.note || undefined,
      paymentType: msForm.paymentType || 'cash',
    };
    try {
      const list = Array.isArray(manualSales) ? [...manualSales] : [];
      list.push(item);
      localStorage.setItem('manual_sales', JSON.stringify(list));
      setManualSales(list);
      setMsForm({ amount: '', customerName: '', note: '', isDebt: false, paymentType: 'cash' });
    } catch { alert('Kaydedilemedi.'); }
  };

  const deleteManualSale = (idx: number) => {
    try {
      const list = manualSales.filter((_: any, i: number) => i !== idx);
      localStorage.setItem('manual_sales', JSON.stringify(list));
      setManualSales(list);
    } catch {}
  };

  const addExpense = () => {
    const amt = Number(expForm.amount || '0');
    if (!amt || isNaN(amt)) { alert('Tutar giriniz.'); return; }
    const item = {
      amount: amt,
      date: new Date().toISOString(),
      title: expForm.title || 'Gider',
      note: expForm.note || undefined,
    };
    try {
      const list = Array.isArray(expenses) ? [...expenses] : [];
      list.push(item);
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
      setExpenses(list);
      setExpForm({ amount: '', title: '', note: '' });
    } catch { alert('Kaydedilemedi.'); }
  };

  const deleteExpense = (idx: number) => {
    try {
      const list = expenses.filter((_: any, i: number) => i !== idx);
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));
      setExpenses(list);
    } catch {}
  };

  const onTwoPage = async () => {
    if (busy) return; setBusy(true);
    try {
      const report = await ensureReport();
      await generateDailyTwoPageReportPDF(report);
      alert('Günlük Rapor (2 sayfa) oluşturuldu. İndirilenler klasörünü kontrol ediniz.');
    } catch (err) {
      console.error(err);
      alert('PDF oluşturma sırasında bir hata oluştu.');
    } finally { setBusy(false); }
  };

  const onGuestList = async () => {
    if (busy) return; setBusy(true);
    try {
      await generateGuestListPDF(todayISO, receptionistNames || undefined, shiftId);
      alert('Misafir Listesi oluşturuldu. İndirilenler klasörünü kontrol ediniz.');
    } catch (err) { console.error(err); alert('PDF oluşturma sırasında bir hata oluştu.'); } finally { setBusy(false); }
  };

  const onFinance = async () => {
    if (busy) return; setBusy(true);
    try {
      const report = await ensureReport();
      await generateFinancePDF(report);
      alert('Gün Sonu Finans Raporu oluşturuldu. İndirilenler klasörünü kontrol ediniz.');
    } catch (err) { console.error(err); alert('PDF oluşturma sırasında bir hata oluştu.'); } finally { setBusy(false); }
  };

  const onMethods = async () => {
    if (busy) return; setBusy(true);
    try {
      const report = await ensureReport();
      await generatePaymentMethodsPDF(report);
      alert('Ödeme Yöntemleri raporu oluşturuldu. İndirilenler klasörünü kontrol ediniz.');
    } catch (err) { console.error(err); alert('PDF oluşturma sırasında bir hata oluştu.'); } finally { setBusy(false); }
  };

  const onGuestTemplate = async () => {
    if (busy) return; setBusy(true);
    try { await generateGuestListBlankTemplatePDF(todayISO); alert('Misafir Listesi (Boş Şablon) oluşturuldu.'); }
    catch (err) { console.error(err); alert('PDF oluşturma sırasında bir hata oluştu.'); } finally { setBusy(false); }
  };

  const onFinanceTemplate = async () => {
    if (busy) return; setBusy(true);
    try { await generateFinanceBlankTemplatePDF(todayISO); alert('Finans (Boş Şablon) oluşturuldu.'); }
    catch (err) { console.error(err); alert('PDF oluşturma sırasında bir hata oluştu.'); } finally { setBusy(false); }
  };

  const createdAtLabel = useMemo(() => {
    const iso = pdfInfo?.createdAt; if (!iso) return '—';
    try { return new Date(iso).toLocaleString('tr-TR'); } catch { return iso; }
  }, [pdfInfo]);

  const todaysSales = manualSales.filter((m:any)=> (m.date||'').slice(0,10) === todayISO);
  const todaysExpenses = expenses.filter((m:any)=> (m.date||'').slice(0,10) === todayISO);

  const onFilterDates = () => {
    const s = startDate ? new Date(startDate).toISOString() : undefined;
    const e = endDate ? new Date(endDate).toISOString() : undefined;
    const filtered = filterEodReports(s, e);
    setReportList(filtered);
  };

  const onSaveToday = async () => {
    const r = await ensureReport();
    alert(`Bugün (${new Date(r.date).toLocaleDateString('tr-TR')}) için rapor kaydedildi.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Modern Header */}
      <div className="mb-8">
        <div className="diamond-band rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl shadow-lg">
              <FiFileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-1">Raporlar</h1>
              <p className="text-slate-400 text-lg">PDF oluşturma ve finansal analiz merkezi</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700">
              <FiCalendar className="w-5 h-5 text-slate-400" />
              <span className="text-white font-medium">{new Date().toLocaleDateString('tr-TR')}</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e)=>setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e)=>setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            />
            <button onClick={onFilterDates} className="btn-diamond flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
              <FiSearch className="w-5 h-5" />
              <span>Filtrele</span>
            </button>
            <button onClick={onSaveToday} className="btn-diamond flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl border border-emerald-500 text-white transition-colors">
              <FiFileText className="w-5 h-5" />
              <span>Bugünün Raporunu Kaydet</span>
            </button>
            {isDemoMode() && (
            <button
              onClick={async () => {
                try {
                  const ok = await runFullTestSeed({ basePrice: 500 });
                  if (ok) {
                    alert('Test verileri (satış + gider + rezervasyon) eklendi. Özet ve PDF’lerde görebilirsiniz.');
                  }
                } catch (err) {
                  console.error(err);
                  alert('Test verileri eklenirken hata oluştu.');
                }
              }}
              className="btn-diamond flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl border border-emerald-500 text-white transition-colors"
            >
              <FaWallet className="w-5 h-5" />
              <span>Test Verileri Oluştur</span>
            </button>
            )}
          </div>
        </div>
        
        {/* Mini Timeline */}
        <div className="diamond-row rounded-xl p-2 flex items-center gap-2 text-sm text-slate-400">
          <FiClock className="w-4 h-4" />
          <span>Son PDF: {createdAtLabel}</span>
          {pdfInfo?.dailyReportFile && (
            <span className="diamond-pill">✓ Günlük Rapor Hazır</span>
          )}
        </div>
      </div>


      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column - PDF Creation Panel */}
        <div className="diamond-card overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <FiBarChart2 className="w-6 h-6 text-orange-400" />
              <h2 className="text-xl font-semibold text-white">PDF & Raporlar</h2>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-slate-900/50 rounded-xl p-1">
              <button 
                onClick={() => setPdfTab('guest')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                  pdfTab === 'guest' 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FiUsers className="w-4 h-4" />
                Misafir Raporları
              </button>
              <button 
                onClick={() => setPdfTab('finance')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                  pdfTab === 'finance' 
                    ? 'bg-orange-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FiDollarSign className="w-4 h-4" />
                Finansal Raporlar
              </button>
            </div>
          </div>

          <div className="p-6">
            {pdfTab === 'guest' ? (
              <div className="space-y-3">
                <button 
                  onClick={onGuestList} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 rounded-xl text-white font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  <FiUsers className="w-5 h-5" />
                  Misafir Listesi
                </button>
                <button 
                  onClick={onGuestTemplate} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-white font-medium transition-all"
                >
                  <FiFile className="w-5 h-5" />
                  Misafir Listesi (Boş Şablon)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button 
                  onClick={onTwoPage} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 rounded-xl text-white font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  <FiFileText className="w-5 h-5" />
                  Günlük Rapor (2 sayfa)
                </button>
                <button 
                  onClick={onFinance} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 rounded-xl text-white font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  <FiBarChart2 className="w-5 h-5" />
                  Finans Raporu
                </button>
                <button 
                  onClick={onMethods} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 rounded-xl text-white font-medium transition-all shadow-lg hover:shadow-xl"
                >
                  <FiCreditCard className="w-5 h-5" />
                  Ödeme Yöntemleri
                </button>
                <button 
                  onClick={onFinanceTemplate} 
                  disabled={busy}
                  className="btn-diamond w-full flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl text-white font-medium transition-all"
                >
                  <FiFile className="w-5 h-5" />
                  Finans (Boş Şablon)
                </button>
              </div>
            )}
            
            <div className="mt-6 p-4 bg-slate-900/50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                {busy ? (
                  <>
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-orange-400 text-sm font-medium">İşlemde...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">Hazır</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400">Kart komisyonu %3.75 varsayılır. Arşivli çıkışlar dahildir.</p>
            </div>
          </div>
        </div>

        {/* Middle Column - Financial Summary */}
        <div className="diamond-card overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <FiTrendingUp className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Gün Sonu Özeti</h2>
              <span className="ml-auto text-sm text-slate-400">{todayISO}</span>
            </div>
          </div>

          <div className="p-6">
            {latestReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FaMoneyBillWave className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">Nakit</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ₺{(latestReport.financial?.cashTotal || 0).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FiCreditCard className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-blue-400 font-medium">Kart Net</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ₺{(latestReport.financial?.cardNetTotal || 0).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FaBuilding className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-purple-400 font-medium">IBAN</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ₺{(latestReport.financial?.ibanTotal || 0).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FaWallet className="w-5 h-5 text-orange-400" />
                      <span className="text-sm text-orange-400 font-medium">Toplam</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      ₺{(latestReport.financial?.generalTotal || 0).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Komisyon</span>
                    <span className="text-sm font-medium text-red-400">%3.75</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Resepsiyonist</span>
                    <span className="text-sm font-medium text-white">{latestReport.financial?.receptionist || '—'}</span>
                  </div>
                </div>

                <button className="btn-diamond w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 rounded-xl text-white font-medium transition-all">
                  <FiDownload className="w-4 h-4" />
                  PDF olarak indir
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <FiAlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">Bugün için EOD raporu bulunmuyor.</p>
                <p className="text-sm text-slate-500 mt-2">PDF üretimi sırasında otomatik oluşturulur.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sales & Expenses */}
        <div className="diamond-card overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <FaReceipt className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold text-white">Satış & Giderler</h2>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-slate-900/50 rounded-xl p-1">
              <button 
                onClick={() => setSalesExpensesTab('sales')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                  salesExpensesTab === 'sales' 
                    ? 'bg-emerald-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FiTrendingUp className="w-4 h-4" />
                Ekstra Satışlar
              </button>
              <button 
                onClick={() => setSalesExpensesTab('expenses')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                  salesExpensesTab === 'expenses' 
                    ? 'bg-emerald-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FaReceipt className="w-4 h-4" />
                Giderler
              </button>
            </div>
          </div>

          <div className="p-6">
            {salesExpensesTab === 'sales' ? (
              <div className="space-y-4">
                {/* Sales Form */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                      type="number" 
                      placeholder="Tutar (₺)" 
                      value={msForm.amount} 
                      onChange={(e)=>setMsForm(f=>({...f, amount: e.target.value}))} 
                    />
                    <input 
                      className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                      placeholder="Müşteri" 
                      value={msForm.customerName} 
                      onChange={(e)=>setMsForm(f=>({...f, customerName: e.target.value}))} 
                    />
                  </div>
                  <select 
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white focus:border-emerald-500 focus:outline-none transition-colors" 
                    value={msForm.paymentType} 
                    onChange={(e)=>setMsForm(f=>({...f, paymentType: e.target.value as any}))}
                  >
                    <option value="cash">💰 Nakit</option>
                    <option value="card">💳 Kredi Kartı</option>
                    <option value="iban">🏦 Havale / IBAN</option>
                    <option value="other">📋 Diğer</option>
                  </select>
                  <input 
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                    placeholder="Açıklama" 
                    value={msForm.note} 
                    onChange={(e)=>setMsForm(f=>({...f, note: e.target.value}))} 
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-slate-300">
                      <input 
                        type="checkbox" 
                        checked={msForm.isDebt} 
                        onChange={(e)=>setMsForm(f=>({...f, isDebt: e.target.checked}))}
                        className="rounded border-slate-600 bg-slate-900/50 text-emerald-500 focus:ring-emerald-500"
                      />
                      Borçlu Müşteri
                    </label>
                    <button 
                      onClick={addManualSale} 
                      className="btn-diamond flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-xl text-white font-medium transition-all shadow-lg"
                    >
                      <FiPlus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                </div>

                {/* Sales List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {todaysSales.length > 0 ? todaysSales.map((m:any, idx:number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {m.isDebt ? (
                            <span className="diamond-pill text-red-400">Borçlu</span>
                          ) : (
                            <span className="diamond-pill text-green-400">Ekstra</span>
                          )}
                          <span className="text-white font-medium">
                            ₺{(Number(m.amount)||0).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          {m.customerName || m.title || '—'} • {
                            m.paymentType === 'card' ? '💳 Kart' : 
                            m.paymentType === 'cash' ? '💰 Nakit' : 
                            m.paymentType === 'iban' ? '🏦 IBAN' : 
                            '📋 Diğer'
                          }
                        </p>
                      </div>
                      <button 
                        onClick={()=>deleteManualSale(idx)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400">
                      <FaReceipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Bugün için satış kaydı yok</p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-900/50 rounded-xl text-center">
                  <p className="text-xs text-slate-400">Borçlu kayıtlar finansa dahildir</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Expenses Form */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                      type="number" 
                      placeholder="Tutar (₺)" 
                      value={expForm.amount} 
                      onChange={(e)=>setExpForm(f=>({...f, amount: e.target.value}))} 
                    />
                    <input 
                      className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                      placeholder="Kalem" 
                      value={expForm.title} 
                      onChange={(e)=>setExpForm(f=>({...f, title: e.target.value}))} 
                    />
                  </div>
                  <input 
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none transition-colors" 
                    placeholder="Not" 
                    value={expForm.note} 
                    onChange={(e)=>setExpForm(f=>({...f, note: e.target.value}))} 
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={addExpense} 
                      className="btn-diamond flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-xl text-white font-medium transition-all shadow-lg"
                    >
                      <FiPlus className="w-4 h-4" />
                      Ekle
                    </button>
                  </div>
                </div>

                {/* Expenses List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {todaysExpenses.length > 0 ? todaysExpenses.map((m:any, idx:number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">
                            ₺{(Number(m.amount)||0).toLocaleString('tr-TR')}
                          </span>
                          <span className="diamond-pill text-red-400">Gider</span>
                        </div>
                        <p className="text-sm text-slate-400">
                          {m.title || 'Gider'} {m.note && `• ${m.note}`}
                        </p>
                      </div>
                      <button 
                        onClick={()=>deleteExpense(idx)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400">
                      <FaReceipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Bugün için gider kaydı yok</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rapor Geçmişi */}
      <div className="diamond-card overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <FiClock className="w-6 h-6 text-sky-400" />
          <h2 className="text-xl font-semibold text-white">Rapor Geçmişi</h2>
          <span className="ml-auto text-sm text-slate-400">Toplam: {reportList.length}</span>
        </div>
        <div className="p-6 space-y-2 max-h-72 overflow-y-auto">
          {reportList.length ? reportList.map((r, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-700">
              <div className="flex items-center gap-4">
                <span className="diamond-pill">{new Date(r.date).toLocaleDateString('tr-TR')}</span>
                <span className="text-slate-300 text-sm">Nakit: ₺{(r.financial?.cashTotal||0).toLocaleString('tr-TR')}</span>
                <span className="text-slate-300 text-sm">Kart Net: ₺{(r.financial?.cardNetTotal||0).toLocaleString('tr-TR')}</span>
                <span className="text-slate-300 text-sm">IBAN: ₺{(r.financial?.ibanTotal||0).toLocaleString('tr-TR')}</span>
                <span className="text-slate-300 text-sm">Toplam: ₺{(r.financial?.generalTotal||r.financial?.eodBalance||0).toLocaleString('tr-TR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async ()=>{ if (!busy) { setBusy(true); try { await generateDailyTwoPageReportPDF(r); } finally { setBusy(false); } } }}
                  className="btn-diamond px-3 py-2 text-white bg-slate-700 hover:bg-slate-600 rounded-lg"
                >PDF</button>
              </div>
            </div>
          )) : (
            <div className="text-center py-6 text-slate-400">Kayıtlı rapor bulunmuyor</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;