Warning: truncated output (original token count: 23335)
Total output lines: 1882

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Bell, Briefcase, Car, ChevronRight, File, FileText, Folder, Heart, Home, Landmark, LogOut,
  MessageCircle, Plus, Shield, ShieldCheck, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  enregistrerIdentite, composerLettreResiliation, modifierObjet, modifierPlusieursObjets, ecarterEcheance, statutEcheance,
  interpreterQuestion, genererICS, SEUIL_BIENTOT_JOURS, clesParNomAffiche,
  categorieInstantanee, affinableParIA, recupererFormulaireCerfa, suggererChampsFormulaire,
  type IndexCoffre, type Echeance, type Identite, type StatutEcheance, type ObjetIndex, type ActionAssistant,
} from '@/lib/coffre';
import { champsFormulaire } from '@/lib/formulaire';
import { RemplirFormulaire, type FormulairePreRempli } from './RemplirFormulaire';
import { AssistantCoffre } from './AssistantCoffre';

type Etape = 'chargement' | 'creer' | 'deverrouiller' | 'ouvert';

const ECHEANCE_VIDE: Echeance = { presente: false, date: null, libelle: null, confiance: 'basse' };
const CATEGORIES_RESILIABLES = ['Assurance', 'Énergie', 'Téléphonie et internet'];
// Dossier de repli pour la vue « Ranger en dossiers » — un papier sans
// catégorie (proposition de classement non lisible, jamais corrigée) doit
// quand même atterrir quelque part plutôt que de disparaître de la vue.
const DOSSIER_SANS_CATEGORIE = 'À trier';
// Le vrai garde-fou est un trigger Postgres sur storage.objects (voir
// supabase/schema.sql §6) — storage.buckets.file_size_limit seul ne protège
// qu'un fichier à la fois, jamais l'espace total d'un compte. Le contrôle
// client donne un message immédiat sans même tenter le chiffrement ; les
// trois doivent rester synchronisés avec SECURITY.md.
//
// 5 Go par fichier, pas plus : `deposerFichier` charge le fichier entier en
// mémoire pour le chiffrer d'un bloc (chiffrerOctets). Un fichier plus gros
// risquerait de faire planter l'onglet sur un téléphone d'entrée de gamme
// avant même d'atteindre le réseau — c'est une limite de conception, pas un
// chiffre choisi au hasard.
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024 * 1024;
// Espace total par compte — 100 Go d'origine, le forfait Supabase Pro inclus.
// Au-delà, chaque Go coûte environ 0,021 $/mois : un compte peut monter au
// téraoctet en ne changeant que ce chiffre, au prix réel de l'usage.
const QUOTA_TOTAL_OCTETS = 100 * 1024 * 1024 * 1024;

// Une couleur reconnaissable par catégorie — vert (soutien discret) pour ce
// qui touche au quotidien personnel, violet (dominant) pour l'administratif
// et l'argent, wine pour ce qui presse (assurance/énergie, déjà lié à des
// échéances de résiliation). Jamais d'orange/jaune, jamais de turquoise ni de
// bleu ici : ces deux-là sont réservés aux titres/liens/actifs et aux
// boutons/alertes, pas à un badge de catégorie.
const STYLE_CATEGORIE: Record<string, { icone: LucideIcon; classe: string }> = {
  'Administratif': { icone: FileText, classe: 'bg-violet/15 text-violet' },
  'Impôts': { icone: Landmark, classe: 'bg-violet/15 text-violet' },
  'Santé': { icone: Heart, classe: 'bg-vert/15 text-vert' },
  'Logement': { icone: Home, classe: 'bg-vert/15 text-vert' },
  'Banque': { icone: Wallet, classe: 'bg-violet/15 text-violet' },
  'Assurance': { icone: Shield, classe: 'bg-wine/15 text-wine' },
  'Énergie': { icone: Zap, classe: 'bg-wine/15 text-wine' },
  'Téléphonie et internet': { icone: Wifi, classe: 'bg-violet/15 text-violet' },
  'Emploi': { icone: Briefcase, classe: 'bg-vert/15 text-vert' },
  'Véhicule': { icone: Car, classe: 'bg-violet/15 text-violet' },
};
const STYLE_CATEGORIE_DEFAUT = { icone: File, classe: 'bg-ink-soft/15 text-ink-soft' };
function styleCategorie(categorie: string) {
  return STYLE_CATEGORIE[categorie] ?? STYLE_CATEGORIE_DEFAUT;
}

