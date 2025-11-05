# Otel Yönetim Sistemi

Akıllı otomasyon ve yapay zeka destekli otel yönetim sistemi.

## Özellikler

### 1. AKILLI OTOMASYON & YAPAY ZEKA KATMANI
- **AI Housekeeping Asistanı**: Temizlik görevlerini otomatik önceliklendirme ve iş dağılımı
- **AI Misafir Memnuniyet Analizi**: Misafir geri bildirimlerinin NLP ile analizi
- **Karbon Ayak İzi & Tasarruf Hesaplama**: Sürdürülebilirlik metrikleri

### 2. MİSAFİR DENEYİMİ KATMANI
- **QR Kodlu Akıllı Misafir Portalı**: Uygulama indirmeden hizmetlere erişim
- **Dil Desteği & Otomatik Çeviri**: Çok dilli iletişim desteği
- **Otomatik ChatBot**: 7/24 misafir desteği

### 3. PATRON & RESEPSİYON YÖNETİM KATMANI
- **Dinamik Gelir-Gider & Doluluk Analizi**: İş performans metrikleri
- **Entegre Bildirim Sistemi**: Rol bazlı bildirimler
- **Veri Güvenliği ve Loglama**: GDPR uyumlu veri yönetimi

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm start
```

## Teknoloji Yığını
- **Frontend**: React, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js (Express), Prisma ORM
- **Veritabanı**: PostgreSQL
- **Gerçek Zamanlı İletişim**: WebSocket / Socket.io
- **AI Analiz**: Python FastAPI mikroservis

## Deploy (CI/CD)

- **Frontend (Vercel)**
  - `REACT_APP_SOCKET_URL` ortam değişkenini Render’daki backend URL’sine yönlendirin.
  - Vercel üzerinde yeni proje oluşturun ve GitHub repo’yu bağlayın.
  - Build komutu: `npm run build`, Output: `build`
  - Tek tık deploy için Vercel UI üzerinden import edip environment’ı tanımlayın.

- **Backend (Render)**
  - Render’da `Web Service` oluşturun, root: `server/`.
  - Start komutu: `npm run start`, Build komutu: `npm run build`.
  - Ortam değişkenleri: `DATABASE_URL`, `PORT` (4000), `CORS_ORIGIN` (Vercel domaini).
  - Sağlanan endpointler: `POST /api/rooms/:id/checkin`, `POST /api/rooms/:id/checkout`, `POST /api/rooms/:id/cleaning/start`, `POST /api/rooms/:id/cleaning/finish`.

## Ortam Değişkenleri

Bkz: `.env.example`

## E2E Senaryolar (Basit)

- Check-in → Housekeeping gerçek zamanlı “Dolu” görsün.
- Check-out → Housekeeping “Kirli” görsün.
- HK temizlik başlat/bitir → Resepsiyon “Temizleniyor/Temiz” görsün.

## Geliştirici Notları

- Merkezi `RoomStatusController` socket ile `roomStatusChanged` yayınlar.
- Frontend Rooms sayfası socket dinleyiciyi başlatır ve local depoyu günceller.