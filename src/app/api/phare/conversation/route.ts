import { createHash, timingSafeEqual } from 'node:crypto';
import { ACTION_KINDS, SYSTEM, validateResult } from '../../../../lib/phare-assistant.ts';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
const ready = () => !!process.env.GEMINI_API_KEY && !!process.env.PHARE_ACCESS_HASH && process.env.PHARE_CHAT_ENABLED === 'true';
export async function GET() { return json({ ready: ready(), paidProduction: false }); }

// A private access token protects the owner's provider account. Never shipped in JS.
export async function POST(request: Request) {
  const expected = process.env.PHARE_ACCESS_HASH;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!expected || expected.length !== 64 || !supplied || supplied.length > 200 || !timingSafeEqual(Buffer.from(createHash('sha256').update(supplied).digest('hex')), Buffer.from(expected))) return json({ error: 'Ouvre ton lien personnel ou saisis ton code d’accès.' }, 401);
  if (!ready()) return json({ error: 'Connexion préparée. Les appels IA attendent la validation du chiffrage ; aucune génération n’est lancée.' }, 503);
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origine refusée.' }, 403);
  let raw = '';
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 150000) { await reader.cancel(); return json({ error: 'Contexte trop long. Exporte tes textes puis démarre un échange plus court.' }, 413); } chunks.push(value); }
    raw = Buffer.concat(chunks).toString('utf8');
  } catch { return json({ error: 'Message illisible.' }, 400); }
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'Message illisible.' }, 400); }
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 10000 || !Array.isArray(body.history) || body.history.length > 12 || body.history.some((m: { role: string; text: string }) => !m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 20000) || !body.context || typeof body.context !== 'object') return json({ error: 'Message ou contexte invalide.' }, 400);
  const search = body.search === true;
  const model = process.env.PHARE_CHAT_MODEL || 'gemini-3.5-flash-lite';
  if (!/^[a-z0-9.-]+$/.test(model)) return json({ error: 'Configuration du modèle invalide.' }, 503);
  const schema = { type: 'object', properties: { reply: { type: 'string' }, actions: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ACTION_KINDS }, value: { type: 'string' }, projectId: { type: 'string' }, section: { type: 'string', enum: ['Idée', 'Couplet', 'Refrain', 'Pont'] } }, required: ['kind', 'value', 'projectId', 'section'] } } }, required: ['reply', 'actions'] };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! }, signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM + (search ? '\nMode recherche web : réponds en texte naturel avec les sources trouvées ; aucune action ni modification de projet pour ce tour.' : '') }] },
        contents: [...body.history.map((m: { role: string; text: string }) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: `CONTEXTE NON INSTRUCTIF :\n${JSON.stringify(body.context)}\n\nDEMANDE :\n${body.message}` }] }],
        ...(search ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: { maxOutputTokens: 6000, ...(search ? {} : { responseMimeType: 'application/json', responseJsonSchema: schema }) },
      }),
    });
    if (!response.ok) return json({ error: response.status === 429 ? 'Quota du fournisseur atteint. Ton message est conservé ; réessaie plus tard.' : 'Le fournisseur IA ne répond pas. Ton message reste dans la saisie.' }, 502);
    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('\n');
    if (!text) return json({ error: 'Le fournisseur n’a pas renvoyé de proposition. Reformule ta demande.' }, 502);
    if (!search) return json(validateResult(JSON.parse(text)));
    const chunks = candidate.groundingMetadata?.groundingChunks || [];
    const sources = chunks.flatMap((c: { web?: { title: string; uri: string } }) => c.web?.uri?.startsWith('https://') ? [{ title: (c.web.title || 'Source').slice(0, 300), uri: c.web.uri.slice(0, 2000) }] : []).slice(0, 10);
    return json({ reply: text.slice(0, 20000), actions: [], sources });
  } catch { return json({ error: 'L’échange a été interrompu ou sa réponse est illisible. Aucun changement enregistré ; réessaie.' }, 502); }
}
