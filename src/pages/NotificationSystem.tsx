import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FaBell, FaEnvelope, FaMobile, FaCheck, FaTimes, FaFilter, FaSearch, FaStar, FaRegStar, FaSort, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import { pushNotification } from '../utils/notifications';
const CHAT_PREFIX = 'hotel:chat:room:';
const CHAT_SUFFIX = ':history';

// Örnek veri
const initialNotifications = [
  {
    id: 1,
    title: 'Oda 302 temizlik talebi',
    message: 'Misafir acil temizlik talep ediyor',
    type: 'housekeeping',
    priority: 'high',
    status: 'unread',
    recipient: 'housekeeping',
    timestamp: '2023-06-15T10:30:00',
    actions: ['assign', 'dismiss']
  },
  {
    id: 2,
    title: 'VIP misafir check-in',
    message: 'Sn. Ahmet Yılmaz (Oda 501) 15 dakika içinde varış yapacak',
    type: 'reception',
    priority: 'high',
    status: 'read',
    recipient: 'reception',
    timestamp: '2023-06-15T09:45:00',
    actions: ['acknowledge']
  },
  {
    id: 3,
    title: 'Oda 118 minibar talebi',
    message: 'Misafir ekstra su ve çikolata talep ediyor',
    type: 'room_service',
    priority: 'medium',
    status: 'unread',
    recipient: 'room_service',
    timestamp: '2023-06-15T11:15:00',
    actions: ['assign', 'dismiss']
  },
  {
    id: 4,
    title: 'Sistem güncellemesi',
    message: 'Sistem bu gece 02:00-04:00 arası bakımda olacak',
    type: 'system',
    priority: 'low',
    status: 'unread',
    recipient: 'all',
    timestamp: '2023-06-15T08:00:00',
    actions: ['acknowledge']
  },
  {
    id: 5,
    title: 'Oda 215 arıza bildirimi',
    message: 'Klima çalışmıyor, misafir acil müdahale bekliyor',
    type: 'maintenance',
    priority: 'high',
    status: 'read',
    recipient: 'maintenance',
    timestamp: '2023-06-15T07:30:00',
    actions: ['assign', 'dismiss']
  }
];

// Örnek şablonlar
const notificationTemplates = [
  {
    id: 1,
    title: 'Temizlik Talebi',
    message: '[ODA_NO] numaralı oda için temizlik talebi',
    type: 'housekeeping',
    priority: 'medium',
    recipient: 'housekeeping'
  },
  {
    id: 2,
    title: 'VIP Misafir Bildirimi',
    message: '[MISAFIR_ADI] ([ODA_NO]) [ZAMAN] içinde varış yapacak',
    type: 'reception',
    priority: 'high',
    recipient: 'reception'
  },
  {
    id: 3,
    title: 'Arıza Bildirimi',
    message: '[ODA_NO] numaralı odada [ARIZA_TIPI] arızası',
    type: 'maintenance',
    priority: 'high',
    recipient: 'maintenance'
  }
];

