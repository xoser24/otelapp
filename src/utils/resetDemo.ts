export function resetAllDemoData() {
  try {
    const explicitKeys = [
      // Auth and user
      'isAuthenticated', 'user',
      // UI/branding
      'hotel_name', 'hotel_logo_url', 'login_logo_url',
      // Notifications and faults
      'notifications', 'fault_resolutions',
      // Rooms, reservations, expenses
      'hotel_rooms', 'hotel:reservations', 'hotel_expenses', 'manual_sales',
      // Maintenance & housekeeping
      'maintenance_reports', 'hk_daily_plans', 'hk_cleaning_status', 'hk_lost_found_items',
      // EOD & shift system
      'hotel:eod_reports', 'current_shift_id', 'shift_status', 'last_eod_date', 'handover_info', 'eod_auto_enabled', 'system_lock_after_eod', 'pos_info', 'cash_real_total', 'last_eod_pdfs',
      // Guests
      'hotel:guests', 'hotel:guests_archive', 'hotel:soft_checkout',
      // AI and misc
      'ai_history'
    ];

    explicitKeys.forEach((k) => { try { localStorage.removeItem(k); } catch {} });

    // Remove any metric histories and chat histories/statuses
    const removeByPattern: ((key: string) => boolean)[] = [
      (k) => k.endsWith(':history'),
      (k) => k.startsWith('hotel:chat:room:'),
      (k) => k.startsWith('hotel:chat:archive:'),
    ];

    // Collect keys first to avoid length changes during iteration
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    allKeys.forEach((k) => {
      if (removeByPattern.some((fn) => fn(k))) {
        try { localStorage.removeItem(k); } catch {}
      }
    });

    // Dispatch light-weight events so listeners may update
    try { window.dispatchEvent(new Event('notificationsUpdated')); } catch {}
    try { window.dispatchEvent(new Event('hk-cleaning-updated')); } catch {}
  } catch {}
}

export function resetAndReload() {
  resetAllDemoData();
  try {
    // EOD otomatiği ilk kurulum mantığı gereği yoksa false olarak set edilecek
    // index.tsx başlangıcında kontrol var, o yüzden burada ayrıca set etmeye gerek yok
  } catch {}
  window.location.reload();
}

export function exitDemoAndReload() {
  try { localStorage.setItem('app:mode', 'prod'); } catch {}
  resetAllDemoData();
  window.location.reload();
}