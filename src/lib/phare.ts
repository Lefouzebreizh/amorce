/** Local text workspace. No media, network calls or generated lyrics. */
export const PHARE_KEY = 'le-phare-atelier-v1';
export const ORIGINS = ['Mes mots', 'Texte source', 'Proposition IA'] as const;
export const SECTIONS = ['Idée', 'Couplet', 'Refrain', 'Pont'] as const;
export type Entry = {
  id: string; text: string; origin: typeof ORIGINS[number]; source: string;
  section: typeof SECTIONS[number]; status: 'À travailler' | 'Retenu' | 'Écarté';
  created: string; parentId: string | null;
};
export type PhareProject = { id: string; title: string; intention: string; next: string; entries: Entry[] };
export type Workspace = { version: 1; projects: PhareProject[] };
export const uid = () => crypto.randomUUID();
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
  return { version: 1, projects };
}
export function mergeWorkspace(current: Workspace, incoming: Workspace): Workspace {
  if (current.projects.length + incoming.projects.length > 50) throw new Error('Limite de 50 projets atteinte.');
  return { version: 1, projects: [...current.projects, ...incoming.projects.map(p => ({ ...p, id: uid(), title: `${p.title.slice(0, 105)} (restauré)` }))] };
}
export function searchEntries(project: PhareProject, query: string): Entry[] {
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const terms = normalize(query).trim().split(/\s+/);
  return project.entries.filter(e => terms.every(term => normalize(`${e.text} ${e.source} ${e.origin} ${e.section} ${e.status}`).includes(term)));
}
