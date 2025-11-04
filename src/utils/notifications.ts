export type NotificationPayload = {
  title: string;
  message: string;
  type: 'housekeeping' | 'maintenance' | 'reception' | 'room_service' | 'system';
  priority: 'high' | 'medium' | 'low';
  recipient: string;
};

export const NOTIFICATIONS_STORAGE_KEY = 'notifications';

export function pushNotification(payload: NotificationPayload) {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const maxId = list.length ? Math.max(...list.map((n: any) => Number(n.id) || 0)) : 0;
    const created = {
      id: maxId + 1,
      ...payload,
      status: 'unread',
      timestamp: new Date().toISOString(),
      actions: ['assign', 'dismiss'],
    };
    const updated = [created, ...list];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    // Aynı sekmede yakalamak için özel olay tetikle
    window.dispatchEvent(new Event('notificationsUpdated'));
    return created;
  } catch (e) {
    // Yut
    return null;
  }
}