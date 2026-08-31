#!/usr/bin/env node
/**
 * ninjatrader-manifest.js — give the NinjaTrader downloads content-addressed URLs.
 *
 * `/ninjatrader/ZeroGexGammaLevels.cs` and `.zip` are fixed URLs, and zerogex.io
 * is proxied through Cloudflare (see deploy/CLOUDFLARE_MTLS.md), which serves
 * them with `cache-control: public, max-age=14400` and is never purged by
 * `make deploy`. So for up to four hours after shipping a new indicator, an
 * edge PoP can still hand a customer the previous build — and nothing on either
 * end says so. They compile it, it behaves like the old version, and the
 * support thread that follows is about a bug that was already fixed.
 *
 * That failure mode is not hypothetical for this file in particular: getting a
 * compiled indicator into a customer's hands already costs a round trip through
 * someone with NinjaTrader installed, so "are you sure you have the new one?"
 * is an expensive question to have to ask.
 *
 * Hashing the bytes into the filename removes the ambiguity: a new build is a
 * new URL, so no cache anywhere can answer for it with something stale. The
 * page that links these is revalidated every 15 minutes, so the new URL reaches
 * visitors long before a stale copy of the old one would have expired.
 *
 * This is the same trick scripts/og-image-manifest.js applies to the social
 * card, for the same reason, against the same cache.
 *
 * The unhashed paths keep being published alongside, so links already in the
 * wild — emails, the docs, anything a customer bookmarked — keep resolving.
 *
 * Writes:
 *   frontend/core/ninjaTraderManifest.ts          (committed — derived from the
 *                                                  tracked sources, so a plain
 *                                                  `npm run build` needs no
 *                                                  pre-step)
 *   frontend/public/ninjatrader/*.<hash>.cs       (gitignored)
 *   frontend/public/ninjatrader/ZeroGexGammaLevels.zip   (gitignored)
 *   frontend/public/ninjatrader/*.<hash>.zip      (gitignored; only when the
 *                                                  archive VERIFIES — see below)
 *
 * The archive is optional by design: without it the site offers the .cs alone
 * (see assets/ninjatrader/README.md), so the manifest records null rather than
 * failing.
 *
 * "Optional" means UNVERIFIABLE too, not just absent. The manifest is what the
 * page reads to decide whether to render a one-click download button at all
 * (NT_PACKAGE_PATH === null means "offer the .cs only"), so recording a path
 * here is a promise that those bytes are sitting in public/. An archive that
 * fails verify-ninjatrader-package.py is one we have decided not to publish —
 * so it must be recorded as null, or the page ships a live button pointing at a
 * file the deploy deliberately withheld. That is a 404 in the customer's hands,
 * which is the one outcome worse than no button. Same for a previously
 * published copy: it is removed here, because nothing links it any more and it
 * no longer matches the source of record.
 *
 * Verification lives in scripts/verify-ninjatrader-package.py and needs
 * python3. Without python3 we cannot prove the archive matches, so it is
 * treated as unverified — fail closed, .cs only.
 *
 * Dependency-free on purpose: this runs on the deploy box, the same constraint
 * scripts/og-image-manifest.js and scripts/trim-png.js work under.
 *
 * Usage: node scripts/ninjatrader-manifest.js [--check]
 *
 *   --check  write nothing; exit non-zero if the committed manifest is out of
 *            date with respect to the tracked sources.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_CS = path.join(ROOT, 'frontend/public/ninjatrader/ZeroGexGammaLevels.cs');
const SOURCE_ZIP = path.join(ROOT, 'assets/ninjatrader/ZeroGexGammaLevels.zip');
const PUBLIC_DIR = path.join(ROOT, 'frontend/public/ninjatrader');
const MANIFEST = path.join(ROOT, 'frontend/core/ninjaTraderManifest.ts');
const VERIFIER = path.join(ROOT, 'scripts/verify-ninjatrader-package.py');

const checkOnly = process.argv.includes('--check');

/** First 8 hex of the file's sha256 — same length the og-image manifest uses. */
function hashOf(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
}

if (!fs.existsSync(SOURCE_CS)) {
  console.error(`  ✗ ${path.relative(ROOT, SOURCE_CS)} is missing — it is the source of record`);
  process.exit(1);
}

const csHash = hashOf(SOURCE_CS);
const csPath = `/ninjatrader/ZeroGexGammaLevels.${csHash}.cs`;

