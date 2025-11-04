import React, { useEffect, useMemo, useState } from 'react';
import { FaStar, FaSmile, FaFrown, FaCommentDots } from 'react-icons/fa';

interface FeedbackEntry {
  id: string;
  roomNumber: string;
  rating: number;
  category?: string | null;
  comment?: string | null;
  forgotItem?: string | null;
  timestamp: string; // ISO
}

const FEEDBACK_KEY = 'hotel_feedback';

const numberTR = new Intl.NumberFormat('tr-TR');
const percentTR = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

const ManagementSatisfaction: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  const load = () => {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setFeedback(Array.isArray(arr) ? arr : []);
    } catch { setFeedback([]); }
  };

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener('guest-feedback-updated', onUpdate);
    const onStorage = (ev: StorageEvent) => { if (ev.key === FEEDBACK_KEY) load(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('guest-feedback-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const kpis = useMemo(() => {
    const total = feedback.length;
    const avg = total ? feedback.reduce((s, f) => s + (Number(f.rating) || 0), 0) / total : 0;
    const positives = feedback.filter(f => (f.rating || 0) >= 4).length;
    const negatives = feedback.filter(f => (f.rating || 0) <= 2).length;
    const positiveRate = total ? (positives / total) * 100 : 0;
    const forgotCount = feedback.filter(f => (f.forgotItem || '').trim() !== '').length;

    const byCategory: Record<string, number> = {};
    feedback.forEach(f => {
      const key = (f.category || 'Genel');
      byCategory[key] = (byCategory[key] || 0) + 1;
    });

    const recentComments = feedback
      .filter(f => (f.comment || '').trim() !== '')
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return { total, avg, positives, negatives, positiveRate, forgotCount, byCategory, recentComments };
  }, [feedback]);

  const formatDateTime = (iso: string) => {
    try { return new Date(iso).toLocaleString('tr-TR'); } catch { return iso; }
  };

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-blue">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center"><FaStar className="mr-2"/> Müşteri Memnuniyeti</h1>
              <p className="text-white/80 text-sm">Geri bildirimler, ortalamalar ve kategoriler</p>
            </div>
            <div className="bg-white/15 backdrop-blur px-4 py-2 rounded-lg text-right">
              <div className="text-xs opacity-80">Toplam Geri Bildirim</div>
              <div className="text-lg font-semibold">{numberTR.format(kpis.total)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="premium-card p-4 border border-indigo-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Ortalama Puan</span>
            <FaStar className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">{kpis.avg.toFixed(1)}</div>
        </div>
        <div className="premium-card p-4 border border-green-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Pozitif Oran</span>
            <FaSmile className="text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">%{percentTR.format(kpis.positiveRate)}</div>
        </div>
        <div className="premium-card p-4 border border-red-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Negatif Adet</span>
            <FaFrown className="text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">{numberTR.format(kpis.negatives)}</div>
        </div>
        <div className="premium-card p-4 border border-yellow-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Unutulan Eşya Bildirimleri</span>
            <FaCommentDots className="text-yellow-600" />
          </div>
          <div className="mt-2 text-2xl font-bold">{numberTR.format(kpis.forgotCount)}</div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold mb-4">Kategori Dağılımı</h2>
          <div className="space-y-2">
            {Object.keys(kpis.byCategory).length === 0 && (
              <div className="text-sm text-gray-600">Henüz veri yok.</div>
            )}
            {Object.entries(kpis.byCategory).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between border-b py-2">
                <span className="text-gray-700">{cat}</span>
                <span className="text-gray-900 font-semibold">{numberTR.format(count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Comments */}
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold mb-4">Son Yorumlar</h2>
          <ul className="space-y-3">
            {kpis.recentComments.length === 0 && (
              <li className="text-sm text-gray-600">Yorum bulunamadı.</li>
            )}
            {kpis.recentComments.map((f) => (
              <li key={f.id} className="border rounded p-3">
                <div className="text-xs text-gray-500 mb-1">Oda {f.roomNumber} • {formatDateTime(f.timestamp)}</div>
                <div className="text-sm text-gray-800">{f.comment}</div>
                <div className="mt-1 text-xs text-gray-600">Puan: {f.rating} {f.category ? `• ${f.category}` : ''}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ManagementSatisfaction;