'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PHARE_KEY, ORIGINS, SECTIONS, addEntry, initialWorkspace, mergeWorkspace, parseWorkspace, searchEntries, uid } from '@/lib/phare';
import type { Entry, PhareProject, Workspace } from '@/lib/phare';

export default function Atelier() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('Ouverture de ton atelier…');
  const [blocked, setBlocked] = useState(false);
  const [undo, setUndo] = useState<Workspace | null>(null);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const snapshot = useRef<string | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PHARE_KEY);
      snapshot.current = raw;
      const value = raw === null ? initialWorkspace() : parseWorkspace(raw);
      // One-time hydration from browser storage: never read localStorage during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspace(value); setSelected(value.projects[0].id);
      setNotice(raw === null ? 'Choisis un morceau et apporte tes premiers mots.' : 'Ton atelier a été retrouvé dans ce navigateur.');
    } catch {
      setBlocked(true);
      setNotice('Impossible de lire la sauvegarde locale. Aucune donnée existante n’a été écrasée. Essaie de rouvrir cet atelier dans ton navigateur habituel.');
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === PHARE_KEY || event.key === null) {
        setBlocked(true); setNotice('La sauvegarde a changé dans un autre onglet. Exporte ton état actuel, puis recharge la page avant de continuer.');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function commit(next: Workspace, message: string, remember = true) {
    if (blocked) return false;
    try {
      if (localStorage.getItem(PHARE_KEY) !== snapshot.current) {
        setBlocked(true); throw new Error('Sauvegarde modifiée ailleurs. Exporte ton état puis recharge la page.');
      }
      const raw = JSON.stringify(next);
      parseWorkspace(raw);
      localStorage.setItem(PHARE_KEY, raw);
      snapshot.current = raw;
      if (remember) setUndo(workspace);
      setWorkspace(next); setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? `Non enregistré : ${error.message}` : 'Non enregistré : stockage indisponible. Exporte une sauvegarde.');
      return false;
    }
  }
  function updateProject(project: PhareProject, message: string) {
    return workspace ? commit({ ...workspace, projects: workspace.projects.map(p => p.id === project.id ? project : p) }, message) : false;
  }
  function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Téléchargement préparé. Vérifie le fichier dans tes téléchargements.');
  }
  const project = workspace?.projects.find(p => p.id === selected) ?? workspace?.projects[0];

  return <main className="phare-atelier">
    <div className="atelier-wrap">
      <header className="atelier-top"><Link href="/phare">← Le Phare</Link><span>Pilote local · textes uniquement</span></header>
      <section className="atelier-intro">
        <p className="atelier-kicker">Lefouzèbreizh · ton atelier</p>
        <h1>Retrouver le fil.<br/><em>Garder tes mots.</em></h1>
        <p>Un morceau à la fois. Tes phrases restent à toi, chaque variante garde son histoire.</p>
      </section>
      <p role="status" className={`atelier-notice${blocked ? ' atelier-warning' : ''}`}>{notice}</p>
      {workspace && project && <>
        <div className="atelier-tools">
          <button onClick={() => download(JSON.stringify(workspace, null, 2), `le-phare-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}>Exporter la sauvegarde</button>
          <button disabled={blocked} onClick={() => backupInput.current?.click()}>Restaurer une copie</button>
          <input ref={backupInput} hidden type="file" accept=".json,application/json" aria-label="Sauvegarde à restaurer" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            try {
              if (file.size > 2_000_000) throw new Error('Fichier trop volumineux (2 Mo maximum).');
              const incoming = parseWorkspace(await file.text());
              // Read current storage again: an import may finish after a different tab writes.
              const current = parseWorkspace(snapshot.current ?? JSON.stringify(workspace));
              commit(mergeWorkspace(current, incoming), 'Copie restaurée dans des projets séparés. Les projets présents sont conservés.');
            } catch (error) { setNotice(error instanceof Error ? error.message : 'Sauvegarde illisible.'); }
          }} />
          <button disabled={!undo || blocked} onClick={() => {
            if (undo && commit(undo, 'Dernière action annulée.', false)) { setSelected(undo.projects[0].id); setUndo(null); }
          }}>Annuler la dernière action</button>
        </div>
        <div className="atelier-layout">
          <aside className="atelier-projects" aria-label="Mes morceaux">
            <h2>Mes morceaux</h2>
            {workspace.projects.map(p => <button key={p.id} aria-pressed={p.id === project.id} onClick={() => { setSelected(p.id); setQuery(''); }}>
              <strong>{p.title}</strong><span>{p.entries.length} texte{p.entries.length > 1 ? 's' : ''} · {p.entries.filter(e => e.status === 'Retenu').length} retenu{p.entries.filter(e => e.status === 'Retenu').length > 1 ? 's' : ''}</span>
            </button>)}
            <form onSubmit={event => {
              event.preventDefault(); if (!title.trim() || workspace.projects.length >= 50) return;
              const p = { id: uid(), title: title.trim(), intention: '', next: '', entries: [] };
              if (commit({ version: 1, projects: [...workspace.projects, p] }, 'Nouveau morceau enregistré.')) { setSelected(p.id); setTitle(''); }
            }}>
              <label htmlFor="new-project">Un autre morceau</label>
              <input id="new-project" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Titre du morceau" required />
              <button disabled={blocked || workspace.projects.length >= 50}>Créer le projet</button>
            </form>
          </aside>
          <section className="atelier-work" aria-label={`Projet ${project.title}`}>
            <div className="atelier-heading"><div><p className="atelier-kicker">Le fil du projet</p><h2>{project.title}</h2></div><span>{project.entries.filter(e => e.status === 'Retenu').length} textes retenus</span></div>
            <ProjectForm key={`project-${project.id}-${project.intention}-${project.next}`} project={project} disabled={blocked} save={updateProject} />
            <TextForm key={`text-${project.id}`} disabled={blocked} save={values => {
              try { return updateProject(addEntry(project, values), 'Texte et provenance enregistrés.'); }
              catch (error) { setNotice((error as Error).message); return false; }
            }} />
            <div className="atelier-heading"><h3>Les mots et leurs versions</h3><button onClick={() => {
              const retained = project.entries.filter(e => e.status === 'Retenu');
              const text = `# ${project.title}\n\n${retained.map(e => `## ${e.section}\n${e.text}\n\nOrigine : ${e.origin} · ${e.source}\nVersion : ${e.id}${e.parentId ? ` · Variante de ${e.parentId}` : ''}`).join('\n\n')}`;
              download(text, 'le-phare-textes-retenus.md', 'text/markdown;charset=utf-8');
            }} disabled={!project.entries.some(e => e.status === 'Retenu')}>Exporter les textes retenus</button></div>
            <label htmlFor="entry-search">Retrouver une phrase ou une source dans ce morceau</label>
            <input id="entry-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Un mot, une image, une provenance…" />
            <div className="atelier-entries">
              {searchEntries(project, query).map(entry => <EntryCard key={entry.id} entry={entry} number={project.entries.findIndex(e => e.id === entry.id) + 1} parentNumber={project.entries.findIndex(e => e.id === entry.parentId) + 1} disabled={blocked}
                status={status => updateProject({ ...project, entries: project.entries.map(e => e.id === entry.id ? { ...e, status } : e) }, 'Choix enregistré. Le texte original est conservé.')}
                variant={values => { try { return updateProject(addEntry(project, values, entry.id), 'Variante ajoutée. La version précédente reste intacte.'); } catch (error) { setNotice((error as Error).message); return false; } }} />)}
              {searchEntries(project, query).length === 0 && <p className="atelier-empty">{project.entries.length ? 'Aucun texte ne correspond à cette recherche.' : 'Aucun texte pour ce morceau. Dépose une première phrase ci-dessus : elle gardera sa provenance.'}</p>}
            </div>
            <details className="atelier-delete"><summary>Effacer ce projet</summary><p>Les textes de ce projet seront retirés de ce navigateur. Exporte une sauvegarde avant de les effacer. Tu peux annuler la dernière action tant que cette page reste ouverte.</p>
              <button disabled={blocked || workspace.projects.length === 1} onClick={() => {
                const next = { ...workspace, projects: workspace.projects.filter(p => p.id !== project.id) };
                if (commit(next, 'Projet effacé. Tu peux annuler cette action.')) setSelected(next.projects[0].id);
              }}>Effacer « {project.title} »</button>{workspace.projects.length === 1 && <p>Conserve au moins un projet dans cet atelier.</p>}</details>
          </section>
        </div>
      </>}
      <footer className="atelier-footer">Les textes enregistrés restent dans ce navigateur, sans compte ni synchronisation. Pense à exporter : effacer les données du navigateur efface aussi l’atelier. L’import ajoute une copie, sans remplacer tes projets. Aucune IA, dictée, connexion Drive ou production audio n’est branchée dans ce pilote.</footer>
    </div>
  </main>;
}

