import React, { useEffect, useMemo, useState } from 'react';
import { FaCalendarPlus, FaCalendarCheck, FaCalendarTimes, FaUser, FaPhone, FaClipboardList } from 'react-icons/fa';
import { addReservation, getReservations, updateReservationStatus, ReservationRecord, checkInReservation, getTomorrow, RESERVATIONS_KEY, markNoShow, getAvailableRoomsForRange, getToday } from '../utils/reservations';

const ROOMS_KEY = 'hotel_rooms';

type Tab = 'today' | 'tomorrow' | 'week' | 'completed';

const Reservations: React.FC = () => {
  const [tab, setTab] = useState<Tab>('tomorrow');
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [rooms, setRooms] = useState<{ number: string }[]>([]);
  const [form, setForm] = useState<Partial<ReservationRecord>>({ checkInDate: new Date().toISOString().slice(0,10), checkOutDate: new Date(Date.now()+24*60*60*1000).toISOString().slice(0,10), paymentState: 'unpaid', peopleCount: 2, source: 'phone' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationRecord['status']>('all');
  const [range, setRange] = useState<{start: string; end: string}>({ start: getToday(), end: getTomorrow() });
  const [aiRooms, setAiRooms] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const [view, setView] = useState<'cards' | 'list'>('list');
  const [rangeMode, setRangeMode] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'roomNumber'|'guestName'|'checkInDate'|'checkOutDate'|'status'>('checkInDate');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showThresholds, setShowThresholds] = useState(false);
  const [calendarThresholds, setCalendarThresholds] = useState<{yellow:number; red:number}>({ yellow: 3, red: 5 });

  useEffect(() => {
    const load = () => setReservations(getReservations());
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === RESERVATIONS_KEY) load(); if (e.key === ROOMS_KEY) loadRooms(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('reservations-updated', load as EventListener);
    const loadRooms = () => {
      try { const raw = localStorage.getItem(ROOMS_KEY); setRooms(raw ? JSON.parse(raw) : []); } catch { setRooms([]); }
    };
    loadRooms();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('reservations-updated', load as EventListener);
    };
  }, []);

  const today = new Date().toISOString().slice(0,10);
  const tomorrow = getTomorrow();
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7); const weekEndStr = weekEnd.toISOString().slice(0,10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('diamond_calendar_thresholds');
      if (raw) {
        const t = JSON.parse(raw);
        if (typeof t?.yellow === 'number' && typeof t?.red === 'number') setCalendarThresholds(t);
      }
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    let list = reservations.slice();
    if (tab === 'today') list = list.filter(r => r.checkInDate === today && r.status !== 'cancelled');
    else if (tab === 'tomorrow') list = list.filter(r => r.checkInDate === tomorrow && r.status !== 'cancelled');
    else if (tab === 'week') list = list.filter(r => r.checkInDate >= today && r.checkInDate <= weekEndStr && r.status !== 'cancelled');
    else list = list.filter(r => r.status === 'completed' || r.status === 'cancelled');
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (search.trim()) list = list.filter(r => r.guestName.toLowerCase().includes(search.toLowerCase()));
    // Aralık modu konaklama aralığına göre filtreler, değilse tek tarih > check-in aralığı
    if (rangeMode && range.start && range.end) {
      list = list.filter(r => r.checkInDate <= range.end && r.checkOutDate >= range.start);
    } else if (selectedDate) {
      list = list.filter(r => r.checkInDate === selectedDate);
    } else if (range.start && range.end) {
      list = list.filter(r => r.checkInDate >= range.start && r.checkInDate <= range.end);
    }
    return list;
  }, [reservations, tab, today, tomorrow, weekEndStr, statusFilter, search, range, selectedDate, rangeMode]);

  const sorted = useMemo(() => {
    const toVal = (r: ReservationRecord, k: typeof sortBy) => {
      const v = r[k] as any;
      if (k === 'roomNumber') {
        const n = parseInt(String(v), 10);
        return isNaN(n) ? String(v) : n;
      }
      return v ?? '';
    };
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.slice().sort((a,b) => {
      const va = toVal(a, sortBy);
      const vb = toVal(b, sortBy);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (k: typeof sortBy) => {
    if (sortBy === k) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortDir('asc'); }
  };

  const allIds = sorted.map(r => r.id);
  const allSelected = selectedIds.length > 0 && selectedIds.length === allIds.length;
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };
  const clearSelection = () => setSelectedIds([]);

  const submit = () => {
    if (!form.guestName || !form.roomNumber || !form.checkInDate || !form.checkOutDate) return;
    addReservation({
      guestName: form.guestName!,
      roomNumber: form.roomNumber!,
      checkInDate: form.checkInDate!,
      checkOutDate: form.checkOutDate!,
      phone: form.phone,
      email: form.email,
      peopleCount: form.peopleCount,
      dailyRate: form.dailyRate,
      paymentState: form.paymentState,
      source: form.source,
      note: form.note,
      status: 'upcoming',
    });
    setForm({ checkInDate: today, checkOutDate: tomorrow });
  };

  const onCheckIn = (id: string) => { checkInReservation(id); };
  const onCancel = (id: string) => { updateReservationStatus(id, 'cancelled'); };
  const onComplete = (id: string) => { updateReservationStatus(id, 'completed'); };
  const onNoShow = (id: string) => { markNoShow(id); };

  const bulkCheckIn = () => { selectedIds.forEach(id => checkInReservation(id)); clearSelection(); };
  const bulkCancel = () => { selectedIds.forEach(id => updateReservationStatus(id, 'cancelled')); clearSelection(); };
  const bulkComplete = () => { selectedIds.forEach(id => updateReservationStatus(id, 'completed')); clearSelection(); };
  const bulkNoShow = () => { selectedIds.forEach(id => markNoShow(id)); clearSelection(); };

  const exportCSV = () => {
    const cols = ['id','roomNumber','guestName','checkInDate','checkOutDate','phone','email','peopleCount','dailyRate','paymentState','source','status','note'] as const;
    const rows = sorted.map(r => cols.map(c => {
      const v = (r as any)[c];
      const s = (v === undefined || v === null) ? '' : String(v);
      return '"' + s.replace(/"/g,'""') + '"';
    }).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reservations_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const head = `
      <style>
        body{ font-family: Arial, Helvetica, sans-serif; padding:16px; }
        h1{ font-size:18px; margin-bottom:12px; }
        table{ width:100%; border-collapse: collapse; font-size:12px; }
        th, td{ border:1px solid #ddd; padding:6px 8px; }
        th{ background:#f1f5f9; text-align:left; }
      </style>`;
    const cols = ['Oda','Misafir','Giriş','Çıkış','Durum'] as const;
    const rows = sorted.map(r => `<tr><td>${r.roomNumber}</td><td>${r.guestName}</td><td>${r.checkInDate}</td><td>${r.checkOutDate}</td><td>${r.status}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head>${head}</head><body><h1>Rezervasyonlar</h1><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const askAiRooms = () => {
    if (!form.checkInDate || !form.checkOutDate) return;
    const list = getAvailableRoomsForRange(form.checkInDate, form.checkOutDate);
    setAiRooms(list);
    if (list.length && !form.roomNumber) setForm(prev => ({...prev, roomNumber: list[0]}));
  };

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="diamond-band">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="icon-badge">📅</span>
              <div>
                <h1 className="band-title">Rezervasyonlar</h1>
                <p className="text-white/80 text-sm">Bugün, Yarın, Hafta ve Tamamlananlar</p>
                <div className="flex items-center gap-2 mt-3">
                  <button className={`btn-outline ${tab==='today'?'bg-white/20':''}`} onClick={()=>setTab('today')}>Bugün</button>
                  <button className={`btn-outline ${tab==='tomorrow'?'bg-white/20':''}`} onClick={()=>setTab('tomorrow')}>Yarın</button>
                  <button className={`btn-outline ${tab==='week'?'bg-white/20':''}`} onClick={()=>setTab('week')}>Bu Hafta</button>
                  <button className={`btn-outline ${tab==='completed'?'bg-white/20':''}`} onClick={()=>setTab('completed')}>Tamamlananlar</button>
                  <span className="mx-3 h-5 w-px bg-white/30 inline-block"/>
                  <button className={`btn-outline ${view==='cards'?'bg-white/20':''}`} onClick={()=>setView('cards')}>Kartlar</button>
                  <button className={`btn-outline ${view==='list'?'bg-white/20':''}`} onClick={()=>setView('list')}>Liste</button>
                </div>
              </div>
            </div>
            <div className="text-white/90">
              <div className="text-xs opacity-80">Toplam</div>
              <div className="text-lg font-semibold">{reservations.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler */}
      <div className="diamond-card p-4 mb-4">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-3">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">İsim arama</div>
            <input className="input form-base text-gray-900 w-full" placeholder="Misafir ismi" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Durum</div>
            <select className="input form-base text-gray-900" value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)}>
              <option value="all">Tümü</option>
              <option value="upcoming">Bekliyor</option>
              <option value="checked-in">Check-in</option>
              <option value="checked-in-pending">Onaylı</option>
              <option value="no-show">No-show</option>
              <option value="cancelled">İptal</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Tarih</div>
            <div className="flex items-center gap-2">
              <input className="input form-base text-gray-900" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
              <button className="btn-outline" onClick={()=>setSelectedDate(today)}>Bugün</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Tarih aralığı</div>
            <div className="flex items-center gap-2">
              <input className="input form-base text-gray-900" type="date" value={range.start} onChange={e=>setRange(prev=>({...prev, start: e.target.value}))}/>
              <span className="text-gray-500">→</span>
              <input className="input form-base text-gray-900" type="date" value={range.end} onChange={e=>setRange(prev=>({...prev, end: e.target.value}))}/>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300 mt-2">
              <input type="checkbox" checked={rangeMode} onChange={e=>setRangeMode(e.target.checked)} />
              Aralık modu (Konaklama aralığına göre)
            </label>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Dışa aktarma</div>
            <div className="flex items-center gap-2">
              <button className="btn-outline" onClick={exportCSV}>CSV</button>
              <button className="btn-outline" onClick={exportPDF}>PDF</button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Takvim eşikleri</div>
            <div className="flex items-center gap-2">
              <button className="btn-outline" onClick={()=>setShowThresholds(s=>!s)}>{showThresholds? 'Kapat' : 'Aç'}</button>
            </div>
          </div>
        </div>
        {showThresholds && (
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <span>Sarı ≥</span>
              <input className="input form-base text-gray-900 w-20" type="number" min={1} value={calendarThresholds.yellow}
                onChange={e=>{ const v = Math.max(1, Number(e.target.value||1)); const t={...calendarThresholds,yellow:v}; setCalendarThresholds(t); localStorage.setItem('diamond_calendar_thresholds', JSON.stringify(t)); }} />
            </div>
            <div className="flex items-center gap-2">
              <span>Kırmızı ≥</span>
              <input className="input form-base text-gray-900 w-20" type="number" min={2} value={calendarThresholds.red}
                onChange={e=>{ const v = Math.max(2, Number(e.target.value||2)); const t={...calendarThresholds,red:v}; setCalendarThresholds(t); localStorage.setItem('diamond_calendar_thresholds', JSON.stringify(t)); }} />
            </div>
            <span className="opacity-70">Yeşil: 1+</span>
          </div>
        )}
      </div>

      {/* Yeni rezervasyon formu */}
      <div className="diamond-card p-4 mb-6 relative overflow-hidden group">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-400/80 via-yellow-500/80 to-yellow-600/80 opacity-60 group-hover:w-1.5 transition-all"></div>
        <div className="absolute inset-y-0 left-0 w-12 animate-shimmer opacity-30 pointer-events-none"></div>
        <div className="flex items-center gap-2 mb-3 text-gray-700"><FaCalendarPlus/> <span className="font-semibold">Yeni Rezervasyon</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input className="input form-base text-gray-900" placeholder="Misafir adı" value={form.guestName||''} onChange={e=>setForm(prev=>({...prev, guestName: e.target.value}))}/>
          <select className="input form-base text-gray-900" value={form.roomNumber||''} onChange={e=>setForm(prev=>({...prev, roomNumber: e.target.value}))}>
            <option value="">Oda seçin</option>
            {(aiRooms.length ? aiRooms.map(n=>({number:n})) : rooms).map(r => <option key={r.number} value={r.number}>{r.number}</option>)}
          </select>
          <input className="input form-base text-gray-900" type="date" value={form.checkInDate||today} onChange={e=>setForm(prev=>({...prev, checkInDate: e.target.value}))}/>
          <input className="input form-base text-gray-900" type="date" value={form.checkOutDate||tomorrow} onChange={e=>setForm(prev=>({...prev, checkOutDate: e.target.value}))}/>
          <input className="input form-base text-gray-900" placeholder="Telefon" value={form.phone||''} onChange={e=>setForm(prev=>({...prev, phone: e.target.value}))}/>
          <input className="input form-base text-gray-900" placeholder="E-posta" value={form.email||''} onChange={e=>setForm(prev=>({...prev, email: e.target.value}))}/>
          <input className="input form-base text-gray-900" type="number" min={1} max={6} placeholder="Kişi sayısı" value={form.peopleCount||2} onChange={e=>setForm(prev=>({...prev, peopleCount: Number(e.target.value||2)}))}/>
          <input className="input form-base text-gray-900" type="number" min={0} step={50} placeholder="Günlük ücret ₺" value={form.dailyRate||''} onChange={e=>setForm(prev=>({...prev, dailyRate: Number(e.target.value||0)}))}/>
          <select className="input form-base text-gray-900" value={form.paymentState||'unpaid'} onChange={e=>setForm(prev=>({...prev, paymentState: e.target.value as any}))}>
            <option value="unpaid">Ödenmedi</option>
            <option value="deposit">Kapora</option>
            <option value="paid">Ödendi</option>
          </select>
          <select className="input form-base text-gray-900" value={form.source||'phone'} onChange={e=>setForm(prev=>({...prev, source: e.target.value}))}>
            <option value="phone">Telefon</option>
            <option value="otelz">OTEL Z</option>
            <option value="internet">İnternet</option>
            <option value="walk-in">Walk-in</option>
          </select>
          <input className="input form-base text-gray-900" placeholder="Not" value={form.note||''} onChange={e=>setForm(prev=>({...prev, note: e.target.value}))}/>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-diamond" onClick={submit}>Kaydet</button>
          <button className="btn-outline" onClick={askAiRooms}>AI Uygun Oda Öner</button>
          {aiRooms.length>0 && <span className="text-xs text-gray-600">Önerilen: {aiRooms.slice(0,5).join(', ')}</span>}
        </div>
      </div>

      {/* Liste + Mini Takvim düzeni */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {view === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="diamond-card p-4 relative overflow-hidden group">
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-400/80 via-yellow-500/80 to-yellow-600/80 opacity-60 group-hover:w-1.5 transition-all"></div>
                <div className="absolute inset-y-0 left-0 w-12 animate-shimmer opacity-30 pointer-events-none"></div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-primary-700"><FaClipboardList className="drop-shadow-sm"/> <span className="font-semibold">Oda {r.roomNumber}</span></div>
                  <span className={`diamond-pill ${r.status==='checked-in'?'badge-yellow':r.status==='cancelled'?'badge-red':r.status==='completed'?'badge-green':r.status==='no-show'?'badge-red':'badge-blue'}`}>
                    {r.status==='upcoming' && 'Bekliyor'}
                    {r.status==='checked-in' && 'Check-in'}
                    {r.status==='checked-in-pending' && 'Onaylı'}
                    {r.status==='cancelled' && 'İptal'}
                    {r.status==='completed' && 'Tamamlandı'}
                    {r.status==='no-show' && 'No-show'}
                  </span>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="flex items-center gap-2"><FaUser className="text-primary-600 drop-shadow-sm"/> <span>{r.guestName}</span></div>
                  <div className="flex items-center gap-2"><FaPhone className="text-primary-600 drop-shadow-sm"/> <span>{r.phone || '—'}</span></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Giriş: {r.checkInDate}</div>
                    <div>Çıkış: {r.checkOutDate}</div>
                  </div>
                  {(r.peopleCount || r.dailyRate || r.paymentState || r.source) && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      {typeof r.peopleCount !== 'undefined' && <div>Kişi: {r.peopleCount}</div>}
                      {typeof r.dailyRate !== 'undefined' && <div>Ücret: {r.dailyRate}₺</div>}
                      {r.paymentState && <div>Ödeme: {r.paymentState==='deposit'?'Kapora':r.paymentState==='paid'?'Ödendi':'Ödenmedi'}</div>}
                      {r.source && <div>Kaynak: {r.source}</div>}
                    </div>
                  )}
                  {r.note && <div className="text-xs text-gray-600">Not: {r.note}</div>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="btn-diamond" onClick={()=>onCheckIn(r.id)}><FaCalendarCheck/> Check-in</button>
                  <button className="btn-outline" onClick={()=>onCancel(r.id)}><FaCalendarTimes/> İptal</button>
                  <button className="btn-outline" onClick={()=>onComplete(r.id)}>Tamamla</button>
                  <button className="btn-outline" onClick={()=>onNoShow(r.id)}>No-show</button>
                </div>
              </div>
            ))}
            </div>
          )}
          {view === 'list' && (
            <div className="diamond-card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="text-xs text-white/80">{sorted.length} kayıt</div>
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">Seçili: {selectedIds.length}</span>
                    <button className="btn-outline" onClick={bulkCheckIn}>Toplu Check-in</button>
                    <button className="btn-outline" onClick={bulkCancel}>Toplu İptal</button>
                    <button className="btn-outline" onClick={bulkComplete}>Toplu Tamamla</button>
                    <button className="btn-outline" onClick={bulkNoShow}>Toplu No-show</button>
                    <button className="btn-outline" onClick={clearSelection}>Temizle</button>
                  </div>
                )}
              </div>
              <div className="diamond-table-head">
                <div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    <span>Seç</span>
                  </label>
                </div>
                <button className="text-left" onClick={()=>toggleSort('roomNumber')}>Oda {sortBy==='roomNumber' ? (sortDir==='asc'?'▲':'▼') : ''}</button>
                <button className="text-left" onClick={()=>toggleSort('guestName')}>Misafir {sortBy==='guestName' ? (sortDir==='asc'?'▲':'▼') : ''}</button>
                <button className="text-left" onClick={()=>toggleSort('checkInDate')}>Giriş {sortBy==='checkInDate' ? (sortDir==='asc'?'▲':'▼') : ''}</button>
                <button className="text-left" onClick={()=>toggleSort('checkOutDate')}>Çıkış {sortBy==='checkOutDate' ? (sortDir==='asc'?'▲':'▼') : ''}</button>
                <button className="text-left" onClick={()=>toggleSort('status')}>Durum {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</button>
                <div className="text-right">İşlem</div>
              </div>
              <div>
                {sorted.map(r => (
                  <div key={r.id} className="diamond-row">
                    <div>
                      <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={()=>toggleSelectOne(r.id)} />
                    </div>
                    <div>{r.roomNumber}</div>
                    <div className="truncate">{r.guestName}</div>
                    <div>{r.checkInDate}</div>
                    <div>{r.checkOutDate}</div>
                    <div>
                      <span className={`diamond-pill ${r.status==='checked-in'?'badge-yellow':r.status==='cancelled'?'badge-red':r.status==='completed'?'badge-green':r.status==='no-show'?'badge-red':'badge-blue'}`}>
                        {r.status==='upcoming' && 'Bekliyor'}
                        {r.status==='checked-in' && 'Check-in'}
                        {r.status==='checked-in-pending' && 'Onaylı'}
                        {r.status==='cancelled' && 'İptal'}
                        {r.status==='completed' && 'Tamamlandı'}
                        {r.status==='no-show' && 'No-show'}
                      </span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button className="btn-diamond" onClick={()=>onCheckIn(r.id)}>Check-in</button>
                      <button className="btn-outline" onClick={()=>onCancel(r.id)}>İptal</button>
                      <button className="btn-outline" onClick={()=>onComplete(r.id)}>Tamamla</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Mini takvim */}
        <div className="diamond-card p-4">
          <div className="font-semibold mb-2">30 Günlük Rezervasyon Takvimi</div>
          <MiniCalendar reservations={reservations} selectedDate={selectedDate} onSelectDate={setSelectedDate} thresholds={calendarThresholds} />
        </div>
      </div>
    </div>
  );
};

const MiniCalendar: React.FC<{reservations: ReservationRecord[]; selectedDate?: string; onSelectDate?: (d:string)=>void; thresholds?: {yellow:number; red:number}}> = ({ reservations, selectedDate, onSelectDate, thresholds }) => {
  const start = new Date(); start.setHours(0,0,0,0);
  const days = Array.from({length: 30}).map((_,i)=>{
    const d = new Date(start); d.setDate(d.getDate()+i);
    const key = d.toISOString().slice(0,10);
    const count = reservations.filter(r => r.checkInDate === key && r.status !== 'cancelled' && r.status !== 'no-show').length;
    return { date: key, day: d.getDate(), count };
  });
  const red = thresholds?.red ?? 5;
  const yellow = thresholds?.yellow ?? 3;
  const cellColor = (c:number) => c>=red ? 'bg-red-100 text-red-700' : c>=yellow ? 'bg-yellow-100 text-yellow-700' : c>0 ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500';
  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map(d => {
        const isSel = selectedDate === d.date;
        return (
          <button
            type="button"
            key={d.date}
            onClick={()=> onSelectDate && onSelectDate(d.date)}
            className={`rounded-md p-2 text-center transition ${cellColor(d.count)} ${isSel ? 'ring-2 ring-offset-2 ring-cyan-400' : ''}`}
            title={`${d.date} • ${d.count} rezervasyon`}
          >
            <div className="text-xs font-semibold">{d.day}</div>
            <div className="text-[10px] opacity-80">{d.count} rez.</div>
          </button>
        );
      })}
    </div>
  );
};

export default Reservations;