/**
 * Whether the export archive is one we are willing to serve: present, and
 * proven by verify-ninjatrader-package.py to contain the current .cs. Returns
 * a reason string when it is not, for the operator reading the deploy log.
 *
 * Deliberately quiet on the happy path and loud on the unhappy one — the
 * failure this catches most often is not a tampered archive but a stale one,
 * exported before the last edit to the indicator, which would otherwise ship
 * an old build under a URL claiming to be the new one.
 */
function archiveStatus() {
  if (!fs.existsSync(SOURCE_ZIP)) {
    return { ok: false, reason: 'no export archive — the pages will offer the .cs only' };
  }
  const result = spawnSync('python3', [VERIFIER, SOURCE_ZIP, SOURCE_CS], { encoding: 'utf8' });
  if (result.error || result.status === null) {
    return {
      ok: false,
      reason: 'python3 unavailable, so the archive cannot be verified — withholding it (.cs only)',
    };
  }
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    return {
      ok: false,
      reason: `the archive does not match the current indicator — withholding it (.cs only)\n${detail}`,
    };
  }
  return { ok: true, reason: null };
}

const archive = archiveStatus();
const zipHash = archive.ok ? hashOf(SOURCE_ZIP) : null;
const zipPath = archive.ok ? `/ninjatrader/ZeroGexGammaLevels.${zipHash}.zip` : null;

const manifest = `// GENERATED by scripts/ninjatrader-manifest.js — do not edit by hand.
//
// Re-run \`make ninjatrader-package\` after changing the indicator or replacing
// the export archive, and commit the result. The hash is what makes a new build
// actually reach customers instead of being answered from a Cloudflare edge
// still holding the previous bytes — see the header comment in that script.

/** Content hash of the indicator source (first 8 hex of its sha256). */
export const NT_INDICATOR_HASH = '${csHash}';

/** Cache-busting path for the indicator source, relative to the site root. */
export const NT_INDICATOR_PATH = '${csPath}';

/** Content hash of the packaged NinjaTrader export, or null when none is published. */
export const NT_PACKAGE_HASH = ${zipHash === null ? 'null' : `'${zipHash}'`};

/** Cache-busting path for the packaged export, or null when none is published. */
export const NT_PACKAGE_PATH = ${zipPath === null ? 'null' : `'${zipPath}'`};
`;

if (checkOnly) {
  const current = fs.existsSync(MANIFEST) ? fs.readFileSync(MANIFEST, 'utf8') : '';
  if (current !== manifest) {
    console.error('  ✗ ninjaTraderManifest.ts is stale — run `make ninjatrader-package`');
    process.exit(1);
  }
  console.log('  ✓ ninjaTraderManifest.ts is up to date');
  process.exit(0);
}

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(MANIFEST, manifest);

// Publish the hashed copy of the indicator. The unhashed .cs is tracked in git,
// so links already in the wild keep resolving.
fs.copyFileSync(SOURCE_CS, path.join(PUBLIC_DIR, `ZeroGexGammaLevels.${csHash}.cs`));
console.log(`  ✓ indicator ${csPath}`);

// The archive, hashed and unhashed, is published here rather than by the
// Makefile so that exactly one place decides whether it ships. Splitting the
// decision (Makefile copies, script records the path) is what let the manifest
// advertise an archive the deploy had refused to publish.
const publishedZips = fs
  .readdirSync(PUBLIC_DIR)
  .filter((name) => name.endsWith('.zip'))
  .map((name) => path.join(PUBLIC_DIR, name));

if (archive.ok) {
  fs.copyFileSync(SOURCE_ZIP, path.join(PUBLIC_DIR, `ZeroGexGammaLevels.${zipHash}.zip`));
  fs.copyFileSync(SOURCE_ZIP, path.join(PUBLIC_DIR, 'ZeroGexGammaLevels.zip'));
  console.log(`  ✓ package   ${zipPath}`);
} else {
  // Withhold it, and take down any copy an earlier deploy published: public/ is
  // gitignored and never pruned by `git pull`, so a stale archive would keep
  // serving from its old URL long after we stopped vouching for it.
  for (const stale of publishedZips) {
    fs.rmSync(stale, { force: true });
    console.log(`  · removed stale ${path.relative(ROOT, stale)}`);
  }
  console.log(`  ⚠ ${archive.reason}`);
}
