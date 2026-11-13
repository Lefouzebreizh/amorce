/** Local creative memory. Media stays out of this JSON backup. */
import type { ChatMessage } from './phare-assistant.ts';
export const PHARE_KEY = 'le-phare-atelier-v1';
export const ORIGINS = ['Mes mots', 'Texte source', 'Proposition IA'] as const;
export const SECTIONS = ['Idée', 'Couplet', 'Refrain', 'Pont'] as const;
export type Entry = {
  id: string; text: string; origin: typeof ORIGINS[number]; source: string;
  section: typeof SECTIONS[number]; status: 'À travailler' | 'Retenu' | 'Écarté';
  created: string; parentId: string | null;
};
export type PhareProject = { id: string; title: string; intention: string; next: string; entries: Entry[] };
export type Workspace = { version: 1; projects: PhareProject[]; conversation?: ChatMessage[]; profile?: string; lastProjectId?: string };
export const uid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Android over the private Wi-Fi link exposes getRandomValues, but not randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export function initialWorkspace(): Workspace {
  return { version: 1, projects: ['Le Phare', 'Ça va', 'Les coups de mou'].map(title => ({
    id: uid(), title, intention: '', next: 'Choisir les premières phrases de ce morceau.', entries: [],
  })) };
}
export function addEntry(project: PhareProject, values: Pick<Entry, 'text' | 'origin' | 'source' | 'section'>, parentId: string | null = null): PhareProject {
  if (!values.text.trim() || values.text.length > 20000 || !values.source.trim()) throw new Error('Ajoute un texte et sa provenance.');
  if (project.entries.length >= 500) throw new Error('Limite de 500 versions par projet atteinte. Exporte une sauvegarde.');
  if (parentId && !project.entries.some(entry => entry.id === parentId)) throw new Error('Version source introuvable dans ce projet.');
  return { ...project, entries: [...project.entries, { ...values, id: uid(), created: new Date().toISOString(), parentId, status: 'À travailler' }] };
}
export function parseWorkspace(raw: string): Workspace {
  if (raw.length > 2_000_000) throw new Error('Sauvegarde trop volumineuse (2 Mo maximum).');
  const data = JSON.parse(raw);
  const invalid = () => { throw new Error('Sauvegarde Le Phare invalide ou version non prise en charge.'); };
  const string = (value: unknown, max: number): string => typeof value === 'string' && value.length <= max ? value : invalid();
  if (!data || data.version !== 1 || !Array.isArray(data.projects) || data.projects.length < 1 || data.projects.length > 50) invalid();
  const projectIds = new Set<string>();
  const projects = data.projects.map((p: PhareProject) => {
    if (!p || !Array.isArray(p.entries) || p.entries.length > 500) invalid();
    const id = string(p.id, 100);
    if (!id || projectIds.has(id)) invalid();
    projectIds.add(id);
    const ids = new Set<string>();
    const entries = p.entries.map((e: Entry): Entry => {
      if (!e || !ORIGINS.includes(e.origin) || !SECTIONS.includes(e.section) || !['À travailler', 'Retenu', 'Écarté'].includes(e.status)) invalid();
      const eid = string(e.id, 100);
      if (!eid || ids.has(eid)) invalid();
      ids.add(eid);
      const created = string(e.created, 40);
      if (!Number.isFinite(Date.parse(created))) invalid();
      return { id: eid, text: string(e.text, 20000), source: string(e.source, 500), origin: e.origin, section: e.section, status: e.status, created, parentId: e.parentId === null ? null : string(e.parentId, 100) };
    });
    // Parents must precede their variants: prevents dangling references and cycles.
    const preceding = new Set<string>();
    for (const entry of entries) {
      if (entry.parentId !== null && !preceding.has(entry.parentId)) invalid();
      preceding.add(entry.id);
    }
    const title = string(p.title, 120);
    if (!title.trim()) invalid();
    return { id, title, intention: string(p.intention, 4000), next: string(p.next, 1000), entries };
  });
  const profile = data.profile === undefined ? undefined : string(data.profile, 4000);
  const conversation = data.conversation === undefined ? undefined : (() => {
    if (!Array.isArray(data.conversation) || data.conversation.length > 100) invalid();
    const ids = new Set<string>();
    return data.conversation.map((m: ChatMessage) => {
      if (!m || !['user', 'assistant'].includes(m.role)) invalid();
      const id = string(m.id, 100);
      if (!id || ids.has(id)) invalid();
      ids.add(id);
      const created = string(m.created, 40);
      if (!Number.isFinite(Date.parse(created))) invalid();
      const sources = m.sources === undefined ? undefined : (() => {
        if (!Array.isArray(m.sources) || m.sources.length > 10) invalid();
        return m.sources.map(s => {
          const uri = string(s.uri, 2000);
          if (!/^https:\/\//.test(uri)) invalid();
          return { title: string(s.title, 300), uri };
        });
      })();
      return { id, role: m.role, text: string(m.text, 20000), created, projectId: string(m.projectId, 100), ...(sources ? { sources } : {}) };
    });
  })();
  const lastProjectId = data.lastProjectId === undefined ? undefined : string(data.lastProjectId, 100);
  if (lastProjectId !== undefined && !projects.some((p: PhareProject) => p.id === lastProjectId)) invalid();
  return { version: 1, projects, ...(lastProjectId ? { lastProjectId } : {}), ...(profile !== undefined ? { profile } : {}), ...(conversation ? { conversation } : {}) };
}
export function mergeWorkspace(current: Workspace, incoming: Workspace): Workspace {
  if (current.projects.length + incoming.projects.length > 50) throw new Error('Limite de 50 projets atteinte.');
  const projectIds = new Map(incoming.projects.map(p => [p.id, uid()]));
  const restoredMessages = (incoming.conversation || []).map(m => ({ ...m, id: uid(), projectId: projectIds.get(m.projectId) || 'archive' }));
  const conversation = [...(current.conversation || []), ...restoredMessages].slice(-100);
  return { ...current, version: 1, projects: [...current.projects, ...incoming.projects.map(p => ({ ...p, id: projectIds.get(p.id)!, title: `${p.title.slice(0, 105)} (restauré)` }))], ...(conversation.length ? { conversation } : {}) };
}
export function searchEntries(project: PhareProject, query: string): Entry[] {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const terms = normalize(query).trim().split(/\s+/);
  return project.entries.filter(e => terms.every(term => normalize(`${e.text} ${e.source} ${e.origin} ${e.section} ${e.status}`).includes(term)));
}
