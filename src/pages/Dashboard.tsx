import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sparkline from '../components/Sparkline';
import { answerReceptionQuery, getEmptyRooms, getTodayCheckIns, getUnpaidGuests } from '../ai/aiReceptionAssistant';
import { forecastNext3Days, generateDailyInsights, getDailyRecommendation } from '../ai/aiManagerAssistant';
import { predictOccupancyAndEnergy } from '../ai/aiForecast';
import { pushNotification } from '../utils/notifications';
import { runEodAndGenerate } from '../ai/aiReports';
import { getReservations, RESERVATIONS_KEY } from '../utils/reservations';
import { createEndOfDayReport, generateGuestListPDF, generateFinancePDF, generateDailyTwoPageReportPDF, HANDOVER_INFO_KEY, getCurrentShiftId, isEodCompleted, SHIFT_STATUS_KEY } from '../utils/endOfDay';
import { onRoomsUpdated } from '../utils/events';

const Dashboard: React.FC = () => {
  const [brandColor, setBrandColor] = useState<string>('#3b82f6');
  const [hotelName, setHotelName] = useState<string>('Otel Yönetim');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [occSeries, setOccSeries] = useState<number[]>([]);
  const [incSeries, setIncSeries] = useState<number[]>([]);
  const [workload, setWorkload] = useState<number>(0);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<{ q: string; a: string; time: string }[]>([]);
  const [busy, setBusy] = useState<boolean>(false);

  // Operasyonel veriler
  const [ciCount, setCiCount] = useState<number>(0);
  const [coCount, setCoCount] = useState<number>(0);
  const [stayingCount, setStayingCount] = useState<number>(0);
  const [debtors, setDebtors] = useState<{ room: string; guest?: string; amountDue?: number }[]>([]);
  const [upcoming, setUpcoming] = useState<{ id: string; guestName: string; roomNumber: string; checkInDate: string }[]>([]);
  const [shiftId, setShiftId] = useState<string>('');
  const [shiftStatus, setShiftStatus] = useState<string>('active');
  const [receptionistNames, setReceptionistNames] = useState<string>('');
  const [eodDone, setEodDone] = useState<boolean>(false);
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);

  // Animasyon durumları
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  useEffect(() => {
    const readSettings = () => {
      try {
        setHotelName(localStorage.getItem('hotel_name') || 'Otel Yönetim');
        setBrandColor(localStorage.getItem('brand_color') || '#3b82f6');
        setLogoUrl(localStorage.getItem('hotel_logo_url'));
      } catch {
        setHotelName('Otel Yönetim');
        setBrandColor('#3b82f6');
        setLogoUrl(null);
      }
    };
    readSettings();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ['hotel_name','brand_color','hotel_logo_url'].includes(ev.key)) readSettings();
    };
    window.addEventListener('storage', onStorage);
    setTimeout(() => setIsLoaded(true), 100);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // AI veri hazırlığı
  useEffect(() => {
    const refresh = () => {
      const unpaid = getUnpaidGuests();
      const unpaidMsg = unpaid[0]
        ? `Oda ${unpaid[0].room} için ${(unpaid[0].amountDue || 0).toLocaleString('tr-TR')}₺ tahsil edilmedi. Hatırlatma gönderilsin mi?`
        : null;
      const recTip = getDailyRecommendation();
      const f3 = forecastNext3Days();
      const tomorrowOcc = Math.round(((f3[1]?.occupancy || 0) * 100));
      const priceMsg = tomorrowOcc >= 85 ? `Yarın doluluk ~%${tomorrowOcc}. Fiyatı %10 artırmayı öneriyorum.` : `Yarın doluluk ~%${tomorrowOcc}. Fiyatı %5 düşürmeyi değerlendirin.`;
      setAiSuggestions([unpaidMsg, recTip, priceMsg].filter(Boolean) as string[]);

      setOccSeries(f3.map(x => Math.round((x.occupancy || 0) * 100)));
      setIncSeries(f3.map(x => Math.round((x.income || 0) / 1000)));
      const pe = predictOccupancyAndEnergy();
      setWorkload(Math.round((pe.workload || 0) * 100));

      const emptyCount = getEmptyRooms().length;
      const todays = getTodayCheckIns().length;
      const debtCount = unpaid.length;
      const al: string[] = [];
      if (debtCount > 0) al.push(`Borçlu misafir: ${debtCount}`);
      if (emptyCount > 0) al.push(`Boş oda: ${emptyCount}`);
      al.push(`Bugün giriş: ${todays}`);
      setAlerts(al);
    };
    refresh();
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const insights = useMemo(() => generateDailyInsights(undefined), []);

  const handleSuggestionAction = (type: 'unpaid_reminder' | 'pricing_apply' | 'route_maintenance' | 'whatsapp_link', payload?: any) => {
    try {
      if (type === 'unpaid_reminder') {
        pushNotification({
          title: 'Ödeme Hatırlatması',
          message: payload?.message || 'Borçlu misafir için hatırlatma gönderildi.',
          type: 'reception',
          priority: 'high',
          recipient: 'reception'
        });
        alert('Hatırlatma bildirimi oluşturuldu. Bildirimler ekranından takip edebilirsiniz.');
      } else if (type === 'pricing_apply') {
        const adj = typeof payload?.adjustment === 'number' ? payload.adjustment : 0;
        try { localStorage.setItem('pricing:tomorrow_adjustment', String(adj)); } catch {}
        pushNotification({
          title: 'Fiyat Önerisi Uygulandı',
          message: `Yarın için fiyat ayarlaması kaydedildi (${Math.round(adj*100)}%).`,
          type: 'system',
          priority: 'medium',
          recipient: 'management'
        });
        alert('Fiyat önerisi uygulandı ve yönetim bilgilendirildi.');
      } else if (type === 'route_maintenance') {
        pushNotification({
          title: 'Bakım Talebi',
          message: payload?.message || 'Teknik ekibe iletildi.',
          type: 'maintenance',
          priority: 'medium',
          recipient: 'maintenance'
        });
        alert('Teknik ekibe bildirim iletildi.');
      } else if (type === 'whatsapp_link') {
        const text = payload?.text || 'Kent Otel bilgilendirme.';
        const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
        alert(`WhatsApp paylaşım linki hazır: ${link}`);
      }
    } catch {}
  };

  const handleAsk = async () => {
    const qRaw = (chatInput || '').trim();
    if (!qRaw || busy) return;
    setBusy(true);
    try {
      let q = qRaw;
      let a = '';
      const lower = qRaw.toLowerCase();

      if ((lower.includes('pdf') || lower.includes('rapor')) && (lower.includes('gün sonu') || lower.includes('eod') || lower.includes('misafir') || lower.includes('finans'))) {
        try {
          const dateISO = new Date().toISOString();
          await runEodAndGenerate(dateISO);
          a = 'Gün sonu raporları oluşturuldu ve PDFler hazırlandı. Raporlar ekranından erişebilirsiniz.';
        } catch {
          a = 'PDF oluşturma sırasında bir sorun oluştu. Lütfen daha sonra tekrar deneyin.';
        }
      } else if (lower.includes('whatsapp') || lower.includes('wa link') || lower.includes('link hazırla')) {
        const summary = generateDailyInsights(undefined);
        const link = `https://wa.me/?text=${encodeURIComponent(summary)}`;
        a = `WhatsApp paylaşım linki hazır: ${link}`;
      } else {
        const qa = answerReceptionQuery(qRaw);
        q = qa.question;
        a = qa.answer;
      }
      setChatHistory(h => [{ q, a, time: new Date().toLocaleString('tr-TR') }, ...h]);
      setChatInput('');
    } finally {
      setBusy(false);
    }
  };

  // Operasyonel veriler
  useEffect(() => {
    const ROOMS_KEY = 'hotel_rooms';
    const todayWindow = () => {
      const base = new Date();
      const start = new Date(base); start.setHours(7,0,0,0);
      const end = new Date(start); end.setDate(end.getDate()+1); end.setHours(7,0,0,0);
      return { start, end };
    };
    const inWnd = (iso?: string, s?: Date, e?: Date) => {
      if (!iso || !s || !e) return false; const t = new Date(iso).getTime(); return t >= s.getTime() && t < e.getTime();
    };

    const refreshOps = () => {
      let rooms: any[] = [];
      try { const raw = localStorage.getItem(ROOMS_KEY); rooms = raw ? JSON.parse(raw) : []; } catch { rooms = []; }
      const { start, end } = todayWindow();
      const ci = rooms.filter(r => inWnd(r.checkInDate, start, end)).length;
      const co = rooms.filter(r => inWnd(r.checkOutDate, start, end)).length;
      const staying = rooms.filter(r => r.status === 'occupied' || r.status === 'sold').length;
      setCiCount(ci); setCoCount(co); setStayingCount(staying);

      setDebtors(getUnpaidGuests());

      const today = new Date(); today.setHours(0,0,0,0); const tStr = today.toISOString().slice(0,10);
      try {
        const list = getReservations()
          .filter(r => r.status !== 'cancelled' && r.checkInDate >= tStr)
          .sort((a,b) => a.checkInDate.localeCompare(b.checkInDate))
          .slice(0,5)
          .map(r => ({ id: r.id, guestName: r.guestName, roomNumber: r.roomNumber, checkInDate: r.checkInDate }));
        setUpcoming(list);
      } catch { setUpcoming([]); }

      try { setShiftId(getCurrentShiftId()); } catch { setShiftId(''); }
      try { const raw = localStorage.getItem(SHIFT_STATUS_KEY); setShiftStatus(raw || 'active'); } catch { setShiftStatus('active'); }
      setEodDone(isEodCompleted());
      try {
        const rawH = localStorage.getItem(HANDOVER_INFO_KEY);
        const info = rawH ? JSON.parse(rawH) as { fromName?: string; toName?: string } : null;
        // Sadece aktif vardiyada olan kişinin ismini göster
        const recep = info ? (info.toName || info.fromName || '') : '';
        setReceptionistNames(recep);
      } catch { setReceptionistNames(''); }
    };
    refreshOps();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || [ROOMS_KEY, RESERVATIONS_KEY, SHIFT_STATUS_KEY, HANDOVER_INFO_KEY].includes(e.key)) refreshOps();
    };
    window.addEventListener('storage', onStorage);
    const onCustom = () => refreshOps();
    window.addEventListener('reservations-updated', onCustom as EventListener);
    window.addEventListener('notificationsUpdated', onCustom as EventListener);
    const unsubRooms = onRoomsUpdated(() => onCustom());
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('reservations-updated', onCustom as EventListener);
      window.removeEventListener('notificationsUpdated', onCustom as EventListener);
      unsubRooms?.();
    };
  }, []);

  const onGuestListPdf = async () => {
    if (pdfBusy) return; setPdfBusy(true);
    try {
      const dateISO = new Date().toISOString();
      let recep = '';
      try { const raw = localStorage.getItem(HANDOVER_INFO_KEY); const info = raw ? JSON.parse(raw) as { fromName?: string; toName?: string } : null; recep = info ? (info.toName || info.fromName || '') : ''; } catch {}
      const report = createEndOfDayReport(recep || undefined, dateISO, getCurrentShiftId());
      await generateGuestListPDF(report.date, recep || report.financial?.receptionist, report.shiftId);
      alert('Misafir listesi PDF hazırlandı. Raporlar ekranından erişebilirsiniz.');
    } catch { alert('Misafir listesi PDF oluşturulamadı.'); }
    finally { setPdfBusy(false); }
  };

  const onFinancePdf = async () => {
    if (pdfBusy) return; setPdfBusy(true);
    try {
      const dateISO = new Date().toISOString();
      let recep = '';
      try { const raw = localStorage.getItem(HANDOVER_INFO_KEY); const info = raw ? JSON.parse(raw) as { fromName?: string; toName?: string } : null; recep = info ? (info.toName || info.fromName || '') : ''; } catch {}
      const report = createEndOfDayReport(recep || undefined, dateISO, getCurrentShiftId());
      await generateFinancePDF(report);
      alert('Gün sonu finans PDF hazırlandı. Raporlar ekranından erişebilirsiniz.');
    } catch { alert('Finans PDF oluşturulamadı.'); }
    finally { setPdfBusy(false); }
  };

  const onTwoPagePdf = async () => {
    if (pdfBusy) return; setPdfBusy(true);
    try {
      const dateISO = new Date().toISOString();
      let recep = '';
      try { const raw = localStorage.getItem(HANDOVER_INFO_KEY); const info = raw ? JSON.parse(raw) as { fromName?: string; toName?: string } : null; recep = info ? (info.toName || info.fromName || '') : ''; } catch {}
      const report = createEndOfDayReport(recep || undefined, dateISO, getCurrentShiftId());
      await generateDailyTwoPageReportPDF(report);
      alert('İki sayfalı günlük rapor PDF hazırlandı.');
    } catch { alert('Günlük rapor PDF oluşturulamadı.'); }
    finally { setPdfBusy(false); }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <div className="container mx-auto px-4 py-8">
        
        {/* Hero Karşılama Bölümü */}
        <div className={`relative overflow-hidden rounded-3xl mb-8 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
             style={{ background: `linear-gradient(135deg, ${brandColor}15, ${brandColor}05)` }}>
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-5" style={{ background: brandColor }} />
          <div className="relative p-8 flex flex-col lg:flex-row items-center justify-between">
            <div className="flex items-center gap-6 mb-6 lg:mb-0">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg"
                   style={{ background: `${brandColor}20`, color: brandColor }}>
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" /> : '🏨'}
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">{hotelName}</h1>
                <p className="text-gray-600 text-lg">Akıllı Resepsiyon Sistemi</p>
                <div className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/admin/reservations"
                className="px-6 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
              >
                🚀 Başla
              </Link>
              <Link
                to="/admin/reports"
                className="px-6 py-3 rounded-xl font-semibold border-2 transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                style={{ borderColor: brandColor, color: brandColor }}
              >
                📊 Raporlar
              </Link>
            </div>
          </div>
        </div>

        {/* Operasyonel Durum Kartları */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          {[
            { title: 'Check-in', value: ciCount, icon: '🔑', color: 'emerald', bgColor: 'from-emerald-100 to-emerald-200' },
            { title: 'Check-out', value: coCount, icon: '🚪', color: 'blue', bgColor: 'from-blue-100 to-blue-200' },
            { title: 'Konaklayan', value: stayingCount, icon: '🏠', color: 'purple', bgColor: 'from-purple-100 to-purple-200' },
            { title: 'Borçlu', value: debtors.length, icon: '⚠️', color: 'red', bgColor: 'from-red-100 to-red-200' }
          ].map((card, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl p-6 text-gray-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 cursor-pointer ${activeCard === card.title ? 'ring-4 ring-gray-300 ring-opacity-50' : ''}`}
              style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              onMouseEnter={() => setActiveCard(card.title)}
              onMouseLeave={() => setActiveCard(null)}
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gray-800 bg-opacity-5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{card.icon}</span>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                    <div className="text-sm text-gray-700 font-medium">{card.title}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-300 bg-opacity-30 rounded-full h-1">
                  <div className="bg-gray-700 h-1 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (card.value / 20) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Ana İçerik Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Sol Kolon - AI ve Operasyonel */}
          <div className="xl:col-span-2 space-y-8">
            
            {/* AI Önerileri ve Hızlı Aksiyonlar */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${brandColor}15`, color: brandColor }}>
                    🧠
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">AI Önerileri</h2>
                    <p className="text-gray-500 text-sm">Akıllı öneriler ve hızlı aksiyonlar</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={onGuestListPdf} disabled={pdfBusy} className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors text-sm font-medium">
                    📋 Misafir Listesi
                  </button>
                  <button onClick={onFinancePdf} disabled={pdfBusy} className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-sm font-medium">
                    💰 Finans Raporu
                  </button>
                  <button onClick={onTwoPagePdf} disabled={pdfBusy} className="px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors text-sm font-medium">
                    📄 Günlük Rapor (2 sayfa)
                  </button>
                </div>
              </div>
              
              {aiSuggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-3">🤖</div>
                  <p>Henüz AI önerisi yok.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiSuggestions.slice(0,3).map((s, i) => {
                    const isUnpaid = /tahsil edilmedi|borç|ödeme/i.test(s);
                    const isPricing = /fiyatı %|fiyat|doluluk/i.test(s);
                    return (
                      <div key={i} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-1">💡</span>
                          <div className="flex-1">
                            <div className="text-gray-800 mb-3">{s}</div>
                            <div className="flex flex-wrap gap-2">
                              {isUnpaid && (
                                <>
                                  <button
                                    onClick={() => handleSuggestionAction('unpaid_reminder', { message: s })}
                                    className="px-4 py-2 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors text-sm font-medium"
                                  >📢 Hatırlatma Gönder</button>
                                  <button
                                    onClick={() => handleSuggestionAction('whatsapp_link', { text: `${hotelName}: ${s}` })}
                                    className="px-4 py-2 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-colors text-sm font-medium"
                                  >💬 WhatsApp Link</button>
                                </>
                              )}
                              {isPricing && (
                                <button
                                  onClick={() => {
                                    const m = s.match(/%([0-9]{1,2})/);
                                    const sign = s.includes('artır') ? 1 : (s.includes('düşür') ? -1 : 0);
                                    const adj = m ? (Number(m[1]) / 100) * (sign || 1) : (sign || 0) * 0.05;
                                    handleSuggestionAction('pricing_apply', { adjustment: adj });
                                  }}
                                  className="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors text-sm font-medium"
                                >💰 Fiyat Önerisini Uygula</button>
                              )}
                              {!isUnpaid && !isPricing && (
                                <button
                                  onClick={() => handleSuggestionAction('route_maintenance', { message: s })}
                                  className="px-4 py-2 rounded-lg bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors text-sm font-medium"
                                >🔧 İşlem Oluştur</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tahmin ve Analitik Paneli */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-400 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${brandColor}15`, color: brandColor }}>
                  📊
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Tahmin ve Analitik</h2>
                  <p className="text-gray-500 text-sm">3 günlük AI tahminleri</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                  <div className="text-sm text-blue-600 font-medium mb-2">Doluluk Oranı (%)</div>
                  <Sparkline values={occSeries} color={brandColor} className="h-12 mb-2" />
                  <div className="text-lg font-bold text-blue-800">{occSeries.join(' → ')}%</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                  <div className="text-sm text-green-600 font-medium mb-2">Gelir Tahmini (bin ₺)</div>
                  <Sparkline values={incSeries} color="#10b981" className="h-12 mb-2" />
                  <div className="text-lg font-bold text-green-800">{incSeries.join(' → ')}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                  <div className="text-sm text-purple-600 font-medium mb-2">İş Yükü</div>
                  <div className="text-3xl font-bold text-purple-800 mb-2">{workload}%</div>
                  <div className="text-xs text-purple-600">AI Tahmin</div>
                </div>
              </div>
              
              {insights && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <div className="text-sm text-gray-600 whitespace-pre-line">{insights}</div>
                </div>
              )}
            </div>

            {/* Borçlu Misafirler ve Yaklaşan Rezervasyonlar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Borçlu Misafirler */}
              <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-red-100 text-red-600">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Borçlu Misafirler</h3>
                    <p className="text-gray-500 text-sm">{debtors.length} kayıt</p>
                  </div>
                </div>
                
                {debtors.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-3xl mb-2">✅</div>
                    <p>Borçlu misafir yok.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {debtors.slice(0,5).map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-800">Oda {d.room}</div>
                          <div className="text-sm text-gray-600">{d.guest || '—'}</div>
                          <div className="text-sm font-bold text-red-600">{(d.amountDue || 0).toLocaleString('tr-TR')}₺</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-xs font-medium"
                            onClick={() => {
                              try { pushNotification({ title: 'Ödeme Hatırlatması', message: `Oda ${d.room} için ödeme hatırlatması`, type: 'reception', priority: 'high', recipient: 'reception' }); } catch {}
                              alert('Hatırlatma bildirimi oluşturuldu.');
                            }}
                          >📢</button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 text-xs font-medium"
                            onClick={() => {
                              const text = `Merhaba, ${hotelName} – Oda ${d.room}: ${(d.amountDue || 0).toLocaleString('tr-TR')}₺ bakiyeniz bulunuyor. Resepsiyonla iletişime geçebilir misiniz?`;
                              const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
                              alert(`WhatsApp paylaşım linki: ${link}`);
                            }}
                          >💬</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Yaklaşan Rezervasyonlar */}
              <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-600 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-blue-100 text-blue-600">
                      🕒
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Yaklaşan Rezervasyonlar</h3>
                      <p className="text-gray-500 text-sm">{upcoming.length} kayıt</p>
                    </div>
                  </div>
                  <Link to="/admin/reservations" className="text-blue-600 hover:text-blue-800 text-sm font-medium">Tümü →</Link>
                </div>
                
                {upcoming.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-3xl mb-2">📅</div>
                    <p>Yaklaşan rezervasyon yok.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {upcoming.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-800">{u.guestName}</div>
                          <div className="text-sm text-gray-600">Oda {u.roomNumber}</div>
                          <div className="text-sm text-blue-600">{u.checkInDate}</div>
                        </div>
                        <Link to="/admin/reservations" className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs font-medium">
                          Detay
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sağ Kolon - Smart Chat ve Durum */}
          <div className="space-y-6">
            
            {/* Vardiya Durumu */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-4 h-4 rounded-full ${eodDone ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Vardiya Durumu</h3>
                  <p className="text-gray-500 text-sm">EOD ve devir bilgileri</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Durum:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${shiftStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {shiftStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Vardiya:</span>
                  <span className="font-medium">{shiftId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Resepsiyon:</span>
                  <span className="font-medium text-right text-black">{receptionistNames || '-'}</span>
                </div>
              </div>
            </div>

            {/* Smart Chat */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-800 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: `${brandColor}15`, color: brandColor }}>
                  🤖
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Smart Chat</h2>
                  <p className="text-gray-500 text-sm">AI asistan ile konuşun</p>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örnek: Bugün kim giriş yaptı?"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); }}}
                />
                <button
                  onClick={handleAsk}
                  className="px-6 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
                  disabled={busy}
                >
                  {busy ? '⏳' : '🚀'}
                </button>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-3">💬</div>
                    <p>Henüz soru yok. AI asistanınızla konuşmaya başlayın!</p>
                  </div>
                ) : (
                  chatHistory.map((h, idx) => (
                    <div key={idx} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-2">{h.time}</div>
                      <div className="text-sm font-semibold text-gray-800 mb-2">❓ {h.q}</div>
                      <div className="text-sm text-gray-700 whitespace-pre-line">💡 {h.a}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Uyarılar */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-700 delay-900 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-orange-100 text-orange-600">
                  🚨
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Anlık Uyarılar</h3>
                  <p className="text-gray-500 text-sm">Sistem bildirimleri</p>
                </div>
              </div>
              
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-3xl mb-2">✅</div>
                  <p>Uyarı yok.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                      <span className="text-orange-500">⚡</span>
                      <span className="text-sm text-gray-800">{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;