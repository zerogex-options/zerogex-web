// Reuse the /spx-gamma-levels social card so a shared /spy-gamma-levels link
// still renders a rich preview. runtime is declared locally (Next reads route
// segment config as static exports of this module).
export { default, alt, size, contentType } from '../spx-gamma-levels/opengraph-image';

export const runtime = 'nodejs';
