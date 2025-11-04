export const isDemoMode = (): boolean => {
  try {
    const env = process.env.REACT_APP_DEMO_MODE;
    const local = localStorage.getItem('app:mode');
    if (env === 'true') return true;
    if (env === 'false') return false;
    // Varsayılan: prod modu için 'app:mode' = 'prod' set edilirse demo kapanır
    return local !== 'prod';
  } catch {
    return true; // varsayılan olarak demo kabul et
  }
};

export const setProdMode = () => {
  try { localStorage.setItem('app:mode', 'prod'); } catch {}
};