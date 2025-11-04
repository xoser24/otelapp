import { EndOfDayReport, createEndOfDayReport, generateGuestListPDF, generateFinancePDF } from '../utils/endOfDay';

const EOD_REPORTS_KEY = 'eod_reports';

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeJSON<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ } }

export async function runEodAndGenerate(dateISO: string): Promise<EndOfDayReport> {
  const report = createEndOfDayReport(undefined, dateISO);
  const reports = readJSON<EndOfDayReport[]>(EOD_REPORTS_KEY, []);
  reports.push(report);
  writeJSON(EOD_REPORTS_KEY, reports);
  await generateGuestListPDF(report.date, report.financial?.receptionist, report.shiftId);
  await generateFinancePDF(report);
  return report;
}

export function attachAiSummary(report: EndOfDayReport, summaryText: string): EndOfDayReport {
  return { ...report, financial: { ...report.financial, notes: `${report.financial?.notes ? report.financial.notes + ' ' : ''}${summaryText}` } } as EndOfDayReport;
}