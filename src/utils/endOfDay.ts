import { RoomData } from '../components/RoomCard';
import { emitRoomsUpdated } from './events';

// Constants (align with rest of app and resetDemo keys)
export const ROOMS_KEY = 'hotel_rooms';
export const ARCHIVED_GUESTS_KEY = 'hotel:guests_archive';
export const EXPENSES_KEY = 'hotel_expenses';
export const LAST_EOD_PDFS_KEY = 'last_eod_pdfs';
export const EOD_REPORTS_KEY = 'hotel:eod_reports';
export const HANDOVER_INFO_KEY = 'handover_info';
export const SHIFT_STATUS_KEY = 'shift_status';
export const POS_INFO_KEY = 'pos_info';

// Types
export type EndOfDayFinancial = {
  cashTotal: number;
  cardTotalGross: number;
  cardCommission: number;
  cardNetTotal: number;
  ibanTotal: number;
  expenseTotal: number;
  eodBalance: number;
  // Common aliases used across UI code
  generalTotal?: number; // equals eodBalance
  expensesTotal?: number; // equals expenseTotal
  cardTotal?: number; // equals cardTotalGross
  cardTotalNet?: number; // equals cardNetTotal
  iban?: number; // equals ibanTotal
  cash?: number; // equals cashTotal
  receptionist?: string;
  notes?: string;
};
export type EndOfDayOperational = { occupiedCount: number; availableCount: number };
export type EndOfDayReport = {
  date: string;
  shiftId?: string;
  createdAt: string;
  financial?: EndOfDayFinancial;
  operational?: EndOfDayOperational;
};

// Helper functions
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

function getEodWindow(dateISO: string) {
  const date = new Date(dateISO);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
  return { start, end };
}

function inWindow(iso: string, start: Date, end: Date): boolean {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function archiveCheckedOutGuests(dateISO: string) {
    const rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
    const { start, end } = getEodWindow(dateISO);
    const inDayWindow = (iso?: string) => inWindow(iso || '', start, end);
    const toArchive = rooms.filter(r => r.checkOutDate && inDayWindow(r.checkOutDate));
    const archived = readJSON<any[]>(ARCHIVED_GUESTS_KEY, []);
    const pushed = toArchive.map(r => ({
      roomNumber: r.number,
      guest: r.guestNames?.join(', ') || r.guestName || '',
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      price: r.price,
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod,
      payments: r.payments || [],
      archivedAt: new Date().toISOString(),
    }));
    const updatedRooms = rooms.map(r => {
      if (r.checkOutDate && inDayWindow(r.checkOutDate)) {
        return {
          ...r,
          // Misafir alanlarını temizle, EOD sonrası sadece oda durumu kalsın
          guestName: '',
          guestNames: [],
          phone: '',
          price: undefined,
          checkInDate: undefined,
          checkOutDate: undefined,
          willContinue: false,
          paymentStatus: undefined,
          paymentMethod: null,
          iban: '',
          payments: [],
          // Statüyü koru (kirli kalabilir), HK temizleyince available olur
        } as RoomData;
      }
      return r;
    });
    try { localStorage.setItem(ARCHIVED_GUESTS_KEY, JSON.stringify([...archived, ...pushed])); } catch {}
    try { localStorage.setItem(ROOMS_KEY, JSON.stringify(updatedRooms)); } catch {}
    try { emitRoomsUpdated(); } catch {}
    try { window.dispatchEvent(new Event('hk-cleaning-updated')); } catch {}
  }

export function computeFinancialSummaryWindow(windowStart: Date, windowEnd: Date): { cashTotal: number; cardGross: number; cardCommission: number; cardNet: number; ibanTotal: number; expensesTotal: number; eodBalance: number; items: { room: string; guest?: string; method?: 'cash'|'card'|'iban'|null; amount: number; time?: string }[] } {
  const rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
  const expenses: { amount: number; date: string }[] = readJSON(EXPENSES_KEY, []);
  const inWindow = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= windowStart.getTime() && t < windowEnd.getTime();
  };
  const paymentsWindow = rooms.flatMap(r => (r.payments || [])
    .filter(p => inWindow(p.time))
    .map(p => ({ room: r.number, guest: (r.guestNames?.join(', ') || r.guestName || undefined), method: (p.method || null) as 'cash'|'card'|'iban'|null, amount: Number(p.amount) || 0, time: p.time }))
  );
  let cashTotal = paymentsWindow.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  let cardGross = paymentsWindow.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0);
  let ibanTotal = paymentsWindow.filter(p => p.method === 'iban').reduce((s, p) => s + p.amount, 0);
  const cardCommission = Number((cardGross * 0.0375).toFixed(2));
  const cardNet = Number((cardGross - cardCommission).toFixed(2));
  const expensesTotal = expenses.filter(e => inWindow(e.date)).reduce((s, e) => s + (e.amount || 0), 0);
  const eodBalance = Number((cashTotal + cardNet + ibanTotal - expensesTotal).toFixed(2));
  return { cashTotal, cardGross, cardCommission, cardNet, ibanTotal, expensesTotal, eodBalance, items: paymentsWindow };
}

// Shift helpers
const SHIFT_ID_KEY = 'current_shift_id';

