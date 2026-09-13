#!/usr/bin/env node
// Narrow repair for the uninitialised Codex app-server transport in OmniRoute 3.8.50.
// Sources: upstream open-sse/executors/index.ts and codex/appServerClient.ts.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MARKER = 'OMNIROUTE_CXA_TRANSPORT_REPAIR_V1';
const VERSION = '3.8.50';
const BACKUPS = '.omniroute-repairs/cxa-3.8.50-v1';
const FACTORY = /new\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(\s*\{\s*\}\s*,\s*(["'])codex-app-server\2\s*\)/g;

// Lazy loading preserves startup behaviour and avoids a circular codex.ts import.
// wreq-js is the existing upstream dependency; its URL and options are unchanged.
export function repairText(original) {
  if (original.includes(MARKER)) return { text: original, count: 0, repaired: true };
  let count = 0;
  const text = original.replace(FACTORY, (_whole, ctor, quote) => {
    count++;
    return `new ${ctor}({websocketFn:async(u,o)=>{/*${MARKER}*/const m=await import("wreq-js");const f=m.websocket??m.default?.websocket;if(typeof f!=="function")throw new Error("Codex app-server websocket transport unavailable");return f(u,o);}},${quote}codex-app-server${quote})`;
  });
  return { text, count, repaired: false };
}

const sha = (value) => createHash('sha256').update(value).digest('hex');
function regularFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${file}`);
  return stat;
}
function safePath(root, relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) {
    throw new Error('Unsafe repair manifest path');
  }
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep)) throw new Error('Repair path escapes package');
  let cursor = full;
  while (cursor !== root) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Refusing symbolic link: ${cursor}`);
    }
    cursor = path.dirname(cursor);
  }
  return full;
}
function inventory(root, sourceOnly = false) {
  const result = [];
  let seen = 0;
  let bytes = 0;
  function walk(relative) {
    const dir = safePath(root, relative);
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === '.omniroute-repairs') continue;
      const rel = path.join(relative, ent.name);
      if (ent.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${rel}`);
      if (ent.isDirectory()) { walk(rel); continue; }
      if (!ent.isFile() || !/\.(?:m?js|ts)$/.test(ent.name) || ent.name.endsWith('.d.ts')) continue;
      // Runtime scan identified factories in these Next chunk families. Skip
      // unrelated routes and vendor chunks before reading or counting bytes.
      if (ent.name !== 'index.ts' && !/^(?:open-sse|\[root-of-the-server\]).*\.js$/.test(ent.name)) continue;
      if (++seen > 60000) throw new Error('Runtime inventory exceeded file limit');
      const file = safePath(root, rel);
      bytes += fs.statSync(file).size;
      if (bytes > 600 * 1024 * 1024) throw new Error('Runtime inventory exceeded size limit');
      const original = fs.readFileSync(file, 'utf8');
      if (!original.includes('codex-app-server')) continue;
      const transformed = repairText(original);
      if (transformed.repaired) throw new Error(`Repair marker without matching manifest: ${rel}`);
      if (!transformed.count) continue;
      result.push({ path: rel, count: transformed.count, original, patched: transformed.text,
        before: sha(original), after: sha(transformed.text) });
    }
  }
  // The CLI starts dist/server*.js. Next compiles internal open-sse modules into
  // dist/.build/next/server; the source copies alone are not the HTTP runtime.
  if (sourceOnly) {
    const relative = 'open-sse/executors/index.ts';
    const file = safePath(root, relative);
    regularFile(file);
    const original = fs.readFileSync(file, 'utf8');
    const transformed = repairText(original);
    if (transformed.repaired || transformed.count !== 1) throw new Error('Source repair requires exactly one unchanged cxa factory');
    result.push({ path: relative, count: 1, original, patched: transformed.text,
      before: sha(original), after: sha(transformed.text) });
  } else for (const rel of ['open-sse/executors', 'dist/open-sse/executors',
    'dist/.build/next/server', 'dist/.next/server', 'dist/server']) walk(rel);
  if (!sourceOnly && !result.some(x => x.path.startsWith('dist' + path.sep) && /(?:^|[\\/])server[\\/]/.test(x.path))) {
    throw new Error('No compiled server factory found; refusing a source-only repair');
  }
  return result;
}

function atomicWrite(file, content, mode) {
  const tmp = `${file}.cxa-repair-${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { flag: 'wx', mode });
  try { fs.renameSync(tmp, file); }
  catch (error) { fs.unlinkSync(tmp); throw error; }
}

export function repairPackage(packageRoot, action = '--check', sourceOnly = false) {
  if (!['--check', '--apply', '--restore'].includes(action)) throw new Error('Unknown action');
  const root = fs.realpathSync(packageRoot);
  const meta = JSON.parse(fs.readFileSync(safePath(root, 'package.json'), 'utf8'));
  if (meta.name !== 'omniroute' || meta.version !== VERSION) throw new Error('Only omniroute@3.8.50 is supported');
  const backupDir = safePath(root, BACKUPS);
  const manifestFile = safePath(root, path.join(BACKUPS, 'manifest.json'));
  let records;
  if (fs.existsSync(manifestFile)) {
    regularFile(manifestFile);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (manifest.marker !== MARKER || manifest.version !== VERSION || !Array.isArray(manifest.files)) {
      throw new Error('Invalid repair manifest');
    }
    records = manifest.files.map(entry => {
      if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.before) ||
        !/^[a-f0-9]{64}$/.test(entry.after)) throw new Error('Invalid manifest entry');
      const file = safePath(root, entry.path);
      const backup = safePath(root, path.join(BACKUPS, entry.path + '.original'));
      regularFile(file); regularFile(backup);
      const original = fs.readFileSync(backup, 'utf8');
      const currentHash = sha(fs.readFileSync(file));
      if (sha(original) !== entry.before || ![entry.before, entry.after].includes(currentHash)) {
        throw new Error(`File differs from known original/repair: ${entry.path}`);
      }
      const transformed = repairText(original);
      if (!transformed.count || sha(transformed.text) !== entry.after) throw new Error('Repair manifest mismatch');
      return { ...entry, original, patched: transformed.text, currentHash };
    });
  } else {
    if (action === '--restore') throw new Error('No repair manifest to restore');
    records = inventory(root, sourceOnly);
  }
  const report = records.map(({ path: file, count, before, after, currentHash }) => ({
    path: file, count, before, after, state: currentHash === after ? 'repaired' : 'original',
  }));
  if (action === '--check') return { version: VERSION, action, files: report };
  // Complete all validation and backups before changing executable files.
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  for (const entry of records) {
    const backup = safePath(root, path.join(BACKUPS, entry.path + '.original'));
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
    if (fs.existsSync(backup)) {
      regularFile(backup);
      if (sha(fs.readFileSync(backup)) !== entry.before) throw new Error('Conflicting original backup');
    } else fs.writeFileSync(backup, entry.original, { flag: 'wx', mode: 0o600 });
  }
  if (!fs.existsSync(manifestFile)) fs.writeFileSync(manifestFile, JSON.stringify({
    marker: MARKER, version: VERSION,
    files: records.map(({ path: file, count, before, after }) => ({ path: file, count, before, after })),
  }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  for (const entry of records) {
    const file = safePath(root, entry.path);
    const target = action === '--restore' ? entry.original : entry.patched;
    if (sha(fs.readFileSync(file)) === sha(target)) continue;
    atomicWrite(file, target, regularFile(file).mode & 0o777);
  }
  return { version: VERSION, action, files: report.map(x => ({ ...x,
    state: action === '--restore' ? 'original' : 'repaired' })) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node repair-cxa.mjs <omniroute-package-directory> [--check|--apply|--restore] [--source-only]');
    if (process.argv[4] && process.argv[4] !== '--source-only') throw new Error('Unknown option');
    console.log(JSON.stringify(repairPackage(process.argv[2], process.argv[3] ?? '--check', process.argv[4] === '--source-only'), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
