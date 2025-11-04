export type Department = 'Reception' | 'Housekeeping' | 'Kitchen' | 'Technical' | 'Other';

export type Staff = {
  id: string;
  name: string;
  department: Department;
  // Çalışma bilgileri
  shiftType?: 'A' | 'B' | 'C' | 'Flexible';
  daysOff?: string[]; // e.g., ['Sat','Sun']
  position?: string; // Örn. Resepsiyonist
  employmentType?: 'full-time' | 'part-time' | 'contractor' | 'intern';
  status?: 'active' | 'on_leave' | 'resigned';
  // Finans / İK
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  baseSalary?: number; // ₺
  salaryCurrency?: 'TRY' | 'USD' | 'EUR';
  advanceMonthlyLimit?: number; // ₺
  iban?: string;
  // İletişim / notlar
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  // Görsel
  photoUrl?: string;
};

export type StaffLog = {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // ISO
  checkOut?: string; // ISO
  tasksAssigned?: number;
  tasksCompleted?: number;
  complaints?: number;
  thanks?: number;
  overtimeMinutes?: number;
  managerNote?: string;
};

export const STAFF_KEY = 'hotel_staff_list';
export const STAFF_LOGS_KEY = 'hotel_staff_logs';
export const STAFF_NOTES_KEY = 'hotel_staff_notes'; // per staffId