export function ensureShiftInitialized(): void {
  try {
    const sid = localStorage.getItem(SHIFT_ID_KEY);
    if (!sid) {
      const newId = `SHIFT-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
      localStorage.setItem(SHIFT_ID_KEY, newId);
    }
    const status = localStorage.getItem(SHIFT_STATUS_KEY);
    if (!status) localStorage.setItem(SHIFT_STATUS_KEY, 'active');
    try { window.dispatchEvent(new Event('shift-status-updated')); } catch {}
  } catch {}
}

export function getCurrentShiftId(): string {
  try {
    const sid = localStorage.getItem(SHIFT_ID_KEY);
    if (sid) return sid;
    ensureShiftInitialized();
    return localStorage.getItem(SHIFT_ID_KEY) || '';
  } catch { return ''; }
}

export function handoverShift(): void {
  try { localStorage.setItem(SHIFT_STATUS_KEY, 'handed_over'); } catch {}
  try { window.dispatchEvent(new Event('shift-status-updated')); } catch {}
}

export function acceptShift(): void {
  try { localStorage.setItem(SHIFT_STATUS_KEY, 'active'); } catch {}
  try { window.dispatchEvent(new Event('shift-status-updated')); } catch {}
}

export function isManualEodWindow(d: Date = new Date()): boolean {
  const hour = d.getHours();
  return hour >= 7 && hour < 12;
}

export function canHandover(d: Date = new Date()): boolean {
  const hour = d.getHours();
  // Basit kural: 12:00'dan sonra devir yapılabilir
  return hour >= 12;
}

export function isEodCompleted(d: Date = new Date()): boolean {
  try {
    const raw = localStorage.getItem('last_eod_date');
    if (!raw) return false;
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return raw.startsWith(today);
  } catch { return false; }
}

export function createEndOfDayReport(receptionist?: string, dateISO?: string, shiftId?: string): EndOfDayReport {
  const date = dateISO || new Date().toISOString();
  const { start, end } = getEodWindow(date);
  const rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
  const occ = rooms.filter(r => r.status === 'occupied').length;
  const avail = rooms.filter(r => r.status === 'available').length;
  const fin = computeFinancialSummaryWindow(start, end);
  const report: EndOfDayReport = {
    date,
    shiftId: shiftId || getCurrentShiftId(),
    createdAt: new Date().toISOString(),
    financial: {
      cashTotal: fin.cashTotal,
      cardTotalGross: fin.cardGross,
      cardCommission: fin.cardCommission,
      cardNetTotal: fin.cardNet,
      ibanTotal: fin.ibanTotal,
      expenseTotal: fin.expensesTotal,
      eodBalance: fin.eodBalance,
      // Aliases for broader UI compatibility
      generalTotal: fin.eodBalance,
      expensesTotal: fin.expensesTotal,
      cardTotal: fin.cardGross,
      cardTotalNet: fin.cardNet,
      iban: fin.ibanTotal,
      cash: fin.cashTotal,
      receptionist,
    },
    operational: { occupiedCount: occ, availableCount: avail },
  };
  // Raporu kalıcı olarak sakla (aynı gün için tek kayıt olacak şekilde)
  try {
    saveEndOfDayReport(report);
  } catch { /* ignore storage errors */ }
  return report;
}

// Kayıtlı raporları getir
export function listSavedEodReports(): EndOfDayReport[] {
  return readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
}

// Tarih aralığına göre raporları filtrele (günlük/haftalık/aylık kullanımına uygun)
export function filterEodReports(startISO?: string, endISO?: string): EndOfDayReport[] {
  const items = listSavedEodReports();
  if (!startISO && !endISO) return items;
  const start = startISO ? new Date(startISO).getTime() : Number.NEGATIVE_INFINITY;
  const end = endISO ? new Date(endISO).getTime() : Number.POSITIVE_INFINITY;
  return items.filter(r => {
    const t = new Date(r.date).getTime();
    return t >= start && t <= end;
  });
}

// Aynı güne ait kayıtları tekilleştirerek raporu kaydeder
export function saveEndOfDayReport(report: EndOfDayReport): void {
  const existing = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  const { start, end } = getEodWindow(report.date);
  const next = existing.filter(r => !inWindow(r.date, start, end));
  next.push(report);
  next.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  writeJSON(EOD_REPORTS_KEY, next);
}

// Belirli gün için raporu getirir (varsa)
export function getEndOfDayReportForDate(dateISO: string): EndOfDayReport | undefined {
  const items = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  const { start, end } = getEodWindow(dateISO);
  return items.find(r => inWindow(r.date, start, end));
}

// Belirli aralıktaki finansal özet PDF (tek sayfa)
export async function generateFinanceRangePDF(title: string, startISO: string, endISO: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Helper removed here; using global loader
  const autoTable = await loadAutoTableGlobal(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  await ensureNotoSans(doc);
  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const startStr = new Date(startISO).toLocaleDateString('tr-TR');
  const endStr = new Date(endISO).toLocaleDateString('tr-TR');

  // Aralık için toplamları hesapla
  const fin = computeFinancialSummaryWindow(new Date(startISO), new Date(endISO));

  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Dönem: ${startStr} - ${endStr}`, 12, 28);

  const gelirRows = [
    ['Kasa (Nakit)', `₺ ${fmt(fin.cashTotal)}`, 'Gün içi tahsilatlar'],
    ['Kredi Kartı (Net)', `₺ ${fmt(fin.cardNet)}`, 'Komisyon düşülmüş'],
    ['Havale / IBAN', `₺ ${fmt(fin.ibanTotal)}`, 'Banka transferleri'],
  ];
  const giderRows = [
    ['Toplam Gider', `₺ ${fmt(fin.expensesTotal)}`]
  ];
  const ozetRows = [
    ['Kart Komisyonu', `₺ ${fmt(fin.cardCommission)}`],
    ['Net Ciro', `₺ ${fmt(fin.cashTotal + fin.cardNet + fin.ibanTotal)}`],
    ['Bakiye', `₺ ${fmt(fin.eodBalance)}`],
  ];

  autoTable(doc, { head: [['GELİRLER','Tutar','Açıklama']], body: gelirRows, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25, halign: 'right' }, 2: { cellWidth: 75 } }, margin: { left: 12, right: 12 } });

  autoTable(doc, { head: [['GİDERLER','Tutar']], body: giderRows, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25, halign: 'right' } }, margin: { left: 12, right: 12 } });

  autoTable(doc, { head: [['GÜN SONU ÖZETİ','Tutar']], body: ozetRows, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 25, halign: 'right' } }, margin: { left: 12, right: 12 } });

  const fileName = `${title.toLowerCase().replace(/\s+/g,'-')}-${startStr.replace(/\./g,'-')}_${endStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

// Unicode Türkçe karakterleri için NotoSans fontunu yükle
// Replace font loader with base64 + validation
async function ensureNotoSans(doc: any): Promise<boolean> {
  const toBase64 = (buf: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  const hasCmap = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    const target = [99, 109, 97, 112]; // 'cmap'
    outer: for (let i = 0; i < bytes.length - 4; i++) {
      for (let j = 0; j < 4; j++) if (bytes[i + j] !== target[j]) continue outer;
      return true;
    }
    return false;
  };
  async function tryLoadFont(family: string, regularPath: string, boldPath: string): Promise<boolean> {
    try {
      const reg = await fetch(regularPath);
      const bold = await fetch(boldPath);
      if (!reg.ok || !bold.ok) return false;
      const ct1 = reg.headers.get('content-type') || '';
      const ct2 = bold.headers.get('content-type') || '';
      const regBuf = await reg.arrayBuffer();
      const boldBuf = await bold.arrayBuffer();
      const looksLikeTtf = (ct: string, buf: ArrayBuffer) => (ct.includes('font') || ct.includes('octet-stream')) && buf.byteLength > 5000 && hasCmap(buf);
      if (!looksLikeTtf(ct1, regBuf) || !looksLikeTtf(ct2, boldBuf)) return false;
      const regName = `${family}-Regular.ttf`;
      const boldName = `${family}-Bold.ttf`;
      (doc as any).addFileToVFS(regName, toBase64(regBuf));
      (doc as any).addFileToVFS(boldName, toBase64(boldBuf));
      (doc as any).addFont(regName, family, 'normal');
      (doc as any).addFont(boldName, family, 'bold');
      (doc as any).__pdfFontFamily = family;
      return true;
    } catch {
      return false;
    }
  }
  if (await tryLoadFont('Poppins', '/fonts/Poppins-Regular.ttf', '/fonts/Poppins-Bold.ttf')) return true;
  if (await tryLoadFont('Roboto', '/fonts/Roboto-Regular.ttf', '/fonts/Roboto-Bold.ttf')) return true;
  if (await tryLoadFont('NotoSans', '/fonts/NotoSans-Regular.ttf', '/fonts/NotoSans-Bold.ttf')) return true;
  return false;
}
// Ensure we always end with a usable font
function setSafeFont(doc: any, style: 'normal' | 'bold' = 'normal') {
  const candidates = [ (doc as any).__pdfFontFamily, 'Poppins', 'Roboto', 'NotoSans' ];
  for (const fam of candidates) {
    if (!fam) continue;
    try { (doc as any).setFont(fam, style); return; } catch { /* continue */ }
  }
  try { (doc as any).setFont('helvetica', style); } catch {}
}
async function savePdf(doc: any, fileName: string) {
  try { doc.save(fileName); } catch {}
}


function getHotelName(): string {
  try { return localStorage.getItem('hotel_name') || 'Kent Otel'; } catch { return 'Kent Otel'; }
}

function drawHeader(doc: any, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(12);
  doc.text(fixText(doc, `${getHotelName()} · ${title}`), 12, 9);
  if (subtitle) {
    setSafeFont(doc, 'normal');
    doc.setFontSize(9);
    doc.text(fixText(doc, subtitle), pageWidth - 12, 9, { align: 'right' });
  }
  doc.setTextColor(0);
}
export async function generateFinancePDF(report: EndOfDayReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

  // Tarih penceresi ve finans kalemleri
  const { start, end } = getEodWindow(report.date);
  const finWindow = computeFinancialSummaryWindow(start, end);
  const items = finWindow.items || [];

  // Başlık ve bilgi kartı
  const dateStr = new Date(report.date).toLocaleDateString('tr-TR');
  drawHeader(doc, 'GÜNLÜK MALİ RAPORU');
  doc.setDrawColor(52,152,219);
  doc.setFillColor(245, 248, 250);
  try { (doc as any).roundedRect(12, 16, pageWidth - 24, 18, 3, 3, 'FD'); } catch { doc.rect(12, 16, pageWidth - 24, 18, 'FD'); }
  setSafeFont(doc, 'bold');
  doc.setFontSize(10);
  doc.text(`Tarih: ${dateStr}`, 16, 24);
  doc.text('Vardiya:', 16, 30);
  const preparedRaw = (() => { try { const custom = localStorage.getItem('finance_prepared_by'); if (custom && custom.trim()) return custom.trim(); const rawHand = localStorage.getItem(HANDOVER_INFO_KEY); if (rawHand) { const info = JSON.parse(rawHand); if (info?.fromName && info?.toName) return `${info.fromName} - ${info.toName}`; return info?.fromName || info?.toName || ''; } } catch {} return report.financial?.receptionist || '—'; })();
  const prepared = preparedRaw.length > 28 ? preparedRaw.slice(0, 28) + '…' : preparedRaw;
  doc.text(fixText(doc, `Hazırlayan: ${prepared}`), pageWidth - 16, 24, { align: 'right' });

  // Kredi Kartı Hareketleri (Özet)
  const sectionY1 = 40;
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12, sectionY1, pageWidth - 24, 8, 2, 2, 'F'); } catch { doc.rect(12, sectionY1, pageWidth - 24, 8, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(10);
  doc.text(fixText(doc, 'KREDİ KARTI HAREKETLERİ'), 16, sectionY1 + 6);
  doc.setTextColor(0);
  const cardCount = items.filter(i => i.method === 'card').length;
  const posInfoAll = readJSON<any>(POS_INFO_KEY, {});
  const posInfo = posInfoAll[report.date] || {};
  const invoiceIssued = !!posInfo.invoiceIssued;
  const zNo = posInfo.zReportNumber || '—';
  const receiptCount = posInfo.receiptCount ?? cardCount;
  const cardRows = fixRows(doc, [
    [`${fmt(finWindow.cardNet)} TL`, dateStr, fixText(doc, invoiceIssued ? 'fatura kesildi' : '—')],
    [`${fmt(finWindow.cardGross)} TL`, dateStr, fixText(doc, `Z:${zNo} F:${receiptCount}`)],
  ]);
  autoTable(doc, {
    head: fixRows(doc, [[fixText(doc, 'Tutar (TL)'), fixText(doc, 'Tarih'), fixText(doc, 'Bilgi')]]),
    body: cardRows,
    startY: sectionY1 + 12,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 35, halign: 'right' }, 1: { cellWidth: 40 }, 2: { cellWidth: pageWidth - 24 - 35 - 40 } },
    margin: { left: 12, right: 12 },
  });
  const afterCardY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : sectionY1 + 12;

  // Yan yana kutular: Nakit/IBAN ve Giderler
  const twoColTop = afterCardY + 10;
  const colGap = 6;
  const colW = (pageWidth - 24 - colGap) / 2;

  // Sol: Nakit ve Havale Gelirleri
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12, twoColTop, colW, 8, 2, 2, 'F'); } catch { doc.rect(12, twoColTop, colW, 8, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(11);
  doc.text(fixText(doc, 'NAKİT VE HAVALE GELİRLERİ'), 16, twoColTop + 6);
  doc.setTextColor(0);
  const rate = finWindow.cardGross ? finWindow.cardCommission / finWindow.cardGross : 0;
  const ratePct = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate * 100);
  const gelirRows = fixRows(doc, [
    [fixText(doc,'Nakit'), `${fmt(finWindow.cashTotal)} TL`],
    [fixText(doc,'IBAN Transferleri'), `${fmt(finWindow.ibanTotal)} TL`],
    [fixText(doc,'Kart (Brüt)'), `${fmt(finWindow.cardGross)} TL`],
    [fixText(doc,`Komisyon Kesinti (%${ratePct})`), `- ${fmt(finWindow.cardCommission)} TL`],
    [fixText(doc,'Kart (Net — komisyon düşüldü)'), `${fmt(finWindow.cardNet)} TL`],
  ]);
  autoTable(doc, {
    head: fixRows(doc, [[fixText(doc,'Tür'),fixText(doc,'Tutar (TL)')]]),
    body: gelirRows,
    startY: twoColTop + 12,
    tableWidth: colW,
    margin: { left: 12 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: colW - 32 }, 1: { cellWidth: 28, halign: 'right' } },
  });
  const leftFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : twoColTop + 12;
  setSafeFont(doc, 'bold');
  doc.setFontSize(8);
  doc.text(fixText(doc,'Toplam Gelir'), 14, leftFinalY + 6);
  setSafeFont(doc, 'normal');
  doc.text(`${fmt(finWindow.cashTotal + finWindow.ibanTotal + finWindow.cardNet)} TL`, 12 + colW - 4, leftFinalY + 6, { align: 'right' });

  // Sağ: Giderler
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12 + colW + colGap, twoColTop, colW, 8, 2, 2, 'F'); } catch { doc.rect(12 + colW + colGap, twoColTop, colW, 8, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(11);
  doc.text('GİDERLER', 16 + colW + colGap, twoColTop + 6);
  doc.setTextColor(0);
  const expenses: { amount: number; date: string; desc?: string; description?: string; note?: string }[] = readJSON(EXPENSES_KEY, []);
  const giderRows = expenses.filter(e => !!e.amount).map(e => [ fixText(doc, (e.desc || e.description || e.note || new Date(e.date).toLocaleDateString('tr-TR'))), `${fmt(e.amount)} TL` ]);
  autoTable(doc, {
    head: fixRows(doc, [[ fixText(doc,'Kalem'),fixText(doc,'Tutar (₺/TL)') ]]),
    body: giderRows.length ? giderRows : fixRows(doc, [[ fixText(doc,'—'),fixText(doc,'0,00') ]]),
    startY: twoColTop + 12,
    tableWidth: colW,
    margin: { left: 12 + colW + colGap },
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: colW - 32 }, 1: { cellWidth: 28, halign: 'right' } },
    pageBreak: 'avoid'
  });
  const rightFinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : twoColTop + 12;
  setSafeFont(doc, 'bold');
  doc.setFontSize(8);
  doc.text(fixText(doc, 'Toplam Gider'), 14 + colW + colGap, rightFinalY + 6);
  setSafeFont(doc, 'normal');
  doc.text(`₺ ${fmt(finWindow.expensesTotal)} TL`, 12 + colW + colGap + colW - 4, rightFinalY + 6, { align: 'right' });

  // Genel Toplam kutusu ve Onay alanı
  const bottomTop = Math.max(leftFinalY, rightFinalY) + 8;
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12, bottomTop, colW, 8, 2, 2, 'F'); } catch { doc.rect(12, bottomTop, colW, 8, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(11);
  doc.text(fixText(doc, 'GENEL TOPLAM'), 16, bottomTop + 6);
  doc.setTextColor(0);
  try { (doc as any).roundedRect(12, bottomTop + 10, colW, 44, 2, 2, 'S'); } catch { doc.rect(12, bottomTop + 10, colW, 44); }
  setSafeFont(doc, 'bold');
  doc.setFontSize(9);
  // Brüt gelir
  doc.text(fixText(doc, 'Toplam Gelir (Brüt)'), 16, bottomTop + 16);
  setSafeFont(doc, 'normal');
  doc.text(`₺ ${fmt(finWindow.cashTotal + finWindow.cardGross + finWindow.ibanTotal)} TL`, 12 + colW - 4, bottomTop + 16, { align: 'right' });
  // Komisyon
  setSafeFont(doc, 'bold');
  doc.text(fixText(doc, `Komisyon Kesinti (%${ratePct})`), 16, bottomTop + 21);
  setSafeFont(doc, 'normal');
  doc.text(`- ₺ ${fmt(finWindow.cardCommission)} TL`, 12 + colW - 4, bottomTop + 21, { align: 'right' });
  // Net gelir
  setSafeFont(doc, 'bold');
  doc.text(fixText(doc, 'Toplam Gelir (Net)'), 16, bottomTop + 26);
  setSafeFont(doc, 'normal');
  doc.text(`₺ ${fmt(finWindow.cashTotal + finWindow.cardNet + finWindow.ibanTotal)} TL`, 12 + colW - 4, bottomTop + 26, { align: 'right' });
  // Gider
  setSafeFont(doc, 'bold');
  doc.text(fixText(doc, 'Toplam Gider'), 16, bottomTop + 31);
  setSafeFont(doc, 'normal');
  doc.text(`₺ ${fmt(finWindow.expensesTotal)} TL`, 12 + colW - 4, bottomTop + 31, { align: 'right' });
  // Kalan Nakit
  setSafeFont(doc, 'bold');
  doc.text(fixText(doc, 'Kalan Nakit (Kart ve IBAN hariç)'), 16, bottomTop + 36);
  setSafeFont(doc, 'normal');
  doc.text(`₺ ${fmt(finWindow.cashTotal - finWindow.expensesTotal)} TL`, 12 + colW - 4, bottomTop + 36, { align: 'right' });

  // Onay alanı (sağ)
  try { (doc as any).roundedRect(12 + colW + colGap, bottomTop, colW, 20, 2, 2, 'S'); } catch { doc.rect(12 + colW + colGap, bottomTop, colW, 20); }
  setSafeFont(doc, 'bold');
  doc.setFontSize(9);
  doc.text(fixText(doc, 'Onaylayan:'), 16 + colW + colGap, bottomTop + 8);
  doc.text(fixText(doc, 'Tarih:'), 16 + colW + colGap, bottomTop + 14);
  doc.text(fixText(doc, 'Saat:'), 16 + colW + colGap, bottomTop + 20);

  const fileName = `gunluk-mali-rapor-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

