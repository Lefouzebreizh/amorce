'use client';

import Link from 'next/link';
import Conversation from './Conversation';
import StudioLocal from './StudioLocal';
import { applyAssistantActions } from '@/lib/phare-assistant';
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
  const [production, setProduction] = useState(false);
  const snapshot = useRef<string | null>(null);
  const latestWorkspace = useRef<Workspace | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PHARE_KEY);
      snapshot.current = raw;
      const value = raw === null ? initialWorkspace() : parseWorkspace(raw);
      // Stable project IDs are needed before the first media session is saved.
      if (raw === null) { const first = JSON.stringify(value); localStorage.setItem(PHARE_KEY, first); snapshot.current = first; }
      // One-time hydration from browser storage: never read localStorage during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      latestWorkspace.current = value; setWorkspace(value); setSelected(value.lastProjectId || value.projects[0].id);
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
    if (latestWorkspace.current !== workspace) { setNotice("Le projet a changé pendant l’échange. Aucun changement ancien n’a été réappliqué ; renvoie ta demande."); return false; }
    try {
      if (localStorage.getItem(PHARE_KEY) !== snapshot.current) {
        setBlocked(true); throw new Error('Sauvegarde modifiée ailleurs. Exporte ton état puis recharge la page.');
      }
      const raw = JSON.stringify(next);
      parseWorkspace(raw);
      localStorage.setItem(PHARE_KEY, raw);
      snapshot.current = raw;
      if (remember) setUndo(workspace);
      latestWorkspace.current = next; setWorkspace(next); setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? `Non enregistré : ${error.message}` : 'Non enregistré : stockage indisponible. Exporte une sauvegarde.');
      return false;
    }
  }
  function updateProject(project: PhareProject, message: string) {
    return workspace ? commit({ ...workspace, projects: workspace.projects.map(p => p.id === project.id ? project : p) }, message) : false;
  }
  function selectProject(id: string) {
    setSelected(id); setQuery('');
    if (workspace && !blocked) commit({ ...workspace, lastProjectId: id }, 'Projet repris. Tu retrouveras ce contexte à la réouverture.', false);
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
      <header className="atelier-top"><Link href="/phare">← Le Phare</Link><span>Un seul chat · de l’idée au clip</span></header>
      <section className="atelier-intro">
        <p className="atelier-kicker">Lefouzèbreizh · ton atelier</p>
        <h1>Ton idée.<br/><em>On en fait un morceau.</em></h1>
        <p>Parle au Phare. On écrit, on choisit, on prépare le clip. Tes mots et tes versions restent dans ton atelier.</p>
      </section>
      <p role="status" className={`atelier-notice${blocked ? ' atelier-warning' : ''}`}>{notice}</p>
      {workspace && project && <>
        <div className="atelier-layout">
          <aside className="atelier-projects" aria-label="Mes morceaux">
            <h2>Mes morceaux</h2>
            <label className="atelier-mobile-project" htmlFor="mobile-project">Mon projet
              <select id="mobile-project" value={project.id} onChange={event => selectProject(event.target.value)}>
                {workspace.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <div className="atelier-project-list">{workspace.projects.map(p => <button key={p.id} aria-pressed={p.id === project.id} onClick={() => selectProject(p.id)}>
              <strong>{p.title}</strong><span>{p.entries.length} texte{p.entries.length > 1 ? 's' : ''} · {p.entries.filter(e => e.status === 'Retenu').length} retenu{p.entries.filter(e => e.status === 'Retenu').length > 1 ? 's' : ''}</span>
            </button>)}</div>
            <details><summary>Créer un autre projet</summary>
            <form onSubmit={event => {
              event.preventDefault(); if (!title.trim() || workspace.projects.length >= 50) return;
              const p = { id: uid(), title: title.trim(), intention: '', next: '', entries: [] };
              if (commit({ ...workspace, version: 1, projects: [...workspace.projects, p], lastProjectId: p.id }, 'Nouveau morceau enregistré.')) { setSelected(p.id); setTitle(''); }
            }}>
              <label htmlFor="new-project">Un autre morceau</label>
              <input id="new-project" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Titre du morceau" required />
              <button disabled={blocked || workspace.projects.length >= 50}>Créer le projet</button>
            </form>
            </details>
          </aside>
          <section className="atelier-work" aria-label={`Projet ${project.title}`}>
            <div className="atelier-heading"><div><p className="atelier-kicker">Le fil du projet</p><h2>{project.title}</h2></div><span>{project.entries.filter(e => e.status === 'Retenu').length} textes retenus</span></div>
            <Conversation workspace={workspace} selected={project.id} blocked={blocked} openProduction={() => setProduction(true)} local={(message, result) => {
              const created = new Date().toISOString();
              const conversation = [...(workspace.conversation || []),
                { id: uid(), role: 'user' as const, text: message, created, projectId: project.id },
                { id: uid(), role: 'assistant' as const, text: result.reply, created, projectId: result.selected },
              ].slice(-100);
              if (!commit({ ...result.workspace, conversation, lastProjectId: result.selected }, 'Commande interne effectuée sans appel fournisseur. Tu peux annuler.')) return false;
              setSelected(result.selected); if (result.production) setProduction(true); return true;
            }} save={(message, answer) => {
              try {
                const result = applyAssistantActions(workspace, project.id, answer.actions);
                const created = new Date().toISOString();
                const conversation = [...(workspace.conversation || []),
                  { id: uid(), role: 'user' as const, text: message, created, projectId: project.id },
                  { id: uid(), role: 'assistant' as const, text: answer.reply, created, projectId: result.selected, ...(answer.sources?.length ? { sources: answer.sources } : {}) },
                ].slice(-100);
                if (!commit({ ...result.workspace, conversation, lastProjectId: result.selected }, result.changes.length ? result.changes.join(' · ') + '. Tu peux annuler cette action.' : 'Échange enregistré.')) return false;
                setSelected(result.selected); if (result.slideshow) setProduction(true); return true;
              } catch (error) { setNotice(error instanceof Error ? error.message : 'Réponse non enregistrée.'); return false; }
            }} />
            <StudioLocal key={project.id} project={project} open={production} onOpen={setProduction} />
            <details className="atelier-memory"><summary>Ce que Le Phare retient de moi</summary><form onSubmit={event => {
              event.preventDefault(); const profile = String(new FormData(event.currentTarget).get('profile'));
              commit({ ...workspace, profile }, 'Préférences enregistrées. Tu peux les modifier à tout moment.');
            }}><label htmlFor="profile">Mes goûts, ma façon de travailler, ce que je veux préserver</label><textarea key={workspace.profile || ''} id="profile" name="profile" defaultValue={workspace.profile || ''} maxLength={4000} rows={4} placeholder="Ex. Des paroles directes, garder mes expressions, avancer une proposition à la fois…" /><button disabled={blocked}>Garder ces repères</button><small>Cette mémoire est explicite et modifiable. Le Phare ne lit pas tes autres chats.</small></form></details>
            <details className="atelier-library"><summary>Mes textes, mon cap et mes versions</summary>
            <p className="atelier-next"><strong>Prochain pas</strong><br/>{project.next || 'Choisir une première petite action.'}</p>
            <form key={`capture-${project.id}`} className="atelier-capture" onSubmit={event => {
              event.preventDefault(); const form = event.currentTarget;
              const text = String(new FormData(form).get('quick-note'));
              try {
                if (updateProject(addEntry(project, { text, origin: 'Mes mots', source: 'Note saisie dans ce projet', section: 'Idée' }), 'Idée enregistrée dans ce projet.')) form.reset();
              } catch (error) { setNotice((error as Error).message); }
            }}>
              <label htmlFor="quick-note">Une idée, une phrase ou une chose à faire</label>
              <textarea id="quick-note" name="quick-note" required maxLength={20000} rows={3} placeholder="Pose-la ici. Tu pourras la reprendre plus tard." />
              <button className="atelier-primary" disabled={blocked}>Garder dans ce projet</button>
              <small>Classée comme idée · tes mots · conservée dans ce navigateur.</small>
            </form>
            <details className="atelier-options"><summary>Préciser mon cap et le prochain pas</summary>
              <ProjectForm key={`project-${project.id}-${project.intention}-${project.next}`} project={project} disabled={blocked} save={updateProject} />
            </details>
            <details className="atelier-options"><summary>Ajouter un texte avec sa provenance</summary>
              <TextForm key={`text-${project.id}`} disabled={blocked} save={values => {
              try { return updateProject(addEntry(project, values), 'Texte et provenance enregistrés.'); }
              catch (error) { setNotice((error as Error).message); return false; }
              }} />
            </details>
            {project.entries.length >= 2 && <details className="atelier-options"><summary>Comparer deux versions</summary>
              <CompareVersions key={`compare-${project.id}-${project.entries.length}`} entries={project.entries} />
            </details>}
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
                const next = { ...workspace, projects: workspace.projects.filter(p => p.id !== project.id), lastProjectId: workspace.projects.find(p => p.id !== project.id)!.id };
                if (commit(next, 'Projet effacé. Tu peux annuler cette action.')) setSelected(next.projects[0].id);
              }}>Effacer « {project.title} »</button>{workspace.projects.length === 1 && <p>Conserve au moins un projet dans cet atelier.</p>}</details>
            </details>
          </section>
        </div>
        <details className="atelier-backups"><summary>Sauvegarde, restauration et annulation</summary><div className="atelier-tools">
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
            if (undo && commit(undo, 'Dernière action annulée.', false)) { setSelected(undo.lastProjectId || undo.projects[0].id); setUndo(null); }
          }}>Annuler la dernière action</button>
        </div></details>
      </>}
      <footer className="atelier-footer">Les textes enregistrés restent dans ce navigateur, sans compte ni synchronisation. Pense à exporter : effacer les données du navigateur efface aussi l’atelier. L’import ajoute une copie, sans remplacer tes projets. La conversation passe par une connexion IA personnelle après activation. La dictée dépend du navigateur. Le devis précède toute génération de musique ou de plans vidéo ; aucun abonnement ni calcul distant n’est lancé automatiquement. Les médias ne sont pas inclus dans cette sauvegarde de textes.</footer>
    </div>
  </main>;
}

function CompareVersions({ entries }: { entries: Entry[] }) {
  const [leftId, setLeftId] = useState(entries[0].id);
  const [rightId, setRightId] = useState(entries[entries.length - 1].id);
  const choices = [{ id: leftId, set: setLeftId }, { id: rightId, set: setRightId }];
  return <div className="atelier-comparison">{choices.map((choice, index) => {
    const entry = entries.find(e => e.id === choice.id)!;
    return <section key={index} aria-label={`Version à comparer ${index + 1}`}>
      <label htmlFor={`compare-${index}`}>Version {index + 1}</label>
      <select id={`compare-${index}`} value={choice.id} onChange={event => choice.set(event.target.value)}>
        {entries.map((e, i) => <option key={e.id} value={e.id}>Version {i + 1} · {e.section} · {e.status}</option>)}
      </select>
      <p className="atelier-provenance">{entry.origin} · {entry.source}</p>
      <p className="atelier-words">{entry.text}</p>
    </section>;
  })}<p className="atelier-comparison-note">Comparaison en lecture seule : aucun texte n’est remplacé.</p></div>;
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
