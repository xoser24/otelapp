import { EndOfDayReport } from '../utils/endOfDay';

const EOD_REPORTS_KEY = 'eod_reports';

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

function calcOcc(report?: EndOfDayReport): number {
  if (!report) return 0;
  const occ = report.operational?.occupiedCount ?? 0;
  const avail = report.operational?.availableCount ?? 0;
  const denom = occ + avail;
  return denom > 0 ? occ / denom : 0;
}

export function predictOccupancyAndEnergy(): { occupancy: number; workload: number; energyUse: number } {
  const reports = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  const last7 = reports.slice(-7);
  const occ = last7.length ? last7.reduce((s, r) => s + calcOcc(r), 0) / last7.length : 0.6;
  const workload = Math.min(1, Math.max(0, occ + 0.1));
  const energyUse = Math.round((300 * workload) + (Math.random() * 20));
  return { occupancy: occ, workload, energyUse };
}