export const getAllStaff = (): Staff[] => {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

export const saveAllStaff = (list: Staff[]) => {
  try { localStorage.setItem(STAFF_KEY, JSON.stringify(list)); } catch {}
};

export const upsertStaff = (s: Staff) => {
  const list = getAllStaff();
  const idx = list.findIndex(x => x.id === s.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...s }; else list.push(s);
  saveAllStaff(list);
};

export const getStaffById = (id: string): Staff | null => {
  const list = getAllStaff();
  const f = list.find(x => x.id === id);
  return f || null;
};

export const getAllLogs = (): StaffLog[] => {
  try {
    const raw = localStorage.getItem(STAFF_LOGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

export const saveAllLogs = (logs: StaffLog[]) => {
  try { localStorage.setItem(STAFF_LOGS_KEY, JSON.stringify(logs)); } catch {}
};

export const getLogsForStaff = (staffId: string): StaffLog[] => {
  return getAllLogs().filter(l => l.staffId === staffId).sort((a,b) => (a.date < b.date ? -1 : 1));
};

export const upsertLog = (log: StaffLog) => {
  const logs = getAllLogs();
  const idx = logs.findIndex(x => x.id === log.id);
  if (idx >= 0) logs[idx] = { ...logs[idx], ...log }; else logs.push(log);
  saveAllLogs(logs);
};

// Personel silme: listeden, loglardan ve notlardan temizle
export const removeStaff = (id: string) => {
  const list = getAllStaff().filter(x => x.id !== id);
  saveAllStaff(list);
  const logs = getAllLogs().filter(l => l.staffId !== id);
  saveAllLogs(logs);
  try { localStorage.removeItem(`${STAFF_NOTES_KEY}_${id}`); } catch {}
  try { window.dispatchEvent(new Event('staff-updated')); } catch {}
};

// Basit varsayılan vardiya saatleri (dakika cinsinden, gün içi 0..1440)
const expectedByDepartment: Record<Department, { inMin: number; outMin: number }> = {
  Reception: { inMin: 9*60, outMin: 18*60 },
  Housekeeping: { inMin: 8*60, outMin: 17*60 },
  Kitchen: { inMin: 7*60, outMin: 16*60 },
  Technical: { inMin: 9*60, outMin: 18*60 },
  Other: { inMin: 9*60, outMin: 18*60 },
};

const timeToMin = (iso?: string): number | null => {
  if (!iso) return null;
  try { const d = new Date(iso); return d.getHours()*60 + d.getMinutes(); } catch { return null; }
};

export type DailyScore = {
  date: string;
  completionRate: number; // 0..100
  satisfaction: number; // 0..100
  punctuality: number; // 0..100
  overtimeBonus: number; // 0..5
  total: number; // 0..100
  details: {
    tasksAssigned: number;
    tasksCompleted: number;
    complaints: number;
    thanks: number;
    checkInDiffMin?: number; // + geç giriş, - erken
    checkOutDiffMin?: number; // + geç çıkış, - erken çıkış
    overtimeMinutes?: number;
  };
};

export const computeDailyPerformance = (staff: Staff, log: StaffLog): DailyScore => {
  const exp = expectedByDepartment[staff.department] || expectedByDepartment.Other;
  const inMin = timeToMin(log.checkIn);
  const outMin = timeToMin(log.checkOut);
  const checkInDiff = inMin == null ? 0 : (inMin - exp.inMin);
  const checkOutDiff = outMin == null ? 0 : (outMin - exp.outMin);

  const tasksAssigned = Math.max(0, log.tasksAssigned || 0);
  const tasksCompleted = Math.max(0, Math.min(tasksAssigned, log.tasksCompleted || 0));
  const completionRate = tasksAssigned === 0 ? 100 : Math.round((tasksCompleted / tasksAssigned) * 100);

  const complaints = Math.max(0, log.complaints || 0);
  const thanks = Math.max(0, log.thanks || 0);
  const satisfactionRaw = 85 + thanks*2 - complaints*5;
  const satisfaction = Math.max(0, Math.min(100, satisfactionRaw));

  const punctualityPenalty = Math.min(100, Math.abs(checkInDiff)/1.5 + Math.abs(checkOutDiff)/2);
  const punctuality = Math.max(0, Math.round(100 - punctualityPenalty));

  const overtime = Math.max(0, log.overtimeMinutes || 0);
  const overtimeBonus = Math.min(5, Math.round(overtime / 30)); // her 30dk ~ +1, max +5

  const total = Math.max(0, Math.min(100, Math.round(0.4*completionRate + 0.3*satisfaction + 0.2*punctuality + 0.1*(80 + overtimeBonus*4) )));

  return {
    date: log.date,
    completionRate,
    satisfaction,
    punctuality,
    overtimeBonus,
    total,
    details: {
      tasksAssigned, tasksCompleted, complaints, thanks,
      checkInDiffMin: inMin == null ? undefined : checkInDiff,
      checkOutDiffMin: outMin == null ? undefined : checkOutDiff,
      overtimeMinutes: overtime,
    }
  };
};

export const getScoresForStaff = (staff: Staff, logs: StaffLog[]): DailyScore[] => {
  return logs.map(l => computeDailyPerformance(staff, l));
};

export const getSeries = (scores: DailyScore[], days: number): number[] => {
  const now = new Date();
  const byDate: Record<string, number> = {};
  scores.forEach(s => { byDate[s.date] = s.total; });
  const arr: number[] = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(now.getTime() - i*24*60*60*1000);
    const key = d.toISOString().slice(0,10);
    arr.push(byDate[key] ?? 70); // boş günlere nötr 70 ver
  }
  return arr;
};

// Demo tohumlama yardımcıları
const rand = (min:number, max:number) => Math.floor(Math.random()*(max-min+1))+min;

export const seedDemoStaffIfEmpty = (id: string): Staff => {
  const existing = getStaffById(id);
  if (existing) return existing;
  const s: Staff = {
    id,
    name: 'Demo Personel',
    department: 'Reception',
    shiftType: 'A',
    daysOff: ['Sat','Sun'],
    position: 'Resepsiyonist',
    employmentType: 'full-time',
    status: 'active',
    startDate: new Date().toISOString().slice(0,10),
    baseSalary: 25000,
    salaryCurrency: 'TRY',
    advanceMonthlyLimit: 10000,
  };
  upsertStaff(s);
  return s;
};

export const seedDemoLogsIfSparse = (staffId: string) => {
  const logs = getLogsForStaff(staffId);
  if (logs.length >= 10) return; // yeterli veri var
  const all = getAllLogs();
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const d = new Date(now.getTime() - i*24*60*60*1000);
    const date = d.toISOString().slice(0,10);
    const inH = 9 + (Math.random() < 0.2 ? 0.5 : 0) + (Math.random() < 0.1 ? 0.5 : 0); // küçük rastgele gecikmeler
    const outH = 18 + (Math.random() < 0.2 ? 0.5 : 0);
    const checkIn = new Date(d.setHours(Math.floor(inH), (inH%1)*60, 0, 0)).toISOString();
    const checkOut = new Date(new Date().setHours(Math.floor(outH), (outH%1)*60, 0, 0)).toISOString();
    const tasksAssigned = rand(6, 12);
    const tasksCompleted = Math.max(0, tasksAssigned - rand(0,3));
    const complaints = Math.random() < 0.15 ? 1 : 0;
    const thanks = rand(0,2);
    const overtimeMinutes = Math.random() < 0.25 ? rand(15, 60) : 0;
    all.push({
      id: `${staffId}_${date}`,
      staffId,
      date,
      checkIn,
      checkOut,
      tasksAssigned,
      tasksCompleted,
      complaints,
      thanks,
      overtimeMinutes,
    });
  }
  saveAllLogs(all);
};

// Personel takibini sıfırla: personel listesi, loglar, notlar ve olaylar
export const resetStaffTracking = () => {
  try { localStorage.removeItem(STAFF_KEY); } catch {}
  try { localStorage.removeItem(STAFF_LOGS_KEY); } catch {}
  try { localStorage.removeItem(STAFF_NOTES_KEY); } catch {}
  try { localStorage.removeItem('hotel_staff_events'); } catch {}
  try {
    window.dispatchEvent(new Event('staff-updated'));
  } catch {}
};