type EnAttente = {
  cle: string;
  fichier: File;
  enAnalyse: boolean;
  categorie: string;
  nomAffiche: string;
  echeance: Echeance;
  emetteur: string;
  referenceClient: string;
  montant: string;
  // Jamais montré ni modifiable ici — sert uniquement à la recherche une
  // fois le document déposé (voir rechercheCorrespond dans coffre.ts).
  texteExtrait: string;
};

type Correction = { nom: string; categorie: string; montant: string };

// Trois états lisibles d'un coup d'œil, dérivés du même calcul que la
// bannière d'alerte — voir statutEcheance dans coffre.ts pour les seuils.
// Jamais d'orange ni de jaune (préférence posée pour tous les projets,
// voir globals.css) : violet pour l'intermédiaire, vert (soutien discret)
// pour « rien à faire », jamais d'ambre.
const LIBELLE_STATUT: Record<StatutEcheance, string> = {
  urgent: 'Urgent', bientot: 'Bientôt', calme: 'Calme',
};
const CLASSE_STATUT: Record<StatutEcheance, string> = {
  urgent: 'bg-wine', bientot: 'bg-violet', calme: 'bg-vert',
};
// Même code couleur que le point, en texte — la couleur seule ne porte
// jamais le statut à elle seule (voir BadgeStatut), et un mot visible sur la
// carte évite d'avoir à ouvrir la fiche détail pour savoir où on en est.
const CLASSE_STATUT_TEXTE: Record<StatutEcheance, string> = {
  urgent: 'text-wine', bientot: 'text-violet', calme: 'text-vert',
};
// Point coloré seul dans la liste (comme la maquette), toujours doublé d'un
// aria-label et d'un title — la couleur seule ne suffit jamais à porter un
// sens pour qui ne la distingue pas.
function BadgeStatut({ jours }: { jours: number }) {
  const statut = statutEcheance(jours);
  return (
    <span
      role="img"
      aria-label={`Statut : ${LIBELLE_STATUT[statut]}`}
      title={LIBELLE_STATUT[statut]}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${CLASSE_STATUT[statut]}`}
    />
  );
}

// Un dégradé continu vert → turquoise → violet, jamais l'ambre demandé au
// départ : cette appli a banni l'orange/jaune de toute sa palette (voir
// globals.css). Le fond du rail porte le dégradé sur toute sa largeur ; un
// cache de la couleur du rail vide recouvre la partie non atteinte depuis la
// droite, si bien que la teinte visible avance en continu avec le temps au
// lieu de sauter entre trois aplats — la jauge se lit comme un vrai dégradé,
// pas comme un badge de statut redondant avec BadgeStatut.
const HORIZON_JAUGE_JOURS = SEUIL_BIENTOT_JOURS + 15; // marge pour qu'« encore loin » ne soit pas déjà à moitié pleine
function JaugeEcheance({ jours }: { jours: number }) {
  const statut = statutEcheance(jours);
  const rempli = Math.max(0, Math.min(100, ((HORIZON_JAUGE_JOURS - jours) / HORIZON_JAUGE_JOURS) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(rempli)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Échéance : ${LIBELLE_STATUT[statut]}`}
      title={`${LIBELLE_STATUT[statut]} — ${formatJours(jours)}`}
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-vert via-accent to-violet" />
      <div
        className="absolute inset-y-0 right-0 rounded-r-full bg-line transition-all"
        style={{ width: `${100 - rempli}%` }}
      />
    </div>
  );
}

function joursRestants(dateIso: string): number {
  const cible = new Date(`${dateIso}T00:00:00`);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible.getTime() - aujourdhui.getTime()) / 86_400_000);
}

