'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Folder, Globe, Send, Trash2, X } from 'lucide-react';
import { demanderAuCoffre, type ActionAssistant, type IndexCoffre, type TourConversation } from '@/lib/coffre';

type Message = TourConversation & {
  // Présents seulement sur un message de l'assistant — jamais reconstruits
  // pour un message de l'utilisateur, qui n'a rien de tout ça.
  documentsCites?: string[];
  ouvrirFormulaire?: boolean;
  ouvrirRangement?: boolean;
  // Un seul bot (10/09/2026) : le message propose de lancer le tri en lot
  // depuis la conversation même — voir le bloc TriAutomatique plus bas.
  declencherTriAutomatique?: boolean;
  rechercheWebEffectuee?: boolean;
  actions?: ActionAssistant[];
  // Résultat d'une action déjà exécutée, indexé sur sa position dans
  // `actions` — jamais réinitialisé, pour qu'une action faite reste
  // affichée comme faite plutôt que de reproposer un bouton « Confirmer ».
  actionsExecutees?: Record<number, string>;
  // Un CERFA officiel trouvé par recherche web pour une démarche nommée par
  // l'utilisateur — voir onPreparerFormulaireCerfa plus bas.
  formulaireCerfa?: { demarche: string; url: string } | null;
};

// État du tri en lot, porté par page.tsx (deux passes — instantanée puis IA,
// voir trierAutomatiquement) et seulement affiché ici — un seul moteur, un
// seul point d'entrée depuis le 10/09/2026. Plus de « non-documents » : tout
// fichier reçoit toujours une catégorie, le bilan ne porte que les vraies
// erreurs techniques.
type EtatTriAutomatique = {
  enCours: boolean;
  progres: { fait: number; total: number } | null;
  // erreursTechniques : encore réessayables (« Réessayer » les reprendra).
  // abandonnes : ont atteint le plafond de tentatives — Réessayer ne les
  // reprend plus, ils gardent leur catégorie générale (Images/Papiers) pour
  // de bon, voir TENTATIVES_TRI_AUTO_MAX dans page.tsx.
  bilan: { erreursTechniques: string[]; abandonnes: string[] } | null;
  detailOuvert: boolean;
};

function libelleAction(a: ActionAssistant): string {
  return a.type === 'classer'
    ? `Classer « ${a.nom} » dans « ${a.categorie} »`
    : `Supprimer « ${a.nom} »`;
}

