import { EndOfDayReport } from '../utils/endOfDay';

const EOD_REPORTS_KEY = 'eod_reports';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function toTRY(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
}

function calcOcc(report?: EndOfDayReport): number {
  if (!report) return 0;
  const occ = report.operational?.occupiedCount ?? 0;
  const avail = report.operational?.availableCount ?? 0;
  const denom = occ + avail;
  return denom > 0 ? occ / denom : 0;
}

export function generateDailyInsights(lastReport?: EndOfDayReport): string {
  const reports = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  const ref = lastReport || reports[reports.length - 1];
  if (!ref) return 'Henüz EOD raporu bulunmuyor.';

  const occRate = calcOcc(ref);
  const prev = reports.length > 1 ? reports[reports.length - 2] : undefined;
  const prevOcc = calcOcc(prev);
  const deltaOcc = Math.round((occRate - prevOcc) * 100) / 100;

  const cardGross = ref.financial?.cardTotalGross ?? 0;
  const iban = ref.financial?.ibanTotal ?? 0;
  const cash = ref.financial?.cashTotal ?? 0;
  const expenses = ref.financial?.expenseTotal ?? 0;
  const net = (cash + (ref.financial?.cardNetTotal ?? 0) + iban) - expenses;

  const lines: string[] = [];
  lines.push(`Doluluk oranı %${Math.round(occRate * 100)}${prev ? `, dün %${Math.round(prevOcc * 100)} (${deltaOcc >= 0 ? '+' : ''}${Math.round(deltaOcc * 100)}bp).` : '.'}`);
  lines.push(`Kart gelirleri ${toTRY(cardGross)}, IBAN gelirleri ${toTRY(iban)}, nakit ${toTRY(cash)}.`);
  lines.push(`Giderler sonrası net bakiye ${toTRY(net)}.`);
  return lines.join(' ');
}

export function forecastNext3Days(): { dayOffset: number; occupancy?: number; income?: number }[] {
  const reports = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  const last7 = reports.slice(-7);
  const avgOcc = last7.length ? (last7.reduce((s, r) => s + calcOcc(r), 0) / last7.length) : 0.6;
  const avgIncome = last7.length ? (last7.reduce((s, r) => s + ((r.financial?.cashTotal ?? 0) + (r.financial?.cardNetTotal ?? 0) + (r.financial?.ibanTotal ?? 0)), 0) / last7.length) : 15000;
  return [0,1,2].map(d => ({ dayOffset: d, occupancy: Math.min(0.95, Math.max(0.4, avgOcc + (d-1)*0.03)), income: Math.max(0, avgIncome * (1 + (d-1)*0.02)) }));
}

export function getDailyRecommendation(): string {
  const forecasts = forecastNext3Days();
  const tomorrow = forecasts[1];
  const tips: string[] = [];
  if ((tomorrow.occupancy ?? 0) > 0.8) tips.push('Yarın yüksek doluluk bekleniyor; temizlik ve resepsiyon vardiyalarını güçlendirin.');
  else tips.push('Yarın orta doluluk bekleniyor; ön büro personeli esnek planlanabilir.');
  tips.push('Kart komisyonlarını optimize etmek için IBAN yönlendirmeyi uygun misafirlere önerin.');
  tips.push('Enerji tasarrufu için boş odalarda ışıklar ve klimalar kapalı tutulmalı.');
  return tips.join(' ');
}