function formatJours(jours: number): string {
  if (jours < 0) return `en retard de ${Math.abs(jours)} j`;
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return 'demain';
  return `dans ${jours} j`;
}

// La plus proche échéance ou rendez-vous, tous confondus — calculé côté
// navigateur sur l'index déjà déchiffré, jamais envoyé nulle part. `nom`
// n'est présent que pour une échéance de document (jamais un rendez-vous) :
// c'est ce qui permet à la bannière d'ouvrir directement la fiche concernée.
function prochaineAlerte(index: IndexCoffre): { libelle: string; date: string; jours: number; nom?: string } | null {
  const items: { libelle: string; date: string; jours: number; nom?: string }[] = [];
  for (const [nom, objet] of Object.entries(index.objets)) {
    if (objet.echeance?.presente && objet.echeance.date) {
      items.push({
        libelle: objet.echeance.libelle || objet.nom,
        date: objet.echeance.date,
        jours: joursRestants(objet.echeance.date),
        nom,
      });
    }
  }
  for (const rdv of Object.values(index.rendezVous || {})) {
    items.push({ libelle: rdv.libelle, date: rdv.date, jours: joursRestants(rdv.date) });
  }
  if (items.length === 0) return null;
  return items.sort((a, b) => a.jours - b.jours)[0] ?? null;
}

function LettrePreview({ identite, emetteur, referenceClient, date }: {
  identite: Identite; emetteur: string; referenceClient: string | null; date: string;
}) {
  const lettre = composerLettreResiliation(identite, emetteur, referenceClient, date);
  return (
    <div className="rounded-lg border border-line bg-paper p-3 text-sm">
      <p className="mb-2 font-medium">Lettre de résiliation (brouillon — à relire avant signature)</p>
      <pre className="mb-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-ink-soft">
        {lettre.objet}{'\n\n'}{lettre.corps}
      </pre>
      {lettre.mentionsManquantes.length > 0 && (
        <p className="text-wine">Manque : {lettre.mentionsManquantes.join(', ')}.</p>
      )}
    </div>
  );
}