export function AssistantCoffre({
  index, questionInitiale, onFermer, onOuvrirDocument, onOuvrirFormulaire, onOuvrirRangement,
  onExecuterAction, onPreparerFormulaireCerfa, triAuto, onLancerTriAutomatique, onBasculerDetailTriAutomatique,
}: {
  index: IndexCoffre;
  // Posée par la recherche locale restée sans résultat, envoyée une seule
  // fois à l'ouverture — voir l'effet ci-dessous. Absente ou vide : le chat
  // s'ouvre à blanc, comme avant.
  questionInitiale?: string;
  onFermer: () => void;
  onOuvrirDocument: (nom: string) => void;
  onOuvrirFormulaire: () => void;
  onOuvrirRangement: () => void;
  // Exécute une action proposée par l'assistant (classer, supprimer) après
  // confirmation de l'utilisateur — jamais toute seule. Rend un message
  // court à afficher à la place du bouton, succès ou échec.
  onExecuterAction: (action: ActionAssistant) => Promise<string>;
  // Télécharge le CERFA trouvé, en lit les champs et propose des valeurs
  // tirées des papiers du coffre, puis ouvre l'écran de remplissage déjà
  // rempli — jamais généré ni téléchargé sans que l'utilisateur ne le voie
  // d'abord. Lève une erreur (message affiché) si le formulaire n'a pas pu
  // être récupéré ou lu.
  onPreparerFormulaireCerfa: (demarche: string, url: string) => Promise<void>;
  // Tri en lot : état et déclencheurs portés par page.tsx, affichés ici
  // seulement quand un message porte `declencherTriAutomatique`.
  triAuto: EtatTriAutomatique;
  onLancerTriAutomatique: () => void;
  onBasculerDetailTriAutomatique: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  // Préparation d'un CERFA en cours — indexé sur le message, pour désactiver
  // seulement son propre bouton pendant l'appel, sans bloquer le reste du chat.
  const [cerfaEnCours, setCerfaEnCours] = useState<number | null>(null);
  const [erreurCerfa, setErreurCerfa] = useState<{ indexMessage: number; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  // Position (index de message, index d'action) de l'action en cours
  // d'exécution — désactive son bouton le temps de l'appel, sans bloquer
  // le reste du chat.
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const finDesMessages = useRef<HTMLDivElement>(null);
  // Dernière question envoyée depuis la barre de recherche — jamais un
  // simple booléen : le panneau reste monté d'une commande à l'autre (un
  // seul bot, jamais fermé entre deux questions), donc un booléen à « déjà
  // envoyée » aurait bloqué tout ce qui suit la première. C'est la valeur
  // elle-même qu'on compare : une NOUVELLE question posée dans la barre
  // pendant que la conversation est déjà ouverte doit repartir vers le bot
  // — sans ça, la barre avait l'air d'un simple filtre de recherche après
  // le premier message, chaque commande suivante disparaissant en silence.
  const derniereQuestionEnvoyee = useRef<string | null>(null);
  // Indices de message déjà exploités pour lancer le tri — sans cette
  // mémoire, un nouveau rendu (ou un second message qui redemande la même
  // chose) relancerait le tri en boucle sur un message déjà traité.
  const triAutoDejaDeclenche = useRef<Set<number>>(new Set());

  useEffect(() => {
    finDesMessages.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Un seul bot, aucune étape à valider (10/09/2026) : dès que la
  // conversation propose de trier, ça part tout seul — ta phrase dans le
  // chat vaut déjà l'accord, un second clic n'ajouterait rien. Ne se
  // déclenche jamais si un tri est déjà en cours.
  useEffect(() => {
    if (triAuto.enCours) return;
    const indexAtraiter = messages.findIndex(
      (m, i) => m.declencherTriAutomatique && !triAutoDejaDeclenche.current.has(i),
    );
    if (indexAtraiter === -1) return;
    triAutoDejaDeclenche.current.add(indexAtraiter);
    onLancerTriAutomatique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, triAuto.enCours]);

  // Retrouve le nom réel d'un document cité par son nom exact — jamais
  // deviné : si Claude a mal recopié un nom, on ne montre pas de lien plutôt
  // que d'en montrer un faux.
  function nomExistant(nom: string): boolean {
    return Object.values(index.objets).some((o) => o.nom === nom);
  }

  async function envoyerTexte(texte: string) {
    if (!texte || enCours) return;
    const historique = messages.map(({ role, texte: t }) => ({ role, texte: t }));
    setMessages((precedent) => [...precedent, { role: 'user', texte }]);
    setEnCours(true);
    try {
      const reponse = await demanderAuCoffre(texte, historique, index);
      setMessages((precedent) => [...precedent, {
        role: 'assistant',
        texte: reponse.reponse,
        documentsCites: reponse.documentsCites,
        ouvrirFormulaire: reponse.ouvrirFormulaire,
        ouvrirRangement: reponse.ouvrirRangement,
        declencherTriAutomatique: reponse.declencherTriAutomatique,
        rechercheWebEffectuee: reponse.rechercheWebEffectuee,
        actions: reponse.actions,
        formulaireCerfa: reponse.formulaireCerfa,
      }]);
    } finally {
      setEnCours(false);
    }
  }

  async function surPreparerFormulaireCerfa(indexMessage: number, demarche: string, url: string) {
    if (cerfaEnCours !== null) return;
    setErreurCerfa(null);
    setCerfaEnCours(indexMessage);
    try {
      await onPreparerFormulaireCerfa(demarche, url);
    } catch (err) {
      setErreurCerfa({ indexMessage, texte: err instanceof Error ? err.message : String(err) });
    } finally {
      setCerfaEnCours(null);
    }
  }

  async function confirmerAction(indexMessage: number, indexAction: number, action: ActionAssistant) {
    const cle = `${indexMessage}-${indexAction}`;
    if (actionEnCours) return;
    setActionEnCours(cle);
    try {
      const resultat = await onExecuterAction(action);
      setMessages((precedent) => precedent.map((m, i) => i !== indexMessage ? m : {
        ...m,
        actionsExecutees: { ...m.actionsExecutees, [indexAction]: resultat },
      }));
    } finally {
      setActionEnCours(null);
    }
  }

  // Envoi automatique de chaque question posée dans la barre de recherche —
  // au premier message comme aux suivants, tant que le texte change. La
  // conversation restant ouverte d'une commande à l'autre, ce n'est PAS
  // seulement l'ouverture du panneau qui doit déclencher l'envoi : c'est
  // chaque nouvelle valeur de `questionInitiale`.
  useEffect(() => {
    if (questionInitiale && questionInitiale !== derniereQuestionEnvoyee.current) {
      derniereQuestionEnvoyee.current = questionInitiale;
      envoyerTexte(questionInitiale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionInitiale]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const texte = question.trim();
    if (!texte || enCours) return;
    setQuestion('');
    await envoyerTexte(texte);
  }

  function ouvrirDocumentEtFermer(nom: string) {
    onFermer();
    onOuvrirDocument(nom);
  }

  function ouvrirFormulaireEtFermer() {
    onFermer();
    onOuvrirFormulaire();
  }

  function ouvrirRangementEtFermer() {
    onFermer();
    onOuvrirRangement();
  }

  return (
    // Une seule barre, un seul bot (10/09/2026) : plus de panneau plein
    // écran par-dessus la page — la conversation vit directement sous la
    // barre de recherche, comme un bloc de plus dans le tableau de bord.
    // Une hauteur bornée (pas `100dvh`) évite qu'un long échange n'avale
    // tout l'écran ; `onFermer` referme le bloc sans jamais recouvrir quoi
    // que ce soit d'autre à fermer par-dessus.
    <div className="rounded-2xl border border-line bg-paper-raised">
      <div className="flex items-center justify-between border-b border-line p-4">
        <p className="text-sm font-semibold text-ink-soft">Conversation</p>
        <button onClick={onFermer} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line/40" aria-label="Fermer la conversation">
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line bg-paper p-4 text-sm text-ink-soft">
            Essaie « trouve mes photos », « range la facture EDF dans Énergie », « supprime le
            doublon de la carte grise », « comment résilier une assurance habitation », ou « je
            veux remplir un formulaire ».
          </p>
        )}
        <ul className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <li key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-bleu text-paper' : 'border border-line bg-paper'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.texte}</p>
                  {m.rechercheWebEffectuee && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                      <Globe size={12} /> Réponse appuyée sur une recherche web.
                    </p>
                  )}
                  {m.documentsCites && m.documentsCites.filter(nomExistant).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.documentsCites.filter(nomExistant).map((nom) => (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => ouvrirDocumentEtFermer(nom)}
                          className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/25"
                        >
                          {nom}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.ouvrirFormulaire && (
                    <button
                      type="button"
                      onClick={ouvrirFormulaireEtFermer}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <FileText size={12} /> Remplir un formulaire
                    </button>
                  )}
                  {m.ouvrirRangement && (
                    <button
                      type="button"
                      onClick={ouvrirRangementEtFermer}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <Folder size={12} /> Ranger en dossiers
                    </button>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-col items-start gap-1.5">
                      {m.actions.map((a, ai) => {
                        const fait = m.actionsExecutees?.[ai];
                        const cleAction = `${i}-${ai}`;
                        if (fait) {
                          return <p key={ai} className="text-xs text-ink-soft">{fait}</p>;
                        }
                        return (
                          <button
                            key={ai}
                            type="button"
                            disabled={actionEnCours === cleAction}
                            onClick={() => confirmerAction(i, ai, a)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-paper transition disabled:opacity-60 ${
                              a.type === 'supprimer' ? 'bg-wine hover:bg-wine/80' : 'bg-bleu hover:bg-bleu-strong'
                            }`}
                          >
                            {a.type === 'supprimer' ? <Trash2 size={12} /> : <Folder size={12} />}
                            {actionEnCours === cleAction ? 'En cours…' : `Confirmer : ${libelleAction(a)}`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {m.formulaireCerfa && (
                    <div className="mt-2 flex flex-col items-start gap-1.5">
                      <button
                        type="button"
                        disabled={cerfaEnCours === i}
                        onClick={() => surPreparerFormulaireCerfa(i, m.formulaireCerfa!.demarche, m.formulaireCerfa!.url)}
                        className="flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60"
                      >
                        <FileText size={12} />
                        {cerfaEnCours === i ? 'Préparation…' : `Préparer « ${m.formulaireCerfa.demarche} » pré-rempli`}
                      </button>
                      {cerfaEnCours === i && (
                        <p className="text-xs text-ink-soft">Téléchargement du formulaire et lecture de tes papiers…</p>
                      )}
                      {erreurCerfa && erreurCerfa.indexMessage === i && (
                        <p className="text-xs text-wine">{erreurCerfa.texte}</p>
                      )}
                    </div>
                  )}
                  {m.declencherTriAutomatique && (
                    <div className="mt-2 flex flex-col items-start gap-2">
                      {/* Aucun bouton : le tri part tout seul dès que ce
                          message existe — voir l'effet de déclenchement
                          plus haut. Ici, seulement le statut. */}
                      {triAuto.progres ? (
                        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <Folder size={12} />
                          Affinage en cours… ({triAuto.progres.fait}/{triAuto.progres.total})
                        </p>
                      ) : triAuto.enCours ? (
                        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <Folder size={12} /> Classement en cours…
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <Folder size={12} /> Fait.
                        </p>
                      )}
                      {triAuto.progres && (
                        <div
                          role="progressbar"
                          aria-valuenow={triAuto.progres.fait}
                          aria-valuemin={0}
                          aria-valuemax={triAuto.progres.total}
                          aria-label="Progression du tri automatique"
                          className="relative h-1.5 w-full overflow-hidden rounded-full bg-line"
                        >
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-vert via-accent to-violet" />
                          <div
                            className="absolute inset-y-0 right-0 rounded-r-full bg-line transition-all"
                            style={{ width: `${100 - (triAuto.progres.fait / triAuto.progres.total) * 100}%` }}
                          />
                        </div>
                      )}
                      {triAuto.bilan && triAuto.bilan.erreursTechniques.length > 0 && (
                        <div className="flex w-full flex-col gap-2 rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-wine">
                              {triAuto.bilan.erreursTechniques.length} fichier{triAuto.bilan.erreursTechniques.length > 1 ? 's' : ''} non
                              analysé{triAuto.bilan.erreursTechniques.length > 1 ? 's' : ''}.
                            </p>
                            <button
                              type="button"
                              onClick={onLancerTriAutomatique}
                              disabled={triAuto.enCours}
                              className="shrink-0 font-semibold text-wine underline decoration-dotted hover:text-ink disabled:opacity-60"
                            >
                              Réessayer
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={onBasculerDetailTriAutomatique}
                            className="self-start text-ink-soft underline decoration-dotted hover:text-ink"
                          >
                            {triAuto.detailOuvert ? 'Masquer le détail' : 'Voir le détail'}
                          </button>
                          {triAuto.detailOuvert && (
                            <div className="max-h-40 overflow-y-auto rounded-lg bg-paper p-2 text-xs text-ink-soft">
                              {triAuto.bilan.erreursTechniques.map((nom, ni) => (
                                <p key={`${nom}-${ni}`} className="truncate">{nom}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {triAuto.bilan && triAuto.bilan.abandonnes.length > 0 && (
                        <div className="flex w-full flex-col gap-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-xs text-ink-soft">
                          <p>
                            {triAuto.bilan.abandonnes.length} fichier{triAuto.bilan.abandonnes.length > 1 ? 's' : ''} n&apos;
                            {triAuto.bilan.abandonnes.length > 1 ? 'ont' : 'a'} pas pu être analysé
                            {triAuto.bilan.abandonnes.length > 1 ? 's' : ''} par l&apos;IA après plusieurs
                            tentatives — {triAuto.bilan.abandonnes.length > 1 ? 'ils restent' : 'il reste'} classé
                            {triAuto.bilan.abandonnes.length > 1 ? 's' : ''} dans leur dossier général (Images/Papiers).
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {enCours && (
              <li className="flex justify-start">
                <div className="rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm text-ink-soft">
                  Je regarde…
                </div>
              </li>
            )}
          </ul>
          <div ref={finDesMessages} />
        </div>

        <form onSubmit={envoyer} className="flex gap-2 border-t border-line p-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pose ta question…"
            disabled={enCours}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={enCours || !question.trim()}
            className="flex shrink-0 items-center justify-center rounded-lg bg-bleu px-4 py-2.5 text-paper transition hover:bg-bleu-strong disabled:opacity-60"
            aria-label="Envoyer"
          >
            <Send size={18} />
          </button>
        </form>
    </div>
  );
}
