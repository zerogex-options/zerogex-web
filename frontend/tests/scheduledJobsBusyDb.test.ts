import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every scheduled job must wait for a busy auth database instead of failing.
//
// The live site writes to the auth database whenever a member is active, and
// the sqlite3 CLI's default busy timeout is zero, so a job's write that lands
// while the site holds the lock fails on the spot with "database is locked
// (5)". For an email job that means the email has gone out, the member is
// never marked as sent, the unit fails and mails an alert, and the next run
// emails them again: what happened to verified-never-paid on 2026-11-12.
//
// The jobs are found from the unit files (deploy/systemd/*.service ExecStart
// -> make target -> recipe -> scripts), so a job is covered the day it is
// added. A sqlite3 CLI call must pass `-cmd ".timeout N"`; a node:sqlite open
// must set PRAGMA busy_timeout. Jobs that go through core/db.ts getDb() are
// covered there (it sets busy_timeout).

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(FRONTEND, '..');
const UNIT_DIR = path.join(REPO, 'deploy/systemd');
const makefile = fs.readFileSync(path.join(REPO, 'Makefile'), 'utf8');

// The tab-indented recipe lines under `target:`.
function recipeLines(target: string): string[] {
  const lines = makefile.split('\n');
  const at = lines.findIndex((line) => line.startsWith(`${target}:`));
  assert.notEqual(at, -1, `Makefile has no "${target}:" target`);
  const recipe: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (!line.startsWith('\t')) break;
    recipe.push(line);
  }
  assert.ok(recipe.length > 0, `"${target}:" has no recipe`);
  return recipe;
}

// A target's recipe plus those of the targets it runs through $(MAKE).
function recipeWithSubMakes(target: string, seen = new Set<string>()): string[] {
  if (seen.has(target)) return [];
  seen.add(target);
  const lines = recipeLines(target);
  const nested = lines.flatMap((line) =>
    [...line.matchAll(/\$\(MAKE\)(?:\s+-[-\w]+)*\s+([\w-]+)/g)].flatMap((m) => recipeWithSubMakes(m[1], seen)),
  );
  return [...lines, ...nested];
}

type Job = { unit: string; target: string; recipe: string[]; scripts: string[] };

const jobs: Job[] = fs
  .readdirSync(UNIT_DIR)
  .filter((name) => name.endsWith('.service'))
  .sort()
  .map((name) => {
    const unit = fs.readFileSync(path.join(UNIT_DIR, name), 'utf8');
    const m = /^ExecStart=\/usr\/bin\/make -C \S+ ([\w-]+)/m.exec(unit);
    assert.ok(m, `${name}: no "ExecStart=/usr/bin/make -C <dir> <target>" line, so this test cannot see what it runs`);
    const recipe = recipeWithSubMakes(m[1]);
    const scripts = [
      ...new Set(recipe.flatMap((line) => [...line.matchAll(/\bscripts\/[\w.-]+\.(?:mts|mjs|ts|js)\b/g)].map((s) => s[0]))),
    ].map((rel) => {
      const file = [path.join(FRONTEND, rel), path.join(REPO, rel)].find((p) => fs.existsSync(p));
      assert.ok(file, `${name}: the recipe runs ${rel}, which does not exist`);
      return file;
    });
    return { unit: name, target: m[1], recipe, scripts };
  });

// Each `sqlite3` CLI invocation in a script, as the text of its argument list.
// The `-version` probe that checks the CLI is installed opens no database.
function sqliteCliCalls(source: string): string[] {
  return [...source.matchAll(/\b(?:execFileSync|execFile|spawnSync|spawn)\(\s*['"]sqlite3['"]\s*,\s*\[([^\]]*)\]/g)]
    .map((m) => m[1])
    .filter((args) => !/['"]-version['"]/.test(args));
}

test('the scheduled units are all readable, so none is skipped silently', () => {
  assert.ok(jobs.length >= 30, `found only ${jobs.length} units`);
  const scripts = new Set(jobs.flatMap((job) => job.scripts.map((file) => path.basename(file))));
  // The job that failed on 2026-11-12, and one that reads with node:sqlite.
  assert.ok(scripts.has('send-verified-never-paid.mts'));
  assert.ok(scripts.has('send-signup-alarm.mts'));
});

test('every sqlite3 CLI call in a scheduled job waits for a busy database', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const job of jobs) {
    for (const file of job.scripts) {
      for (const args of sqliteCliCalls(fs.readFileSync(file, 'utf8'))) {
        checked += 1;
        if (!/['"]-cmd['"]/.test(args) || !/\.timeout /.test(args)) {
          missing.push(`${job.unit} -> ${path.relative(REPO, file)}: sqlite3 [${args.replace(/\s+/g, ' ').trim()}]`);
        }
      }
    }
  }
  assert.ok(checked >= 16, `expected the CLI-based jobs to be found, checked only ${checked} calls`);
  assert.deepEqual(missing, [], 'pass -cmd ".timeout N" before the database path');
});

test('every node:sqlite open in a scheduled job sets a busy timeout', () => {
  const missing: string[] = [];
  for (const job of jobs) {
    for (const file of job.scripts) {
      const source = fs.readFileSync(file, 'utf8');
      const opens = source.match(/new DatabaseSync\(/g)?.length ?? 0;
      const timeouts = source.match(/PRAGMA busy_timeout/g)?.length ?? 0;
      if (timeouts < opens) missing.push(`${job.unit} -> ${path.relative(REPO, file)}: ${opens} opens, ${timeouts} busy timeouts`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every sqlite3 command in a scheduled make recipe waits for a busy database', () => {
  const missing: string[] = [];
  for (const job of jobs) {
    for (const raw of job.recipe) {
      // Not invocations: the install check and the messages that name the CLI.
      const line = raw.replace(/command -v sqlite3/g, '').replace(/echo\s+"[^"]*"/g, '').replace(/echo\s+'[^']*'/g, '');
      if (!/\bsqlite3\s/.test(line)) continue;
      // The integrity check opens the backup's private snapshot, which nothing
      // else has open.
      if (/\bsqlite3\s+"\$\$snap"/.test(line)) continue;
      if (!/-cmd\s+"\.timeout \d+"/.test(line)) missing.push(`${job.unit} (${job.target}): ${raw.trim()}`);
    }
  }
  assert.deepEqual(missing, []);
});
