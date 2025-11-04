import React, { useEffect, useMemo, useState } from 'react';
import { JobApplication, getApplications, updateApplication, addApplication } from '../utils/applications';
import { Staff, upsertStaff } from '../utils/staff';
import GoldModal from '../components/GoldModal';
import { FaPlus } from 'react-icons/fa';

const Applications: React.FC = () => {
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all'|'new'|'accepted'|'rejected'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Partial<JobApplication>>({ name: '', department: 'Reception', position: '', phone: '', email: '', cvUrl: '', note: '' });

  const load = () => setApps(getApplications());
  useEffect(() => {
    load();
    const onUpd = () => load();
    window.addEventListener('applications-updated', onUpd as EventListener);
    return () => window.removeEventListener('applications-updated', onUpd as EventListener);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return apps.filter(a => {
      const okTerm = term === '' || a.name.toLocaleLowerCase('tr-TR').includes(term) || (a.position||'').toLocaleLowerCase('tr-TR').includes(term);
      const okStatus = status==='all' || a.status === status;
      return okTerm && okStatus;
    });
  }, [apps, search, status]);

  const accept = (a: JobApplication) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const staff: Staff = {
      id,
      name: a.name,
      department: (a.department as any) || 'Other',
      position: a.position,
      status: 'active',
      employmentType: 'full-time',
      startDate: new Date().toISOString().slice(0,10),
      phone: a.phone,
      email: a.email,
      notes: a.note,
    };
    upsertStaff(staff);
    try { window.dispatchEvent(new Event('staff-updated')); } catch {}
    updateApplication(a.id, { status: 'accepted' });
    load();
    alert('Başvuru kabul edildi ve personel listesine eklendi.');
  };

  const reject = (a: JobApplication) => {
    updateApplication(a.id, { status: 'rejected' });
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="diamond-band">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">İş Başvuruları</h1>
            <p className="text-white/80 text-sm">Başvuruları inceleyin, kabul/ret işlemleri yapın.</p>
          </div>
          <button onClick={()=>{ setDraft({ name: '', department: 'Reception', position: '', phone: '', email: '', cvUrl: '', note: '' }); setShowCreate(true); }} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 inline-flex items-center gap-2"><FaPlus/> Başvuru Ekle</button>
        </div>
      </div>

      <div className="gold-glass-surface rounded-2xl p-3 border border-amber-300/20 mb-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Ara: ad/pozisyon" className="px-3 py-2 rounded bg-white text-gray-900" />
          <select className="px-3 py-2 rounded bg-white text-gray-900" value={status} onChange={(e)=>setStatus(e.target.value as any)}>
            <option value="all">Durum: Tümü</option>
            <option value="new">Yeni</option>
            <option value="accepted">Kabul</option>
            <option value="rejected">Ret</option>
          </select>
          <div className="hidden md:block"></div>
          <button onClick={()=>{ setDraft({ name: '', department: 'Reception', position: '', phone: '', email: '', cvUrl: '', note: '' }); setShowCreate(true); }} className="px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700">Başvuru Ekle</button>
        </div>
      </div>

      <div className="gold-glass-surface rounded-2xl p-4 border border-amber-300/20 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/80 border-b border-amber-300/20">
              <th className="py-2">Ad</th>
              <th className="py-2">Pozisyon</th>
              <th className="py-2">İletişim</th>
              <th className="py-2">Başvuru</th>
              <th className="py-2">Durum</th>
              <th className="py-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-white/10 hover:bg-white/5">
                <td className="py-2 text-white">{a.name}</td>
                <td className="py-2 text-white/90">{a.department || '-'} {a.position ? `• ${a.position}` : ''}</td>
                <td className="py-2 text-white/80">{a.phone || '-'} {a.email ? `• ${a.email}` : ''}</td>
                <td className="py-2 text-white/70">{new Date(a.createdAt).toLocaleString('tr-TR')}</td>
                <td className="py-2 text-white/80">{a.status}</td>
                <td className="py-2 text-right">
                  {a.status === 'new' ? (
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={()=>accept(a)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white">Kabul</button>
                      <button onClick={()=>reject(a)} className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white">Ret</button>
                    </div>
                  ) : (
                    <span className="text-white/60">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-white/60">Başvuru bulunmuyor.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Başvuru Ekle Popup */}
      <GoldModal open={showCreate} onClose={()=>setShowCreate(false)} title="Başvuru Ekle">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div className="text-white/70 text-xs mb-1">Ad Soyad</div>
              <input className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.name || ''} onChange={(e)=>setDraft(prev=>({...prev, name: e.target.value}))} />
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">Pozisyon</div>
              <input className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.position || ''} onChange={(e)=>setDraft(prev=>({...prev, position: e.target.value}))} />
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">Departman</div>
              <select className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.department || 'Reception'} onChange={(e)=>setDraft(prev=>({...prev, department: e.target.value}))}>
                <option value="Reception">Reception</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Technical">Technical</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">Telefon</div>
              <input className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.phone || ''} onChange={(e)=>setDraft(prev=>({...prev, phone: e.target.value}))} />
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">E-posta</div>
              <input className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.email || ''} onChange={(e)=>setDraft(prev=>({...prev, email: e.target.value}))} />
            </div>
            <div>
              <div className="text-white/70 text-xs mb-1">CV URL</div>
              <input className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.cvUrl || ''} onChange={(e)=>setDraft(prev=>({...prev, cvUrl: e.target.value}))} placeholder="https://..." />
            </div>
          </div>
          <div>
            <div className="text-white/70 text-xs mb-1">Not</div>
            <textarea className="w-full px-3 py-2 rounded bg-white text-gray-900" value={draft.note || ''} onChange={(e)=>setDraft(prev=>({...prev, note: e.target.value}))} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setShowCreate(false)} className="px-3 py-2 rounded bg-gray-200 text-gray-800 text-sm hover:bg-gray-300">İptal</button>
            <button
              onClick={()=>{
                const name = (draft.name||'').trim();
                if (!name) { alert('Ad zorunlu.'); return; }
                addApplication({ name, phone: draft.phone, email: draft.email, position: draft.position, department: draft.department, cvUrl: draft.cvUrl, note: draft.note });
                setShowCreate(false);
                setDraft({ name: '', department: 'Reception', position: '', phone: '', email: '', cvUrl: '', note: '' });
                load();
                alert('Başvuru eklendi.');
              }}
              className="px-3 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
            >Kaydet</button>
          </div>
        </div>
      </GoldModal>
    </div>
  );
};

export default Applications;