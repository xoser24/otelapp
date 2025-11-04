import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';

// Varsayılan oda numaraları (Rooms/HK ile uyumlu)
const DEFAULT_ROOM_NUMBERS = [
  '101','102','103','104','105','106','107','108','109','110',
  '201','203','204','205','206','207','208','209','210','211','212','213',
  '301','303','304','305','306','307','308','309','310','311','312','313','314','315',
  '402','403'
];

const ROOMS_KEY = 'hotel_rooms';

const RoomQRCodes: React.FC = () => {
  const [roomNumbers, setRoomNumbers] = useState<string[]>(DEFAULT_ROOM_NUMBERS);
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    try { return window.location.origin; } catch { return 'http://localhost:3003'; }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as { number: string }[];
        const nums = Array.isArray(arr) ? arr.map(r => r.number) : DEFAULT_ROOM_NUMBERS;
        const uniqueSorted = Array.from(new Set(nums)).sort((a,b) => a.localeCompare(b));
        setRoomNumbers(uniqueSorted);
      }
    } catch {
      setRoomNumbers(DEFAULT_ROOM_NUMBERS);
    }
  }, []);

  const qrEntries = useMemo(() => {
    return roomNumbers.map(n => ({ room: n, url: `${baseUrl}/portal?room=${n}` }));
  }, [roomNumbers, baseUrl]);

  const downloadSvg = (room: string) => {
    try {
      const el = document.querySelector(`#qr-${room} svg`) as SVGElement | null;
      if (!el) { alert('SVG bulunamadı.'); return; }
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(el);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oda-${room}-qr.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('İndirme sırasında bir hata oluştu.');
    }
  };

  const printAll = () => {
    try { window.print(); } catch {}
  };

  return (
    <div className="p-6">
      <div className="diamond-band mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="icon-badge">🔗</span>
            <div>
              <h1 className="band-title">Oda QR Kodları</h1>
              <p className="text-white/80 text-sm">Misafir portalına hızlı erişim için her oda QR kodu.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printAll} className="btn-outline">Tümünü Yazdır / PDF</button>
          </div>
        </div>
      </div>

      <div className="premium-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">Temel URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3003"
            className="px-3 py-2 rounded-lg border border-gray-300 w-full"
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">Örnek URL: {`${baseUrl}/portal?room=101`}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {qrEntries.map(({ room, url }) => (
          <div key={room} className="premium-card p-4 flex flex-col items-center">
            <div id={`qr-${room}`} className="bg-white p-4 rounded-lg shadow-md">
              <QRCode value={url} size={200} />
            </div>
            <div className="mt-3 text-sm text-gray-700 font-medium">Oda {room}</div>
            <div className="text-xs text-gray-500">{url}</div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => downloadSvg(room)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700">SVG İndir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomQRCodes;