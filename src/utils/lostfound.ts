export type LostItem = {
  id: string;
  roomNumber: string;
  date: string; // ISO date
  storageLocation: string;
  description?: string;
  ownerName?: string;
  ownerSurname?: string;
  delivered?: boolean;
  deliveredDate?: string;
};

export const LOST_FOUND_KEY = 'hk_lost_found_items';

export const getLostItems = (): LostItem[] => {
  try {
    const raw = localStorage.getItem(LOST_FOUND_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const setLostItems = (items: LostItem[]) => {
  try {
    localStorage.setItem(LOST_FOUND_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('hk-lost-found-updated'));
  } catch {}
};

export const addLostItem = (item: Omit<LostItem, 'id'>) => {
  const items = getLostItems();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const newItem: LostItem = { id, ...item };
  setLostItems([newItem, ...items]);
};

export const updateLostItem = (id: string, updates: Partial<LostItem>) => {
  const items = getLostItems();
  const updated = items.map(i => i.id === id ? { ...i, ...updates } : i);
  setLostItems(updated);
};

export const removeLostItem = (id: string) => {
  const items = getLostItems();
  const filtered = items.filter(i => i.id !== id);
  setLostItems(filtered);
};