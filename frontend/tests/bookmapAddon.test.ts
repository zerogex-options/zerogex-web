import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

// The Bookmap add-on is the one integration we ship compiled: Bookmap loads
// add-ons as jars and has no compiler of its own. The jar in public/ is built
// from integrations/bookmap/src/main/java by integrations/bookmap/build.sh
// --release, which stamps a hash of those sources into the jar's manifest.
//
// The failure this guards against is quiet: someone fixes a bug in the Java
// source, commits it, and never rebuilds. The repo then reads as fixed while
// every customer keeps downloading the old jar. Recomputing the source hash
// here and comparing it to the one inside the published jar catches exactly
// that, without needing a JDK in the web toolchain.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ADDON = path.join(HERE, '../../integrations/bookmap');
const JAR = path.join(HERE, '../public/bookmap/zerogex-bookmap.jar');

/** Every file under src/main/java, relative to the add-on root, in byte order (build.sh: LC_ALL=C sort). */
function sourceFiles(dir: string, rel = 'src/main/java'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const r = `${rel}/${name}`;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full, r));
    else out.push(r);
  }
  return out;
}

/** build.sh's source_hash: for each file, its path, a newline, then its bytes. */
function sourceHash(): string {
  const files = sourceFiles(path.join(ADDON, 'src/main/java')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash('sha256');
  for (const f of files) {
    h.update(`${f}\n`);
    h.update(readFileSync(path.join(ADDON, f)));
  }
  return h.digest('hex');
}

/** Reads one entry out of a zip (a jar) using its central directory. */
function zipEntry(zip: Buffer, name: string): Buffer | null {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'not a zip: no end-of-central-directory record');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(p), 0x02014b50, 'bad central directory entry');
    const method = zip.readUInt16LE(p + 10);
    const compressed = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entryName = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (entryName === name) {
      const localNameLen = zip.readUInt16LE(local + 26);
      const localExtraLen = zip.readUInt16LE(local + 28);
      const start = local + 30 + localNameLen + localExtraLen;
      const data = zip.subarray(start, start + compressed);
      return method === 8 ? inflateRawSync(data) : data;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function manifest(zip: Buffer): Record<string, string> {
  const raw = zipEntry(zip, 'META-INF/MANIFEST.MF');
  assert.ok(raw, 'the jar has no manifest');
  // Manifest lines wrap at 72 bytes; a continuation line starts with one space.
  const text = raw.toString('utf8').replace(/\r?\n /g, '');
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(': ');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 2);
  }
  return out;
}

const jar = readFileSync(JAR);

test('the published jar was built from the committed sources', () => {
  assert.equal(
    manifest(jar)['ZeroGEX-Source-SHA256'],
    sourceHash(),
    'integrations/bookmap/src/main/java changed without a rebuild: customers would still download the old add-on. ' +
      'Run integrations/bookmap/build.sh --release, then make integration-assets, and commit both.',
  );
});

test('the jar version matches the source', () => {
  const source = readFileSync(path.join(ADDON, 'src/main/java/io/zerogex/bookmap/ZeroGexLevels.java'), 'utf8');
  const version = /VERSION = "([^"]+)"/.exec(source)?.[1];
  assert.equal(manifest(jar)['Implementation-Version'], version);
});

test('the entry point is Java 8 bytecode, so Bookmap 7.0 through 8 can load it', () => {
  const cls = zipEntry(jar, 'io/zerogex/bookmap/ZeroGexLevels.class');
  assert.ok(cls, 'the add-on entry point is missing from the jar');
  assert.equal(cls.readUInt32BE(0), 0xcafebabe, 'not a class file');
  assert.equal(cls.readUInt16BE(6), 52, 'compiled for a newer Java than Bookmap 7.0 runs');
  assert.ok(cls.includes(Buffer.from('ZeroGEX Gamma Levels')), 'the strategy name Bookmap lists it under');
});

test('nothing but the add-on ships: no tests, no Bookmap classes', () => {
  const names = jar.toString('latin1');
  for (const forbidden of ['testkit/', 'harness/', 'velox/', 'FakeTransport', 'AddonEndToEndTest']) {
    assert.ok(!names.includes(forbidden), `the jar must not contain ${forbidden}`);
  }
});
