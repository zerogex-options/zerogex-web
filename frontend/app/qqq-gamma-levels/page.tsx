// /qqq-gamma-levels is a clone of /spx-gamma-levels: it renders the exact same
// unified SPX/SPY/QQQ gamma-levels view and inherits the same metadata, whose
// canonical points back at /spx-gamma-levels — so all three URLs "show the same
// thing" and consolidate to a single canonical for search engines. The clone
// exists so anyone who searches or types "QQQ gamma levels" lands on the map.
export { default, metadata } from '../spx-gamma-levels/page';

// Route segment config must be declared on THIS module — Next reads these as
// static exports of the page file, not through the re-export above.
export const dynamic = 'force-static';
export const revalidate = 900;
