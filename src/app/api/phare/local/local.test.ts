import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { handleLocal, readLocal } from '../../../../server/phare-local.ts';
import { newLocalEdit } from '../../../../lib/phare-local.ts';
test('private local import, seek, conflict, actual render and original preservation', { timeout: 120000 }, async () => {
 const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'phare-local-test-')); const originalEnv = { ...process.env }; process.env.PHARE_LOCAL_DATA_DIR = dir; process.env.PHARE_LOCAL_TOKEN = 'test-private-code'; delete process.env.VERCEL;
 const url = 'http://localhost:3010/api/phare/local/';
 const request = (part: string, method = 'GET', body?: BodyInit, extra: Record<string,string> = {}) => handleLocal(new Request(url + part, { method, body, headers: { host: 'localhost:3010', cookie: 'phare_local=test-private-code', 'x-phare-local': '1', ...extra } }), part.split('/'));
 try {
  assert.equal((await handleLocal(new Request(url + 'state'), ['state'])).status, 401);
  assert.equal((await request('edit', 'PUT', '{}', { origin: 'https://intruder.invalid' })).status, 403);
  assert.equal((await request('unlock', 'POST', JSON.stringify({ code: 'bad' }))).status, 401);
  const wave = path.join(dir, 'fixture.wav'), pic = path.join(dir, 'fixture.png');
  assert.equal(spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=6','-y',wave]).status, 0);
  assert.equal(spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=red:s=640x360','-frames:v','1','-threads','1','-y',pic]).status, 0);
  const bytes = await fs.readFile(wave), png = await fs.readFile(pic);
  const audioResponse = await request('media', 'PUT', bytes, { 'x-file-name': 'fixture.wav' }); assert.equal(audioResponse.status, 201); const audio = await audioResponse.json();
  const imageResponse = await request('media','PUT', png, { 'x-file-name': 'fixture.png' }); assert.equal(imageResponse.status, 201); const image = await imageResponse.json();
  const bluePath = path.join(dir, 'blue.png'); assert.equal(spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=blue:s=640x360','-frames:v','1','-threads','1','-y',bluePath]).status,0); const blueResponse = await request('media','PUT',await fs.readFile(bluePath),{'x-file-name':'blue.png'}); const blue = await blueResponse.json();
  const range = await request('media/' + audio.id, 'GET', undefined, { range: 'bytes=0-31' }); assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0,32));
  assert.equal((await request('media/' + audio.id, 'GET', undefined, { range: 'bytes=999999999-' })).status, 416);
  const edit = { ...newLocalEdit('real-project'), lyrics:'Essai technique', audioId: audio.id, visualIds:[image.id, blue.id], cues:[{line:0,start:0,end:5.8}], sourceApproved:true };
  const save = await request('edit','PUT',JSON.stringify(edit)); assert.equal(save.status,200); const saved = await save.json();
  assert.equal((await request('edit','PUT',JSON.stringify(edit))).status,400);
  const render = await request('render','POST',JSON.stringify({projectId:edit.projectId,revision:saved.revision})); assert.equal(render.status,202); const job = await render.json();
  let result; for (let i=0;i<100;i++) { await new Promise(r=>setTimeout(r,300)); result = JSON.parse(await fs.readFile(path.join(dir,'jobs',job.id,'job.json'),'utf8')); if (['complete','failed'].includes(result.state)) break; }
  assert.equal(result.state,'complete',result.error);
  const output = await request('output/'+job.id); assert.equal(output.status,200); assert.ok((await output.arrayBuffer()).byteLength>1000);
  const probe = JSON.parse(spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(dir,'jobs',job.id,'clip.mp4')],{encoding:'utf8'}).stdout); assert.equal(probe.streams[0].width,1280); assert.equal(probe.streams[1].codec_name,'aac'); assert.ok(Math.abs(Number(probe.format.duration)-6)<.1);
  const frame = spawnSync('ffmpeg',['-v','error','-ss','4.72','-i',path.join(dir,'jobs',job.id,'clip.mp4'),'-vf','crop=2:2:0:0,format=rgb24','-frames:v','1','-f','rawvideo','pipe:1']).stdout; assert.ok(frame[0]>40 && frame[2]>40, 'real red/blue crossfade must contain both colors: '+Array.from(frame).slice(0,12).join(','));
  assert.equal(createHash('sha256').update(await fs.readFile(path.join(dir,'media',audio.file))).digest('hex'),audio.sha256);
  assert.equal((await readLocal()).edits[0].lyrics,edit.lyrics);
  const nextRender = await request('render','POST',JSON.stringify({projectId:edit.projectId,revision:saved.revision})); assert.equal(nextRender.status,202); const cancelledJob = await nextRender.json();
  assert.equal((await request('cancel','POST',JSON.stringify({id:cancelledJob.id}))).status,202);
  for (let i=0;i<100;i++) { await new Promise(r=>setTimeout(r,100)); result=JSON.parse(await fs.readFile(path.join(dir,'jobs',cancelledJob.id,'job.json'),'utf8')); if(result.state==='cancelled')break; }
  assert.equal(result.state,'cancelled'); assert.equal((await readLocal()).media.length,3);
  process.env.VERCEL='1'; assert.equal((await request('state')).status,503);
 } finally { process.env = originalEnv; if (!process.env.PHARE_KEEP_TEST) await fs.rm(dir,{recursive:true,force:true}); else console.log('TEST_DIRECTORY',dir); }
});
