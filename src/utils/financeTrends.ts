import { EndOfDayReport, listSavedEodReports } from './endOfDay';

export type FinancePoint = {
  date: string; // YYYY-MM-DD
  income: number;
  expenses: number;
  net: number;
  breakdown: { cash: number; cardGross: number; cardNet: number; iban: number };
};

function ymd(dateISO: string): string {
  try { return new Date(dateISO).toISOString().slice(0,10); } catch { return dateISO.slice(0,10); }
}

export function getLastNDaysSeries(n: number): FinancePoint[] {
  const reports: EndOfDayReport[] = listSavedEodReports();
  const byDay = new Map<string, EndOfDayReport>();
  for (const r of reports) {
    // Keep latest per day if duplicates
    byDay.set(ymd(r.date), r);
  }
  const today = new Date();
  const series: FinancePoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0,10);
    const rep = byDay.get(key);
    const cash = rep?.financial?.cashTotal ?? 0;
    const cardGross = rep?.financial?.cardTotalGross ?? rep?.financial?.cardTotal ?? 0;
    const cardNet = rep?.financial?.cardNetTotal ?? rep?.financial?.cardTotalNet ?? 0;
    const iban = rep?.financial?.ibanTotal ?? rep?.financial?.iban ?? 0;
    const expenses = rep?.financial?.expenseTotal ?? rep?.financial?.expensesTotal ?? 0;
    const income = cash + cardNet + iban; // use net for card to reflect commission
    const net = income - expenses;
    series.push({ date: key, income, expenses, net, breakdown: { cash, cardGross, cardNet, iban } });
  }
  return series;
}

export function sumLastNDays(n: number): { income: number; expenses: number; net: number } {
  const s = getLastNDaysSeries(n);
  const income = s.reduce((acc, p) => acc + p.income, 0);
  const expenses = s.reduce((acc, p) => acc + p.expenses, 0);
  const net = income - expenses;
  return { income, expenses, net };
}