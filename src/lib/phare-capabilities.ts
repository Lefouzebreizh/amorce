import { addEntry, searchEntries } from './phare.ts';
import type { Workspace } from './phare.ts';
export type Capability = { id: string; name: string; state: 'Disponible' | 'Disponible sous condition' | 'À connecter'; proof: string; external: boolean; cost: string; excludes: string };
/** Source-backed capabilities only; no account/device access inferred from ChatGPT tools. */
export const CAPABILITIES: Capability[] = [
  { id: 'note', name: 'Garder une idée', state: 'Disponible', proof: 'Ajout local avec provenance ; restauration et export JSON.', external: false, cost: 'Sans appel fournisseur', excludes: 'Pas de synchronisation entre appareils.' },
  { id: 'resume', name: 'Reprendre un projet', state: 'Disponible', proof: 'Sélection par titre dans la sauvegarde de cet atelier.', external: false, cost: 'Sans appel fournisseur', excludes: 'Ne lit pas les autres chats ni les fichiers de ton ordinateur.' },
  { id: 'search', name: 'Retrouver mes textes', state: 'Disponible', proof: 'Recherche dans les textes enregistrés avec projet et provenance.', external: false, cost: 'Sans appel fournisseur', excludes: 'Pas de recherche Drive ou disque.' },
  { id: 'quote', name: 'Préparer et chiffrer mon clip', state: 'Disponible', proof: 'Plan et calcul daté téléchargeables ; aucune soumission de job.', external: false, cost: 'Consultation du devis sans génération', excludes: 'Ce devis ne fabrique pas de clip.' },
  { id: 'voice', name: 'Dicter et écouter', state: 'Disponible sous condition', proof: 'Web Speech et speechSynthesis ; disponibilité vérifiée dans le navigateur.', external: true, cost: 'Dépend du navigateur et de la connexion', excludes: 'Le test de dictée réelle sur ton téléphone reste à faire.' },
  { id: 'assistant', name: 'Écrire avec une IA et chercher sur le web', state: 'À connecter', proof: 'API serveur préparée ; activation et accès personnel encore requis.', external: true, cost: 'Tarification du modèle ; chiffrage avant activation', excludes: 'Aucun appel réel validé dans ce lot.' },
  { id: 'produce', name: 'Produire musique, plans et clip final', state: 'À connecter', proof: 'Worker et assemblage local testés ; cloud, file et stockage privés non raccordés.', external: true, cost: 'Devis à valider avant production', excludes: 'Pas de production distante disponible depuis le chat aujourd’hui.' },
  { id: 'devices', name: 'Applications, jeux et appareils', state: 'À connecter', proof: 'Aucun appareil ni API de satellite intégré à cet atelier.', external: true, cost: 'À vérifier par intégration', excludes: 'Aucun faux contrôle de télévision ou de jeu.' },
];
export function routeLocalCommand(workspace: Workspace, selected: string, text: string) {
  const project = workspace.projects.find(p => p.id === selected);
  if (!project) return null;
  const result = (reply: string, next = workspace, id = selected, production = false) => ({ reply, workspace: next, selected: id, production });
  const note = text.match(/^(?:note|capture|garde|enregistre)(?:\s+(?:cette?\s+)?(?:idée|note|phrase))?\s*[:：]\s*([\s\S]+)$/i);
  if (note) {
    const changed = addEntry(project, { text: note[1], origin: 'Mes mots', source: 'Commande interne du Phare', section: 'Idée' });
    return result(`Idée gardée dans « ${project.title} ». Tes mots sont conservés, sans appel IA.`, { ...workspace, projects: workspace.projects.map(p => p.id === selected ? changed : p) });
  }
  const resume = text.match(/^(?:on\s+)?(?:reprends?|reprendre|ouvre|ouvrir|continue)(?:\s+(?:le\s+)?projet)?\s+(.+?)[.!?]?$/i);
  if (resume) {
    const title = resume[1].replace(/[«»“”"']/g, '').trim();
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
    const p = workspace.projects.find(p => normalize(p.title) === normalize(title));
    if (p) return result(`Je reprends « ${p.title} ». ${p.entries.length} texte(s), dont ${p.entries.filter(e => e.status === 'Retenu').length} retenu(s).\nProchain pas : ${p.next || 'À choisir ensemble.'}`, workspace, p.id);
  }
  const search = text.match(/^(?:cherche|retrouve|recherche)(\s+dans mes projets)?\s*[:：]\s*(.+)$/i);
  if (search) {
    const projects = search[1] ? workspace.projects : [project];
    const matches = projects.flatMap(p => searchEntries(p, search[2]).map(e => ({ p, e }))).slice(0, 8);
    return result(matches.length ? matches.map(({p,e}) => `« ${p.title} » · ${e.origin} · ${e.source}\n${e.text.slice(0, 1200)}`).join('\n\n') : `Aucun résultat dans ${search[1] ? 'tes projets enregistrés' : `« ${project.title} »`}. Aucune autre source n’a été consultée.`);
  }
  if (/^(?:prépare|preparer|préparer|chiffre|chiffrer|ouvre)\s+(?:(?:le|mon|un)\s+)?(?:clip|devis|diaporama)(?:\s+vidéo)?[.!?]?$/i.test(text.trim())) return result(`J’ouvre la préparation du clip de « ${project.title} ». Dans le lanceur local, importe ton master et tes visuels, cale tes paroles et lance le montage. Aucune génération ni dépense n’est lancée.`, workspace, selected, true);
  if (/^(?:aide|capacités|que peux.tu faire|qu.est.ce que tu peux faire)[.!?]?$/i.test(text.trim())) return result(CAPABILITIES.map(c => `${c.name} : ${c.state}. ${c.excludes}`).join('\n\n'));
  return null;
}
