export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { initMonitoring } = await import('./core/monitoring');
  initMonitoring();
}
