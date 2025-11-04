import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBed, FaCheck, FaClock, FaBroom, FaExclamationTriangle, FaUsers, FaBell, FaChartBar } from 'react-icons/fa';

type Task = {
  id: number;
  roomNumber: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  checkOut: boolean;
  lateCheckOut: boolean;
  estimatedTime: number;
  notes?: string;
};

const sampleTasks: Task[] = [
  { id: 1, roomNumber: '302', status: 'pending', priority: 'high', checkOut: true, lateCheckOut: false, estimatedTime: 14, notes: 'Check-out temizliği' },
  { id: 2, roomNumber: '215', status: 'in_progress', priority: 'medium', checkOut: false, lateCheckOut: false, estimatedTime: 10, notes: 'Günlük temizlik' },
  { id: 3, roomNumber: '118', status: 'completed', priority: 'low', checkOut: false, lateCheckOut: false, estimatedTime: 12, notes: 'Günlük temizlik' },
  { id: 4, roomNumber: '305', status: 'pending', priority: 'medium', checkOut: false, lateCheckOut: true, estimatedTime: 15, notes: 'Geç çıkış yapacak' },
  { id: 5, roomNumber: '401', status: 'pending', priority: 'high', checkOut: true, lateCheckOut: false, estimatedTime: 18, notes: 'VIP misafir check-out' },
];

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: 'housekeeping' | 'maintenance' | 'reception' | 'room_service' | 'system';
  priority: 'high' | 'medium' | 'low';
  status: 'unread' | 'read';
  recipient: string;
  timestamp: string;
};

const HousekeepingDashboard: React.FC = () => {
  const [tasks] = useState<Task[]>(sampleTasks);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hotelName, setHotelName] = useState<string>('Kent Otel');
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('notifications');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setNotifications(arr);
    } catch {}
    // Branding
    try {
      const name = localStorage.getItem('hotel_name') || 'Kent Otel';
      const logo = localStorage.getItem('hotel_logo_url');
      setHotelName(name);
      setHotelLogoUrl(logo);
    } catch {
      setHotelName('Kent Otel');
      setHotelLogoUrl(null);
    }
  }, []);

  const total = tasks.length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const checkOutCount = tasks.filter(t => t.checkOut).length;
  const lateCheckOutCount = tasks.filter(t => t.lateCheckOut).length;
  const avgTime = Math.round(tasks.reduce((acc, t) => acc + t.estimatedTime, 0) / tasks.length);

  const urgentNotifications = notifications
    .filter(n => (n.type === 'housekeeping' || n.type === 'maintenance') && n.priority === 'high')
    .slice(0, 5);

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="diamond-band">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              {hotelLogoUrl ? (
                <img src={hotelLogoUrl} alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
              ) : (
                <img src="/logo192.png" alt={hotelName} className="h-8 w-auto rounded bg-white/10 p-1" />
              )}
              <div>
                <h1 className="band-title flex items-center gap-2"><span className="icon-badge animate-float">🧹</span> {hotelName}</h1>
                <p className="text-white/80 text-sm">Anlık durum ve görev özetleri</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/housekeeping/tasks" className="btn-outline hover-tilt">Görevler</Link>
              <Link to="/housekeeping/rooms" className="btn-outline hover-tilt">Odalar</Link>
              <Link to="/housekeeping/notifications" className="btn-outline hover-tilt">Bildirimler</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Görev Durumu Çubuk Grafiği */}
      <div className="diamond-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/80">Görev Durumu</span>
          <span className="text-sm text-white/70">Toplam: {total}</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden flex">
          <div className="h-4 bg-yellow-500" style={{ width: `${Math.round((pending / (total || 1)) * 100)}%` }} />
          <div className="h-4 bg-blue-500" style={{ width: `${Math.round((inProgress / (total || 1)) * 100)}%` }} />
          <div className="h-4 bg-green-600" style={{ width: `${Math.round((completed / (total || 1)) * 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-white/70 mt-2">
          <span>Bekleyen: {pending}</span>
          <span>Devam Eden: {inProgress}</span>
          <span>Tamamlanan: {completed}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Toplam Görev</span>
            <FaChartBar className="text-primary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{total}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Bekleyen</span>
            <FaClock className="text-yellow-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{pending}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Devam Eden</span>
            <FaBroom className="text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{inProgress}</div>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Tamamlanan</span>
            <FaCheck className="text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{completed}</div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Check-out Odalar</span>
            <FaBed className="text-primary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{checkOutCount}</div>
          <p className="text-sm text-white/70 mt-1">Önceliklendirme önerilir</p>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Geç Çıkış Yapacak</span>
            <FaClock className="text-secondary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{lateCheckOutCount}</div>
          <p className="text-sm text-white/70 mt-1">Planlamayı buna göre güncelleyin</p>
        </div>
        <div className="diamond-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-white/80">Ortalama Süre</span>
            <FaUsers className="text-primary-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{avgTime} dk</div>
          <p className="text-sm text-white/70 mt-1">Günlük performans</p>
        </div>
      </div>

      {/* Urgent Notifications */}
      <div className="diamond-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center"><FaBell className="mr-2 text-primary-600" />Önemli Bildirimler</h2>
          <a href="/housekeeping/notifications" className="text-primary-600 hover:text-primary-700">Tüm Bildirimler</a>
        </div>
        {urgentNotifications.length === 0 ? (
          <p className="text-gray-600">Önemli bildirim bulunmuyor.</p>
        ) : (
          <ul className="divide-y">
            {urgentNotifications.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FaExclamationTriangle className="text-red-600 mr-2" />
                    <div>
                      <p className="font-semibold">{n.title}</p>
                      <p className="text-sm text-gray-600">{n.message}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleString('tr-TR')}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sustainability Tips */}
      <div className="premium-card p-6 mb-6 animate-fade-in">
        <h2 className="text-lg font-bold mb-3">Sürdürülebilirlik İpuçları</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-primary-100 rounded-lg">
            <div className="font-semibold mb-1">Havlu Yeniden Kullanımı</div>
            <p className="text-sm text-gray-600">Misafir havlularını askıda buluyorsanız değiştirmeyin; yere bırakılanları değiştirin.</p>
          </div>
          <div className="p-4 border border-blue-100 rounded-lg">
            <div className="font-semibold mb-1">Su Tasarrufu</div>
            <p className="text-sm text-gray-600">Muslukları kısa süreli kullanın, gereksiz akışı kapatın; düşük akışlı başlıkları tercih edin.</p>
          </div>
          <div className="p-4 border border-green-100 rounded-lg">
            <div className="font-semibold mb-1">Enerji Verimliliği</div>
            <p className="text-sm text-gray-600">Oda boşken ışıkları ve klimaları kapatın; perdeleri gündüz açık bırakın.</p>
          </div>
          <div className="p-4 border border-purple-100 rounded-lg">
            <div className="font-semibold mb-1">Atık Ayrıştırma</div>
            <p className="text-sm text-gray-600">Geri dönüştürülebilir atıkları ayrı toplayın; tehlikeli atıkları bildirin.</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex space-x-3">
        <a href="/housekeeping/tasks" className="bg-primary-600 text-white py-2 px-4 rounded hover:bg-primary-700">Görev Listesine Git</a>
        <a href="/housekeeping/rooms" className="bg-secondary-700 text-white py-2 px-4 rounded hover:bg-secondary-800">Odaları Gör</a>
      </div>
    </div>
  );
};

export default HousekeepingDashboard;