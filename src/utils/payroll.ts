import { getEventsForStaff } from './staffEvents';

export type PayrollEntry = {
  id: string;
  staffId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  advances: number;
  bonuses: number;
  penalties: number;
  netPaid: number;
  createdAt: string; // ISO
  note?: string;
};

const KEY = 'hotel_payroll_ledger';

const readJSON = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const writeJSON = <T,>(key: string, value: T) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

export const getPayrollLedger = (): PayrollEntry[] => readJSON<PayrollEntry[]>(KEY, []);
export const setPayrollLedger = (list: PayrollEntry[]) => writeJSON(KEY, list);
export const getPayrollForStaff = (staffId: string): PayrollEntry[] => getPayrollLedger().filter(p => p.staffId === staffId).sort((a,b)=> (a.month < b.month ? 1 : -1));

export const monthKey = (d = new Date()): string => d.toISOString().slice(0,7);

export const computeMonthlyTotals = (staffId: string, d = new Date()) => {
  const key = monthKey(d);
  const evts = getEventsForStaff(staffId);
  const inMonth = evts.filter(e => (e.date || '').startsWith(key));
  const advances = inMonth.filter(e => e.type === 'advance').reduce((s,e)=> s + (Number(e.amount)||0), 0);
  const bonuses = inMonth.filter(e => e.type === 'bonus').reduce((s,e)=> s + (Number(e.amount)||0), 0);
  const penalties = inMonth.filter(e => e.type === 'penalty').reduce((s,e)=> s + (Number(e.amount)||0), 0);
  return { advances, bonuses, penalties };
};

export const recordMonthlyPayroll = (staffId: string, baseSalary: number, note?: string, d = new Date()) => {
  const key = monthKey(d);
  const existing = getPayrollLedger().find(p => p.staffId === staffId && p.month === key);
  if (existing) return existing; // zaten işlenmiş
  const { advances, bonuses, penalties } = computeMonthlyTotals(staffId, d);
  const netPaid = Math.max(0, (Number(baseSalary)||0) + (bonuses||0) - (advances||0) - (penalties||0));
  const rec: PayrollEntry = {
    id: `${staffId}_${key}`,
    staffId,
    month: key,
    baseSalary: Number(baseSalary)||0,
    advances,
    bonuses,
    penalties,
    netPaid,
    createdAt: new Date().toISOString(),
    note,
  };
  const list = getPayrollLedger();
  list.push(rec);
  setPayrollLedger(list);
  return rec;
};