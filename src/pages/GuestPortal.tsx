import React, { useEffect, useRef, useState } from 'react';
import { FaWifi, FaUtensils, FaBed, FaComments, FaStar, FaRegStar, FaBoxOpen, FaLeaf, FaClock, FaHeadphones, FaMapMarkedAlt } from 'react-icons/fa';

import { pushNotification } from '../utils/notifications';


interface GuestPortalProps {
  activeTab?: string;
}

const GuestPortal: React.FC<GuestPortalProps> = ({ activeTab = 'home' }) => {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [roomNumber, setRoomNumber] = useState('302');
  const [welcomeName, setWelcomeName] = useState<string>('');
  const [cleaningRequested, setCleaningRequested] = useState(false);
  const [cleaningCancelled, setCleaningCancelled] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{message: string, isGuest: boolean, timestamp?: string}[]>([
    {message: 'Merhaba! Size nasıl yardımcı olabilirim?', isGuest: false, timestamp: new Date().toISOString()}
  ]);
  const CHAT_PREFIX = 'hotel:chat:room:';
  const CHAT_SUFFIX = ':history';
  const CHAT_STATUS_SUFFIX = ':status';
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [isTyping] = useState<boolean>(false);
  const chatChannelRef = useRef<BroadcastChannel | null>(null);
  const [copiedWifi, setCopiedWifi] = useState<boolean>(false);
  const wifiPassword = '20142014';
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const lastLenRef = useRef<number>(0);
  const didInitRef = useRef<boolean>(false);

  const playIncomingSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(700, ctx.currentTime);
      osc1.connect(gain);
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(500, ctx.currentTime + 0.08);
      osc2.connect(gain);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.start();
      osc2.start(ctx.currentTime + 0.08);
      osc1.stop(ctx.currentTime + 0.28);
      osc2.stop(ctx.currentTime + 0.28);
    } catch {}
  };

  // Feedback storage key and local state
  const FEEDBACK_KEY = 'hotel_feedback';
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackForgotItem, setFeedbackForgotItem] = useState<string>('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  const submitFeedback = async () => {
    if (feedbackRating < 1) return;
    setFeedbackSubmitting(true);
    const ts = new Date().toISOString();
    const entry = {
      id: `${roomNumber || 'unknown'}-${Date.now()}`,
      roomNumber: roomNumber || '',
      rating: feedbackRating,
      category: (feedbackCategory || '').trim() || null,
      comment: (feedbackComment || '').trim() || null,
      forgotItem: (feedbackForgotItem || '').trim() || null,
      timestamp: ts,
    };
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const updated = Array.isArray(arr) ? [entry, ...arr] : [entry];
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('guest-feedback-updated'));
    } catch {}
    setFeedbackSubmitted(true);
    setFeedbackSubmitting(false);
    setFeedbackComment('');
    setFeedbackForgotItem('');
    setFeedbackCategory('');
    setFeedbackRating(0);
    setTimeout(() => setFeedbackSubmitted(false), 2000);
  };

  const formatTime = (iso?: string) => {
    try {
      return iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    } catch {
      return '';
    }
  };


  const copyWifi = async () => {
    try {
      await navigator.clipboard.writeText(wifiPassword);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 1500);
    } catch {}
  };

  const handleSendMessage = () => {
    const text = chatMessage.trim();
    if (text === '' || isArchived) return;

    // Misafir mesajını ekle
    const guestEntry = { message: text, isGuest: true, timestamp: new Date().toISOString() };
    const key = `${CHAT_PREFIX}${roomNumber}${CHAT_SUFFIX}`;
    const statusKey = `${CHAT_PREFIX}${roomNumber}${CHAT_STATUS_SUFFIX}`;
    let ackSent = false;
    try {
      const rawS = localStorage.getItem(statusKey);
      const objS = rawS ? JSON.parse(rawS) : {};
      ackSent = Boolean(objS?.ackSent);
    } catch {}
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      const updated = [...arr, guestEntry];
      localStorage.setItem(key, JSON.stringify(updated));
      setChatHistory(updated);
      window.dispatchEvent(new Event('guest-chat-updated'));
    } catch {
      setChatHistory([...chatHistory, guestEntry]);
    }

    // Resepsiyona bildirim push et
    try {
      pushNotification({
        title: `Misafir Mesajı - Oda ${roomNumber}`,
        message: text,
        type: 'reception',
        priority: 'medium',
        recipient: 'reception',
      });
    } catch {}

    // Mesajı temizle
    setChatMessage('');

    // İlk mesajda tek seferlik teşekkür yanıtını hemen göster (sadece bir kez)
    if (!ackSent) {
      const thanksEntry = { message: 'Mesajınız için teşekkürler. En kısa sürede size dönüş yapacağız.', isGuest: false, timestamp: new Date().toISOString() };
      try {
        const raw2 = localStorage.getItem(key);
        const arr2 = raw2 ? JSON.parse(raw2) : [];
        const updated2 = [...arr2, thanksEntry];
        localStorage.setItem(key, JSON.stringify(updated2));
        setChatHistory(updated2);
        window.dispatchEvent(new Event('guest-chat-updated'));
      } catch {
        setChatHistory(prev => [...prev, thanksEntry]);
      }
      try {
        const rawS = localStorage.getItem(statusKey);
        const objS = rawS ? JSON.parse(rawS) : {};
        objS.ackSent = true;
        localStorage.setItem(statusKey, JSON.stringify(objS));
      } catch {}
      ackSent = true;
    }

    // Bot yanıtı simülasyonu (anahtar kelimelere göre)
    setTimeout(() => {
      let botResponse: string | null = null;

      const lower = text.toLowerCase();
      if (lower.includes('kahvaltı')) {
        botResponse = 'Kahvaltı saatlerimiz 07:00-10:00 arasındadır. Açık büfe 4. kattadır.';
      } else if (lower.includes('wifi') || lower.includes('internet')) {
        botResponse = 'Wifi şifresi: 20142014';
      } else if (lower.includes('temizlik')) {
        botResponse = 'Temizlik talebiniz alındı. Housekeeping ekibimiz en kısa sürede odanıza gelecektir.';
      }

      // Eğer anahtar kelime yoksa ve teşekkür zaten gönderildiyse, ek yanıt verme
      if (!botResponse) return;

      const botEntry = { message: botResponse, isGuest: false, timestamp: new Date().toISOString() };
      try {
        const raw2 = localStorage.getItem(key);
        const arr2 = raw2 ? JSON.parse(raw2) : [];
        const updated2 = [...arr2, botEntry];
        localStorage.setItem(key, JSON.stringify(updated2));
        setChatHistory(updated2);
        window.dispatchEvent(new Event('guest-chat-updated'));
      } catch {
        setChatHistory(prev => [...prev, botEntry]);
      }
    }, 1000);
  };

  const handleCleaningRequest = () => {
    setCleaningRequested(true);
    setCleaningCancelled(false);
    // Bildirim: HK ekibine temizlik talebi
    try {
      pushNotification({
        title: `Oda ${roomNumber} temizlik talebi`,
        message: 'Misafir oda temizliği istiyor',
        type: 'housekeeping',
        priority: 'medium',
        recipient: 'housekeeping',
      });
    } catch {}
  };

  const handleCleaningCancel = () => {
    setCleaningRequested(false);
    setCleaningCancelled(true);
    // Gerçek uygulamada burada API çağrısı olacak
  };

  // QR: oda parametresini al ve karşılama ismini ayarla
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rm = params.get('room');
      if (rm) setRoomNumber(rm);
      const raw = localStorage.getItem('hotel_rooms');
      const rooms = raw ? JSON.parse(raw) : [];
      const found = rooms.find((r: any) => r.number === (rm || roomNumber));
      const nm = found?.guestNames?.length ? found.guestNames[0] : (found?.guestName || '');
      if (nm) setWelcomeName(nm);
    } catch {}
  }, [roomNumber]);

  // Admin’den gelen yeni mesajlarda ses çal
  useEffect(() => {
    const len = chatHistory.length;
    if (!didInitRef.current) {
      didInitRef.current = true;
      lastLenRef.current = len;
      return;
    }
    if (len > (lastLenRef.current || 0)) {
      const last = chatHistory[len - 1];
      if (last && !last.isGuest) {
        playIncomingSound();
      }
    }
    lastLenRef.current = len;
  }, [chatHistory]);

  // Oda numarası belirlendikten sonra chat geçmişini localStorage'dan yükle ve canlı dinle
  useEffect(() => {
    const key = `${CHAT_PREFIX}${roomNumber}${CHAT_SUFFIX}`;
    const legacyKey = `guest_chat_${roomNumber}`;
    const statusKey = `${CHAT_PREFIX}${roomNumber}${CHAT_STATUS_SUFFIX}`;
    const load = () => {
      try {
        const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
        const arr = raw ? JSON.parse(raw) : [];
        if (Array.isArray(arr)) setChatHistory(arr);
      } catch {}
      try {
        const rawS = localStorage.getItem(statusKey);
        const obj = rawS ? JSON.parse(rawS) : {};
        setIsArchived(Boolean(obj?.archived));
      } catch {}
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('guest-chat-updated', onUpdate);
    const onStorage = (ev: StorageEvent) => { if (ev.key === key || ev.key === legacyKey || ev.key === statusKey) load(); };
    window.addEventListener('storage', onStorage);
    try {
      // @ts-ignore
      const BC = (window as any).BroadcastChannel ? BroadcastChannel : null;
      if (BC) {
        chatChannelRef.current?.close?.();
        chatChannelRef.current = new BC(`${CHAT_PREFIX}${roomNumber}`);
        chatChannelRef.current.onmessage = (ev: MessageEvent) => {
          const data = (ev as any).data;
          if (data?.type === 'chat_message' && data.roomNumber === roomNumber && data.entry) {
            setChatHistory(prev => [...prev, data.entry]);
          }
          if (data?.type === 'chat_archived' && data.roomNumber === roomNumber) {
            setIsArchived(true);
          }
        };
      }
    } catch {}
    return () => {
      window.removeEventListener('guest-chat-updated', onUpdate);
      window.removeEventListener('storage', onStorage);
      try { chatChannelRef.current?.close?.(); } catch {}
    };
  }, [roomNumber]);

  const renderTabContent = () => {
    switch(currentTab) {
      case 'home':
        return (
          <div className="p-4">
            {/* Hero Section */}
            <div className="premium-card p-6 mb-4 bg-gradient-to-br from-primary-50 via-white to-secondary-50">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full mb-4 shadow-lg">
                  <span className="text-2xl text-white">🏨</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                  {roomNumber === '101' ? 'Hoş Geldiniz Sayın Ahmet Bey!' : 
                   roomNumber === '205' ? 'Welcome Mr. Johnson!' :
                   roomNumber === '312' ? 'Bienvenue Madame Dubois!' :
                   `Hoş Geldiniz${welcomeName ? `, ${welcomeName}` : ''}!`}
                </h1>
                <p className="text-gray-600 mb-4">Kent Otel'de konforlu bir konaklama dileriz</p>
                
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                    <FaBed className="mr-2 text-primary-600" />
                    <span className="font-medium">Oda {roomNumber}</span>
                  </div>
                  <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm">
                    <FaClock className="mr-2 text-secondary-600" />
                    <span className="font-medium">Check-out: Yarın, 12:00</span>
                  </div>
                </div>
              </div>

              {/* Wi-Fi Quick Access - Enhanced */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-lg">📶</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Wi-Fi Erişimi</h3>
                      <p className="text-blue-100 text-sm">Şifre: <span className="font-mono bg-white bg-opacity-20 px-2 py-1 rounded">{wifiPassword}</span></p>
                    </div>
                  </div>
                  <button
                    onClick={copyWifi}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    {copiedWifi ? '✅ Kopyalandı!' : '📋 Kopyala'}
                  </button>
                </div>
              </div>

              {/* Hızlı Aksiyonlar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {!cleaningRequested && !cleaningCancelled && (
                  <>
                    <button
                      onClick={handleCleaningRequest}
                      className="border border-primary-200 text-primary-700 bg-gradient-to-r from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200 rounded-lg py-3 px-4 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-md"
                    >
                      ✨ Oda Temizliği İste
                    </button>
                    <button
                      onClick={handleCleaningCancel}
                      className="border border-secondary-200 text-secondary-700 bg-gradient-to-r from-secondary-50 to-secondary-100 hover:from-secondary-100 hover:to-secondary-200 rounded-lg py-3 px-4 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-md"
                    >
                      🌱 Bugün Temizlik İstemiyorum
                    </button>
                  </>
                )}
                {cleaningRequested && (
                  <div className="col-span-2 md:col-span-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 text-sm flex items-center justify-between shadow-sm">
                    <span className="text-blue-800 font-medium">⏳ Temizlik talebiniz alındı.</span>
                    <button onClick={() => setCleaningRequested(false)} className="text-blue-700 underline hover:text-blue-900 transition-colors">❌ İptal Et</button>
                  </div>
                )}
                {cleaningCancelled && (
                  <div className="col-span-2 md:col-span-2 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4 text-sm flex items-center justify-between shadow-sm">
                    <span className="text-green-800 font-medium">🌱 Bugün temizlik istemeyerek su tasarrufu sağladınız</span>
                    <button onClick={() => { setCleaningCancelled(false); setCleaningRequested(true); }} className="text-green-700 underline hover:text-green-900 transition-colors">💭 Fikrim Değişti</button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setCurrentTab('chat');
                    setTimeout(() => {
                      try { (document.getElementById('guest-portal-chat-input') as HTMLInputElement | null)?.focus(); } catch {}
                    }, 50);
                  }}
                  className="border border-gray-200 bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-lg py-3 px-4 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-md"
                >
                  💬 Resepsiyona Mesaj Yaz
                </button>
                <button
                  onClick={() => setCurrentTab('services')}
                  className="border border-gray-200 bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-lg py-3 px-4 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:shadow-md"
                >
                  🏨 Hizmetlere Göz At
                </button>
              </div>
            </div>

            {/* Hızlı Bilgiler & Günün Akışı */}
            <div className="premium-card p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <FaWifi className="text-primary-600 mr-3" />
                    <div>
                      <div className="text-sm font-semibold">Wi‑Fi</div>
                      <div className="text-xs text-gray-600">Şifre: {wifiPassword}</div>
                    </div>
                  </div>
                  <button onClick={copyWifi} className="text-xs text-primary-600 hover:text-primary-700">Kopyala</button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start">
                  <FaClock className="text-gray-700 mr-3 mt-1" />
                  <div>
                    <div className="text-sm font-semibold">Bugün</div>
                    <ul className="mt-1 text-xs text-gray-700 space-y-1">
                      <li>07:00–10:00 Kahvaltı • 4. kat</li>
                      <li>10:00–18:00 Havuz • Zemin kat</li>
                      <li>12:00 Check‑out</li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="text-sm font-semibold text-green-800 mb-1">Sürdürülebilirlik İpucu</div>
                  <div className="text-xs text-green-700">Havlu değişimini azaltarak su ve enerji tasarrufu sağlayabilirsiniz.</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="p-4">
            <div className="premium-card p-4 h-[500px] flex flex-col">
              <div className="flex-1 overflow-y-auto mb-4">
                {chatHistory.length > visibleCount && (
                  <div className="flex justify-center mb-3">
                    <button onClick={() => setVisibleCount(c => c + 20)} className="text-xs text-gray-600 underline">Daha fazla yükle</button>
                  </div>
                )}
                {chatHistory.slice(Math.max(0, chatHistory.length - visibleCount)).map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mb-3 ${msg.isGuest ? 'text-right' : ''}`}
                  >
                    <div 
                      className={`inline-block rounded-2xl py-2 px-3 max-w-[80%] shadow ${
                        msg.isGuest 
                          ? 'bg-sky-500 text-white' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <div className={`text-xs mt-1 flex items-center ${msg.isGuest ? 'justify-end text-gray-200' : 'text-gray-500'}`}>
                      <FaClock className="mr-1" />
                      <span>{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {isTyping && !isArchived && (
                <div className="mb-2">
                  <span className="inline-block bg-gray-100 text-gray-600 text-xs rounded-full px-3 py-1">Resepsiyon yazıyor…</span>
                </div>
              )}
              {isArchived && (
                <div className="mb-2">
                  <span className="inline-block bg-red-100 text-red-700 text-xs rounded-full px-3 py-1">Sohbet arşivlendi • Yeni mesaj gönderilemez</span>
                </div>
              )}
              
              <div className="flex">
                <input
                  id="guest-portal-chat-input"
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder={isArchived ? 'Sohbet arşivlendi' : 'Mesajınızı yazın...'}
                  className={`flex-1 border border-gray-300 rounded-l-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isArchived}
                />
                <button
                  onClick={handleSendMessage}
                  className={`bg-primary-600 text-white py-2 px-4 rounded-r-lg hover:bg-primary-700 ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={isArchived}
                >
                  Gönder
                </button>
              </div>
            </div>
          </div>
        );
      
      case 'services':
        return (
          <div className="p-4">
            <div className="premium-card p-6 mb-4">
              <h2 className="text-xl font-bold mb-1">Otel Hizmetleri</h2>
              <p className="text-sm text-gray-600 mb-4">Tek tıkla talep gönderin; resepsiyona otomatik bildirim gider.</p>

              {/* Öne Çıkan Hızlı Aksiyonlar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border border-gray-200 rounded-lg p-4 flex items-start">
                  <FaUtensils className="text-secondary-600 mr-3 mt-1" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">Oda Servisi</div>
                    <div className="text-xs text-gray-600 mb-2">07:00–23:00 • Sıcak/soğuk menü</div>
                    <button
                      onClick={() => { try { pushNotification({ title: `Oda Servisi Talebi`, message: `Oda ${roomNumber} oda servisi istiyor`, type: 'reception', priority: 'high', recipient: 'reception' }); } catch {} }}
                      className="text-xs border border-secondary-300 text-secondary-700 rounded px-2 py-1 hover:bg-secondary-50"
                    >
                      Talep Gönder
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex items-start">
                  <FaBed className="text-primary-600 mr-3 mt-1" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">Housekeeping</div>
                    <div className="text-xs text-gray-600 mb-2">Ek havlu, nevresim veya temizlik talebi</div>
                    <button
                      onClick={() => { try { pushNotification({ title: `Housekeeping Talebi`, message: `Oda ${roomNumber} ek housekeeping talebi`, type: 'reception', priority: 'medium', recipient: 'reception' }); } catch {} }}
                      className="text-xs border border-primary-300 text-primary-700 rounded px-2 py-1 hover:bg-primary-50"
                    >
                      Talep Gönder
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex items-start">
                  <FaMapMarkedAlt className="text-gray-700 mr-3 mt-1" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">Taksi</div>
                    <div className="text-xs text-gray-600 mb-2">Konforlu şehir içi ulaşım</div>
                    <button
                      onClick={() => { try { pushNotification({ title: `Taksi Talebi`, message: `Oda ${roomNumber} taksi talep ediyor`, type: 'reception', priority: 'medium', recipient: 'reception' }); } catch {} }}
                      className="text-xs border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50"
                    >
                      Talep Gönder
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex items-start">
                  <FaLeaf className="text-green-700 mr-3 mt-1" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">Spa & Wellness</div>
                    <div className="text-xs text-gray-600 mb-2">10:00–22:00 • Rezervasyon gerekli</div>
                    <button
                      onClick={() => { try { pushNotification({ title: `Spa Rezervasyon Talebi`, message: `Oda ${roomNumber} spa rezervasyonu istiyor`, type: 'reception', priority: 'low', recipient: 'reception' }); } catch {} }}
                      className="text-xs border border-green-300 text-green-700 rounded px-2 py-1 hover:bg-green-50"
                    >
                      Talep Gönder
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 flex items-start md:col-span-2">
                  <FaHeadphones className="text-blue-700 mr-3 mt-1" />
                  <div className="flex-1">
                    <div className="font-bold mb-1">Resepsiyon</div>
                    <div className="text-xs text-gray-600 mb-2">Her türlü talebiniz için bize yazın</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { try { pushNotification({ title: `Havaalanı Transfer Talebi`, message: `Oda ${roomNumber} havaalanı transferi istiyor`, type: 'reception', priority: 'medium', recipient: 'reception' }); } catch {} }}
                        className="text-xs border border-blue-300 text-blue-700 rounded px-2 py-1 hover:bg-blue-50"
                      >
                        Havaalanı Transfer
                      </button>
                      <button
                        onClick={() => { try { pushNotification({ title: `Bagaj Yardımı Talebi`, message: `Oda ${roomNumber} bagaj yardımı istiyor`, type: 'reception', priority: 'low', recipient: 'reception' }); } catch {} }}
                        className="text-xs border border-blue-300 text-blue-700 rounded px-2 py-1 hover:bg-blue-50"
                      >
                        Bagaj Yardımı
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bilgi Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold mb-2">Yemek & İçecek</h3>
                  <ul className="space-y-2 text-sm">
                    <li><span className="font-semibold">Kahvaltı:</span> 07:00–10:30, Lobi Katı</li>
                    <li><span className="font-semibold">Öğle Yemeği:</span> 12:30–14:30, Restoran</li>
                    <li><span className="font-semibold">Akşam Yemeği:</span> 19:00–22:00, Restoran</li>
                    <li><span className="font-semibold">Bar:</span> 10:00–00:00, Lobi Katı</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold mb-2">Ulaşım</h3>
                  <ul className="space-y-2 text-sm">
                    <li><span className="font-semibold">Havaalanı Servisi:</span> Resepsiyon aracılığıyla</li>
                    <li><span className="font-semibold">Taksi:</span> Resepsiyondan talep edilebilir</li>
                    <li><span className="font-semibold">Otopark:</span> Ücretsiz, 24 saat açık</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'feedback':
        return (
          <div className="p-4">
            <div className="premium-card p-6 mb-4">
              <h2 className="text-xl font-bold mb-1">Geri Bildirim</h2>
              <p className="text-sm text-gray-600 mb-6">Deneyiminizi paylaşın, hizmetimizi geliştirmemize yardımcı olun.</p>
              
              {/* Memnuniyet Değerlendirmesi */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Genel Memnuniyet Puanınız</label>
                <div className="flex justify-center space-x-3 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className={`text-3xl transition-all duration-200 hover:scale-110 ${
                        feedbackRating >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-300 hover:text-yellow-200'
                      }`}
                    >
                      {star <= feedbackRating ? <FaStar /> : <FaRegStar />}
                    </button>
                  ))}
                </div>
                <div className="text-center text-xs text-gray-500">
                  {feedbackRating === 0 && "Puanınızı seçin"}
                  {feedbackRating === 1 && "Çok Kötü"}
                  {feedbackRating === 2 && "Kötü"}
                  {feedbackRating === 3 && "Orta"}
                  {feedbackRating === 4 && "İyi"}
                  {feedbackRating === 5 && "Mükemmel"}
                </div>
              </div>
              
              {/* Hızlı Kategori Seçimi */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Hangi konuda geri bildirim vermek istiyorsunuz?</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { value: 'cleanliness', label: 'Temizlik', icon: '✨', color: 'teal' },
                    { value: 'comfort', label: 'Konfor', icon: '🛏️', color: 'blue' },
                    { value: 'staff', label: 'Personel', icon: '👥', color: 'purple' },
                    { value: 'facilities', label: 'Tesisler', icon: '🏊', color: 'green' },
                    { value: 'location', label: 'Konum', icon: '📍', color: 'orange' },
                    { value: 'value', label: 'Fiyat/Fayda', icon: '💰', color: 'gray' }
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setFeedbackCategory(cat.value)}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-center ${
                        feedbackCategory === cat.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-lg mb-1">{cat.icon}</div>
                      <div className="text-xs font-medium">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Yorum Alanı */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Detaylı Yorumunuz</label>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg h-28 resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Deneyiminizi detaylı olarak bizimle paylaşın. Önerileriniz bizim için çok değerli..."
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {feedbackComment.length}/500 karakter
                </div>
              </div>
              
              {/* Unutulan Eşya */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Unutulan Eşya Bildirimi</label>
                <div className="flex items-center space-x-2 mb-2">
                  <FaBoxOpen className="text-gray-600" />
                  <span className="text-sm text-gray-600">Odanızda unuttuğunuz bir eşya mı var?</span>
                </div>
                <textarea
                  value={feedbackForgotItem}
                  onChange={(e) => setFeedbackForgotItem(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg h-20 resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Lütfen eşyanızı detaylı olarak tarif edin (renk, marka, boyut vb.)..."
                />
              </div>
              
              {/* Gönder Butonu */}
              <button
                onClick={submitFeedback}
                disabled={feedbackSubmitting || feedbackRating < 1}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  feedbackRating >= 1 && !feedbackSubmitting
                    ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {feedbackSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Gönderiliyor...
                  </span>
                ) : feedbackRating >= 1 ? (
                  '✨ Geri Bildirimi Gönder'
                ) : (
                  'Lütfen puan verin'
                )}
              </button>
              
              {feedbackSubmitted && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-green-800 font-medium">Teşekkürler! Geri bildiriminiz başarıyla kaydedildi.</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Hızlı Aksiyonlar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="premium-card p-4">
                <div className="flex items-start">
                  <div className="text-2xl mr-3">🏆</div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">Personel Takdiri</h3>
                    <p className="text-xs text-gray-600 mb-3">Özel bir personeli takdir etmek ister misiniz?</p>
                    <button
                      onClick={() => { try { pushNotification({ title: `Personel Takdiri`, message: `Oda ${roomNumber} personel takdiri bildirimi`, type: 'system', priority: 'low', recipient: 'management' }); } catch {} }}
                      className="text-xs bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Takdir Et
                    </button>
                  </div>
                </div>
              </div>

              <div className="premium-card p-4">
                <div className="flex items-start">
                  <div className="text-2xl mr-3">💡</div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-1">Öneri Kutusu</h3>
                    <p className="text-xs text-gray-600 mb-3">Hizmetlerimizi geliştirmek için önerileriniz?</p>
                    <button
                      onClick={() => { try { pushNotification({ title: `Öneri`, message: `Oda ${roomNumber} öneri bildirimi`, type: 'system', priority: 'low', recipient: 'management' }); } catch {} }}
                      className="text-xs bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Öneri Gönder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'sustainability':
        return (
          <div className="p-4">
            <div className="premium-card p-6 mb-4">
              <h2 className="text-xl font-bold mb-1">Sürdürülebilirlik</h2>
              <p className="text-sm text-gray-600 mb-6">Birlikte daha yeşil bir gelecek inşa ediyoruz. 🌱</p>
              
              {/* Çevre Etkisi Göstergesi */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-green-800">Bu Ay Birlikte Tasarruf Ettiklerimiz</h3>
                  <div className="text-2xl">🌍</div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-700">2,847</div>
                    <div className="text-xs text-green-600">kWh Enerji</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-700">1,523</div>
                    <div className="text-xs text-blue-600">Litre Su</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-700">89</div>
                    <div className="text-xs text-purple-600">kg CO₂</div>
                  </div>
                </div>
              </div>
              
              {/* Etkileşimli Katkı Kartları */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Siz de Katkıda Bulunun</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="border border-green-200 rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex items-start">
                      <div className="text-2xl mr-3">🏠</div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Havlu & Çarşaf Politikası</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Havlularınızı askıda bırakın, çarşaflarınızı 2 günde bir değiştirin.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { try { pushNotification({ title: `Havlu Değişimi İptal`, message: `Oda ${roomNumber} havlu değişimi istemediğini bildirdi`, type: 'housekeeping', priority: 'low', recipient: 'housekeeping' }); } catch {} }}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                          >
                            Havlu Değişimi İstemiyorum
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-blue-200 rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex items-start">
                      <div className="text-2xl mr-3">❄️</div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Enerji Tasarrufu</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Odadan çıkarken klimayı kapatın, perdeleri açık bırakın.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { try { pushNotification({ title: `Enerji Tasarrufu Taahhüdü`, message: `Oda ${roomNumber} enerji tasarrufu taahhüdünde bulundu`, type: 'system', priority: 'low', recipient: 'management' }); } catch {} }}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                          >
                            Taahhüt Ediyorum
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-purple-200 rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex items-start">
                      <div className="text-2xl mr-3">♻️</div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Geri Dönüşüm</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Plastik, cam ve kağıt atıklarınızı ayrı toplayın.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { try { pushNotification({ title: `Geri Dönüşüm Kutusu Talebi`, message: `Oda ${roomNumber} geri dönüşüm kutusu talep ediyor`, type: 'housekeeping', priority: 'low', recipient: 'housekeeping' }); } catch {} }}
                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                          >
                            Geri Dönüşüm Kutusu İste
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-orange-200 rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex items-start">
                      <div className="text-2xl mr-3">🚿</div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Su Tasarrufu</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Kısa duş alın, muslukları sıkıca kapatın.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { try { pushNotification({ title: `Su Tasarrufu Taahhüdü`, message: `Oda ${roomNumber} su tasarrufu taahhüdünde bulundu`, type: 'system', priority: 'low', recipient: 'management' }); } catch {} }}
                            className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
                          >
                            Taahhüt Ediyorum
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Çevre Politikamız */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Çevre Politikamız</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl mr-3">💡</div>
                    <div>
                      <div className="font-medium text-sm">LED Aydınlatma</div>
                      <div className="text-xs text-gray-600">%80 daha az enerji tüketimi</div>
                    </div>
                  </div>
                  <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl mr-3">🚰</div>
                    <div>
                      <div className="font-medium text-sm">Akıllı Musluklar</div>
                      <div className="text-xs text-gray-600">Otomatik su tasarrufu</div>
                    </div>
                  </div>
                  <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl mr-3">🌱</div>
                    <div>
                      <div className="font-medium text-sm">Yerel Tedarik</div>
                      <div className="text-xs text-gray-600">Düşük karbon ayak izi</div>
                    </div>
                  </div>
                  <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="text-xl mr-3">🔋</div>
                    <div>
                      <div className="font-medium text-sm">Yenilenebilir Enerji</div>
                      <div className="text-xs text-gray-600">Güneş paneli sistemi</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yeşil Sertifika */}
              <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">🏆</div>
                <div className="font-bold text-green-800 mb-1">Yeşil Otel Sertifikası</div>
                <div className="text-sm text-green-700">Çevre dostu uygulamalarımızla sertifikalıyız</div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Misafir Katkısı</h3>
              <p className="text-sm text-green-800 mb-3">Bugün temizlik istemeyerek yaklaşık 20 litre su tasarrufuna katkı sağlayabilirsiniz 🌱</p>
              <div className="flex space-x-3">
                <button 
                  onClick={handleCleaningCancel}
                  className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition text-sm"
                >
                  Bugün Temizlik İstemiyorum
                </button>
                <button 
                  onClick={() => setCurrentTab('home')}
                  className="bg-white text-green-800 border border-green-300 py-2 px-4 rounded hover:bg-green-100 transition text-sm"
                >
                  Ana Sayfaya Dön
                </button>
              </div>
            </div>

            <div className="premium-card p-6">
              <h3 className="text-lg font-bold mb-3">İpuçları</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Su Tasarrufu</h4>
                  <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                    <li>Havlu değişimini azaltarak çamaşır suyunu azaltabilirsiniz</li>
                    <li>Duş süresini kısaltarak su tüketimini azaltın</li>
                    <li>Günlük temizlik seçimini ihtiyaca göre yapın</li>
                  </ul>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Enerji Verimliliği</h4>
                  <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                    <li>Odanızdan çıkarken ışıkları kapatın</li>
                    <li>Klima ayarını 22-24°C aralığında tutun</li>
                    <li>Güneş alan saatlerde perdeleri kullanın</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return <div>Sayfa bulunamadı</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F3E6] via-[#F4EFE4] to-[#EFE9DC]">
      <header className="mx-4 mt-4 mb-2 rounded-xl border border-black/10 bg-white/80 backdrop-blur-md text-gray-900 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-3" style={{ width: 36, height: 36 }} aria-hidden="true" />
            <div>
              <h1 className="text-xl font-bold">Kent Otel — Bizi tercih ettiğiniz için teşekkür ederiz</h1>
              <p className="text-sm text-gray-600">Oda {roomNumber}</p>
            </div>
          </div>
          <button onClick={copyWifi} className="flex items-center text-sm text-primary-700 hover:text-primary-800">
            <FaWifi className="mr-2" />
            {copiedWifi ? 'Kopyalandı!' : 'Wi‑Fi Şifresi'}
          </button>
        </div>
      </header>
      
      <main className="pb-12">
        {renderTabContent()}
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-white/80 border-t border-black/10 shadow-xl">
        <div className="flex justify-around text-gray-800">
          <button 
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center py-2 px-4 ${currentTab === 'home' ? 'text-primary-700' : 'text-gray-600'}`}
          >
            <FaBed size={22} />
            <span className="text-xs mt-1">Ana Sayfa</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('chat')}
            className={`flex flex-col items-center py-2 px-4 ${currentTab === 'chat' ? 'text-primary-700' : 'text-gray-600'}`}
          >
            <FaComments size={22} />
            <span className="text-xs mt-1">Sohbet</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('services')}
            className={`flex flex-col items-center py-2 px-4 ${currentTab === 'services' ? 'text-primary-700' : 'text-gray-600'}`}
          >
            <FaUtensils size={22} />
            <span className="text-xs mt-1">Hizmetler</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('feedback')}
            className={`flex flex-col items-center py-2 px-4 ${currentTab === 'feedback' ? 'text-primary-700' : 'text-gray-600'}`}
          >
            <FaStar size={22} />
            <span className="text-xs mt-1">Geri Bildirim</span>
          </button>
          
          <button 
            onClick={() => setCurrentTab('sustainability')}
            className={`flex flex-col items-center py-2 px-4 ${currentTab === 'sustainability' ? 'text-primary-700' : 'text-gray-600'}`}
          >
            <FaLeaf size={22} />
            <span className="text-xs mt-1">Sürdürülebilirlik</span>
          </button>

          <a 
            href="https://www.rotaerzincan.com/" 
            target="_blank" 
            rel="noreferrer" 
            className="flex flex-col items-center py-2 px-4 text-gray-600"
          >
            <FaMapMarkedAlt size={22} />
            <span className="text-xs mt-1">Gezilecek Yerler</span>
          </a>
        </div>
      </nav>
    </div>
  );
};

export default GuestPortal;