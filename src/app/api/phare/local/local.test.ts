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
  assert.equal(spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-y',wave]).status, 0);
  assert.equal(spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=navy:s=640x360','-frames:v','1','-threads','1','-y',pic]).status, 0);
  const bytes = await fs.readFile(wave), png = await fs.readFile(pic);
  const audioResponse = await request('media', 'PUT', bytes, { 'x-file-name': 'fixture.wav' }); assert.equal(audioResponse.status, 201); const audio = await audioResponse.json();
  const imageResponse = await request('media','PUT', png, { 'x-file-name': 'fixture.png' }); assert.equal(imageResponse.status, 201); const image = await imageResponse.json();
  const range = await request('media/' + audio.id, 'GET', undefined, { range: 'bytes=0-31' }); assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0,32));
  assert.equal((await request('media/' + audio.id, 'GET', undefined, { range: 'bytes=999999999-' })).status, 416);
  const edit = { ...newLocalEdit('real-project'), lyrics:'Essai technique', audioId: audio.id, visualIds:[image.id], cues:[{line:0,start:0,end:1.8}], sourceApproved:true };
  const save = await request('edit','PUT',JSON.stringify(edit)); assert.equal(save.status,200); const saved = await save.json();
  assert.equal((await request('edit','PUT',JSON.stringify(edit))).status,400);
  const render = await request('render','POST',JSON.stringify({projectId:edit.projectId,revision:saved.revision})); assert.equal(render.status,202); const job = await render.json();
  let result; for (let i=0;i<100;i++) { await new Promise(r=>setTimeout(r,300)); result = JSON.parse(await fs.readFile(path.join(dir,'jobs',job.id,'job.json'),'utf8')); if (['complete','failed'].includes(result.state)) break; }
  assert.equal(result.state,'complete',result.error);
  const output = await request('output/'+job.id); assert.equal(output.status,200); assert.ok((await output.arrayBuffer()).byteLength>1000);
  const probe = JSON.parse(spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(dir,'jobs',job.id,'clip.mp4')],{encoding:'utf8'}).stdout); assert.equal(probe.streams[0].width,1280); assert.equal(probe.streams[1].codec_name,'aac'); assert.ok(Math.abs(Number(probe.format.duration)-2)<.1);
  assert.equal(createHash('sha256').update(await fs.readFile(path.join(dir,'media',audio.file))).digest('hex'),audio.sha256);
  assert.equal((await readLocal()).edits[0].lyrics,edit.lyrics);
  process.env.VERCEL='1'; assert.equal((await request('state')).status,503);
 } finally { process.env = originalEnv; await fs.rm(dir,{recursive:true,force:true}); }
});
