import React, { useEffect, useState } from 'react';
import { createEndOfDayReport, generateGuestListPDF, generateFinancePDF, archiveCheckedOutGuests, HANDOVER_INFO_KEY } from '../utils/endOfDay';
import { activateTomorrowReservationsOnEod } from '../utils/reservations';
import { resetAndReload, exitDemoAndReload } from '../utils/resetDemo';



const Settings: React.FC = () => {
  const [hotelName, setHotelName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string>('#f59e0b');

  useEffect(() => {
    try {
      setHotelName(localStorage.getItem('hotel_name') || '');
      setLogoUrl(localStorage.getItem('hotel_logo_url'));
      setBrandColor(localStorage.getItem('brand_color') || '#f59e0b');
    } catch {
      setHotelName('');
      setLogoUrl(null);
      setBrandColor('#f59e0b');
    }
  }, []);

  const saveHotelName = () => {
    try { localStorage.setItem('hotel_name', hotelName.trim() || ''); } catch {}
    alert('Otel adı kaydedildi.');
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'hotel_name' } as any)); } catch {}
  };

  const handleLogoChange = async (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      try { localStorage.setItem('hotel_logo_url', dataUrl); } catch {}
      setLogoUrl(dataUrl);
      try { window.dispatchEvent(new StorageEvent('storage', { key: 'hotel_logo_url' } as any)); } catch {}
      alert('Logo güncellendi.');
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    try { localStorage.removeItem('hotel_logo_url'); } catch {}
    setLogoUrl(null);
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'hotel_logo_url' } as any)); } catch {}
    alert('Logo kaldırıldı.');
  };

  const saveBrandColor = () => {
    try { localStorage.setItem('brand_color', brandColor); } catch {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'brand_color' } as any)); } catch {}
    alert('Marka rengi kaydedildi.');
  };






  const runManualEod = async () => {
    try {

      const dateISO = new Date().toISOString();
      const rawHand = localStorage.getItem(HANDOVER_INFO_KEY);
      const info = rawHand ? JSON.parse(rawHand) as { fromName?: string; toName?: string } : null;
      const recep = info ? (info.fromName && info.toName ? `${info.fromName} - ${info.toName}` : (info.toName || info.fromName || '')) : undefined;
      const report = createEndOfDayReport(recep, dateISO);
      activateTomorrowReservationsOnEod(dateISO);
      await generateGuestListPDF(report.date, recep, report.shiftId);
      await generateFinancePDF(report);
      archiveCheckedOutGuests(report.date);
      alert('Gün sonu raporu oluşturuldu; yarınki rezervasyonlar aktive edildi. Raporlar sayfasını kontrol ediniz.');
    } catch (e) {
      console.error(e);
      alert('Manuel EOD sırasında hata oluştu.');
    }
  };

  const exportLocalStorage = () => {
    try {
      const data: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        data[key] = localStorage.getItem(key);
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `otelapp-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert('Yedek indirildi.');
    } catch (e) {
      console.error(e);
      alert('Yedek alınırken hata oluştu.');
    }
  };

  const importLocalStorage = async (file?: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, string | null>;
      const ok = window.confirm('Geri yükleme mevcut verileri üzerine yazacak. Devam etmek istiyor musunuz?');
      if (!ok) return;
      Object.keys(data).forEach(k => {
        const v = data[k];
        if (typeof v === 'string') {
          localStorage.setItem(k, v);
        } else {
          localStorage.removeItem(k);
        }
      });
      // Misafirler ve odalar sayfası senkronize olsun
      window.dispatchEvent(new Event('hk-cleaning-updated'));
      alert('Geri yükleme tamamlandı.');
    } catch (e) {
      console.error(e);
      alert('Geri yükleme sırasında hata oluştu.');
    }
  };

  return (
    <div className="p-6">
      <div className="rounded-xl overflow-hidden mb-6">
        <div className="section-band section-band-blue">
          <h1 className="text-2xl font-bold">Ayarlar</h1>
          <p className="text-white/80 text-sm">Otomasyon ve raporlama tercihleri</p>
        </div>
      </div>

      {/* Otel Bilgisi */}
      <div className="premium-card p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Otel Adı</div>
            <div className="text-xs text-gray-600">Üst menüde görünecek isim</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Örn: My Hotel" className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <button onClick={saveHotelName} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Kaydet</button>
        </div>
      </div>

      {/* Marka Ayarları */}
      <div className="premium-card p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Marka Ayarları</div>
            <div className="text-xs text-gray-600">Logo ve tema rengi</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">Logo yok</span>
              )}
            </div>
            <label className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoChange(e.target.files?.[0])} />
              Logo Yükle
            </label>
            {logoUrl && (
              <button onClick={removeLogo} className="px-3 py-2 rounded-lg bg-rose-100 text-rose-700 text-sm hover:bg-rose-200">Kaldır</button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-10 h-10 rounded-md border border-gray-300" />
            <button onClick={saveBrandColor} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Rengi Kaydet</button>
          </div>
        </div>
      </div>

      <div className="premium-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Gün Sonu Modu</div>
            <div className="text-xs text-gray-600">Otomatik kaldırıldı • Artık tamamen manuel, saat sınırsız.</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm">Manuel</div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Manuel Gün Sonu</div>
            <div className="text-xs text-gray-600">Raporlar, PDF ve arşivleme işlemlerini şimdi çalıştır.</div>
          </div>
          <button onClick={runManualEod} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700">Şimdi Çalıştır</button>
        </div>
      </div>

      <div className="premium-card p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Veri Yedekleme</div>
            <div className="text-xs text-gray-600">Tüm uygulama verilerini JSON olarak indir.</div>
          </div>
          <button onClick={exportLocalStorage} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Yedeği İndir</button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Veri Geri Yükleme</div>
            <div className="text-xs text-gray-600">Bir yedek dosyasından verileri geri yükle.</div>
          </div>
          <label className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 cursor-pointer">
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importLocalStorage(e.target.files?.[0])} />
            Dosya Seç
          </label>
        </div>
      </div>

      <div className="premium-card p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Uygulamayı Sıfırla</div>
            <div className="text-xs text-gray-600">Demo modunu kapatır, tüm verileri temizler ve yeniden başlatır. PDF üretimi etkilenmez.</div>
          </div>
          <button onClick={() => { const ok = window.confirm('Demo modu kapatılacak, tüm veriler silinecek ve sayfa yenilenecek. Onaylıyor musunuz?'); if (ok) exitDemoAndReload(); }} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700">Sıfırla</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;