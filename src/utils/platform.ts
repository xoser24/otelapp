export type PlatformMode = 'web' | 'mobile';

const queryFlag = (key: string): boolean => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) === '1' || params.get(key) === 'true';
  } catch { return false; }
};

export const isMobilePlatform = (): boolean => {
  // Explicit overrides via query: ?mobile=1 or ?desktop=1
  if (queryFlag('mobile')) return true;
  if (queryFlag('desktop')) return false;
  try {
    const ua = navigator.userAgent || '';
    const isTouch = 'ontouchstart' in window;
    const small = Math.min(window.innerWidth, window.innerHeight) <= 820; // tablet breakpoint
    const mobileUA = /(Android|iPhone|iPad|iPod|Opera Mini|IEMobile)/i.test(ua);
    return (mobileUA || (isTouch && small));
  } catch {
    return false;
  }
};

export const getPlatformMode = (): PlatformMode => (isMobilePlatform() ? 'mobile' : 'web');