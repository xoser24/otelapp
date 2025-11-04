import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FaTachometerAlt, FaBed, FaUsers, FaChartBar, FaCog, FaBell, FaSignOutAlt, FaSuitcase, FaComments, FaChartLine, FaCalendarCheck, FaLeaf, FaClock } from 'react-icons/fa';
// Logo kaldırıldı: yalnızca login ekranında görsel kullanılacak

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const [notifCount, setNotifCount] = useState(0);
  const [hotelName, setHotelName] = useState<string>('Otel Yönetim');
  const [hotelLogoUrl, setHotelLogoUrl] = useState<string | null>(null);

  const [chatAlert, setChatAlert] = useState<{ room?: string; text?: string } | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('notifications');
        const arr = raw ? JSON.parse(raw) : [];
        const unread = Array.isArray(arr) ? arr.filter((n: any) => n.status === 'unread').length : 0;
        setNotifCount(unread);
      } catch {}
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('notificationsUpdated', onUpdate);
    window.addEventListener('storage', (ev) => { if (ev.key === 'notifications') load(); });
    return () => { window.removeEventListener('notificationsUpdated', onUpdate); };
  }, []);

  // Otel adını, logosunu ve marka rengini localStorage'dan oku ve değişiklikleri izle
  useEffect(() => {
    const readBranding = () => {
      try {
        const name = localStorage.getItem('hotel_name') || 'Otel Yönetim';
        const logo = localStorage.getItem('hotel_logo_url');
        setHotelName(name);
        setHotelLogoUrl(logo);
      } catch {
        setHotelName('Otel Yönetim');
        setHotelLogoUrl(null);
      }
    };
    readBranding();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key || ev.key === 'hotel_name' || ev.key === 'hotel_logo_url' || ev.key === 'brand_color') {
        readBranding();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);

  // Yeni misafir mesajında sayfa bağımsız merkez uyarı
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      try {
        const key = ev.key || '';
        if (!key) return;
        // Chat history anahtarı pattern: hotel:chat:room:<ROOM>:history
        const prefix = 'hotel:chat:room:';
        const suffix = ':history';
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) return;
        const room = key.slice(prefix.length, key.length - suffix.length);
        const val = ev.newValue || localStorage.getItem(key) || '';
        if (!val) return;
        const arr = JSON.parse(val);
        if (!Array.isArray(arr) || arr.length === 0) return;
        const last = arr[arr.length - 1];
        if (!last || !last.isGuest) return;
        const lastTs: string = last.timestamp;
        const seenRaw = localStorage.getItem('hotel:admin:last_seen_chats');
        const seenMap = seenRaw ? JSON.parse(seenRaw) : {};
        const prevTs: string | undefined = seenMap[room];
        if (prevTs === lastTs) return; // aynı mesajı tekrar gösterme
        // Uyarıyı göster ve son görüleni güncelle
        setChatAlert({ room, text: last.message });
        seenMap[room] = lastTs;
        localStorage.setItem('hotel:admin:last_seen_chats', JSON.stringify(seenMap));
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('storage', onStorage); };
  }, []);
  
  const menuItems = [
    { path: '/admin', icon: <FaTachometerAlt />, title: 'Dashboard' },
    { path: '/admin/rooms', icon: <FaBed />, title: 'Odalar' },
    { path: '/admin/reservations', icon: <FaCalendarCheck />, title: 'Rezervasyonlar' },
    { path: '/admin/guests', icon: <FaUsers />, title: 'Misafirler' },
    { path: '/admin/chat', icon: <FaComments />, title: 'Sohbet' },
    { path: '/admin/notifications', icon: <FaBell />, title: 'Bildirimler' },
    { path: '/admin/applications', icon: <FaSuitcase />, title: 'İş Başvuruları' },
    { path: '/admin/lost-and-found', icon: <FaSuitcase />, title: 'Unutulan Eşya' },
    { path: '/admin/reports', icon: <FaChartBar />, title: 'Raporlar' },
    { path: '/admin/cleaning-reports', icon: <FaClock />, title: 'Temizlik Süreleri' },
    { path: '/admin/maintenance', icon: <FaSuitcase />, title: 'Arıza Kayıtları' },
    { path: '/admin/personnel', icon: <FaUsers />, title: 'Personel Takip' },
    { path: '/admin/settings', icon: <FaCog />, title: 'Ayarlar' },
    { path: '/admin/sustainability', icon: <FaLeaf />, title: 'Sürdürülebilirlik' },
    { path: '/admin/management', icon: <FaChartLine />, title: 'Yönetim' },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-b from-[#0c0c0f] via-[#0a0a0d] to-[#0c0c0f] bg-gold-glass animate-fade-in">
      {/* Sidebar */}
      <div className={`gold-glass-surface border-r border-amber-400/25 text-white ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center">
              {hotelLogoUrl && (
                <img src={hotelLogoUrl} alt="Logo" className="w-8 h-8 rounded-md object-cover border border-amber-400/30 mr-2" />
              )}
              <h1 className="text-xl font-bold text-white truncate max-w-[140px]">{hotelName}</h1>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded-full hover:bg-white/20 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>
        
        <nav className="mt-5">
          <ul className="space-y-2 px-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition ${
                    location.pathname === item.path 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-3">{item.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="absolute bottom-0 w-full p-4">
          <Link
            to="/login"
            className={`flex items-center p-3 rounded-lg text-white/80 hover:bg-white/10 transition`}
          >
            <span className="text-lg"><FaSignOutAlt /></span>
            {sidebarOpen && <span className="ml-3">Çıkış Yap</span>}
          </Link>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="diamond-band animate-fade-in-delayed">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              {/* logo kaldırıldı */}
              <h2 className="text-xl font-semibold text-white">
                {menuItems.find(item => item.path === location.pathname)?.title || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <Link to="/admin/notifications" className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none relative">
                <FaBell />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-5 px-1 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                    {notifCount}
                  </span>
                )}
              </Link>
              <div className="flex items-center px-3 py-1 rounded-lg bg-black/20 border border-white/10">
                {hotelLogoUrl && (
                  <img src={hotelLogoUrl} alt="Logo" className="w-6 h-6 rounded-sm object-cover border border-white/10 mr-2" />
                )}
                <span className="text-sm font-medium truncate max-w-[200px] text-white/90">{hotelName}</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-transparent">
          <Outlet />
        </main>

        {/* Global Chat Alert Overlay */}
        {chatAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setChatAlert(null)} />
            <div className="relative premium-card max-w-md w-[90%] p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Misafir Mesaj İsteği</h3>
              <p className="text-sm text-gray-800 mb-2">Oda {chatAlert.room} tarafından yeni mesaj gönderildi.</p>
              {chatAlert.text && (
                <div className="mb-4 p-3 rounded bg-gray-100 text-gray-800 text-sm">{chatAlert.text}</div>
              )}
              <div className="flex justify-center">
                <button
                  onClick={() => setChatAlert(null)}
                  className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLayout;