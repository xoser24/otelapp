// Lightweight event helpers for room updates with cross-tab support

export type Unsubscribe = () => void;

const CHANNEL_NAME = 'rooms-updated';

export function emitRoomsUpdated(payload?: any): void {
  try {
    // Intra-tab custom event
    window.dispatchEvent(new Event(CHANNEL_NAME));
  } catch {}
  try {
    // Cross-tab broadcast
    // @ts-ignore
    const BC = (window as any).BroadcastChannel ? BroadcastChannel : null;
    if (BC) {
      const ch = new BC(CHANNEL_NAME);
      ch.postMessage({ type: CHANNEL_NAME, payload });
      // Close immediately to avoid leaks
      ch.close?.();
    }
  } catch {}
}

export function onRoomsUpdated(handler: () => void): Unsubscribe {
  const onCustom = () => {
    try { handler(); } catch {}
  };
  window.addEventListener(CHANNEL_NAME, onCustom as EventListener);

  // Also listen via BroadcastChannel for cross-tab updates
  let bc: BroadcastChannel | null = null;
  try {
    // @ts-ignore
    const BC = (window as any).BroadcastChannel ? BroadcastChannel : null;
    if (BC) {
      bc = new BC(CHANNEL_NAME);
      bc.onmessage = () => {
        try { handler(); } catch {}
      };
    }
  } catch {}

  return () => {
    try { window.removeEventListener(CHANNEL_NAME, onCustom as EventListener); } catch {}
    try { bc?.close?.(); } catch {}
  };
}