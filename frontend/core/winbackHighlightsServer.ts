// The fs half of core/winbackHighlights.ts: read content/winback-highlights.json
// off disk and hand the parsed rows to the pure validator.
//
// Split out for the usual reason — the pure module stays importable from tests
// and from the edge without dragging `node:fs` along — and kept dependency-light
// so a page can import it without pulling in the mailer (and therefore the
// Resend SDK) just to render a few bullets.

import fs from 'node:fs';
import path from 'node:path';
import { parseHighlightsJson, type DatedHighlight } from './winbackHighlights.ts';

/**
 * Load the editable highlight list, or null when it isn't usable.
 *
 * Null covers every failure the same way — absent file, unreadable file, bad
 * JSON, no valid rows — because every caller's correct response is identical:
 * fall back to its own default copy (the senders) or omit the section entirely
 * (the wall). Nothing here throws; editable content must never be able to break
 * a page render or a scheduled send.
 *
 * `baseDir` defaults to the process cwd, which is the `frontend/` directory both
 * under `next start` and for the scripts run from there via the Makefile.
 */
export function loadWinbackHighlights(baseDir = process.cwd()): DatedHighlight[] | null {
  try {
    const file = path.join(baseDir, 'content', 'winback-highlights.json');
    if (!fs.existsSync(file)) return null;
    return parseHighlightsJson(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}
