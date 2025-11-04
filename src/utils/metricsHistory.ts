export type DailyDatum = { date: string; value: number };

const KEY_PREFIX = 'metrics_history_';
const MAX_LEN = 30;

export const getTodayStr = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const storageKey = (metric: string) => `${KEY_PREFIX}${metric}`;

export const readHistory = (metric: string): DailyDatum[] => {
  try {
    const raw = localStorage.getItem(storageKey(metric));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeHistory = (metric: string, data: DailyDatum[]) => {
  try {
    localStorage.setItem(storageKey(metric), JSON.stringify(data));
  } catch {}
};

export const upsertDailyMetric = (metric: string, date: string, value: number) => {
  const list = readHistory(metric);
  const last = list[list.length - 1];
  if (last && last.date === date) {
    if (last.value !== value) {
      last.value = value;
      writeHistory(metric, list);
    }
    return;
  }
  const next = [...list, { date, value }];
  // benzersiz tarihleri garanti altına al (son kayıt kazanır)
  const seen = new Set<string>();
  const dedup = [] as DailyDatum[];
  for (let i = next.length - 1; i >= 0; i--) {
    const item = next[i];
    if (!seen.has(item.date)) {
      seen.add(item.date);
      dedup.push(item);
    }
  }
  dedup.reverse();
  const trimmed = dedup.slice(-MAX_LEN);
  writeHistory(metric, trimmed);
};

export const getSeries = (metric: string, count: number): number[] => {
  const list = readHistory(metric);
  const sliced = list.slice(-count);
  return sliced.map((d) => (typeof d.value === 'number' ? d.value : Number(d.value) || 0));
};