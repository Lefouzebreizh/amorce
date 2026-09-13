import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(process.argv[2]); const data = join(root, '.runtime');
const { key } = JSON.parse(readFileSync(join(data, 'client-key.json'), 'utf8'));
const model = 'cxa/gpt-5.3-codex-spark';
const results = [];
for (const stream of [false, true]) {
  const r = await fetch('http://127.0.0.1:20129/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 32, stream, messages: [{ role: 'user', content: 'Reply only OK. Do not use tools or read files.' }] }), signal: AbortSignal.timeout(45000) });
  const body = await r.text();
  if (!r.ok) { console.error(JSON.stringify({ http: r.status, error: body.slice(0, 1600) })); process.exitCode = 1; break; }
  let answer; let valid;
  if (!stream) { const json = JSON.parse(body); answer = json.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''; valid = answer.trim() === 'OK'; }
  else { const events = body.split('\n').filter(l => l.startsWith('data: ')).map(l => { try { return JSON.parse(l.slice(6)); } catch { return null; } }).filter(Boolean); answer = events.filter(e => e.type === 'content_block_delta' && e.delta?.type === 'text_delta').map(e => e.delta.text).join(''); valid = answer.trim() === 'OK' && events.some(e => e.type === 'message_stop'); }
  const check = { stream, http: r.status, valid, answer: answer.slice(0, 100) }; results.push(check); console.log(JSON.stringify(check));
  if (!valid) { process.exitCode = 1; break; }
}
if (results.length !== 2 || results.some(result => result.http !== 200 || result.valid !== true)) {
  throw new Error('Route validation incomplete; previous successful proof was preserved');
}
const target = join(data, 'route-validation.json');
const temporary = target + '.' + process.pid + '.tmp';
try {
  writeFileSync(temporary, JSON.stringify({ success: true, at: new Date().toISOString(), model, results }, null, 2), { mode: 0o600, flag: 'wx' });
  renameSync(temporary, target);
} catch (error) {
  try { unlinkSync(temporary); } catch {}
  throw error;
}