// Aperçu instantané dans la fiche détail, sans passer par un téléchargement
// (rien n'est écrit sur le disque du téléphone dans les deux cas). Monté
// avec key={nom} par l'appelant : changer de document remonte ce composant
// à neuf plutôt que de réinitialiser son état depuis un effet, qui
// déclencherait un rendu en cascade évitable. Une image se montre
// directement dans la page ; un PDF s'ouvre en un tap dans un nouvel onglet
// — jamais dans un cadre intégré, que Chrome Android refuse de rendre. Les
// autres types gardent le seul bouton Télécharger.
function FichePreview({ nom, info, userId, cle }: {
  nom: string; info: ObjetIndex; userId: string; cle: CryptoKey;
}) {
  const previsualisable = info.type.startsWith('image/') || info.type === 'application/pdf';
  const [apercu, setApercu] = useState<{ url: string; type: string } | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!previsualisable) return;
    let annule = false;
    recupererFichier(userId, cle, nom, info)
      .then((blob) => { if (!annule) setApercu({ url: URL.createObjectURL(blob), type: info.type }); })
      .catch((err) => { if (!annule) setErreur(err instanceof Error ? err.message : String(err)); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (apercu) URL.revokeObjectURL(apercu.url); };
  }, [apercu]);

  if (!previsualisable) {
    return (
      <p className="text-sm text-ink-soft">
        Aperçu non disponible pour ce type de fichier — télécharge-le pour l&apos;ouvrir.
      </p>
    );
  }
  if (erreur) return <p className="text-sm text-wine">Aperçu impossible : {erreur}</p>;
  if (!apercu) return <p className="text-sm text-ink-soft">Déchiffrement de l&apos;aperçu…</p>;
  // Un PDF ne s'affiche pas dans un <iframe> sur Chrome Android : au lieu du
  // rendu attendu, le navigateur bascule sur son intention de téléchargement
  // natif — plein écran, nom de fichier illisible (l'opaque du stockage), et
  // le bouton « Ouvrir » de cette boîte ne fait rien (06/09/2026, vu en
  // usage réel). Ouvrir le même blob en nouvel onglet, plutôt qu'en cadre
  // intégré, est le chemin que le lecteur PDF intégré de Chrome sait
  // réellement prendre en charge.
  return apercu.type === 'application/pdf' ? (
    <button
      type="button"
      onClick={() => window.open(apercu.url, '_blank', 'noopener')}
      className="flex w-full flex-col items-center gap-2 rounded-xl border border-line bg-paper p-6 text-center transition hover:border-accent/60"
    >
      <FileText size={28} className="text-ink-soft" />
      <span className="text-sm font-medium">Ouvrir l&apos;aperçu du PDF</span>
      <span className="text-xs text-ink-soft">Dans un nouvel onglet — rien n&apos;est enregistré sur le téléphone.</span>
    </button>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- blob: local, next/image ne s'applique pas
    <img src={apercu.url} alt={info.nom} className="max-h-80 w-full rounded-xl border border-line object-contain" />
  );
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  if (octets < 1024 * 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(octets / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

// Surface minimale de l'API File and Directory Entries — non standardisée
// (préfixe « webkit »), donc absente des types DOM de TypeScript. Déclarée
// ici plutôt que globalement : elle ne sert qu'à explorer un dossier glissé.
type EntreeSysteme = {
  isFile: boolean;
  isDirectory: boolean;
  file?: (succes: (f: File) => void, echec: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (succes: (e: EntreeSysteme[]) => void, echec: (e: unknown) => void) => void;
  };
};

// Un dossier glissé n'est pas une liste de fichiers : seule cette API sait
// descendre dans un sous-dossier. Hors Chrome/Edge (webkitGetAsEntry
// absent), on retombe sur les fichiers à plat que dataTransfer.files donne
// déjà — jamais d'erreur, juste moins de fichiers trouvés.
async function fichiersDuGlisserDeposer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items || []);
  const racines = items
    .map((item) => (item as unknown as { webkitGetAsEntry?: () => EntreeSysteme | null }).webkitGetAsEntry?.())
    .filter((e): e is EntreeSysteme => Boolean(e));
  if (racines.length === 0) return Array.from(dataTransfer.files);

  async function lireDossier(entree: EntreeSysteme): Promise<EntreeSysteme[]> {
    const lecteur = entree.createReader?.();
    if (!lecteur) return [];
    const tout: EntreeSysteme[] = [];
    // readEntries ne rend qu'un lot à la fois — un dossier de plus de cent
    // fichiers ne sortirait pas en entier sans boucler jusqu'au lot vide.
    let lot: EntreeSysteme[];
    do {
      lot = await new Promise<EntreeSysteme[]>((resolve, reject) => lecteur.readEntries(resolve, reject));
      tout.push(...lot);
    } while (lot.length > 0);
    return tout;
  }

  async function explorer(entree: EntreeSysteme): Promise<File[]> {
    if (entree.isFile && entree.file) {
      return [await new Promise<File>((resolve, reject) => entree.file?.(resolve, reject))];
    }
    if (entree.isDirectory) {
      const enfants = await lireDossier(entree);
      const listes = await Promise.all(enfants.map(explorer));
      return listes.flat();
    }
    return [];
  }

  const listes = await Promise.all(racines.map(explorer));
  return listes.flat();
}

// Champ de saisie commun aux petits formulaires (identité, rendez-vous) —
// un seul endroit à toucher pour l'habillage plutôt que de le répéter.
function Champ(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
    />
  );
}

