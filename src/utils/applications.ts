export type ApplicationStatus = 'new' | 'accepted' | 'rejected';

export type JobApplication = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  department?: string;
  cvUrl?: string;
  note?: string;
  createdAt: string; // ISO
  status: ApplicationStatus;
};

const APPS_KEY = 'job_applications';

const readJSON = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const writeJSON = <T,>(key: string, value: T) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

export const getApplications = (): JobApplication[] => readJSON<JobApplication[]>(APPS_KEY, []);
export const setApplications = (list: JobApplication[]) => { writeJSON(APPS_KEY, list); try { window.dispatchEvent(new Event('applications-updated')); } catch {} };
export const addApplication = (app: Omit<JobApplication, 'id' | 'createdAt' | 'status'> & { status?: ApplicationStatus }): JobApplication => {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const rec: JobApplication = { id, createdAt: new Date().toISOString(), status: app.status || 'new', ...app };
  setApplications([rec, ...getApplications()]);
  return rec;
};
export const updateApplication = (id: string, patch: Partial<JobApplication>) => {
  const list = getApplications();
  const idx = list.findIndex(a => a.id === id);
  if (idx >= 0) { list[idx] = { ...list[idx], ...patch }; setApplications(list); }
};
export const removeApplication = (id: string) => { setApplications(getApplications().filter(a => a.id !== id)); };