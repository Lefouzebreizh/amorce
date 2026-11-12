import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const [root, id] = process.argv.slice(2);
const dir = path.join(root, 'jobs', id);
const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
const job = JSON.parse(await fs.readFile(path.join(dir, 'job.json'), 'utf8'));
job.pid = process.pid;
async function save() { job.updated = new Date().toISOString(); const tmp = path.join(dir, 'job.tmp'); await fs.writeFile(tmp, JSON.stringify(job)); await fs.rename(tmp, path.join(dir, 'job.json')); }
let active; let cancelled = false;
async function checkCancel() { try { await fs.access(path.join(dir, 'cancel')); cancelled = true; active?.kill('SIGTERM'); } catch {} }
const cancelTimer = setInterval(() => void checkCancel(), 300);

process.on('SIGTERM', () => { active?.kill('SIGTERM'); });
async function run(args) { await checkCancel(); if (cancelled) throw new Error('Rendu annulé.'); return new Promise((resolve, reject) => { const p = spawn('ffmpeg', ['-hide_banner', '-y', '-threads', '2', '-filter_threads', '1', '-filter_complex_threads', '1', ...args.slice(0, -1), '-threads', '2', args.at(-1)], { cwd: dir, windowsHide: true }); active = p; let err = ''; p.stderr.on('data', b => { err = (err + b).slice(-3000); }); p.on('error', reject); p.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg (${code}) : ${err}`))); }); }
try {
  job.state = 'running'; await save(); const { width: w, height: h, shots, media, edit } = manifest;
  for (let i = 0; i < shots.length; i++) {
    job.stage = `Assemblage du plan ${i + 1}/${shots.length}`; job.progress = { seconds: shots[i].start, total: media.find(m => m.id === edit.audioId).duration }; await save();
    const shot = shots[i], visual = media.find(m => m.id === shot.mediaId); const source = path.join(root, 'media', visual.file);
    const input = visual.kind === 'image' ? ['-loop', '1', '-i', source] : ['-ss', String(shot.sourceStart), '-i', source];
    const scale = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=25,format=yuv420p`;
    const motion = visual.kind === 'image' ? `,zoompan=z='min(zoom+0.0003,1.04)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${w}x${h}:fps=25` : '';
    await run([...input, '-t', String(shot.duration), '-an', '-vf', scale + motion, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', `${i}.mp4`]);
    if (i > 0 && edit.transition !== 'cut' && shots[i].duration >= .08) {
      const fade = Math.min(.4, shot.duration / 2);
      job.stage = `Fondu du plan ${i + 1}/${shots.length}`; await save();
      // Only two video streams at once. A held last frame avoids trimming
      // the master or requesting frames beyond the original video range.
      await run(['-sseof', '-0.08', '-i', `${i - 1}.mp4`, '-update', '1', 'previous.png']);
      const filter = `[0:v]format=yuv420p,setsar=1,settb=AVTB[a];[1:v]format=yuv420p,setsar=1,settb=AVTB[b];[a][b]xfade=transition=fade:duration=${fade}:offset=0[v]`;
      await run(['-loop', '1', '-framerate', '25', '-t', String(fade), '-i', 'previous.png', '-i', `${i}.mp4`, '-filter_complex', filter, '-map', '[v]', '-t', String(shot.duration), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', `${i}.fade.mp4`]);
    }

  }
  await fs.writeFile(path.join(dir, 'concat.txt'), shots.map((_, i) => `file '${i > 0 && edit.transition !== 'cut' && shots[i].duration >= .08 ? i + '.fade' : i}.mp4'`).join('\n'));
  job.stage = 'Encodage du clip et des paroles'; await save();
  const audio = media.find(m => m.id === edit.audioId);
  await run(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-i', path.join(root, 'media', audio.file), '-map', '0:v:0', '-map', '1:a:0', '-vf', 'ass=lyrics.ass', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '256k', '-t', String(audio.duration), '-movflags', '+faststart', 'clip.partial.mp4']);
  await fs.rename(path.join(dir, 'clip.partial.mp4'), path.join(dir, 'clip.mp4')); job.state = 'complete'; job.stage = 'Clip disponible — vérifie l’écoute et le calage'; job.output = 'clip.mp4'; job.manifest = 'manifest.json'; job.progress.seconds = audio.duration; await save();
  await Promise.all(shots.flatMap((_, i) => [`${i}.mp4`, `${i}.fade.mp4`]).map(name => fs.unlink(path.join(dir, name)).catch(() => {})));
} catch (e) { job.state = cancelled ? 'cancelled' : 'failed'; job.stage = cancelled ? 'Rendu annulé — les sources et la session sont conservées' : 'Le rendu a échoué, les sources sont conservées'; job.error = String(e.message).slice(-3000); await save(); process.exitCode = cancelled ? 0 : 1; } finally { clearInterval(cancelTimer); }
