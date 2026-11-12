import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { emptyLocalState, validateLocalEdit, buildLocalTimeline, makeLocalAss } from '../lib/phare-local.ts';
import type { LocalState, LocalMedia } from '../lib/phare-local.ts';

export function localRoot() { if (process.env.VERCEL || !process.env.PHARE_LOCAL_DATA_DIR || !process.env.PHARE_LOCAL_TOKEN) throw new Error('LOCAL_DISABLED'); return path.resolve(process.env.PHARE_LOCAL_DATA_DIR); }
async function ensure() { const root = localRoot(); await fs.mkdir(path.join(root, 'media'), { recursive: true, mode: 0o700 }); await fs.mkdir(path.join(root, 'jobs'), { recursive: true }); return root; }
export async function readLocal(): Promise<LocalState> { const root = await ensure(); try { return JSON.parse(await fs.readFile(path.join(root, 'state.json'), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyLocalState(); throw e; } }
// Exclusive lock is shared by HTTP workers; job progress lives in its own file.
export async function changeLocal<T>(fn: (s: LocalState) => T | Promise<T>): Promise<T> {
  const root = await ensure(); const lockPath = path.join(root, 'state.lock');
  let lock; try { lock = await fs.open(lockPath, 'wx', 0o600); } catch { throw new Error('Bibliothèque occupée. Réessaie dans un instant.'); }
  try { const state = await readLocal(); const result = await fn(state); state.revision++; const temp = path.join(root, `state-${randomUUID()}.tmp`); await fs.writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await fs.rename(temp, path.join(root, 'state.json')); return result; }
  finally { await lock.close(); await fs.unlink(lockPath); }
}
function equal(a: string, b: string) { const x = createHash('sha256').update(a).digest(), y = createHash('sha256').update(b).digest(); return timingSafeEqual(x, y); }
export function authorized(req: Request) { const cookie = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('phare_local='))?.slice(12) || ''; return equal(cookie, process.env.PHARE_LOCAL_TOKEN || randomUUID()); }
function originOK(req: Request) { const host = req.headers.get('host') || ''; if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return false; const origin = req.headers.get('origin'); if (!origin) return req.headers.get('x-phare-local') === '1'; try { const parsed = new URL(origin); return parsed.host === host && ['http:', 'https:'].includes(parsed.protocol); } catch { return false; } }
const reply = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
async function probe(file: string) { return new Promise<{ streams: { codec_type: string; width?: number; height?: number }[]; format: { duration?: string } }>((resolve, reject) => { const p = spawn('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { windowsHide: true }); let out = ''; p.stdout.on('data', b => { if (out.length < 200000) out += b; }); p.on('error', reject); p.on('close', code => { try { if (code) throw new Error('Fichier audio/visuel illisible par FFmpeg.'); resolve(JSON.parse(out)); } catch (e) { reject(e); } }); }); }
export async function handleLocal(req: Request, parts: string[]): Promise<Response> {
  try {
    try { localRoot(); } catch { return reply({ enabled: false, message: 'Le Studio utilise le lanceur local : npm run phare:local. Aucun média n’est envoyé depuis la vitrine.' }, 503); }
    if (req.method !== 'GET' && req.method !== 'HEAD' && !originOK(req)) return reply({ error: 'Origine refusée.' }, 403);
    if (parts[0] === 'unlock' && req.method === 'POST') { const body = await req.json(); if (!equal(String(body.code || ''), process.env.PHARE_LOCAL_TOKEN!)) return reply({ error: 'Code incorrect.' }, 401); return Response.json({ ok: true }, { headers: { 'Set-Cookie': `phare_local=${process.env.PHARE_LOCAL_TOKEN}; HttpOnly; SameSite=Strict; Path=/api/phare/local; Max-Age=43200`, 'Cache-Control': 'no-store' } }); }
    if (!authorized(req)) return reply({ error: 'Déverrouille le Studio avec le code du lanceur.' }, 401);
    if (parts[0] === 'state' && req.method === 'GET') {
      const state = await readLocal(); state.jobs = await Promise.all(state.jobs.map(async j => { try { const saved = JSON.parse(await fs.readFile(path.join(localRoot(), 'jobs', j.id, 'job.json'), 'utf8')); if (saved.state === 'running' || (saved.state === 'queued' && Date.now() - Date.parse(saved.created) > 10000)) { try { process.kill(saved.pid, 0); } catch { saved.state = 'interrupted'; saved.stage = 'Rendu interrompu. Relance-le depuis les sources conservées.'; } } return saved; } catch { return j; } })); return reply(state);
    }
    if (parts[0] === 'edit' && req.method === 'PUT') { const edit = validateLocalEdit(await req.json()); return reply(await changeLocal(s => { const prior = s.edits.find(e => e.projectId === edit.projectId); if ((prior?.revision || 0) !== edit.revision) throw new Error('Session modifiée ailleurs : recharge avant d’enregistrer.'); edit.revision++; s.edits = [...s.edits.filter(e => e.projectId !== edit.projectId), edit]; return edit; })); }
    if (parts[0] === 'media' && req.method === 'PUT') {
      const name = decodeURIComponent(req.headers.get('x-file-name') || '').slice(0, 200); const ext = path.extname(name).toLowerCase();
      const types: Record<string, [LocalMedia['kind'], string]> = { '.mp3': ['audio', 'audio/mpeg'], '.wav': ['audio', 'audio/wav'], '.m4a': ['audio', 'audio/mp4'], '.flac': ['audio', 'audio/flac'], '.mp4': ['video', 'video/mp4'], '.mov': ['video', 'video/quicktime'], '.webm': ['video', 'video/webm'], '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'], '.png': ['image', 'image/png'], '.webp': ['image', 'image/webp'] };
      if (!types[ext] || !req.body) throw new Error('Importe MP3, WAV, M4A, FLAC, MP4, MOV, WebM, JPG, PNG ou WebP.');
      const id = randomUUID(), root = await ensure(), file = `${id}${ext}`, target = path.join(root, 'media', file); const hash = createHash('sha256'); let bytes = 0;
      const handle = await fs.open(target, 'wx', 0o600);
      try { for await (const chunk of Readable.fromWeb(req.body as import("node:stream/web").ReadableStream)) { bytes += chunk.length; if (bytes > 512 * 1024 * 1024) throw new Error('Limite de 512 Mo par fichier.'); hash.update(chunk); await handle.writeFile(chunk); } await handle.close(); const p = await probe(target); const [kind, mime] = types[ext]; const stream = p.streams.find(s => s.codec_type === (kind === 'audio' ? 'audio' : 'video')); if (!stream) throw new Error('Le contenu ne correspond pas au type du fichier.'); const duration = Number(p.format.duration); if (kind !== 'image' && (!Number.isFinite(duration) || duration <= 0 || duration > 3600)) throw new Error('Durée non exploitable (maximum une heure).'); if (stream.width && stream.height && stream.width * stream.height > 40000000) throw new Error('Image trop grande : maximum 40 mégapixels.'); const media: LocalMedia = { id, name, kind, category: kind === 'audio' ? 'Morceau' : 'Visuel', mime, file, bytes, sha256: hash.digest('hex'), created: new Date().toISOString(), duration: Number.isFinite(duration) ? duration : undefined, width: stream.width, height: stream.height, tags: [], provenance: 'Import personnel — original conservé' }; await changeLocal(s => { s.media.push(media); }); return reply(media, 201); }
      catch (e) { await handle.close().catch(() => {}); await fs.unlink(target).catch(() => {}); throw e; }
    }
    if (parts[0] === 'cancel' && req.method === 'POST') {
      const { id } = await req.json(); const state = await readLocal(); const job = state.jobs.find(j => j.id === id); if (!job) return reply({ error: 'Travail introuvable.' }, 404);
      await fs.writeFile(path.join(localRoot(), 'jobs', job.id, 'cancel'), 'cancel'); return reply({ ok: true }, 202);
    }
    if (parts[0] === 'render' && req.method === 'POST') {
      const { projectId, revision } = await req.json();
      return reply(await changeLocal(async s => { const edit = s.edits.find(e => e.projectId === projectId); if (!edit || edit.revision !== revision) throw new Error('Enregistre la session avant de lancer le rendu.'); for (const j of s.jobs) { try { const active = JSON.parse(await fs.readFile(path.join(localRoot(), 'jobs', j.id, 'job.json'), 'utf8')); if (active.state === 'queued' && Date.now() - Date.parse(active.created) < 10000) throw new Error('Un lancement est déjà en cours.'); if (['queued', 'running'].includes(active.state)) { try { process.kill(active.pid, 0); } catch { continue; } throw new Error('Un rendu est déjà en cours sur cet ordinateur.'); } } catch (e) { if ((e as Error).message.includes('déjà en cours')) throw e; } } const shots = buildLocalTimeline(edit, s.media); const id = randomUUID(), folder = path.join(localRoot(), 'jobs', id); await fs.mkdir(folder); const width = edit.aspect === '16:9' ? 1280 : 720, height = edit.aspect === '16:9' ? 720 : 1280;
        await fs.writeFile(path.join(folder, 'lyrics.ass'), makeLocalAss(edit, width, height));
        const manifest = { edit, shots, media: s.media.filter(m => m.id === edit.audioId || edit.visualIds.includes(m.id)), width, height, sourcePolicy: 'Audio personnel, aucune voix générée, aucun appel fournisseur', output: 'clip.mp4' };
        await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
        const job = { id, projectId, state: 'queued' as const, stage: 'Préparation', created: new Date().toISOString(), updated: new Date().toISOString() };
        await fs.writeFile(path.join(folder, 'job.json'), JSON.stringify(job));
        const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts/phare-local/render.mjs'), localRoot(), id], { detached: process.platform !== 'win32', stdio: 'ignore', windowsHide: true, env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP } });
        child.on('error', () => {}); child.unref(); const stored = { ...job, pid: child.pid }; s.jobs.push(stored); return stored;
      }), 202);
    }
    if ((parts[0] === 'media' || parts[0] === 'output') && ['GET', 'HEAD'].includes(req.method)) {
      const state = await readLocal(); const media = state.media.find(m => m.id === parts[1]); const job = state.jobs.find(j => j.id === parts[1]);
      const target = parts[0] === 'media' && media ? path.join(localRoot(), 'media', media.file) : parts[0] === 'output' && job ? path.join(localRoot(), 'jobs', job.id, parts[2] === 'manifest' ? 'manifest.json' : 'clip.mp4') : null;
      if (!target) return reply({ error: 'Fichier introuvable.' }, 404);
      const stat = await fs.stat(target); let start = 0, end = stat.size - 1; const range = req.headers.get('range');
      if (range) { const match = /^bytes=(\d+)-(\d*)$/.exec(range); if (!match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } }); start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } }); }
      const headers: Record<string, string> = { 'Content-Type': media?.mime || (parts[2] === 'manifest' ? 'application/json' : 'video/mp4'), 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      return new Response(req.method === 'HEAD' ? null : Readable.toWeb(createReadStream(target, { start, end })) as ReadableStream, { status: range ? 206 : 200, headers });
    }
    return reply({ error: 'Action inconnue.' }, 404);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Erreur locale.' }, 400); }
}