export async function generatePaymentMethodsPDF(report: EndOfDayReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const dateStr = new Date(report.date).toLocaleDateString('tr-TR');
  const f = report.financial || { cashTotal:0, cardNetTotal:0, ibanTotal:0, expenseTotal:0 } as EndOfDayFinancial;

  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Ödeme Yöntemleri', pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Tarih: ${dateStr}`, 12, 28);

  const rows = [
    ['Nakit', `₺ ${fmt(f.cashTotal)} TL`],
    ['Kart (Net)', `₺ ${fmt(f.cardNetTotal)} TL`],
    ['IBAN', `₺ ${fmt(f.ibanTotal)} TL`],
    ['Gider', `₺ ${fmt(f.expenseTotal)} TL`],
  ];

  autoTable(doc, { head: [['Yöntem','Tutar']], body: rows, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' } }, margin: { left: 12, right: 12 } });
  const fileName = `odeme-yontemleri-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

export async function generateDailyTwoPageReportPDF(report: EndOfDayReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const dateStr = new Date(report.date).toLocaleDateString('tr-TR');
  const f = report.financial || { cashTotal:0, cardNetTotal:0, cardCommission:0, cardTotalGross:0, ibanTotal:0, expenseTotal:0, eodBalance:0 } as EndOfDayFinancial;

  // Page 1: Finance summary
  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Günlük Rapor — Finans', pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Tarih: ${dateStr}  •  Vardiya: ${report.shiftId || '—'}`, 12, 28);
  const gelirRows = [
    ['Kasa (Nakit)', `₺ ${fmt(f.cashTotal)}`, 'Gün içi tahsilatlar'],
    ['Kredi Kartı (Net)', `₺ ${fmt(f.cardNetTotal)}`, `Komisyon: ₺ ${fmt(f.cardCommission)} (₺ ${fmt(f.cardTotalGross)})`],
    ['Havale / IBAN', `₺ ${fmt(f.ibanTotal)}`, 'Banka transferleri'],
  ];
  const giderRows = [ ['Toplam Gider', `₺ ${fmt(f.expenseTotal)}`] ];
  const ozetRows = [
    ['Net Ciro', `₺ ${fmt(f.cashTotal + f.cardNetTotal + f.ibanTotal)}`],
    ['Bakiye', `₺ ${fmt(f.eodBalance)}`],
  ];
  autoTable(doc, { head: [['GELİRLER','Tutar','Açıklama']], body: gelirRows, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' }, 2: { cellWidth: 70 } }, margin: { left: 12, right: 12 } });
  autoTable(doc, { head: [['GİDERLER','Tutar']], body: giderRows, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' } }, margin: { left: 12, right: 12 } });
  autoTable(doc, { head: [['ÖZET','Tutar']], body: ozetRows, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 30, halign: 'right' } }, margin: { left: 12, right: 12 } });

  // Page 2: Guest list
  doc.addPage();
  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Günlük Rapor — Misafir Listesi', pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Tarih: ${dateStr}`, 12, 28);

  const rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
  const items = rooms.filter(r => ['occupied','reserved','sold'].includes(r.status as any))
    .map(r => [
      r.number,
      (r.guestNames && r.guestNames.length ? r.guestNames.join(', ') : (r.guestName || '')),
      r.phone || '—',
      r.status,
    ]);
  const head = [['Oda','Misafir','Telefon','Durum']];
  autoTable(doc, { head, body: items, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 70 }, 2: { cellWidth: 40 }, 3: { cellWidth: 25 } }, margin: { left: 12, right: 12 } });

  const fileName = `gunluk-rapor-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

// Ödeme ve not eşleştirme yardımcıları (RoomCard alanları ile)
function mapPaymentMethodLabel(method?: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'cash' || m === 'nakit') return 'Nakit';
  if (m === 'card' || m === 'kart') return 'Kart';
  if (m === 'iban' || m === 'transfer' || m === 'havale') return 'Havale';
  return '—';
}
function mapPaymentStatusLabel(status?: string, paidFallback?: boolean): string {
  const s = (status || '').toLowerCase();
  // Hem Türkçe doğru yazımları hem de ASCII varyantlarını eşle
  if (s.includes('paid') || s.includes('ödendi') || s.includes('alındı') || s.includes('alindi')) return '✓ Alındı';
  if (s.includes('pending') || s.includes('bekle') || s.includes('borç') || s.includes('kalan') || s.includes('alınmadı') || s.includes('alinmadi')) return '✗ Alınmadı';
  return paidFallback ? '✓ Alındı' : '✗ Alınmadı';
}
export async function generateGuestListPDF(dateISO: string, receptionist?: string, shiftId?: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const fmt = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);
  const fmtTL = (n: number) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);

  const dateStr = new Date(dateISO).toLocaleDateString('tr-TR');
  const { start, end } = getEodWindow(dateISO);
  const rooms: RoomData[] = readJSON<RoomData[]>(ROOMS_KEY, []);
  // Tüm odaları göstermek için filtreyi kaldırıyoruz (boş odalar dahil)
  const allRooms = rooms.slice();

  const dayCount = (r: RoomData): number => {
    const inD = r.checkInDate ? new Date(r.checkInDate) : undefined;
    const outD = r.checkOutDate ? new Date(r.checkOutDate) : undefined;
    const until = outD && outD.getTime() <= end.getTime() ? outD : end;
    if (!inD) return 1;
    const diff = Math.ceil((until.getTime() - inD.getTime()) / (1000*60*60*24));
    return Math.max(diff || 1, 1);
  };
  const sumPaymentsInWindow = (r: RoomData): number => (r.payments || []).filter(p => {
    const t = p.time ? new Date(p.time).getTime() : 0;
    return t >= start.getTime() && t < end.getTime();
  }).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const lastMethodInWindow = (r: RoomData): string => {
    const last = (r.payments || []).filter(p => {
      const t = p.time ? new Date(p.time).getTime() : 0;
      return t >= start.getTime() && t < end.getTime();
    }).sort((a,b) => (new Date(a.time||'').getTime()) - (new Date(b.time||'').getTime())).pop();
    const m = (last?.method || r.paymentMethod || '').toLowerCase();
    if (m === 'cash') return 'Nakit';
    if (m === 'card') return 'Kart';
    if (m === 'iban' || m === 'transfer') return 'Havale';
    return '—';
  };
  const noteFor = (r: RoomData): string => {
    const out = r.checkOutDate ? new Date(r.checkOutDate) : undefined;
    if (out && out.getTime() >= start.getTime() && out.getTime() < end.getTime()) return 'Çıkış Yaptı';
    return `Devam Ediyor (${dayCount(r)}. Gün)`;
  };
  const totalDue = (r: RoomData): number => (Number(r.price) || 0) * dayCount(r);
  const paidOk = (r: RoomData): boolean => sumPaymentsInWindow(r) >= totalDue(r);
  const getStatusLabels = (r: RoomData) => {
    const paidStatus = mapPaymentStatusLabel((r.paymentStatus as any), paidOk(r));
    const methodLabel = mapPaymentMethodLabel(((r.paymentMethod as any) || lastMethodInWindow(r)));
    return { paidStatus, methodLabel };
  };

  // Üst mavi başlık
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12, 10, pageWidth - 24, 20, 3, 3, 'F'); } catch { doc.rect(12, 10, pageWidth - 24, 20, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold');
  doc.setFontSize(13);
  doc.text(fixText(doc, `${getHotelName()} – Günlük Misafir Listesi`), pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'bold');
  doc.setFontSize(11);
  doc.text(fixText(doc, '(Gün Sonu Raporu)'), pageWidth/2, 24, { align: 'center' });
  doc.setTextColor(0);

  // Üst Bilgi Alanı
  doc.setDrawColor(180);
  doc.setFillColor(245,248,250);
  try { (doc as any).roundedRect(12, 34, pageWidth - 24, 22, 3, 3, 'FD'); } catch { doc.rect(12, 34, pageWidth - 24, 22, 'FD'); }
  setSafeFont(doc, 'bold'); doc.setFontSize(9); doc.text(fixText(doc, 'Tarih:'), 16, 42);
  setSafeFont(doc, 'normal'); doc.text(dateStr, 30, 42);
  setSafeFont(doc, 'bold'); doc.text(fixText(doc, 'Vardiya:'), 16, 48);
  setSafeFont(doc, 'normal'); doc.text(shiftId || '………………', 36, 48);
  setSafeFont(doc, 'bold'); doc.text(fixText(doc, 'Hazırlayan:'), pageWidth/2 + 4, 42);
  setSafeFont(doc, 'normal'); doc.text(receptionist || '………………', pageWidth/2 + 28, 42);
  setSafeFont(doc, 'bold'); doc.text(fixText(doc, 'Sayfa:'), pageWidth/2 + 4, 48);
  setSafeFont(doc, 'normal'); doc.text('1 / 1', pageWidth/2 + 20, 48);

  // Bölüm başlığı
  const sectionY = 62;
  doc.setFillColor(41,128,185);
  try { (doc as any).roundedRect(12, sectionY, pageWidth - 24, 8, 2, 2, 'F'); } catch { doc.rect(12, sectionY, pageWidth - 24, 8, 'F'); }
  doc.setTextColor(255);
  setSafeFont(doc, 'bold'); doc.setFontSize(11); doc.text(fixText(doc, 'MİSAFİR LİSTESİ'), 16, sectionY + 6);
  doc.setTextColor(0);

  // Sayfa 1: 101-110 ve 201-403 arası odalar
  const roomsPage1 = allRooms.filter(r => {
    const num = Number(r.number);
    return (num >= 101 && num <= 110) || (num >= 201 && num <= 403);
  });
  const head = fixRows(doc, [['Oda No','Misafir Adı','Gün Sayısı','Günlük Ücret (₺/TL)','Toplam (₺/TL)','Alındı/Alınmadı','Ödeme Türü','Not / Durum','Not']]);
  const bodyPage1 = roomsPage1.map(r => {
    const { paidStatus, methodLabel } = getStatusLabels(r);
    return [
      String(r.number || '—'),
      (r.guestNames?.length ? r.guestNames.join(', ') : (r.guestName || '')),
      String(dayCount(r)),
      `₺ ${fmtTL(Number(r.price)||0)} TL`,
      `₺ ${fmtTL(totalDue(r))} TL`,
      paidStatus,
      methodLabel,
      noteFor(r),
      '', // Yeni Not sütunu - şimdilik boş
    ];
  });
  const bodyPage1Fixed = fixRows(doc, bodyPage1);
  autoTable(doc, {
    head,
    body: bodyPage1Fixed.length ? bodyPage1Fixed : fixRows(doc, [['—','—','—','—','—','—','—','—','—']]),
    startY: sectionY + 12,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 45 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25 },
      6: { cellWidth: 20 },
      7: { cellWidth: 30 },
      8: { cellWidth: 28 },
    },
    margin: { left: 12, right: 12 },
  });

  // Toplamlar ve imza bölümü tek sayfada
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : sectionY + 12;
  const activeRoomsTotals = rooms.filter(r => ['occupied','reserved','sold'].includes((r.status || '') as any));
  const totalGuestsAll = activeRoomsTotals.length;
  const totalRoomsAll = new Set(allRooms.map(r => r.number)).size;
  const debtRoomsAll = activeRoomsTotals.filter(r => !paidOk(r)).length;
  
  setSafeFont(doc, 'bold'); doc.setFontSize(9); 
  doc.text(fixText(doc, `Toplam Konaklayan Misafir Sayısı: ${fmt(totalGuestsAll)}`), 14, finalY + 8);
  doc.text(fixText(doc, `Toplam Oda Sayısı: ${fmt(totalRoomsAll)}`), 14, finalY + 14);
  doc.text(fixText(doc, `Borçlu Oda Sayısı: ${fmt(debtRoomsAll)}`), 14, finalY + 20);
  
  // İmza kutuları
  try { (doc as any).roundedRect(12, finalY + 26, (pageWidth - 24)/2 - 4, 24, 2, 2, 'S'); } catch { doc.rect(12, finalY + 26, (pageWidth - 24)/2 - 4, 24); }
  setSafeFont(doc, 'bold'); doc.text(fixText(doc, 'Rapor Hazırlayan'), 16, finalY + 34);
  setSafeFont(doc, 'normal'); doc.text('………………………………', 16, finalY + 44);
  
  try { (doc as any).roundedRect(12 + (pageWidth - 24)/2 + 4, finalY + 26, (pageWidth - 24)/2 - 4, 24, 2, 2, 'S'); } catch { doc.rect(12 + (pageWidth - 24)/2 + 4, finalY + 26, (pageWidth - 24)/2 - 4, 24); }
  setSafeFont(doc, 'bold'); doc.text(fixText(doc, 'Onay'), 16 + (pageWidth - 24)/2 + 8, finalY + 34);
  setSafeFont(doc, 'normal'); doc.text(`___ / ${new Date(dateISO).getFullYear()}`, 16 + (pageWidth - 24)/2 + 8, finalY + 40);
  doc.text('(imza)', 16 + (pageWidth - 24)/2 + 8, finalY + 46);

  const fileName = `gunluk-misafir-listesi-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

export async function generateGuestListBlankTemplatePDF(dateISO: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = new Date(dateISO).toLocaleDateString('tr-TR');

  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Misafir Listesi (Şablon)', pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Tarih: ${dateStr}`, 12, 28);

  const head = [['Oda','Misafir','Telefon','Giriş','Çıkış','Durum']];
  const empty = Array.from({ length: 20 }).map(() => ['','','','','','']);
  autoTable(doc, { head, body: empty, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, margin: { left: 12, right: 12 } });

  const fileName = `misafir-listesi-sablon-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}

export async function generateFinanceBlankTemplatePDF(dateISO: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTable = await loadAutoTableGlobal(doc);
  await ensureNotoSans(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = new Date(dateISO).toLocaleDateString('tr-TR');

  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Finans (Şablon)', pageWidth/2, 18, { align: 'center' });
  setSafeFont(doc, 'normal');
  doc.setFontSize(9);
  doc.text(`Tarih: ${dateStr}`, 12, 28);

  const gelirHead = [['GELİRLER','Tutar','Açıklama']];
  const giderHead = [['GİDERLER','Tutar']];
  const ozetHead = [['ÖZET','Tutar']];
  const empties1 = Array.from({ length: 8 }).map(() => ['','','']);
  const empties2 = Array.from({ length: 6 }).map(() => ['','']);

  autoTable(doc, { head: gelirHead, body: empties1, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, margin: { left: 12, right: 12 } });
  autoTable(doc, { head: giderHead, body: empties2, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, margin: { left: 12, right: 12 } });
  autoTable(doc, { head: ozetHead, body: empties2, startY: (doc as any).lastAutoTable.finalY + 8, styles: { fontSize: 8 }, headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' }, margin: { left: 12, right: 12 } });

  const fileName = `finans-sablon-${dateStr.replace(/\./g,'-')}.pdf`;
  await savePdf(doc, fileName);
}
// Light helper to load autotable at runtime (shared)
async function loadAutoTableGlobal(doc: any) {
  const { default: autoTable } = await import('jspdf-autotable');
  return autoTable as (doc: any, opts: any) => void;
}

function hasUnicodeFont(doc: any): boolean { return !!(doc as any).__pdfFontFamily; }
function normalizeTR(s: string): string {
  if (!s) return s;
  return s
    .replace(/₺/g, 'TL')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/’/g, "'")
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}
function fixText(doc: any, s: string): string { return hasUnicodeFont(doc) ? s : normalizeTR(s); }
function fixRows(doc: any, rows: any[][]): any[][] {
  return rows.map(r => r.map(c => typeof c === 'string' ? fixText(doc, c) : c));
}