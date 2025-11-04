import React, { useEffect, useMemo, useState } from 'react';

type MaintenanceReport = {
  id: string;
  roomNumber?: string;
  note?: string;
  image?: string; // data URL
  timestamp?: string; // ISO string
  status?: 'open' | 'closed' | 'resolved' | string;
  resolved?: boolean;
};

const MAINTENANCE_KEY = 'maintenance_reports';

const readReports = (): MaintenanceReport[] => {
  try {
    const raw = localStorage.getItem(MAINTENANCE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
};

const writeReports = (reports: MaintenanceReport[]) => {
  try {
    localStorage.setItem(MAINTENANCE_KEY, JSON.stringify(reports));
    // notify others
    window.dispatchEvent(new StorageEvent('storage', { key: MAINTENANCE_KEY } as any));
  } catch {}
};

const statusIsResolved = (r: MaintenanceReport) => {
  const s = r.status || '';
  return r.resolved === true || s === 'closed' || s === 'resolved';
};

const MaintenanceReports: React.FC = () => {
  const [reports, setReports] = useState<MaintenanceReport[]>(readReports());
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === MAINTENANCE_KEY) {
        setReports(readReports());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const sortedReports = useMemo(() => {
    const arr = [...reports];
    arr.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    return arr;
  }, [reports]);

  const filtered = useMemo(() => {
    if (filter === 'open') return sortedReports.filter(r => !statusIsResolved(r));
    if (filter === 'resolved') return sortedReports.filter(r => statusIsResolved(r));
    return sortedReports;
  }, [sortedReports, filter]);

  const openCount = useMemo(() => reports.filter(r => !statusIsResolved(r)).length, [reports]);
  const resolvedCount = useMemo(() => reports.filter(r => statusIsResolved(r)).length, [reports]);

  const toggleResolve = (id: string) => {
    setReports(prev => {
      const next: MaintenanceReport[] = prev.map(r => {
        if (r.id === id) {
          const willResolve = !statusIsResolved(r);
          const nextStatus: 'closed' | 'open' = willResolve ? 'closed' : 'open';
          return { ...r, resolved: willResolve, status: nextStatus } as MaintenanceReport;
        }
        return r as MaintenanceReport;
      });
      writeReports(next);
      return next;
    });
  };

  const removeReport = (id: string) => {
    setReports(prev => {
      const next = prev.filter(r => r.id !== id);
      writeReports(next);
      return next;
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-yellow">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="icon-badge">🛠️</span>
              <div>
                <h1 className="band-title">Arıza Kayıtları</h1>
                <p className="text-white/80 text-sm">Oda bazlı arıza bildirimlerini listele ve yönet</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Açık</div>
                <div className="text-lg font-semibold">{openCount}</div>
              </div>
              <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">Çözülen</div>
                <div className="text-lg font-semibold">{resolvedCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="premium-card p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Filtre:</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filter} onChange={e => setFilter(e.target.value as any)}>
              <option value="all">Tümü</option>
              <option value="open">Açık</option>
              <option value="resolved">Çözülen</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">Toplam kayıt: {reports.length}</div>
        </div>
      </div>

      {/* List */}
      <div className="premium-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Oda</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Not</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Görsel</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tarih</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Durum</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Kayıt bulunamadı</td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-800">{r.roomNumber || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 break-words max-w-xs">{r.note || ''}</td>
                    <td className="px-4 py-2">
                      {r.image ? (
                        <img src={r.image} alt="Arıza" className="h-12 w-12 object-cover rounded" />
                      ) : (
                        <span className="text-xs text-gray-400">Yok</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">
                      {statusIsResolved(r) ? (
                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">Çözüldü</span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs">Açık</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleResolve(r.id)} className={`px-2.5 py-1 rounded-lg text-white text-xs ${statusIsResolved(r) ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>
                          {statusIsResolved(r) ? 'Yeniden Aç' : 'Çözüldü İşaretle'}
                        </button>
                        <button onClick={() => removeReport(r.id)} className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs">Sil</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceReports;