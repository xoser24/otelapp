import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Sparkline from '../components/Sparkline';
import { Staff, StaffLog, DailyScore, seedDemoStaffIfEmpty, getLogsForStaff, seedDemoLogsIfSparse, getScoresForStaff, getSeries, STAFF_NOTES_KEY, upsertStaff, getStaffById } from '../utils/staff';
import { isDemoMode } from '../utils/appMode';
import { analyzeStaff } from '../ai/aiStaff';
import { computeMonthlyTotals, getPayrollForStaff, monthKey, recordMonthlyPayroll } from '../utils/payroll';
import { getEventsForStaff, addEvent as addStaffEvent } from '../utils/staffEvents';
import type { StaffEvent } from '../utils/staffEvents';

const StaffProfile: React.FC = () => {
  const params = useParams();
  const id = params.id || 'demo';
  const [staff, setStaff] = useState<Staff | null>(null);
  const [logs, setLogs] = useState<StaffLog[]>([]);
  const [scores, setScores] = useState<DailyScore[]>([]);
  const [managerNotes, setManagerNotes] = useState<string>('');

  useEffect(() => {
    if (isDemoMode()) {
      const s = seedDemoStaffIfEmpty(id);
      seedDemoLogsIfSparse(id);
      setStaff(s);
      setLogs(getLogsForStaff(id));
    } else {
      // Prod modunda: sadece mevcut veriyi yükle, otomatik demo seed yok
      const s = getStaffById(id);
      setStaff(s);
      setLogs(getLogsForStaff(id));
    }
  }, [id]);

  useEffect(() => {
    if (!staff) return;
    setScores(getScoresForStaff(staff, logs));
  }, [staff, logs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STAFF_NOTES_KEY}_${id}`);
      setManagerNotes(raw || '');
    } catch {}
  }, [id]);

  const todayKey = new Date().toISOString().slice(0,10);
  const todayLog = useMemo(() => logs.find(l => l.date === todayKey) || logs[logs.length-1], [logs, todayKey]);
  const todayScore = useMemo(() => (staff && todayLog) ? scores.find(s => s.date === todayLog.date) : undefined, [scores, staff, todayLog]);

  const weekly = useMemo(() => getSeries(scores, 7), [scores]);
  const monthly = useMemo(() => getSeries(scores, 30), [scores]);
  const insight = useMemo(() => staff ? analyzeStaff(staff, logs, scores) : undefined, [staff, logs, scores]);

  const saveNotes = () => {
    try { localStorage.setItem(`${STAFF_NOTES_KEY}_${id}`, managerNotes || ''); alert('Not kaydedildi.'); } catch {}
  };

  const onBasicEdit = (patch: Partial<Staff>) => {
    if (!staff) return;
    const next = { ...staff, ...patch } as Staff;
    setStaff(next);
    upsertStaff(next);
  };

  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [leaveForm, setLeaveForm] = useState<{ start: string; end: string; note: string }>({ start: '', end: '', note: '' });

  useEffect(() => {
    if (staff) {
      try { setEvents(getEventsForStaff(staff.id)); } catch { setEvents([]); }
    }
  }, [staff]);

  const addLeave = () => {
    if (!staff) return;
    const { start, end, note } = leaveForm;
    if (!start || !end) { alert('Başlangıç ve bitiş tarihlerini giriniz.'); return; }
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) { alert('Geçerli bir tarih aralığı giriniz.'); return; }
    const msPerDay = 24*60*60*1000;
    const days = Math.max(1, Math.round((e.getTime() - s.getTime())/msPerDay) + 1);
    addStaffEvent({ staffId: staff.id, type: 'leave', date: s.toISOString(), endDate: e.toISOString(), amount: days, description: note });
    setEvents(getEventsForStaff(staff.id));
    setLeaveForm({ start: '', end: '', note: '' });
  };

  if (!staff) return <div className="diamond-band"><h1 className="text-2xl font-bold text-white">Yükleniyor…</h1></div>;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="diamond-band">
        <h1 className="text-2xl font-bold text-white mb-1">👤 {staff.name}</h1>
        <p className="text-white/80 text-sm">ID: {staff.id} • Vardiya: {staff.shiftType || '-'} • İzin: {staff.daysOff?.join(', ') || '-'}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="diamond-pill badge-blue">Departman: {staff.department}</span>
          {todayScore && (<span className="diamond-pill badge-green">Günlük Skor: {todayScore.total}/100</span>)}
        </div>
      </div>

      {/* Günlük Performans Özeti */}
      <div className="diamond-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg font-semibold">✅ Günlük Performans Özeti</h3>
          {todayLog && <span className="text-white/60 text-xs">Tarih: {todayLog.date}</span>}
        </div>
        {todayScore ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-3">
            <div className="bg-white/5 rounded p-3">
              <div className="text-white/70 text-xs">Tamamlama</div>
              <div className="text-xl font-semibold">{todayScore.completionRate}%</div>
              <div className="text-white/60 text-xs">Görev: {todayScore.details.tasksCompleted}/{todayScore.details.tasksAssigned}</div>
            </div>
            <div className="bg-white/5 rounded p-3">
              <div className="text-white/70 text-xs">Memnuniyet</div>
              <div className="text-xl font-semibold">{todayScore.satisfaction}</div>
              <div className="text-white/60 text-xs">Teşekkür: {todayScore.details.thanks} • Şikayet: {todayScore.details.complaints}</div>
            </div>
            <div className="bg-white/5 rounded p-3">
              <div className="text-white/70 text-xs">Dakiklik</div>
              <div className="text-xl font-semibold">{todayScore.punctuality}</div>
              <div className="text-white/60 text-xs">Giriş farkı: {todayScore.details.checkInDiffMin ?? 0} dk</div>
            </div>
            <div className="bg-white/5 rounded p-3">
              <div className="text-white/70 text-xs">Mesai</div>
              <div className="text-xl font-semibold">{todayScore.details.overtimeMinutes || 0} dk</div>
              <div className="text-white/60 text-xs">Bonus: +{todayScore.overtimeBonus}</div>
            </div>
            <div className="bg-white/5 rounded p-3">
              <div className="text-white/70 text-xs">Genel Skor</div>
              <div className="text-2xl font-bold">{todayScore.total}/100</div>
              <div className="text-white/60 text-xs">Ağırlıklı bileşenlerle hesaplandı</div>
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-sm mt-2">Bugün için veri bulunamadı.</p>
        )}
      </div>

      {/* Haftalık & Aylık Grafikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="diamond-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold">📈 Haftalık Skor</h3>
            <span className="text-white/60 text-xs">Son 7 gün</span>
          </div>
          <Sparkline values={weekly} width={280} height={48} className="mt-3" />
        </div>
        <div className="diamond-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold">📊 Aylık Skor</h3>
            <span className="text-white/60 text-xs">Son 30 gün</span>
          </div>
          <Sparkline values={monthly} width={280} height={48} className="mt-3" />
        </div>
      </div>

      {/* AI Analizleri */}
      <div className="diamond-card p-6">
        <h3 className="text-white text-lg font-semibold">🧠 AI Analizi</h3>
        {insight ? (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-white/70 text-xs mb-1">Anomali Algılama</div>
              {insight.anomalies.length ? (
                <ul className="list-disc ml-5 text-white/80 text-sm">
                  {insight.anomalies.map((a,i)=>(<li key={i}>{a}</li>))}
                </ul>
              ) : (<p className="text-white/60 text-sm">Önemli anomali yok.</p>)}
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">Tahminleme</div>
              {insight.forecasts.length ? (
                <ul className="list-disc ml-5 text-white/80 text-sm">
                  {insight.forecasts.map((a,i)=>(<li key={i}>{a}</li>))}
                </ul>
              ) : (<p className="text-white/60 text-sm">Anlamlı risk görünmüyor.</p>)}
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">Günlük Otomatik Özet</div>
              <p className="text-white/80 text-sm">{insight.summary}</p>
            </div>
          </div>
        ) : (<p className="text-white/60 text-sm mt-2">Analiz için veri bekleniyor…</p>)}
      </div>

      {/* Çalışma Bilgileri ve Notlar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="diamond-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold">🏢 Çalışma Bilgileri</h3>
            <button className="btn-outline text-xs" onClick={()=>onBasicEdit({ shiftType: staff.shiftType === 'A' ? 'B' : 'A' })}>Vardiya Değiştir</button>
          </div>
          <div className="mt-2 text-white/80 text-sm">
            <div>Departman: {staff.department}</div>
            <div>Vardiya Tipi: {staff.shiftType || '-'}</div>
            <div>İzin Günleri: {staff.daysOff?.join(', ') || '-'}</div>
          </div>
        </div>
        <div className="diamond-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold">💬 Yönetici Notları</h3>
            <button className="btn-diamond text-xs" onClick={saveNotes}>Kaydet</button>
          </div>
          <textarea value={managerNotes} onChange={(e)=>setManagerNotes(e.target.value)} className="w-full mt-2 min-h-[120px] p-2 rounded bg-white/20 text-white" placeholder="Geri bildirim, koçluk notları, şikayet/teşekkür değerlendirmesi…" />
        </div>
      </div>

      {/* Kişisel ve Finans Bilgileri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="diamond-card p-6">
          <h3 className="text-white text-lg font-semibold">👤 Kişisel Bilgiler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
            <label className="text-white/80">Telefon
              <input className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.phone || ''} onChange={(e)=>onBasicEdit({ phone: e.target.value })} />
            </label>
            <label className="text-white/80">E-posta
              <input className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.email || ''} onChange={(e)=>onBasicEdit({ email: e.target.value })} />
            </label>
            <label className="text-white/80 md:col-span-2">Adres
              <input className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.address || ''} onChange={(e)=>onBasicEdit({ address: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="diamond-card p-6">
          <h3 className="text-white text-lg font-semibold">💳 Finans Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
            <label className="text-white/80">Maaş (₺)
              <input type="number" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.baseSalary ?? ''} onChange={(e)=>onBasicEdit({ baseSalary: Number(e.target.value) })} />
            </label>
            <label className="text-white/80">IBAN
              <input className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.iban || ''} onChange={(e)=>onBasicEdit({ iban: e.target.value })} />
            </label>
            <label className="text-white/80">Başlangıç
              <input type="date" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.startDate || ''} onChange={(e)=>onBasicEdit({ startDate: e.target.value })} />
            </label>
            <label className="text-white/80">Bitiş
              <input type="date" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.endDate || ''} onChange={(e)=>onBasicEdit({ endDate: e.target.value })} />
            </label>
            <label className="text-white/80">Aylık Avans Limiti
              <input type="number" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={staff.advanceMonthlyLimit ?? ''} onChange={(e)=>onBasicEdit({ advanceMonthlyLimit: Number(e.target.value) })} />
            </label>
          </div>
        </div>
      </div>

      {/* Aylık Maaş İşleme ve Kayıtlar */}
      <div className="diamond-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg font-semibold">📅 Aylık Maaş İşleme</h3>
          <span className="text-white/70 text-sm">Ay: {monthKey()}</span>
        </div>
        <PayrollPanel staffId={staff.id} baseSalary={staff.baseSalary || 0} />
      </div>

      {/* Yıllık İzinler */}
      <div className="diamond-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg font-semibold">🏖️ Yıllık İzinler</h3>
          <span className="text-white/60 text-xs">Toplam kayıt: {events.filter(e=>e.type==='leave').length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 text-sm">
          <label className="text-white/80">Başlangıç
            <input type="date" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={leaveForm.start} onChange={(e)=>setLeaveForm(prev=>({...prev, start: e.target.value}))} />
          </label>
          <label className="text-white/80">Bitiş
            <input type="date" className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" value={leaveForm.end} onChange={(e)=>setLeaveForm(prev=>({...prev, end: e.target.value}))} />
          </label>
          <label className="text-white/80 md:col-span-2">Açıklama
            <input className="w-full mt-1 px-3 py-2 rounded bg-white text-gray-900" placeholder="Örn. Yıllık izin" value={leaveForm.note} onChange={(e)=>setLeaveForm(prev=>({...prev, note: e.target.value}))} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={addLeave} className="px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2">İzin Ekle</button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white/5 rounded p-3 text-white">
            <div className="text-white/70 text-xs">İzin Geçmişi</div>
            <div className="mt-2 divide-y divide-white/10">
              {events.filter(e=>e.type==='leave').length === 0 && (
                <div className="text-sm text-white/70 py-2">Kayıt yok</div>
              )}
              {events.filter(e=>e.type==='leave').map(e => (
                <div key={e.id} className="py-2 text-white/90 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/70">{new Date(e.date).toLocaleDateString('tr-TR')} {e.endDate ? `– ${new Date(e.endDate).toLocaleDateString('tr-TR')}` : ''}</div>
                    <div className="text-sm">{e.description || '—'}</div>
                  </div>
                  <div className="font-medium">{(e.amount||0)} gün</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Giriş/Çıkış Logları */}
      <div className="diamond-card p-6">
        <h3 className="text-white text-lg font-semibold">🕓 Giriş / Çıkış Logları</h3>
        {logs.length ? (
          <table className="w-full text-left text-sm text-white/80 mt-2">
            <thead>
              <tr>
                <th className="py-2 border-b border-white/20">Tarih</th>
                <th className="py-2 border-b border-white/20">Giriş</th>
                <th className="py-2 border-b border-white/20">Çıkış</th>
                <th className="py-2 border-b border-white/20">Görev</th>
                <th className="py-2 border-b border-white/20">Şikayet/Teşekkür</th>
                <th className="py-2 border-b border-white/20">Mesai</th>
                <th className="py-2 border-b border-white/20">Skor</th>
              </tr>
            </thead>
            <tbody>
              {[...logs].slice(-14).reverse().map((l) => {
                const s = staff ? getScoresForStaff(staff, [l])[0] : undefined;
                return (
                  <tr key={l.id} className="diamond-row">
                    <td className="py-2 border-b border-white/10">{l.date}</td>
                    <td className="py-2 border-b border-white/10">{l.checkIn ? new Date(l.checkIn).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="py-2 border-b border-white/10">{l.checkOut ? new Date(l.checkOut).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="py-2 border-b border-white/10">{(l.tasksCompleted||0)}/{(l.tasksAssigned||0)}</td>
                    <td className="py-2 border-b border-white/10">{l.complaints||0}/{l.thanks||0}</td>
                    <td className="py-2 border-b border-white/10">{l.overtimeMinutes||0} dk</td>
                    <td className="py-2 border-b border-white/10">{s ? s.total : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-white/60 text-sm">Kayıt bulunamadı.</p>
        )}
      </div>
    </div>
  );
};

export default StaffProfile;

type PayrollPanelProps = { staffId: string; baseSalary: number };
const PayrollPanel: React.FC<PayrollPanelProps> = ({ staffId, baseSalary }) => {
  const [ledger, setLedger] = useState(getPayrollForStaff(staffId));
  const [note, setNote] = useState('');

  useEffect(() => { setLedger(getPayrollForStaff(staffId)); }, [staffId]);

  const mKey = monthKey();
  const totals = computeMonthlyTotals(staffId);
  const already = useMemo(() => ledger.some(l => l.month === mKey), [ledger, mKey]);
  const net = Math.max(0, (Number(baseSalary)||0) + (totals.bonuses||0) - (totals.advances||0) - (totals.penalties||0));

  const process = () => {
    const rec = recordMonthlyPayroll(staffId, baseSalary, note);
    setLedger(getPayrollForStaff(staffId));
    alert(`Maaş işlendi: ${rec.month} net ${rec.netPaid.toLocaleString('tr-TR')}₺`);
    setNote('');
  };

  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-white/5 rounded p-3 text-white">
          <div className="text-white/70 text-xs">Brüt Maaş</div>
          <div className="text-lg font-semibold">{(baseSalary||0).toLocaleString('tr-TR')}₺</div>
        </div>
        <div className="bg-amber-500/15 rounded p-3 text-amber-200">
          <div className="text-white/80 text-xs">Bu Ay Avans</div>
          <div className="text-lg font-semibold">{(totals.advances||0).toLocaleString('tr-TR')}₺</div>
        </div>
        <div className="bg-emerald-500/15 rounded p-3 text-emerald-200">
          <div className="text-white/80 text-xs">Bonus</div>
          <div className="text-lg font-semibold">{(totals.bonuses||0).toLocaleString('tr-TR')}₺</div>
        </div>
        <div className="bg-rose-500/15 rounded p-3 text-rose-200">
          <div className="text-white/80 text-xs">Ceza</div>
          <div className="text-lg font-semibold">{(totals.penalties||0).toLocaleString('tr-TR')}₺</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Not (opsiyonel)" className="px-3 py-2 rounded bg-white text-gray-900 text-sm flex-1" />
        <button disabled={already} onClick={process} className={`px-4 py-2 rounded text-sm ${already ? 'bg-gray-400 text-gray-800 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>{already ? 'Bu Ay İşlendi' : `Bu Ayı İşle (Net ${net.toLocaleString('tr-TR')}₺)`}</button>
      </div>

      <div className="mt-4">
        <h4 className="text-white font-semibold mb-2">Kayıtlı Maaş Hareketleri</h4>
        {ledger.length ? (
          <table className="w-full text-left text-sm text-white/80">
            <thead>
              <tr>
                <th className="py-2 border-b border-white/20">Ay</th>
                <th className="py-2 border-b border-white/20">Brüt</th>
                <th className="py-2 border-b border-white/20">Avans</th>
                <th className="py-2 border-b border-white/20">Bonus</th>
                <th className="py-2 border-b border-white/20">Ceza</th>
                <th className="py-2 border-b border-white/20">Net</th>
                <th className="py-2 border-b border-white/20">Not</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 6).map(l => (
                <tr key={l.id} className="diamond-row">
                  <td className="py-2 border-b border-white/10">{l.month}</td>
                  <td className="py-2 border-b border-white/10">{l.baseSalary.toLocaleString('tr-TR')}₺</td>
                  <td className="py-2 border-b border-white/10">{l.advances.toLocaleString('tr-TR')}₺</td>
                  <td className="py-2 border-b border-white/10">{l.bonuses.toLocaleString('tr-TR')}₺</td>
                  <td className="py-2 border-b border-white/10">{l.penalties.toLocaleString('tr-TR')}₺</td>
                  <td className="py-2 border-b border-white/10">{l.netPaid.toLocaleString('tr-TR')}₺</td>
                  <td className="py-2 border-b border-white/10">{l.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-white/60 text-sm">Kayıt yok.</p>
        )}
      </div>
    </div>
  );
};