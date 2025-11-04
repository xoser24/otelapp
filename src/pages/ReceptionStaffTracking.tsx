import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserTie, FaUserAlt, FaIdBadge, FaMoneyBillWave, FaCalendarAlt, FaPlus, FaEdit, FaRobot } from 'react-icons/fa';
import { Staff, getAllStaff, upsertStaff, removeStaff } from '../utils/staff';
import { addEvent as addStaffEvent, getEvents, getEventsForStaff, removeEventsForStaff } from '../utils/staffEvents';
import type { StaffEvent } from '../utils/staffEvents';
import GoldModal from '../components/GoldModal';
import { analyzeStaffLLM } from '../ai/aiStaffHelper';

type ViewMode = 'cards' | 'table';

const statusBadge = (st?: Staff['status']) => {
  if (st === 'on_leave') return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
  if (st === 'resigned') return 'bg-gray-200 text-gray-700 border border-gray-300';
  return 'bg-green-100 text-green-800 border border-green-300';
};

const statusLabel = (st?: Staff['status']) => st === 'on_leave' ? 'İzinli' : st === 'resigned' ? 'Ayrıldı' : 'Aktif';

const ReceptionStaffTracking: React.FC = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<Staff[]>([]);
  const [view, setView] = useState<ViewMode>('cards');
  const [selected, setSelected] = useState<Staff | null>(null);
  const [advance, setAdvance] = useState<{ amount: string; note: string }>({ amount: '', note: '' });
  const [selectedEvents, setSelectedEvents] = useState<StaffEvent[]>([]);
  const [draft, setDraft] = useState<Partial<Staff>>({});
  const [aiInput, setAiInput] = useState<string>('');
  const [aiReply, setAiReply] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [leave, setLeave] = useState<{ days: string; note: string }>({ days: '', note: '' });

  // Filtre/Sıralama/Sayfalama
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'on_leave'|'resigned'>('all');
  const [deptFilter, setDeptFilter] = useState<'all'|Staff['department']>('all');
  const [onlyNewStarters, setOnlyNewStarters] = useState<boolean>(false);
  const [advanceRisk, setAdvanceRisk] = useState<'all'|'approaching'|'over'>('all');
  const [sortBy, setSortBy] = useState<'name'|'department'|'salary'|'status'|'startDate'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);

  const load = () => setList(getAllStaff());
  useEffect(() => {
    load();
    const onUpd = () => load();
    const onEvt = () => setSelectedEvents(prev => [...prev]);
    window.addEventListener('staff-updated', onUpd as EventListener);
    window.addEventListener('staff-events-updated', onEvt as EventListener);
    return () => {
      window.removeEventListener('staff-updated', onUpd as EventListener);
      window.removeEventListener('staff-events-updated', onEvt as EventListener);
    };
  }, []);

  const openDetail = (s: Staff) => {
    setSelected(s);
    setDraft({ ...s });
    try { setSelectedEvents(getEventsForStaff(s.id)); } catch { setSelectedEvents([]); }
    setAdvance({ amount: '', note: '' });
    const monthAdv = monthlyAdvanceFor(s.id);
    const leaveUsed = selectedEvents.filter(e=>e.type==='leave').reduce((sum,e)=> sum + (Number(e.amount)||1), 0);
    const prompt = `${s.name} adlı personelin maaşı ${Number(s.baseSalary||0)} TL, bu ay ${monthAdv} TL avans almış, toplam izin kullanımı ${leaveUsed} gün. Kısa performans önerin nedir?`;
    setAiInput(prompt);
    setAiReply('');
  };

  const closeDetail = () => { setSelected(null); setSelectedEvents([]); };

  const saveStaff = () => {
    if (!selected) return;
    const merged: Staff = { ...selected, ...draft } as Staff;
    upsertStaff(merged);
    setSelected(merged);
    load();
  };

  const deleteStaff = () => {
    if (!selected) return;
    const name = selected.name || selected.id;
    const ok = window.confirm(`${name} adlı personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`);
    if (!ok) return;
    // Sadece kaydedilmiş personelleri temizle
    removeStaff(selected.id);
    try { removeEventsForStaff(selected.id); } catch {}
    setSelected(null);
    setSelectedEvents([]);
    load();
    alert('Personel kaldırıldı.');
  };
  const addAdvance = () => {
    if (!selected) return;
    const amt = parseFloat((advance.amount || '').toString().replace(',', '.'));
    if (!isFinite(amt) || amt <= 0) { alert('Geçerli bir tutar giriniz.'); return; }
    addStaffEvent({ staffId: selected.id, type: 'advance', amount: amt, description: advance.note });
    setSelectedEvents(getEventsForStaff(selected.id));
    setAdvance({ amount: '', note: '' });
  };

  const addLeave = () => {
    if (!selected) return;
    const days = parseFloat((leave.days || '').toString().replace(',', '.'));
    if (!isFinite(days) || days <= 0) { alert('Geçerli bir gün sayısı giriniz.'); return; }
    addStaffEvent({ staffId: selected.id, type: 'leave', amount: days, description: leave.note });
    setSelectedEvents(getEventsForStaff(selected.id));
    setLeave({ days: '', note: '' });
  };

  const runAssistant = async () => {
    if (!selected) return;
    setAiLoading(true); setAiReply('');
    try {
      const monthAdv = monthlyAdvanceFor(selected.id);
      const leaveUsed = selectedEvents.filter(e=>e.type==='leave').reduce((sum,e)=> sum + (Number(e.amount)||1), 0);
      const text = await analyzeStaffLLM(selected, selectedEvents, { monthlyAdvance: monthAdv, leaveUsed, userPrompt: aiInput });
      setAiReply(text);
    } catch (e: any) {
      setAiReply(`Asistan hatası: ${e?.message || 'bilinmeyen'}`);
    } finally { setAiLoading(false); }
  };

  const currencyTR = useMemo(() => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }), []);

  // Finans yardımcıları ve KPI'lar
  const isSameMonth = (iso?: string, ref?: Date) => {
    if (!iso) return false; const r = ref || new Date(); const t = new Date(iso);
    return t.getFullYear() === r.getFullYear() && t.getMonth() === r.getMonth();
  };
  const monthlyAdvanceFor = (staffId: string, ref?: Date) => {
    const evts = getEventsForStaff(staffId);
    return evts.filter(e => e.type==='advance' && isSameMonth(e.date, ref)).reduce((s,e)=> s + (Number(e.amount)||0), 0);
  };
  const allEvents = useMemo(() => getEvents(), [list]);
  const last30DaysAdvanceTotal = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 29*24*60*60*1000);
    return allEvents.filter(e => e.type==='advance' && e.date && new Date(e.date) >= from).reduce((s,e)=> s + (Number(e.amount)||0), 0);
  }, [allEvents]);
  const activeCount = useMemo(() => list.filter(s => (s.status ?? 'active') === 'active').length, [list]);
  const totalSalaryActive = useMemo(() => list.filter(s => (s.status ?? 'active')==='active').reduce((s, x)=> s + (Number(x.baseSalary)||0), 0), [list]);
  const newStartersCount = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate()-30);
    return list.filter(s => s.startDate && new Date(s.startDate) >= from).length;
  }, [list]);

  // Filtrelenmiş/sıralanmış/sayfalanmış liste
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    const from = new Date(); from.setDate(from.getDate()-30);
    return list.filter(s => {
      const okTerm = term === '' || s.name.toLocaleLowerCase('tr-TR').includes(term) || (s.position||'').toLocaleLowerCase('tr-TR').includes(term);
      const okStatus = statusFilter==='all' || (s.status||'active') === statusFilter;
      const okDept = deptFilter==='all' || s.department === deptFilter;
      const okNew = !onlyNewStarters || (s.startDate && new Date(s.startDate) >= from);
      const risk = (() => {
        const limit = Number(s.advanceMonthlyLimit)||0; if (!limit) return 'none';
        const used = monthlyAdvanceFor(s.id);
        if (used >= limit) return 'over';
        if (used >= 0.8*limit) return 'approaching';
        return 'ok';
      })();
      const okRisk = advanceRisk==='all' || risk===advanceRisk;
      return okTerm && okStatus && okDept && okNew && okRisk;
    });
  }, [list, search, statusFilter, deptFilter, onlyNewStarters, advanceRisk]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name, 'tr-TR');
      if (sortBy === 'department') return dir * (`${a.department} ${a.position||''}`).localeCompare(`${b.department} ${b.position||''}`, 'tr-TR');
      if (sortBy === 'salary') return dir * (((a.baseSalary||0) - (b.baseSalary||0)));
      if (sortBy === 'status') return dir * ((a.status||'active').localeCompare((b.status||'active')));
      if (sortBy === 'startDate') return dir * (((new Date(a.startDate||'1970-01-01')).getTime()) - ((new Date(b.startDate||'1970-01-01')).getTime()));
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => sorted.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [sorted, page, pageSize]);
  useEffect(()=>{ if (page > totalPages) setPage(1); }, [totalPages, page]);

  const setSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(prev => prev==='asc'?'desc':'asc'); else { setSortBy(col); setSortDir('asc'); }
  };

  const headers = (
    <div className="rounded-xl overflow-hidden mb-6">
      <div className="diamond-band">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center"><FaUserTie className="mr-2" /> Personel Takip</h1>
            <p className="text-white/90 text-sm">Cam efektli kartlar veya tablo, detay popup ile</p>
          </div>
          <div className="flex gap-2">
            <button className={`px-3 py-1.5 rounded-lg text-sm ${view==='cards'?'bg-white/25 text-white':'bg-white/15 text-white/80 hover:bg-white/25'}`} onClick={()=>setView('cards')}>Kart</button>
            <button className={`px-3 py-1.5 rounded-lg text-sm ${view==='table'?'bg-white/25 text-white':'bg-white/15 text-white/80 hover:bg-white/25'}`} onClick={()=>setView('table')}>Tablo</button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm bg-amber-600 text-white hover:bg-amber-700 inline-flex items-center gap-2"
              onClick={() => {
                const id = `new_${Date.now()}`;
                const s: Staff = { id, name: '', department: 'Reception', status: 'active' };
                setSelected(s);
                setDraft({ ...s });
                setSelectedEvents([]);
                setAdvance({ amount: '', note: '' });
                setAiInput(''); setAiReply('');
              }}
            >
              <FaPlus/> Personel Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {headers}

      {/* KPI Bandi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20">
          <div className="text-white/70 text-xs">Toplam Maaş (Aktif)</div>
          <div className="text-white font-semibold text-lg">{currencyTR.format(totalSalaryActive)}</div>
        </div>
        <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20">
          <div className="text-white/70 text-xs">Son 30 Gün Avans</div>
          <div className="text-white font-semibold text-lg">{currencyTR.format(last30DaysAdvanceTotal)}</div>
        </div>
        <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20">
          <div className="text-white/70 text-xs">Aktif Personel</div>
          <div className="text-white font-semibold text-lg">{activeCount}</div>
        </div>
        <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20">
          <div className="text-white/70 text-xs">Yeni Başlayan (30g)</div>
          <div className="text-white font-semibold text-lg">{newStartersCount}</div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input placeholder="Ara: ad veya pozisyon" className="px-3 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-500" value={search} onChange={(e)=>{ setSearch(e.target.value); setPage(1); }} />
          <select className="px-3 py-2 rounded-lg bg-white text-gray-900" value={statusFilter} onChange={(e)=>{ setStatusFilter(e.target.value as any); setPage(1); }}>
            <option value="all">Durum: Tümü</option>
            <option value="active">Aktif</option>
            <option value="on_leave">İzinli</option>
            <option value="resigned">Ayrıldı</option>
          </select>
          <select className="px-3 py-2 rounded-lg bg-white text-gray-900" value={deptFilter} onChange={(e)=>{ setDeptFilter(e.target.value as any); setPage(1); }}>
            <option value="all">Departman: Tümü</option>
            <option value="Reception">Reception</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Technical">Technical</option>
            <option value="Other">Other</option>
          </select>
          <select className="px-3 py-2 rounded-lg bg-white text-gray-900" value={advanceRisk} onChange={(e)=>{ setAdvanceRisk(e.target.value as any); setPage(1); }}>
            <option value="all">Avans Riski: Tümü</option>
            <option value="approaching">Sınıra Yakın (≥%80)</option>
            <option value="over">Limit Aşıldı</option>
          </select>
          <label className="inline-flex items-center gap-2 text-white/90 px-2">
            <input type="checkbox" className="w-4 h-4" checked={onlyNewStarters} onChange={(e)=>{ setOnlyNewStarters(e.target.checked); setPage(1); }} />
            <span>Yeni Başlayanlar</span>
          </label>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.map(s => (
            <div
              key={s.id}
              className="gold-glass-surface rounded-2xl p-4 border border-amber-300/20 shadow-goldGlow cursor-pointer hover:bg-white/5"
              onClick={() => openDetail(s)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 text-white grid place-items-center shadow-md"><FaUserAlt/></div>
                  <div>
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-xs text-white/70">{s.department}{s.position ? ` • ${s.position}` : ''}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(s.status)}`}>{statusLabel(s.status)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white/10 rounded-xl p-3 border border-amber-300/20">
                  <div className="text-[11px] text-white/70">Maaş</div>
                  <div className="font-medium text-white">{s.baseSalary ? currencyTR.format(s.baseSalary) : '—'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-amber-300/20">
                  <div className="text-[11px] text-white/70">Başlangıç</div>
                  <div className="font-medium text-white">{s.startDate ? new Date(s.startDate).toLocaleDateString('tr-TR') : '—'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 border border-amber-300/20">
                  <div className="text-[11px] text-white/70">IBAN</div>
                  <div className="font-medium text-white truncate" title={s.iban || '—'}>{s.iban || '—'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-amber-500/15 rounded-xl p-2 border border-amber-300/20 text-amber-200">
                  <div className="text-[11px] opacity-80">Ay Avans</div>
                  <div className="font-semibold">{currencyTR.format(monthlyAdvanceFor(s.id))}</div>
                </div>
                <div className="bg-emerald-500/15 rounded-xl p-2 border border-emerald-300/20 text-emerald-200">
                  <div className="text-[11px] opacity-80">Limit</div>
                  <div className="font-semibold">{currencyTR.format(Number(s.advanceMonthlyLimit||0))}</div>
                </div>
                <div className="bg-sky-500/15 rounded-xl p-2 border border-sky-300/20 text-sky-200">
                  <div className="text-[11px] opacity-80">Kalan</div>
                  <div className="font-semibold">{currencyTR.format(Math.max(0, (Number(s.advanceMonthlyLimit||0) - monthlyAdvanceFor(s.id))))}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button onClick={(e)=>{ e.stopPropagation(); navigate(`/admin/staff/${s.id}`); }} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2">
                  <FaIdBadge/> Profil
                </button>
                <button onClick={(e)=>{ e.stopPropagation(); openDetail(s); }} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30 inline-flex items-center gap-2">
                  Detay
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="gold-glass-surface rounded-2xl p-4 border border-amber-300/20 shadow-goldGlow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/80 border-b border-amber-300/20">
                <th className="py-2 cursor-pointer" onClick={()=>setSort('name')}>Adı {sortBy==='name' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="py-2 cursor-pointer" onClick={()=>setSort('department')}>Departman / Pozisyon {sortBy==='department' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="py-2 cursor-pointer" onClick={()=>setSort('salary')}>Maaş {sortBy==='salary' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="py-2 cursor-pointer" onClick={()=>setSort('status')}>Durum {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="py-2 cursor-pointer" onClick={()=>setSort('startDate')}>Başlangıç {sortBy==='startDate' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(s => (
                <tr key={s.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="py-2 text-white">{s.name}</td>
                  <td className="py-2 text-white/90">{s.department}{s.position ? ` • ${s.position}` : ''}</td>
                  <td className="py-2 text-white/90">{s.baseSalary ? currencyTR.format(s.baseSalary) : '—'}</td>
                  <td className="py-2"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(s.status)}`}>{statusLabel(s.status)}</span></td>
                  <td className="py-2 text-white/70">{s.startDate ? new Date(s.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                  <td className="py-2 text-right flex items-center gap-2 justify-end">
                    <button onClick={()=>navigate(`/admin/staff/${s.id}`)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2">Profil</button>
                    <button onClick={()=>openDetail(s)} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30 inline-flex items-center gap-2">Detay</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pager */}
      <div className="flex items-center justify-between mt-4 text-white/80">
        <div className="flex items-center gap-2">
          <span className="text-xs">Sayfa Boyutu</span>
          <select className="px-2 py-1 rounded bg-white/70 text-gray-800 text-xs" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page<=1} className="px-2 py-1 rounded bg-white/20 disabled:opacity-40" onClick={()=>setPage(p=>Math.max(1,p-1))}>Önceki</button>
          <span className="text-xs">{page} / {totalPages}</span>
          <button disabled={page>=totalPages} className="px-2 py-1 rounded bg-white/20 disabled:opacity-40" onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sonraki</button>
        </div>
      </div>

      <GoldModal open={!!selected} onClose={closeDetail} title={`${selected?.name || ''} ${selected?.position ? '• '+selected.position : ''}`}>
        {!!selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="text-white/70 text-xs mb-1">Ad</div>
                <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.name || ''} onChange={(e)=>setDraft(prev => ({...prev, name: e.target.value}))} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Pozisyon</div>
                    <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.position || ''} onChange={(e)=>setDraft(prev => ({...prev, position: e.target.value}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Durum</div>
                    <select className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.status || 'active'} onChange={(e)=>setDraft(prev => ({...prev, status: e.target.value as Staff['status']}))}>
                      <option value="active">Aktif</option>
                      <option value="on_leave">İzinli</option>
                      <option value="resigned">Ayrıldı</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Telefon</div>
                    <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.phone || ''} onChange={(e)=>setDraft(prev => ({...prev, phone: e.target.value}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">E-posta</div>
                    <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.email || ''} onChange={(e)=>setDraft(prev => ({...prev, email: e.target.value}))} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-white/70 text-xs mb-1">Adres</div>
                  <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.address || ''} onChange={(e)=>setDraft(prev => ({...prev, address: e.target.value}))} />
                </div>
              </div>
              <div className="bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-white/70 text-xs mb-1">Maaş (₺)</div>
                    <input type="number" className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.baseSalary ?? ''} onChange={(e)=>setDraft(prev => ({...prev, baseSalary: Number(e.target.value)}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Başlangıç</div>
                    <input type="date" className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.startDate || ''} onChange={(e)=>setDraft(prev => ({...prev, startDate: e.target.value}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Bitiş</div>
                    <input type="date" className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.endDate || ''} onChange={(e)=>setDraft(prev => ({...prev, endDate: e.target.value}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">İstihdam Tipi</div>
                    <select className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.employmentType || 'full-time'} onChange={(e)=>setDraft(prev => ({...prev, employmentType: e.target.value as Staff['employmentType']}))}>
                      <option value="full-time">Tam zamanlı</option>
                      <option value="part-time">Yarı zamanlı</option>
                      <option value="contractor">Yüklenici</option>
                      <option value="intern">Stajyer</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">IBAN</div>
                    <input className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.iban || ''} onChange={(e)=>setDraft(prev => ({...prev, iban: e.target.value}))} />
                  </div>
                  <div>
                    <div className="text-white/70 text-xs mb-1">Avans Limit (Ay)</div>
                    <input type="number" className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.advanceMonthlyLimit ?? ''} onChange={(e)=>setDraft(prev => ({...prev, advanceMonthlyLimit: Number(e.target.value)}))} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-amber-500/15 rounded-xl p-2 border border-amber-300/20 text-amber-200">
                    <div className="text-[11px] opacity-80">Bu Ay Avans</div>
                    <div className="font-semibold">{selected ? currencyTR.format(monthlyAdvanceFor(selected.id)) : '—'}</div>
                  </div>
                  <div className="bg-emerald-500/15 rounded-xl p-2 border border-emerald-300/20 text-emerald-200">
                    <div className="text-[11px] opacity-80">Limit</div>
                    <div className="font-semibold">{currencyTR.format(Number(draft.advanceMonthlyLimit || selected.advanceMonthlyLimit || 0))}</div>
                  </div>
                  <div className="bg-sky-500/15 rounded-xl p-2 border border-sky-300/20 text-sky-200">
                    <div className="text-[11px] opacity-80">Kalan</div>
                    <div className="font-semibold">{selected ? currencyTR.format(Math.max(0, Number((draft.advanceMonthlyLimit ?? selected.advanceMonthlyLimit) || 0) - monthlyAdvanceFor(selected.id))) : '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black/20 rounded-xl p-3 border border-amber-200/20">
              <div className="text-white/70 text-xs mb-1">Notlar</div>
              <textarea rows={3} className="w-full px-3 py-2 rounded-lg bg-white/70" value={draft.notes || ''} onChange={(e)=>setDraft(prev => ({...prev, notes: e.target.value}))} />
            </div>

            {/* AI Asistan - mini chat */}
            <div className="bg-black/25 rounded-xl p-3 border border-amber-300/20">
              <div className="font-medium text-white mb-2 flex items-center gap-2"><FaRobot/> AI Asistan</div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
                <textarea rows={3} className="w-full px-3 py-2 rounded-lg bg-white/70" placeholder="Kısa analiz istemi yazın..." value={aiInput} onChange={(e)=>setAiInput(e.target.value)} />
                <button disabled={aiLoading} onClick={runAssistant} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2 disabled:opacity-60">
                  <FaRobot/> {aiLoading ? 'Çalışıyor...' : 'Asistanı Çalıştır'}
                </button>
              </div>
              {aiReply && (
                <div className="mt-3 bg-white/10 rounded-lg p-3 text-white/90 whitespace-pre-wrap">
                  {aiReply}
                </div>
              )}
              {!aiReply && !aiLoading && (
                <div className="mt-2 text-xs text-white/60">İpucu: API anahtarını .env dosyasına `REACT_APP_OPENAI_API_KEY` olarak ekleyebilir veya tarayıcı localStorage'ına `openai_api_key` olarak kaydedebilirsiniz.</div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-1 bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="font-medium text-white mb-2 flex items-center gap-2"><FaMoneyBillWave/> Avans Ekle</div>
                <div className="grid grid-cols-1 gap-2">
                  <input type="number" placeholder="Tutar (₺)" className="w-full px-3 py-2 rounded-lg bg-white/70" value={advance.amount} onChange={(e)=>setAdvance(prev=>({...prev, amount: e.target.value}))} />
                  <input placeholder="Açıklama (opsiyonel)" className="w-full px-3 py-2 rounded-lg bg-white/70" value={advance.note} onChange={(e)=>setAdvance(prev=>({...prev, note: e.target.value}))} />
                  <button onClick={addAdvance} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2"><FaPlus/> Ekle</button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="font-medium text-white mb-2">Avans Geçmişi</div>
                <div className="max-h-56 overflow-y-auto divide-y divide-white/10">
                  {selectedEvents.filter(e=>e.type==='advance').length === 0 && (
                    <div className="text-white/60 text-sm">Kayıt yok.</div>
                  )}
                  {selectedEvents.filter(e=>e.type==='advance').map(e => (
                    <div key={e.id} className="py-2 text-white/90 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-amber-500"/>
                        <div>
                          <div className="text-xs text-white/70">{new Date(e.date).toLocaleString('tr-TR')}</div>
                          <div className="text-sm">{e.description || '—'}</div>
                        </div>
                      </div>
                      <div className="font-medium">{currencyTR.format(Number(e.amount) || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Yıllık İzin alanı */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-1 bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="font-medium text-white mb-2 flex items-center gap-2"><FaCalendarAlt/> Yıllık İzin Ekle</div>
                <div className="grid grid-cols-1 gap-2">
                  <input type="number" placeholder="Gün (ör. 2)" className="w-full px-3 py-2 rounded-lg bg-white/70" value={leave.days} onChange={(e)=>setLeave(prev=>({...prev, days: e.target.value}))} />
                  <input placeholder="Açıklama (opsiyonel)" className="w-full px-3 py-2 rounded-lg bg-white/70" value={leave.note} onChange={(e)=>setLeave(prev=>({...prev, note: e.target.value}))} />
                  <button onClick={addLeave} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2"><FaPlus/> Ekle</button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-black/20 rounded-xl p-3 border border-amber-200/20">
                <div className="font-medium text-white mb-2">İzin Geçmişi</div>
                <div className="max-h-56 overflow-y-auto divide-y divide-white/10">
                  {selectedEvents.filter(e=>e.type==='leave').length === 0 && (
                    <div className="text-white/60 text-sm">Kayıt yok.</div>
                  )}
                  {selectedEvents.filter(e=>e.type==='leave').map(e => (
                    <div key={e.id} className="py-2 text-white/90 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-amber-500"/>
                        <div>
                          <div className="text-xs text-white/70">{new Date(e.date).toLocaleString('tr-TR')}</div>
                          <div className="text-sm">{e.description || '—'}</div>
                        </div>
                      </div>
                      <div className="font-medium">{Number(e.amount) || 0} gün</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeDetail} className="px-3 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm hover:bg-gray-300">İptal</button>
              <button onClick={deleteStaff} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700">Sil</button>
              <button onClick={saveStaff} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2"><FaEdit/> Kaydet</button>
            </div>
          </div>
        )}
      </GoldModal>
    </div>
  );
};

export default ReceptionStaffTracking;