const NotificationSystem: React.FC = () => {
  const LOCAL_KEY = 'notifications';
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  // Yeni filtre ve sıralama durumları
  const [statusFilter, setStatusFilter] = useState<'all'|'unread'|'read'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all'|'high'|'medium'|'low'>('all');
  const [sortKey, setSortKey] = useState<'timestamp'|'priority'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc');
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastIdRef = useRef<number>(0);
  const didInitRef = useRef<boolean>(false);
  
  // Yeni bildirim oluşturma state'leri
  const [showNewNotificationForm, setShowNewNotificationForm] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'housekeeping',
    priority: 'medium',
    recipient: 'housekeeping'
  });
  
  // Bildirim filtreleme ve sıralama (gelişmiş)
  const filteredNotifications = React.useMemo(() => {
    let list = [...notifications];
    if (activeTab !== 'all') list = list.filter(n => n.type === activeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') list = list.filter(n => n.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(n => n.priority === priorityFilter);
    list.sort((a, b) => {
      // Sabitlenenler önce
      const ap = pinnedIds.includes(a.id) ? 1 : 0;
      const bp = pinnedIds.includes(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      if (sortKey === 'priority') {
        const orderMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const diff = (orderMap[b.priority] || 0) - (orderMap[a.priority] || 0);
        return sortOrder === 'asc' ? -diff : diff;
      } else {
        const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        return sortOrder === 'asc' ? -diff : diff;
      }
    });
    return list;
  }, [notifications, activeTab, searchQuery, statusFilter, priorityFilter, sortKey, sortOrder, pinnedIds]);
  
  // Özet metrikler
  const unreadCount = React.useMemo(() => notifications.filter(n => n.status === 'unread').length, [notifications]);
  const highPriorityCount = React.useMemo(() => notifications.filter(n => n.priority === 'high').length, [notifications]);
  const todayCount = React.useMemo(() => notifications.filter(n => {
    const t = new Date(n.timestamp);
    const now = new Date();
    return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  }).length, [notifications]);
  
  // LocalStorage'dan yükle ve değişiklikleri dinle
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
          try { lastIdRef.current = parsed.length ? Math.max(...parsed.map((n: any) => n.id)) : 0; } catch {}
          didInitRef.current = true;
        }
      } else {
        // İlk kez açılıyorsa örnek veriyi yaz
        localStorage.setItem(LOCAL_KEY, JSON.stringify(initialNotifications));
        try { lastIdRef.current = initialNotifications.length ? Math.max(...initialNotifications.map((n: any) => n.id)) : 0; } catch {}
        didInitRef.current = true;
      }
    } catch (e) {
      // noop
    }
    const handleExternalUpdate = () => {
      try {
        const raw2 = localStorage.getItem(LOCAL_KEY);
        const arr = raw2 ? JSON.parse(raw2) : [];
        if (Array.isArray(arr)) setNotifications(arr);
      } catch {}
    };
    window.addEventListener('notificationsUpdated', handleExternalUpdate);
    window.addEventListener('storage', (ev) => {
      if (ev.key === LOCAL_KEY) handleExternalUpdate();
    });
    return () => {
      window.removeEventListener('notificationsUpdated', handleExternalUpdate);
    };
  }, []);

  // Yeni bildirim sesi
  const playNotificationSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      // Vurgulu iki aşamalı uyarı: keskin square + kısa triangle
      const osc1 = ctx.createOscillator();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(1200, ctx.currentTime);
      osc1.connect(gain);
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(900, ctx.currentTime + 0.09);
      osc2.connect(gain);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc1.start();
      osc2.start(ctx.currentTime + 0.09);
      osc1.stop(ctx.currentTime + 0.34);
      osc2.stop(ctx.currentTime + 0.34);
    } catch {}
  };

  // Liste değişince yeni kayıt varsa sesi çal
  useEffect(() => {
    const maxId = notifications.length ? Math.max(...notifications.map(n => n.id)) : 0;
    if (didInitRef.current && maxId > (lastIdRef.current || 0)) {
      if (soundEnabled) playNotificationSound();
    }
    lastIdRef.current = maxId;
  }, [notifications, soundEnabled]);

  // Değiştikçe LocalStorage'a yaz
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  // Bildirim durumunu güncelle
  const updateNotificationStatus = (id: number, status: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, status } : notification
    ));
  };
  
  // Yeni bildirim oluştur
  const createNotification = () => {
    pushNotification({
      title: newNotification.title,
      message: newNotification.message,
      type: newNotification.type as any,
      priority: newNotification.priority as any,
      recipient: newNotification.recipient as any,
    });
    setShowNewNotificationForm(false);
    setNewNotification({
      title: '',
      message: '',
      type: 'housekeeping',
      priority: 'medium',
      recipient: 'housekeeping'
    });
  };
  
  // Şablon seç
  const selectTemplate = (templateId: number) => {
    const template = notificationTemplates.find(t => t.id === templateId);
    if (template) {
      setNewNotification({
        title: template.title,
        message: template.message,
        type: template.type,
        priority: template.priority,
        recipient: template.recipient
      });
    }
  };
  
  return (
    <div className="p-6 space-y-4">
      <div className="diamond-band">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="icon-badge animate-float">🔔</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Bildirimler</h1>
              <p className="text-white/80 text-sm">Filtrele, oluştur ve yönet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/notifications" className="px-3 py-1.5 rounded-lg bg-black/30 text-white border border-white/20 hover:bg-black/40">Admin</Link>
            <Link to="/housekeeping/notifications" className="px-3 py-1.5 rounded-lg bg-black/30 text-white border border-white/20 hover:bg-black/40">Housekeeping</Link>
            <button onClick={() => setSoundEnabled(s => !s)} className="px-3 py-1.5 rounded-lg bg-black/30 text-white border border-white/20 hover:bg-black/40 inline-flex items-center gap-2">
              {soundEnabled ? <FaVolumeUp/> : <FaVolumeMute/>}
              <span>Ses</span>
            </button>
            <button onClick={() => setShowNewNotificationForm(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">Yeni Bildirim</button>
          </div>
        </div>
      </div>
      
      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="gold-glass-surface rounded-2xl p-4 border border-amber-300/20 text-white">
          <div className="text-sm opacity-80">Okunmamış</div>
          <div className="text-2xl font-semibold">{unreadCount}</div>
        </div>
        <div className="p-4 rounded-lg bg-white/10 border border-white/20 text-white">
          <div className="text-sm opacity-80">Yüksek Öncelik</div>
          <div className="text-2xl font-semibold">{highPriorityCount}</div>
        </div>
        <div className="p-4 rounded-lg bg-white/10 border border-white/20 text-white">
          <div className="text-sm opacity-80">Bugün</div>
          <div className="text-2xl font-semibold">{todayCount}</div>
        </div>
      </div>
      
      {/* Üst Kontroller */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          <button 
            onClick={() => setActiveTab('all')}
            className={`py-2 px-3 rounded ${activeTab === 'all' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Tümü
          </button>
          
          <button 
            onClick={() => setActiveTab('housekeeping')}
            className={`py-2 px-3 rounded ${activeTab === 'housekeeping' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Temizlik
          </button>
          
          <button 
            onClick={() => setActiveTab('maintenance')}
            className={`py-2 px-3 rounded ${activeTab === 'maintenance' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Bakım
          </button>
          
          <button 
            onClick={() => setActiveTab('reception')}
            className={`py-2 px-3 rounded ${activeTab === 'reception' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Resepsiyon
          </button>
          
          <button 
            onClick={() => setActiveTab('room_service')}
            className={`py-2 px-3 rounded ${activeTab === 'room_service' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Oda Servisi
          </button>
          
          <button 
            onClick={() => setActiveTab('system')}
            className={`py-2 px-3 rounded ${activeTab === 'system' ? 'bg-primary-600 text-black' : 'bg-white border border-gray-300 text-black'}`}
          >
            Sistem
          </button>
        </div>
        
        <div className="flex space-x-2 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Bildirim ara..."
              className="border border-gray-300 rounded-md pl-9 pr-3 py-2 text-black placeholder-black"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as any)} className="border border-gray-300 rounded-md px-3 py-2 text-black">
            <option value="all">Durum: Tümü</option>
            <option value="unread">Okunmamış</option>
            <option value="read">Okunmuş</option>
          </select>
          <select value={priorityFilter} onChange={(e)=>setPriorityFilter(e.target.value as any)} className="border border-gray-300 rounded-md px-3 py-2 text-black">
            <option value="all">Öncelik: Tümü</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
          </select>
          <select value={sortKey} onChange={(e)=>setSortKey(e.target.value as any)} className="border border-gray-300 rounded-md px-3 py-2 text-black">
            <option value="timestamp">Sırala: Zaman</option>
            <option value="priority">Sırala: Öncelik</option>
          </select>
          <button onClick={()=> setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 rounded bg-white border border-gray-300 flex items-center gap-1 text-black">
            <FaSort /> {sortOrder === 'asc' ? 'Artan' : 'Azalan'}
          </button>
        </div>
      </div>
      
      {/* Bildirim Listesi */}
      <div className="premium-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Durum
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Öncelik
                    <FaFilter className="ml-1" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Başlık
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Alıcı
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    Zaman
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNotifications.map((notification) => (
                <tr 
                  key={notification.id} 
                  className={`${selectedNotification === notification.id ? 'bg-blue-50' : ''} ${notification.status === 'unread' ? 'font-semibold' : ''}`}
                  onClick={() => setSelectedNotification(notification.id === selectedNotification ? null : notification.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {notification.status === 'unread' ? (
                      <span className="inline-flex items-center justify-center w-2 h-2 bg-red-500 rounded-full"></span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-2 h-2 bg-gray-300 rounded-full"></span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {notification.priority === 'high' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Yüksek
                      </span>
                    )}
                    {notification.priority === 'medium' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Orta
                      </span>
                    )}
                    {notification.priority === 'low' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Düşük
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <button
                        title={pinnedIds.includes(notification.id) ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                        onClick={(e)=>{ e.stopPropagation();
                          setPinnedIds(prev => prev.includes(notification.id) ? prev.filter(id => id !== notification.id) : [...prev, notification.id]);
                        }}
                        className="text-yellow-500 hover:text-yellow-600 mr-2"
                      >
                        {pinnedIds.includes(notification.id) ? <FaStar /> : <FaRegStar />}
                      </button>
                      {notification.type === 'housekeeping' && <FaBell className="text-blue-500 mr-2" />}
                      {notification.type === 'maintenance' && <FaBell className="text-red-500 mr-2" />}
                      {notification.type === 'reception' && <FaBell className="text-purple-500 mr-2" />}
                      {notification.type === 'room_service' && <FaBell className="text-green-500 mr-2" />}
                      {notification.type === 'system' && <FaBell className="text-gray-500 mr-2" />}
                      {notification.title}
                      {notification.status === 'unread' && <span className="text-blue-500 text-xs ml-2">• yeni</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize">{notification.recipient}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(notification.timestamp).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <input 
                        type="checkbox" 
                        checked={bulkSelected.includes(notification.id)} 
                        onChange={(e)=>{
                          e.stopPropagation();
                          setBulkSelected(prev => e.target.checked ? [...prev, notification.id] : prev.filter(id => id !== notification.id));
                        }} 
                      />
                      {notification.status === 'unread' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNotificationStatus(notification.id, 'read');
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Okundu İşaretle"
                        >
                          <FaCheck />
                        </button>
                      )}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Silme işlemi
                          setNotifications(notifications.filter(n => n.id !== notification.id));
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="Sil"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Seçili Bildirim Detayı */}
      {selectedNotification && (
        <div className="mt-6 premium-card p-6">
          {(() => {
            const notification = notifications.find(n => n.id === selectedNotification);
            if (!notification) return null;
            
            return (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">{notification.title}</h2>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(notification.timestamp).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      notification.priority === 'high' 
                        ? 'bg-red-100 text-red-800' 
                        : notification.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }`}>
                      {notification.priority === 'high' ? 'Yüksek Öncelik' : notification.priority === 'medium' ? 'Orta Öncelik' : 'Düşük Öncelik'}
                    </span>
                    
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 capitalize">
                      {notification.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p>{notification.message}</p>
                </div>

                {/* Resepsiyon için hızlı yanıt alanı (Misafir Mesajı - Oda XX) */}
                {notification.type === 'reception' && /Misafir Mesajı\s*-\s*Oda\s*\d+/.test(notification.title || '') && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-md">
                    <h3 className="font-medium mb-2">Misafire Yanıt Gönder</h3>
                    <div className="flex">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Yanıtınızı yazın..."
                        className="flex-1 border border-blue-200 rounded-l-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => {
                          const match = /Oda\s*(\d+)/.exec(notification.title || '');
                          if (!match) return;
                          const room = match[1];
                          const newKey = `${CHAT_PREFIX}${room}${CHAT_SUFFIX}`;
                          const legacyKey = `guest_chat_${room}`;
                          try {
                            const rawNew = localStorage.getItem(newKey);
                            const rawLegacy = localStorage.getItem(legacyKey);
                            const base = rawNew ? JSON.parse(rawNew) : (rawLegacy ? JSON.parse(rawLegacy) : []);
                            const entry = { message: replyText, isGuest: false, timestamp: new Date().toISOString() };
                            const updated = [...(Array.isArray(base) ? base : []), entry];
                            localStorage.setItem(newKey, JSON.stringify(updated));
                            localStorage.setItem(legacyKey, JSON.stringify(updated));
                            window.dispatchEvent(new Event('guest-chat-updated'));
                            try {
                              // @ts-ignore
                              const BC = (window as any).BroadcastChannel ? BroadcastChannel : null;
                              if (BC) {
                                const ch = new BC(`${CHAT_PREFIX}${room}`);
                                ch.postMessage({ type: 'chat_message', roomNumber: room, entry });
                                ch.close();
                              }
                            } catch {}
                            setReplyText('');
                          } catch {}
                        }}
                        className="bg-primary-600 text-white py-2 px-4 rounded-r-lg hover:bg-primary-700"
                      >
                        Gönder
                      </button>
                    </div>
                    <p className="text-xs text-blue-700 mt-2">Yanıt, misafir portalı sohbetinde anında görünecek.</p>
                  </div>
                )}
                
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Bildirim Gönderim Seçenekleri</h3>
                  <div className="flex space-x-4">
                    <button className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                      <FaEnvelope className="mr-2" /> E-posta Gönder
                    </button>
                    <button className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200">
                      <FaMobile className="mr-2" /> SMS Gönder
                    </button>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-2">
                  {notification.actions.includes('assign') && (
                    <button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
                      Personel Ata
                    </button>
                  )}
                  
                  {notification.actions.includes('acknowledge') && (
                    <button 
                      onClick={() => {
                        updateNotificationStatus(notification.id, 'read');
                        setSelectedNotification(null);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Onaylıyorum
                    </button>
                  )}
                  
                  {notification.actions.includes('dismiss') && (
                    <button 
                      onClick={() => {
                        setNotifications(notifications.filter(n => n.id !== notification.id));
                        setSelectedNotification(null);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reddet
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
      
      {/* Yeni Bildirim Formu */}
      {showNewNotificationForm && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 grid place-items-center z-50 p-4">
          <div className="premium-card p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Yeni Bildirim Oluştur</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Şablon Seç
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {notificationTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => selectTemplate(template.id)}
                    className="border border-gray-300 rounded p-2 text-left hover:bg-gray-50"
                  >
                    <div className="font-medium">{template.title}</div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">{template.type}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Başlık
                </label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mesaj
                </label>
                <textarea 
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tür
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={newNotification.type}
                    onChange={(e) => setNewNotification({...newNotification, type: e.target.value})}
                  >
                    <option value="housekeeping">Temizlik</option>
                    <option value="maintenance">Bakım</option>
                    <option value="reception">Resepsiyon</option>
                    <option value="room_service">Oda Servisi</option>
                    <option value="system">Sistem</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Öncelik
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={newNotification.priority}
                    onChange={(e) => setNewNotification({...newNotification, priority: e.target.value})}
                  >
                    <option value="high">Yüksek</option>
                    <option value="medium">Orta</option>
                    <option value="low">Düşük</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alıcı
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={newNotification.recipient}
                    onChange={(e) => setNewNotification({...newNotification, recipient: e.target.value})}
                  >
                    <option value="housekeeping">Temizlik Ekibi</option>
                    <option value="maintenance">Bakım Ekibi</option>
                    <option value="reception">Resepsiyon</option>
                    <option value="room_service">Oda Servisi</option>
                    <option value="all">Tüm Personel</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-2">
              <button 
                onClick={() => setShowNewNotificationForm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button 
                onClick={createNotification}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Bildirim Oluştur
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default NotificationSystem;