export default function PageCoffre() {
  const routeur = useRouter();
  const [utilisateur, setUtilisateur] = useState<User | null>(null);
  const [etape, setEtape] = useState<Etape>('chargement');
  const [cle, setCle] = useState<CryptoKey | null>(null);
  const [index, setIndex] = useState<IndexCoffre>({ objets: {}, rendezVous: {} });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [aValider, setAValider] = useState<EnAttente[]>([]);
  // Miroir synchrone de aValider, pour confirmerTout ci-dessous : une
  // boucle qui dépose « tout » doit voir l'état le plus frais à chaque
  // tour, jamais l'instantané capturé à l'appel — c'est cet instantané qui
  // laissait de côté les fichiers encore en lecture au moment du clic.
  const aValiderRef = useRef<EnAttente[]>([]);
  useEffect(() => {
    aValiderRef.current = aValider;
  }, [aValider]);
  const [survole, setSurvole] = useState(false);
  const [identiteEnregistree, setIdentiteEnregistree] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  // Posé quand un CERFA a été trouvé et téléchargé par l'assistant (voir
  // preparerFormulaireCerfa) — undefined pour un dépôt manuel classique,
  // remis à undefined à la fermeture pour ne pas réutiliser un formulaire
  // périmé au prochain « Remplir un formulaire ».
  const [formulairePrerempli, setFormulairePrerempli] = useState<FormulairePreRempli | undefined>(undefined);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  // Posée par la barre de recherche du haut quand elle n'a rien trouvé
  // localement, ou vide pour une question ouverte — voir demanderAAssistant.
  const [questionAssistant, setQuestionAssistant] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  // Vue par défaut demandée le 10/09/2026 : des dossiers repliés, jamais la
  // liste plate — avec des centaines de papiers, une liste continue oblige à
  // défiler longtemps avant d'atteindre ce qui vit en dessous (rendez-vous,
  // identité). `dossiersOuverts` démarre vide juste en dessous : les dossiers
  // eux-mêmes restent repliés tant qu'on n'a pas cliqué dessus.
  const [vueDossiers, setVueDossiers] = useState(true);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [triAutoEnCours, setTriAutoEnCours] = useState(false);
  const [triAutoProgres, setTriAutoProgres] = useState<{ fait: number; total: number } | null>(null);
  // Plus de « non-documents » ici depuis le 10/09/2026 : tout fichier reçoit
  // toujours une catégorie (voir trierAutomatiquement) — ce bilan ne porte
  // plus que les vrais échecs techniques (réseau, quota).
  const [triAutoBilan, setTriAutoBilan] = useState<{ erreursTechniques: string[]; abandonnes: string[] } | null>(null);
  const [triAutoDetailOuvert, setTriAutoDetailOuvert] = useState(false);
  // Clés de stockage déjà passées par l'IA cette session, verdict positif ou
  // négatif peu importe — jamais remises en question tant que la page reste
  // ouverte. Sans cette mémoire, « Réessayer » après un échec technique ne
  // retrouvait plus le fichier concerné : la passe 1 lui avait déjà donné
  // une catégorie instantanée (Images/Papiers), donc il ne comptait plus
  // parmi les « non classés » que le prochain appel recalculait — mesuré le
  // 10/09/2026, 7 fichiers restés bloqués sur un lot de 89, le bouton
  // Réessayer ne faisant plus rien. Un échec technique ne rejoint PAS cet
  // ensemble : c'est justement ce qui le rend réessayable.
  const triAutoDejaAffines = useRef<Set<string>>(new Set());

  // Combien de fois un même…13335 tokens truncated…
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          </>
        )}

        {/* Grille principale : documents (large) + rendez-vous/identité (colonne) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold tracking-widest text-ink-soft uppercase">
                {/* « X sur Y » dès qu'un filtre réduit la liste — un simple
                    « (0) » a déjà fait croire à une perte de documents alors
                    qu'il ne comptait que les résultats filtrés (06/09/2026). */}
                Vos papiers ({noms.length === tousLesNoms.length ? noms.length : `${noms.length} sur ${tousLesNoms.length}`})
              </p>
              <button
                type="button"
                onClick={() => setVueDossiers((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  vueDossiers ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink-soft hover:text-ink'
                }`}
              >
                <Folder size={14} /> {vueDossiers ? 'Revenir à la liste' : 'Ranger en dossiers'}
              </button>
            </div>
            {categoriesConnues.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setFiltreCategorie(null)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    filtreCategorieEffectif === null ? 'bg-accent text-paper' : 'bg-paper-raised text-ink-soft hover:text-ink'
                  }`}>
                  Tout
                </button>
                {categoriesConnues.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setFiltreCategorie(filtreCategorieEffectif === c ? null : c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      filtreCategorieEffectif === c ? 'bg-accent text-paper' : 'bg-paper-raised text-ink-soft hover:text-ink'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            {tousLesNoms.length === 0 ? (
              <p className="rounded-2xl border border-line bg-paper-raised p-6 text-ink-soft">
                Le coffre est vide pour l&apos;instant — touche « Ajouter un papier » ci-dessous,
                ou dépose une photo n&apos;importe où sur cette page.
              </p>
            ) : noms.length === 0 ? (
              <p className="rounded-2xl border border-line bg-paper-raised p-6 text-ink-soft">
                {filtreCategorieEffectif && recherche.trim()
                  ? `Aucun papier dans « ${filtreCategorieEffectif} » pour « ${recherche.trim()} ».`
                  : filtreCategorieEffectif
                    ? `Aucun papier dans « ${filtreCategorieEffectif} ».`
                    : `Aucun papier pour « ${recherche.trim()} ».`}
              </p>
            ) : vueDossiers ? (
              // Repliés par défaut (dossiersOuverts démarre vide) : avec des
              // centaines de papiers, tout déplier d'un coup rend la page
              // aussi injouable qu'une longue liste continue — seul ce qu'on
              // a cliqué reste ouvert, le reste ne coûte qu'une ligne de titre.
              <div className="flex flex-col gap-4">
                {dossiers.map(([categorie, nomsDossier]) => {
                  const ouvert = dossiersOuverts.has(categorie);
                  return (
                    <div key={categorie} className="rounded-2xl border border-line bg-paper-raised p-4">
                      <button
                        type="button"
                        aria-expanded={ouvert}
                        onClick={() => setDossiersOuverts((precedent) => {
                          const suivant = new Set(precedent);
                          if (suivant.has(categorie)) suivant.delete(categorie); else suivant.add(categorie);
                          return suivant;
                        })}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <ChevronRight size={16} className={`shrink-0 text-ink-soft transition-transform ${ouvert ? 'rotate-90' : ''}`} />
                        <Folder size={16} className="shrink-0 text-ink-soft" />
                        <p className="text-sm font-semibold text-ink-soft">{categorie}</p>
                        <span className="text-xs text-ink-soft">({nomsDossier.length})</span>
                      </button>
                      {ouvert && (
                        <ul className="mt-3 flex flex-col gap-3">
                          {nomsDossier.map((nom) => carteDocument(nom))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {noms.map((nom) => carteDocument(nom))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-8">
            {/* Carte en verre demandée le 10/09/2026 : ces trois sections
                n'avaient jamais reçu la même carte que le reste de la page
                (en-tête, barre de recherche, fiches document) — sans
                `border-line bg-paper-raised`, elles ne portent aucun fond,
                donc pas la règle CSS partagée qui pose le dégradé
                turquoise-violet. Seul le turquoise des boutons et des bords
                de champ y ressortait, perçu comme « tout en vert » face au
                duo turquoise-violet visible ailleurs. */}
            <section id="rendez-vous" className="scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
              <h2 className="mb-4 font-affiche text-2xl">Rendez-vous</h2>
              <form onSubmit={surAjoutRendezVous} className="mb-4 flex flex-col gap-2">
                <Champ name="libelle" placeholder="Dentiste, cabinet Martin…" required />
                <div className="flex gap-2">
                  <Champ name="date" type="date" required />
                  {/* Optionnelle : sans heure, le rendez-vous reste noté
                      comme avant, juste sans rappel possible. */}
                  <Champ name="heure" type="time" aria-label="Heure (optionnel)" />
                  <button type="submit" disabled={enCours}
                    className="shrink-0 rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
                    Ajouter
                  </button>
                </div>
              </form>
              {rendezVousTries.length === 0 ? (
                <p className="text-sm text-ink-soft">Aucun rendez-vous noté.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rendezVousTries.map((rdv) => {
                    const joursRdv = joursRestants(rdv.date);
                    return (
                      <li key={rdv.id} className="flex flex-col gap-2 rounded-xl border border-line bg-paper-raised px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{rdv.libelle}</p>
                            <p className="text-sm text-ink-soft">{rdv.date}{rdv.heure ? ` à ${rdv.heure}` : ''}</p>
                          </div>
                          <button onClick={() => retirerRendezVous(rdv.id)} className="text-sm text-wine hover:underline">
                            Retirer
                          </button>
                        </div>
                        <JaugeEcheance jours={joursRdv} />
                        <button
                          type="button"
                          onClick={() => ajouterAuCalendrier(rdv.libelle, rdv.date, rdv.heure)}
                          className="self-start text-sm text-accent hover:underline"
                        >
                          Ajouter au calendrier{rdv.heure ? ' (avec rappel)' : ''}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section id="mon-identite" className="scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
              <h2 className="mb-2 font-affiche text-2xl">Mon identité</h2>
              <p className="mb-4 text-sm text-ink-soft">
                Sert uniquement à remplir l&apos;en-tête des lettres de résiliation — chiffrée comme le reste.
              </p>
              <form onSubmit={surEnregistrementIdentite} className="flex flex-col gap-2">
                <Champ name="nom" placeholder="Nom complet" required defaultValue={index.identite?.nom}
                  autoComplete="name" />
                <Champ name="adresse" placeholder="Adresse" required defaultValue={index.identite?.adresse}
                  autoComplete="street-address" />
                <div className="flex gap-2">
                  <Champ name="codePostal" placeholder="Code postal" defaultValue={index.identite?.codePostal}
                    autoComplete="postal-code" inputMode="numeric" />
                  <Champ name="ville" placeholder="Ville" defaultValue={index.identite?.ville}
                    autoComplete="address-level2" />
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={enCours}
                    className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
                    Enregistrer
                  </button>
                  {identiteEnregistree && (
                    <span className="text-sm text-vert">Identité enregistrée ✓</span>
                  )}
                </div>
              </form>
            </section>

            <section id="remplir-formulaire" className="scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
              <h2 className="mb-2 font-affiche text-2xl">Remplir un formulaire</h2>
              <p className="mb-4 text-sm text-ink-soft">
                Dépose un CERFA ou un mandat vierge : l&apos;appli détecte ses champs et les
                propose remplis avec ton identité, jamais hors de ce navigateur.
              </p>
              <button
                type="button"
                onClick={() => setFormulaireOuvert(true)}
                className="flex items-center gap-2 rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong"
              >
                <FileText size={16} /> Remplir un PDF vierge
              </button>
            </section>
          </div>
        </div>
      </div>

      {formulaireOuvert && (
        <RemplirFormulaire
          identite={index.identite}
          prerempli={formulairePrerempli}
          onFermer={() => { setFormulaireOuvert(false); setFormulairePrerempli(undefined); }}
        />
      )}

      {/* Un seul bouton flottant désormais : ajouter un papier — seul point
          d'entrée visible pour ça (la page entière reste aussi déposable,
          voir onDrop sur <main>). « Demander au coffre » n'a plus de bouton
          flottant séparé : la barre de recherche du haut est le point
          d'entrée unique, qui n'ouvre l'assistant que sur une recherche
          restée sans résultat ou une question explicitement plus large (voir
          demanderAAssistant) — plus de deux entrées concurrentes pour le
          même besoin. `pointer-events-none` sur le conteneur pleine largeur,
          `auto` sur le bouton : sans ça, toute la bande invisible du bas de
          l'écran — pas seulement le bouton visible — interceptait les taps
          destinés aux lignes de documents rendues dessous, quel que soit le
          défilement (position `fixed`). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <button
          type="button"
          onClick={() => entreeFichier.current?.click()}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-bleu px-6 py-3.5 font-semibold text-paper shadow-lg transition hover:bg-bleu-strong"
        >
          <Plus size={20} /> Ajouter un papier
        </button>
      </div>

      {/* Fiche détail : ouverte au clic sur un document, porte la correction
          du classement et les actions (télécharger / supprimer). */}
      {detailOuvert && index.objets[detailOuvert] && correction && (() => {
        const info = index.objets[detailOuvert];
        if (!info) return null;
        const { icone: Icone, classe } = styleCategorie(info.categorie);
        const jours = info.echeance?.presente && info.echeance.date
          ? joursRestants(info.echeance.date) : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6"
            onClick={fermerDetail}
          >
            <div
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-paper-raised p-6 sm:max-w-lg sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`shrink-0 rounded-xl p-2.5 ${classe}`}><Icone size={20} /></div>
                    <div className="min-w-0">
                      <p className="truncate font-affiche text-xl">{info.nom}</p>
                      <p className="text-sm text-ink-soft">
                        {formatTaille(info.taille)} · déposé le{' '}
                        {new Date(info.deposeLe).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <button onClick={fermerDetail}
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft transition hover:bg-line/40" aria-label="Fermer">
                    <X size={20} />
                  </button>
                </div>

                {utilisateur && cle && (
                  <FichePreview key={detailOuvert} nom={detailOuvert} info={info} userId={utilisateur.id} cle={cle} />
                )}

                {jours !== null && info.echeance && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <BadgeStatut jours={jours} />
                        <span className="text-sm text-ink-soft">
                          {info.echeance.libelle} — {formatJours(jours)} ({info.echeance.date})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => ecarter(detailOuvert)}
                        disabled={enCours}
                        className="text-xs text-ink-soft underline decoration-dotted transition hover:text-wine disabled:opacity-60"
                      >
                        Ce n&apos;est pas une échéance
                      </button>
                    </div>
                    <JaugeEcheance jours={jours} />
                  </div>
                )}

                {(info.montant || info.emetteur || info.referenceClient) && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {info.montant && (
                      <>
                        <dt className="text-ink-soft">Montant</dt>
                        <dd className="text-right font-medium">{info.montant}</dd>
                      </>
                    )}
                    {info.emetteur && (
                      <>
                        <dt className="text-ink-soft">Émetteur</dt>
                        <dd className="text-right">{info.emetteur}</dd>
                      </>
                    )}
                    {info.referenceClient && (
                      <>
                        <dt className="text-ink-soft">Référence</dt>
                        <dd className="text-right">{info.referenceClient}</dd>
                      </>
                    )}
                  </dl>
                )}

                {info.lettre && (
                  <div className="rounded-lg border border-line bg-paper p-3 text-sm">
                    <p className="mb-2 font-medium">Lettre de résiliation (brouillon — à relire avant signature)</p>
                    <pre className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-ink-soft">
                      {info.lettre.objet}{'\n\n'}{info.lettre.corps}
                    </pre>
                    {info.lettre.mentionsManquantes.length > 0 && (
                      <p className="text-wine">Manque : {info.lettre.mentionsManquantes.join(', ')}.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
                  <p className="text-sm font-medium text-ink-soft">Corriger le classement</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <label className="text-sm text-ink-soft" htmlFor="correction-nom">Nom</label>
                      <Champ id="correction-nom" value={correction.nom}
                        onChange={(e) => setCorrection({ ...correction, nom: e.target.value })} />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm text-ink-soft" htmlFor="correction-categorie">Catégorie</label>
                      <Champ id="correction-categorie" value={correction.categorie} list="categories-connues"
                        onChange={(e) => setCorrection({ ...correction, categorie: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-ink-soft" htmlFor="correction-montant">Montant</label>
                    <Champ id="correction-montant" value={correction.montant} placeholder="Non lu — à préciser"
                      onChange={(e) => setCorrection({ ...correction, montant: e.target.value })} />
                  </div>
                  <button onClick={enregistrerCorrection} disabled={enCours}
                    className="self-start rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
                    Enregistrer
                  </button>
                </div>

                <div className="flex gap-4 text-sm">
                  <button onClick={() => telecharger(detailOuvert)} className="text-accent hover:underline">
                    Télécharger
                  </button>
                  <button onClick={() => supprimer(detailOuvert)} className="text-wine hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