function ProjectForm({ project, disabled, save }: { project: PhareProject; disabled: boolean; save: (p: PhareProject, message: string) => boolean }) {
  return <form className="atelier-context" onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save({ ...project, intention: String(form.get('intention')), next: String(form.get('next')) }, 'Intention et prochain pas enregistrés.');
  }}><label htmlFor="intention">Ce que tu veux raconter</label><textarea id="intention" name="intention" defaultValue={project.intention} maxLength={4000} rows={2} placeholder="Le sens, l’ambiance, ce que tu veux préserver…" />
    <label htmlFor="next">Le prochain petit pas</label><input id="next" name="next" defaultValue={project.next} maxLength={1000} />
    <button disabled={disabled}>Enregistrer mon cap</button><small>Enregistre avant de changer de morceau.</small></form>;
}

type Values = Pick<Entry, 'text' | 'origin' | 'source' | 'section'>;
function TextForm({ disabled, save, initial, prefix = 'new' }: { disabled: boolean; save: (v: Values) => boolean; initial?: Entry; prefix?: string }) {
  return <form className="atelier-capture" onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (save({ text: String(values.get('text')), origin: values.get('origin') as Entry['origin'], source: String(values.get('source')), section: values.get('section') as Entry['section'] })) { if (!initial) form.reset(); }
  }}>
    <h3>{initial ? 'Créer une variante' : 'Une phrase à garder'}</h3>
    <label htmlFor={`${prefix}-text`}>{initial ? 'Texte de la nouvelle version' : 'Ton texte'}</label>
    <textarea id={`${prefix}-text`} name="text" defaultValue={initial?.text} rows={4} maxLength={20000} required placeholder="Tes mots, sans les perdre ni les remplacer…" />
    <div className="atelier-fields"><div><label htmlFor={`${prefix}-origin`}>Origine de cette formulation</label><select id={`${prefix}-origin`} name="origin" defaultValue={initial?.origin}>{ORIGINS.map(origin => <option key={origin}>{origin}</option>)}</select></div>
      <div><label htmlFor={`${prefix}-section`}>Place dans le morceau</label><select id={`${prefix}-section`} name="section" defaultValue={initial?.section}>{SECTIONS.map(section => <option key={section}>{section}</option>)}</select></div></div>
    <label htmlFor={`${prefix}-source`}>Provenance précise</label><input id={`${prefix}-source`} name="source" maxLength={500} defaultValue={initial?.source} required placeholder="Ex. mon carnet du 11 novembre, fichier et auteur…" />
    <button className="atelier-primary" disabled={disabled}>{initial ? 'Garder cette variante' : 'Garder ce texte'}</button>
    <small>{initial ? 'L’original reste conservé. Mets à jour l’origine si tu as réécrit une proposition.' : 'Ajout manuel : aucun texte n’est généré automatiquement.'}</small>
  </form>;
}

function EntryCard({ entry, number, parentNumber, disabled, status, variant }: { entry: Entry; number: number; parentNumber: number; disabled: boolean; status: (s: Entry['status']) => void; variant: (v: Values) => boolean }) {
  return <article className="atelier-entry"><header><strong>Version {number} · {entry.section}</strong><span>{entry.status}</span></header>
    <p className="atelier-words">{entry.text}</p><p className="atelier-provenance">{entry.origin} · {entry.source}<br/>{new Date(entry.created).toLocaleString('fr-FR')}{parentNumber > 0 ? ` · Variante de la version ${parentNumber}` : ' · Texte initial'}</p>
    <label htmlFor={`status-${entry.id}`}>Mon choix pour la version {number}</label><select id={`status-${entry.id}`} value={entry.status} disabled={disabled} onChange={e => status(e.target.value as Entry['status'])}><option>À travailler</option><option>Retenu</option><option>Écarté</option></select>
    <details><summary>Écrire une variante sans remplacer l’original</summary><TextForm prefix={entry.id} initial={entry} disabled={disabled} save={variant} /></details>
  </article>;
}
