/** Media metadata and edit decisions. No network, no provider, no generated words. */
export type LocalMedia = { id: string; name: string; kind: 'audio' | 'video' | 'image' | 'text'; category: 'Voix' | 'Instrument' | 'Rythme' | 'Ambiance' | 'Morceau' | 'Visuel' | 'Texte'; file: string; mime: string; bytes: number; sha256: string; created: string; duration?: number; width?: number; height?: number; tags: string[]; provenance: string; parentId?: string; sourceRange?: { start: number; end: number } };
export type LyricCue = { start: number; end: number; line: number };
export type LocalEdit = { projectId: string; lyrics: string; audioId: string; visualIds: string[]; cues: LyricCue[]; recipe: 'récit' | 'montée' | 'rythme'; bpm: number; aspect: '16:9' | '9:16'; position: number; sourceApproved: boolean; updated: string; revision: number };
export type LocalJob = { id: string; projectId: string; state: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled' | 'interrupted'; stage: string; created: string; updated: string; progress?: { seconds: number; total: number }; error?: string; output?: string; manifest?: string; pid?: number };
export type LocalState = { version: 1; revision: number; media: LocalMedia[]; edits: LocalEdit[]; jobs: LocalJob[] };
export const emptyLocalState = (): LocalState => ({ version: 1, revision: 0, media: [], edits: [], jobs: [] });
export const lyricLines = (text: string) => text.split(/\r?\n/).map((text, index) => ({ text, index })).filter(x => x.text.trim());
export function newLocalEdit(projectId: string): LocalEdit { return { projectId, lyrics: '', audioId: '', visualIds: [], cues: [], recipe: 'récit', bpm: 80, aspect: '16:9', position: 0, sourceApproved: false, updated: new Date().toISOString(), revision: 0 }; }
export function validateLocalEdit(input: unknown): LocalEdit {
  if (!input || typeof input !== 'object') throw new Error('Session illisible.');
  const e = input as LocalEdit;
  if (typeof e.projectId !== 'string' || !e.projectId || e.projectId.length > 100 || typeof e.lyrics !== 'string' || e.lyrics.length > 30000 || typeof e.audioId !== 'string' || e.audioId.length > 100 || !Array.isArray(e.visualIds) || e.visualIds.length > 100 || e.visualIds.some(x => typeof x !== 'string' || x.length > 100) || new Set(e.visualIds).size !== e.visualIds.length || !['récit', 'montée', 'rythme'].includes(e.recipe) || !['16:9', '9:16'].includes(e.aspect) || !Number.isFinite(e.bpm) || e.bpm < 40 || e.bpm > 240 || !Number.isFinite(e.position) || e.position < 0 || e.position > 86400 || !Number.isInteger(e.revision) || e.revision < 0 || typeof e.sourceApproved !== 'boolean' || !Array.isArray(e.cues) || e.cues.length > 500) throw new Error('Paramètres de session invalides.');
  const lines = lyricLines(e.lyrics); let previousEnd = 0; const seen = new Set<number>();
  for (const c of e.cues) {
    if (!c || !Number.isInteger(c.line) || !lines.some(l => l.index === c.line) || seen.has(c.line) || !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < previousEnd - .001 || c.end <= c.start || c.end > 86400) throw new Error('Repères de paroles invalides : lignes uniques, temps croissants et sans chevauchement.');
    previousEnd = c.end; seen.add(c.line);
  }
  return { projectId: e.projectId, lyrics: e.lyrics, audioId: e.audioId, visualIds: e.visualIds, cues: e.cues.map(c => ({ start: c.start, end: c.end, line: c.line })), recipe: e.recipe, bpm: e.bpm, aspect: e.aspect, position: e.position, sourceApproved: e.sourceApproved, updated: new Date().toISOString(), revision: e.revision };
}
export function validateRenderSources(edit: LocalEdit, media: LocalMedia[]) {
  validateLocalEdit(edit);
  const audio = media.find(m => m.id === edit.audioId);
  if (!audio || audio.kind !== 'audio' || !audio.duration || audio.duration > 600) throw new Error('Choisis un audio importé de moins de 10 minutes. Aucune voix ne sera créée à sa place.');
  const visuals = edit.visualIds.map(id => media.find(m => m.id === id));
  if (!visuals.length || visuals.some(m => !m || !['video', 'image'].includes(m.kind))) throw new Error('Choisis au moins une de tes images ou vidéos.');
  const lines = lyricLines(edit.lyrics);
  if (lines.length && (edit.cues.length !== lines.length || edit.cues.some(c => c.end > audio.duration! + .05))) throw new Error('Synchronise chaque ligne sur le master choisi avant le rendu.');
  if (!edit.sourceApproved) throw new Error('Valide l’audio, les paroles et les visuels retenus avant le rendu.');
  return { audio, visuals: visuals as LocalMedia[] };
}
export type LocalShot = { mediaId: string; start: number; duration: number; sourceStart: number };
export function buildLocalTimeline(edit: LocalEdit, media: LocalMedia[]): LocalShot[] {
  const { audio, visuals } = validateRenderSources(edit, media); const total = audio.duration!;
  const shots: LocalShot[] = []; let cursor = 0, index = 0;
  while (cursor < total - .001) {
    const base = edit.recipe === 'rythme' ? 240 / edit.bpm : edit.recipe === 'montée' ? 5.5 - 3 * cursor / total : 4.5;
    let desired = Math.min(6, Math.max(2, base));
    const line = edit.cues.find(c => c.start <= cursor && c.end > cursor);
    const words = line ? edit.lyrics.split(/\r?\n/)[line.line].toLocaleLowerCase('fr') : '';
    const matched = edit.recipe === 'récit' ? visuals.find(m => m.tags.some(t => words.includes(t.toLocaleLowerCase('fr')))) : undefined;
    const visual = matched || visuals[index % visuals.length];
    if (visual.kind === 'video') desired = Math.min(desired, visual.duration || desired);
    const remaining = total - cursor;
    const duration = Math.min(desired, remaining);
    if (duration <= 0) throw new Error('Visuel sans durée exploitable.');
    const range = Math.max(0, (visual.duration || duration) - duration);
    const sourceStart = visual.kind === 'video' ? Math.min(range, Math.floor(index / visuals.length) * 2) : 0;
    shots.push({ mediaId: visual.id, start: cursor, duration, sourceStart }); cursor += duration; index++;
    if (shots.length > 400) throw new Error('Montage trop fragmenté.');
  }
  return shots;
}
export function assTime(seconds: number) { const cs = Math.round(seconds * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; }
export function makeLocalAss(edit: LocalEdit, width: number, height: number) {
  const text = edit.lyrics.split(/\r?\n/);
  const escape = (s: string) => s.replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝');
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Main,DejaVu Sans,${Math.round(height * .044)},&H00FFFFFF,&H00FFFFFF,&H00121C22,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,${Math.round(width * .06)},${Math.round(width * .06)},${Math.round(height * .09)},1\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n` + edit.cues.map(c => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Main,,0,0,0,,${escape(text[c.line])}`).join('\n') + '\n';
}
