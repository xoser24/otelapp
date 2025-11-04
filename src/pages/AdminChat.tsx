import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FaComments, FaClock, FaSearch, FaPaperPlane, FaArchive, FaSmile, FaTrash, FaDoorOpen, FaCommentDots, FaHeadphones, FaUser, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const CHAT_PREFIX = 'hotel:chat:room:';
const CHAT_SUFFIX = ':history';
const CHAT_STATUS_SUFFIX = ':status';
const CHAT_ARCHIVE_PREFIX = 'hotel:chat:archive:';

const AdminChat: React.FC = () => {
  const [rooms, setRooms] = useState<{ number: string; last?: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [chat, setChat] = useState<{ message: string; isGuest: boolean; timestamp?: string }[]>([]);
  const [filter, setFilter] = useState('');
  const [replyText, setReplyText] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const [showArchives, setShowArchives] = useState<boolean>(false);
  const [archives, setArchives] = useState<{ key: string; roomNumber: string; archivedAt?: string; last?: string }[]>([]);
  const [selectedArchiveKey, setSelectedArchiveKey] = useState<string>('');
  const [showEmoji, setShowEmoji] = useState<boolean>(false);
  const lastLenRef = useRef<number>(0);
  const didInitRef = useRef<boolean>(false);

  const playChatSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      // Pop + ping kombinasyonu
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(650, ctx.currentTime);
      osc1.connect(gain);
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(950, ctx.currentTime + 0.06);
      osc2.connect(gain);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc1.start();
      osc2.start(ctx.currentTime + 0.06);
      osc1.stop(ctx.currentTime + 0.24);
      osc2.stop(ctx.currentTime + 0.24);
    } catch {}
  };


  const loadRooms = useCallback(() => {
    try {
      const seen = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (key.startsWith(CHAT_PREFIX) && key.endsWith(CHAT_SUFFIX)) {
          const rn = key.slice(CHAT_PREFIX.length, -CHAT_SUFFIX.length);
          seen.add(rn);
        } else if (key.startsWith('guest_chat_')) {
          seen.add(key.replace('guest_chat_', ''));
        }
      }
      const list = Array.from(seen);
      const withLast = list.map((rn) => {
        const newKey = `${CHAT_PREFIX}${rn}${CHAT_SUFFIX}`;
        const legacyKey = `guest_chat_${rn}`;
        let arr: any[] = [];
        try {
          const raw = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
          arr = raw ? JSON.parse(raw) : [];
        } catch {}
        const last = arr.length ? arr[arr.length - 1]?.message : '';
        return { number: rn, last };
      });
      withLast.sort((a, b) => a.number.localeCompare(b.number));
      setRooms(withLast);
      if (!showArchives) {
        setSelectedRoom((prev) => prev || (withLast.length ? withLast[0].number : ''));
      }
    } catch {}
  }, [showArchives]);

  const loadArchives = useCallback(() => {
    try {
      const items: { key: string; roomNumber: string; archivedAt?: string; last?: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (key.startsWith(CHAT_ARCHIVE_PREFIX)) {
          try {
            const raw = localStorage.getItem(key) || 'null';
            const obj = JSON.parse(raw);
            if (obj && obj.roomNumber) {
              const hist = Array.isArray(obj.history) ? obj.history : [];
              const last = hist.length ? hist[hist.length - 1]?.message : '';
              items.push({ key, roomNumber: obj.roomNumber, archivedAt: obj.archivedAt, last });
            }
          } catch {}
        }
      }
      items.sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''));
      setArchives(items);
      if (showArchives) {
        setSelectedArchiveKey((prev) => prev || (items[0]?.key || ''));
        setSelectedRoom('');
      }
    } catch {}
  }, [showArchives]);

  const loadChat = (room: string) => {
    try {
      const newKey = `${CHAT_PREFIX}${room}${CHAT_SUFFIX}`;
      const statusKey = `${CHAT_PREFIX}${room}${CHAT_STATUS_SUFFIX}`;
      const legacyKey = `guest_chat_${room}`;
      const raw = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
      const arr = raw ? JSON.parse(raw) : [];
      setChat(Array.isArray(arr) ? arr : []);
      try {
        const rawS = localStorage.getItem(statusKey);
        const obj = rawS ? JSON.parse(rawS) : {};
        setIsArchived(Boolean(obj?.archived));
      } catch {}
    } catch {
      setChat([]);
    }
  };

  useEffect(() => {
    loadRooms();
    loadArchives();
    const onUpdate = () => {
      loadRooms();
      loadArchives();
      if (selectedRoom) loadChat(selectedRoom);
      if (selectedArchiveKey) loadArchiveChat(selectedArchiveKey);
    };
    window.addEventListener('guest-chat-updated', onUpdate);
    window.addEventListener('storage', onUpdate as any);
    return () => {
      window.removeEventListener('guest-chat-updated', onUpdate);
      window.removeEventListener('storage', onUpdate as any);
    };
  }, [loadRooms, loadArchives, selectedRoom, selectedArchiveKey]);

  useEffect(() => {
    if (selectedRoom) loadChat(selectedRoom);
    try {
      // @ts-ignore
      const BC = (window as any).BroadcastChannel ? BroadcastChannel : null;
      if (BC) {
        channelRef.current?.close?.();
        channelRef.current = new BC(`${CHAT_PREFIX}${selectedRoom}`);
        channelRef.current.onmessage = (ev: MessageEvent) => {
          const data = (ev as any).data;
          if (data?.type === 'chat_message' && data.roomNumber === selectedRoom && data.entry) {
            setChat((prev) => [...prev, data.entry]);
          }
        };
      }
    } catch {}
    return () => {
      try {
        channelRef.current?.close?.();
      } catch {}
    };
  }, [selectedRoom]);

  // Yeni gelen misafir mesajında ses çal
  useEffect(() => {
    const len = chat.length;
    if (!didInitRef.current) {
      didInitRef.current = true;
      lastLenRef.current = len;
      return;
    }
    if (len > (lastLenRef.current || 0)) {
      const last = chat[len - 1];
      if (last && last.isGuest) {
        playChatSound();
      }
    }
    lastLenRef.current = len;
  }, [chat]);

  const loadArchiveChat = (archiveKey: string) => {
    try {
      const raw = localStorage.getItem(archiveKey) || 'null';
      const obj = JSON.parse(raw);
      const arr = Array.isArray(obj?.history) ? obj.history : [];
      setChat(arr);
      setIsArchived(true);
    } catch {
      setChat([]);
      setIsArchived(true);
    }
  };

  const filteredRooms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rooms.filter((r) => r.number.toLowerCase().includes(q));
  }, [rooms, filter]);

  const filteredArchives = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return archives.filter((a) => a.roomNumber.toLowerCase().includes(q));
  }, [archives, filter]);

  const finishChat = () => {
    if (!selectedRoom) return;
    const newKey = `${CHAT_PREFIX}${selectedRoom}${CHAT_SUFFIX}`;
    const legacyKey = `guest_chat_${selectedRoom}`;
    const statusKey = `${CHAT_PREFIX}${selectedRoom}${CHAT_STATUS_SUFFIX}`;
    const ts = new Date().toISOString();
    try {
      const raw = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
      const arr = raw ? JSON.parse(raw) : [];
      try {
        const archiveKey = `${CHAT_ARCHIVE_PREFIX}${selectedRoom}:${Date.now()}`;
        localStorage.setItem(archiveKey, JSON.stringify({ roomNumber: selectedRoom, history: arr, archivedAt: ts }));
      } catch {}
      localStorage.setItem(statusKey, JSON.stringify({ archived: true, archivedAt: ts, by: 'admin' }));
      localStorage.removeItem(newKey);
      localStorage.removeItem(legacyKey);
      setChat([]);
      setIsArchived(true);
      window.dispatchEvent(new Event('guest-chat-updated'));
      try { channelRef.current?.postMessage?.({ type: 'chat_archived', roomNumber: selectedRoom }); } catch {}
      loadRooms();
    } catch {}
  };

  const sendReply = () => {
    const text = replyText.trim();
    if (!selectedRoom || text === '' || isArchived) return;
    const entry = { message: text, isGuest: false, timestamp: new Date().toISOString() };
    try {
      const newKey = `${CHAT_PREFIX}${selectedRoom}${CHAT_SUFFIX}`;
      const legacyKey = `guest_chat_${selectedRoom}`;
      const rawNew = localStorage.getItem(newKey);
      const rawLegacy = localStorage.getItem(legacyKey);
      const base = rawNew ? JSON.parse(rawNew) : rawLegacy ? JSON.parse(rawLegacy) : [];
      const updated = [...(Array.isArray(base) ? base : []), entry];
      localStorage.setItem(newKey, JSON.stringify(updated));
      localStorage.setItem(legacyKey, JSON.stringify(updated));
      setChat(updated);
      window.dispatchEvent(new Event('guest-chat-updated'));
      try {
        channelRef.current?.postMessage?.({ type: 'chat_message', roomNumber: selectedRoom, entry });
      } catch {}
    } catch {}
    setReplyText('');
  };

  const deleteArchive = (archiveKey: string) => {
    if (!archiveKey) return;
    const ok = window.confirm('Bu arşiv kaydını silmek istiyor musunuz?');
    if (!ok) return;
    try { localStorage.removeItem(archiveKey); } catch {}
    setSelectedArchiveKey('');
    setChat([]);
    setIsArchived(false);
    loadArchives();
  };

  const formatTime = (iso?: string) => {
    try {
      return iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    } catch {
      return '';
    }
  };

  return (
    <div className="p-4 animate-fade-in">
      {/* Header Band */}
      <div className="rounded-xl overflow-hidden mb-4">
        <div className="diamond-band">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="icon-badge animate-band-icon">💬</span>
              <div>
                <h1 className="band-title">Sohbet Yönetimi</h1>
                <p className="text-white/80 text-sm">Misafir mesajları ve arşiv kontrolü</p>
              </div>
            </div>
            <div className="band-counter">{new Date().toLocaleDateString('tr-TR')}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <div className="diamond-card p-4 relative overflow-hidden group">
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-400/80 via-yellow-500/80 to-yellow-600/80 opacity-60 group-hover:w-1.5 transition-all"></div>
            <div className="absolute inset-y-0 left-0 w-12 animate-shimmer opacity-30 pointer-events-none"></div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <FaComments className="text-white drop-shadow-sm mr-2" />
                <h3 className="text-white text-sm font-semibold">{showArchives ? 'Arşivler' : 'Odalar'}</h3>
              </div>
              <button className={`btn-outline text-xs ${showArchives ? 'bg-white/10' : ''}`} onClick={()=>{ setShowArchives(s=>!s); setSelectedRoom(''); setSelectedArchiveKey(''); setChat([]); setIsArchived(false); }}>
                <FaArchive className="mr-1"/> {showArchives ? 'Aktif' : 'Arşiv'}
              </button>
            </div>
            <div className="relative mb-3">
              <FaSearch className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Oda ara..."
                className="input form-base pl-9 text-gray-900"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {!showArchives && (
                <>
                  {filteredRooms.map((r) => (
                    <button
                      key={r.number}
                      onClick={() => { setSelectedRoom(r.number); setSelectedArchiveKey(''); setIsArchived(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition border ${
                        selectedRoom === r.number ? 'bg-white/15 border-white/20 text-white' : 'hover:bg-white/10 border-white/10 text-white/90'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white"><FaDoorOpen /></span>
                        <span className="text-sm">Oda {r.number}</span>
                      </div>
                      <div className="flex items-center gap-1 max-w-[160px]">
                        <FaCommentDots className="text-white/60" />
                        <span className="text-xs text-white/70 truncate">{r.last || '—'}</span>
                      </div>
                    </button>
                  ))}
                  {filteredRooms.length === 0 && (
                    <div className="text-white/70 text-sm">Sohbet bulunan oda yok.</div>
                  )}
                </>
              )}
              {showArchives && (
                <>
                  {filteredArchives.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => { setSelectedArchiveKey(a.key); setSelectedRoom(''); loadArchiveChat(a.key); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition border ${
                        selectedArchiveKey === a.key ? 'bg-white/15 border-white/20 text-white' : 'hover:bg-white/10 border-white/10 text-white/90'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white"><FaArchive /></span>
                        <span className="text-sm">Oda {a.roomNumber}</span>
                      </div>
                      <span className="text-xs text-white/70 truncate max-w-[140px]">{a.archivedAt?.slice(0,10) || ''}</span>
                    </button>
                  ))}
                  {filteredArchives.length === 0 && (
                    <div className="text-white/70 text-sm">Arşiv bulunamadı.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="diamond-card p-4 relative overflow-hidden group h-[560px] flex flex-col animate-fade-in-delayed">
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-yellow-400/80 via-yellow-500/80 to-yellow-600/80 opacity-60 group-hover:w-1.5 transition-all"></div>
            <div className="absolute inset-y-0 left-0 w-12 animate-shimmer opacity-30 pointer-events-none"></div>
            {selectedRoom ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-semibold">Oda {selectedRoom} Sohbeti</h3>
                  <span className="text-white/70 text-xs">{chat.length} mesaj</span>
                </div>
                {!isArchived && (
                  <div className="mb-2 flex justify-end">
                    <button onClick={finishChat} className="btn-outline text-[11px] flex items-center gap-1">
                      <FaCheckCircle /> Sohbeti Bitir
                    </button>
                  </div>
                )}
                {isArchived && (
                  <div className="mb-2">
                    <span className="diamond-pill badge-yellow">Arşivlendi</span>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto mb-3">
                  {chat.length > visibleCount && (
                    <div className="flex justify-center mb-3">
                      <button onClick={() => setVisibleCount((c) => c + 40)} className="btn-outline text-xs py-1 px-2">
                        Daha fazla yükle
                      </button>
                    </div>
                  )}
                  {chat.slice(Math.max(0, chat.length - visibleCount)).map((msg, idx) => (
                    <div key={idx} className="mb-3">
                      <div className={`flex items-start gap-2 ${msg.isGuest ? '' : 'flex-row-reverse'}`}>
                        <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full shadow ${msg.isGuest ? 'bg-white text-gray-800' : 'bg-blue-600 text-white'}`}>
                          {msg.isGuest ? <FaUser /> : <FaHeadphones />}
                        </div>
                        <div>
                          <div
                            className={`inline-block rounded-2xl py-2 px-3 max-w-[80%] shadow ${
                              msg.isGuest ? 'bg-white text-gray-800' : 'bg-gradient-to-r from-indigo-600 via-cyan-600 to-blue-600 text-white drop-shadow-sm'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <div className={`text-[11px] mt-1 flex items-center ${msg.isGuest ? 'text-white/70' : 'justify-end text-white/90'}`}>
                            <span className="inline-flex items-center gap-1 mr-2">
                              {msg.isGuest ? '🧑‍💼 Misafir' : '🎧 Resepsiyon'}
                            </span>
                            <FaClock className="mr-1 drop-shadow-sm" />
                            <span>{formatTime(msg.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-stretch gap-2 relative">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowEmoji((s) => !s)}
                    disabled={isArchived}
                    title="Emoji"
                  >
                    <FaSmile />
                  </button>
                  {showEmoji && (
                    <div className="absolute bottom-12 left-0 z-10 grid grid-cols-8 gap-1 p-2 rounded-xl bg-white shadow-lg border text-xl">
                      {['😀','😂','😍','👍','🙏','🎉','🔥','✨','❤️','🙌','📞','🧳','🛎️','🧼','😊','😅','😎','🤝','✔️','❗'].map((e)=> (
                        <button key={e} className="hover:bg-gray-100 rounded" onClick={()=>{ setReplyText((t)=> t + e); setShowEmoji(false); const inp = document.getElementById('admin-chat-input') as HTMLInputElement|null; inp?.focus(); }}> {e} </button>
                      ))}
                    </div>
                  )}
                  {/* Hazır Yanıtlar */}
                  <div className="hidden md:flex items-center gap-2 absolute -top-10 left-0">
                    {[
                      { t: 'Merhaba! 👋', i: <FaUser /> },
                      { t: 'Size yardımcı olayım 🧭', i: <FaHeadphones /> },
                      { t: 'Kısa süre içinde döneceğiz ⏳', i: <FaClock /> },
                      { t: 'Teşekkürler 🙏', i: <FaCheckCircle /> },
                      { t: 'İlgili ekibi yönlendiriyorum 🧑‍🔧', i: <FaExclamationCircle /> },
                    ].map((q, i) => (
                      <button key={i} className="text-[11px] px-2 py-1 rounded bg-white/20 border border-white/30 text-white hover:bg-white/30 flex items-center gap-1"
                        onClick={() => { setReplyText((t) => (t ? t + ' ' : '') + q.t); const inp = document.getElementById('admin-chat-input') as HTMLInputElement|null; inp?.focus(); }}>
                        {q.i} {q.t}
                      </button>
                    ))}
                  </div>
                  <input
                    id="admin-chat-input"
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={isArchived ? 'Arşivlendi — yanıt gönderilemez' : 'Yanıt yazın...'}
                    className={`input form-base flex-1 text-gray-900 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                    disabled={isArchived}
                  />
                  <button
                    onClick={sendReply}
                    className={`btn-diamond flex items-center ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                    disabled={isArchived}
                  >
                    <FaPaperPlane className="mr-2 drop-shadow-sm" /> Gönder
                  </button>
                </div>
              </>
            ) : selectedArchiveKey ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-semibold">Arşiv Sohbeti</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs">{chat.length} mesaj</span>
                    <button className="btn-outline text-xs" onClick={()=>deleteArchive(selectedArchiveKey)} title="Arşivden sil">
                      <FaTrash className="mr-1"/> Sil
                    </button>
                  </div>
                </div>
                <div className="mb-2">
                  <span className="diamond-pill badge-yellow">Arşivlendi</span>
                </div>
                <div className="flex-1 overflow-y-auto mb-3">
                  {chat.slice(Math.max(0, chat.length - visibleCount)).map((msg, idx) => (
                    <div key={idx} className={`mb-3 ${msg.isGuest ? '' : 'text-right'}`}>
                      <div className={`inline-block rounded-2xl py-2 px-3 max-w-[80%] shadow ${msg.isGuest ? 'bg-white text-gray-800' : 'bg-gradient-to-r from-indigo-600 via-cyan-600 to-blue-600 text-white drop-shadow-sm'}`}>{msg.message}</div>
                      <div className={`text-xs mt-1 flex items-center ${msg.isGuest ? 'text-white/70' : 'justify-end text-white/90'}`}>
                        <FaClock className="mr-1 drop-shadow-sm" />
                        <span>{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-white/70 text-sm h-[40px] flex items-center justify-center">Arşivlenen sohbet — yanıt gönderilemez.</div>
              </>
            ) : (
              <div className="text-white/70 text-sm h-full flex items-center justify-center">Bir oda ya da arşiv seçerek sohbeti görüntüleyin.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminChat;