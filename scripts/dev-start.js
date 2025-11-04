// Simple dev server launcher to set PORT reliably in PowerShell
process.env.PORT = process.env.PORT || '3016';
try {
  require('react-scripts/scripts/start');
} catch (err) {
  console.error('Failed to start dev server:', err && err.message ? err.message : err);
  process.exit(1);
}