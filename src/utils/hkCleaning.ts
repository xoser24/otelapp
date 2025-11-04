export type Checklist = {
  // Not: yatak ve banyo temizliği günlük görevlere taşındı; bu alanlar opsiyonel
  bedClean?: boolean;
  bathroomClean?: boolean;
  remotesOk: boolean;
  minibarOk: boolean;
  floorsClean: boolean;
  towelsStocked: boolean;
  toiletriesStocked: boolean;
  slippersPresent: boolean;
};

export type Assignments = {
  bathroomBy?: string;
  bedBy?: string;
};

export type CleaningStatus = {
  inProgress: boolean;
  startTime?: number; // epoch ms
  completedAt?: number; // epoch ms
  checklist?: Checklist;
  assignments?: Assignments;
};

export type CleaningStatusMap = Record<string, CleaningStatus>; // key: room number

export const HK_CLEANING_KEY = 'hk_cleaning_status';

export const getCleaningMap = (): CleaningStatusMap => {
  try {
    const raw = localStorage.getItem(HK_CLEANING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setCleaningMap = (map: CleaningStatusMap) => {
  try {
    localStorage.setItem(HK_CLEANING_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('hk-cleaning-updated'));
  } catch {}
};

export const startCleaning = (roomNumber: string) => {
  const map = getCleaningMap();
  map[roomNumber] = { inProgress: true, startTime: Date.now() };
  setCleaningMap(map);
};

export const completeCleaning = (roomNumber: string) => {
  const map = getCleaningMap();
  const prev = map[roomNumber] || {} as CleaningStatus;
  map[roomNumber] = { inProgress: false, startTime: prev.startTime, completedAt: Date.now() };
  setCleaningMap(map);
};

export const finalizeCleaning = (
  roomNumber: string,
  checklist: Checklist,
  assignments: Assignments
) => {
  const map = getCleaningMap();
  const prev = map[roomNumber] || {} as CleaningStatus;
  map[roomNumber] = {
    inProgress: false,
    startTime: prev.startTime,
    completedAt: Date.now(),
    checklist,
    assignments,
  };
  setCleaningMap(map);
};