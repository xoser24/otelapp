import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ensureShiftInitialized } from './utils/endOfDay';
import { scheduleReservationNotifications } from './utils/reservations';

// ResizeObserver hatalarını güçlü şekilde bastır (sadece geliştirme ortamında)
if (process.env.NODE_ENV === 'development') {
  (() => {
    const roPattern = /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i;

    // Yardımcı: mesaj veya Error objesinden metni çıkarıp RO hatası mı kontrol et
    const isROMessage = (input: any): boolean => {
      if (!input) return false;
      const text = typeof input === 'string' ? input : (input?.message || String(input));
      return typeof text === 'string' && roPattern.test(text);
    };

    // ResizeObserver callbacklarını rAF ile kuyrukla: overlay hatalarını önler
    try {
      const NativeRO = (window as any).ResizeObserver;
      if (typeof NativeRO === 'function') {
        (window as any).ResizeObserver = class ResizeObserver extends NativeRO {
          constructor(callback: any) {
            super((entries: any, obs: any) => {
              requestAnimationFrame(() => {
                try { callback(entries, obs); } catch (e) { /* swallow in dev */ }
              });
            });
          }
        };
      }
    } catch {}

    // console.error filtrele (string veya Error objesi)
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (args.some(a => isROMessage(a))) {
        return;
      }
      originalError.apply(console, args as any);
    };

    // window.onerror ile erken yakala ve bastır
    const originalOnError = window.onerror;
    window.onerror = function (message: any, source?: any, lineno?: any, colno?: any, error?: any) {
      if (isROMessage(message) || isROMessage(error)) {
        // returning true prevents the default handling
        return true;
      }
      if (typeof originalOnError === 'function') {
        // @ts-ignore
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // error ve unhandledrejection dinle, varsayılan ve overlay'e ulaşmadan durdur
    window.addEventListener(
      'error',
      (event: ErrorEvent) => {
        if (isROMessage(event.message) || isROMessage((event as any).error)) {
          event.preventDefault();
          // @ts-ignore
          event.stopImmediatePropagation?.();
        }
      },
      { capture: true }
    );

    window.addEventListener(
      'unhandledrejection',
      (event: PromiseRejectionEvent) => {
        const reason: any = event.reason;
        if (isROMessage(reason)) {
          event.preventDefault();
          // @ts-ignore
          (event as any).stopImmediatePropagation?.();
        }
      },
      { capture: true }
    );
  })();
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
(function initEodScheduler(){ try { if (!(window as any).__eodSchedulerStarted) { if (localStorage.getItem('eod_auto_enabled') === null) { localStorage.setItem('eod_auto_enabled', 'false'); } ensureShiftInitialized(); (window as any).__eodSchedulerStarted = true; } } catch {} })();

(function initReservationNotifications(){
  try {
    if (!(window as any).__reservationNotifStarted) {
      const stop = scheduleReservationNotifications();
      (window as any).__reservationNotifStop = stop;
      (window as any).__reservationNotifStarted = true;
    }
  } catch {}
})();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance ölçümü için
reportWebVitals();