/** Dated price assumptions, not an invoice or authorization to spend. USD, excl. tax. */
export const PRICING_DATE = '2026-11-11';
export type ClipPlan = { version: 1; title: string; lyrics: string; musicDirection: string; visualDirection: string; duration: number; aspect: '16:9' | '9:16'; resolution: '720p' | '1080p'; takes: number; scenes: { prompt: string; duration: number }[] };
export function makeClipPlan(title: string, lyrics = ''): ClipPlan {
  return { version: 1, title, lyrics, musicDirection: '', visualDirection: '', duration: 180, aspect: '16:9', resolution: '1080p', takes: 2, scenes: [] };
}
export function validateClipPlan(value: unknown): ClipPlan {
  if (!value || typeof value !== 'object') throw new Error('Plan de clip invalide.');
  const p = value as ClipPlan;
  if (p.version !== 1 || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 120 || typeof p.lyrics !== 'string' || p.lyrics.length > 20000 || typeof p.musicDirection !== 'string' || p.musicDirection.length > 4000 || typeof p.visualDirection !== 'string' || p.visualDirection.length > 4000 || !Number.isInteger(p.duration) || p.duration < 15 || p.duration > 300 || !['16:9', '9:16'].includes(p.aspect) || !['720p', '1080p'].includes(p.resolution) || !Number.isInteger(p.takes) || p.takes < 1 || p.takes > 4 || !Array.isArray(p.scenes) || p.scenes.length > 100) throw new Error('Paramètres du clip invalides.');
  for (const s of p.scenes) if (!s || typeof s.prompt !== 'string' || s.prompt.length > 4000 || !Number.isInteger(s.duration) || s.duration < 3 || s.duration > 15) throw new Error('Plan vidéo invalide (3 à 15 secondes).');
  if (p.scenes.length && p.scenes.reduce((n, s) => n + s.duration, 0) < p.duration) throw new Error('Les plans ne couvrent pas la durée du morceau.');
  return p;
}
export function quoteClip(plan: ClipPlan) {
  validateClipPlan(plan);
  // Gemini Omni 1.2: 5792 output tokens/second (720p), 8688 (1080p upscaled), $12/M.
  const perSecond = (plan.resolution === '720p' ? 5792 : 8688) * 12 / 1_000_000;
  const seconds = plan.scenes.length ? plan.scenes.reduce((n, s) => n + s.duration, 0) : Math.ceil(plan.duration / 15) * 15;
  const video = seconds * plan.takes * perSecond;
  const music = plan.takes * .08; // Lyria 3.5 per song, duration not guaranteed.
  // CPU example only: 4 vCPU, 8 GiB, 10 min/job, Cloud Run Tier1, no free tier assumed.
  const renderExample = (4 * .000018 + 8 * .000002) * 600;
  const generation = video + music;
  return { currency: 'USD', date: PRICING_DATE, video, music, generation, renderExample, reserve: generation * .25, indicative: generation * 1.25 + renderExample, seconds, perSecond, exclusions: 'Hors taxes, change, stockage, trafic sortant, requêtes texte/image, éventuel abonnement et reprises au-delà des variantes. Calcul CPU illustratif ; durée réelle non mesurée en cloud.' };
}
