'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  ArrowUpRight, Bell, Bot, Briefcase, Camera, Car, CheckCircle2, ChevronRight, File, FileText, Folder,
  FolderUp, Heart, Home, Landmark, LoaderCircle, LogOut, MessageCircle, ScanLine, Shield, ShieldCheck,
  Sparkles, Upload, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  analyserDocumentPourClassement, coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  enregistrerIdentite, composerLettreResiliation, modifierObjet, modifierPlusieursObjets, ecarterEcheance, statutEcheance,
  interpreterQuestion, genererICS, SEUIL_BIENTOT_JOURS, clesParNomAffiche,
  categorieInstantanee, recupererFormulaireCerfa, separerPdfParDocuments, suggererChampsFormulaire,
  digestIndex, type DigestDocument, type IndexCoffre, type Echeance, type Identite, type StatutEcheance, type ObjetIndex, type ActionAssistant,
} from '@/lib/coffre';
import { champsFormulaire } from '@/lib/formulaire';
import { RemplirFormulaire, type FormulairePreRempli } from './RemplirFormulaire';
import { AssistantCoffre } from './AssistantCoffre';
import { CoffreMer } from './CoffreMer';

type Etape = 'chargement' | 'configurer-acces' | 'creer' | 'deverrouiller' | 'ouvert';

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

type EtatCapture = {
  etat: 'repos' | 'analyse' | 'chiffrement' | 'range' | 'a-verifier' | 'erreur';
  message: string;
  cleDocument?: string;
};

type EtatImportIntelligent = {
  etat: 'repos' | 'analyse' | 'pret' | 'erreur';
  fait: number;
  total: number;
  message: string;
};

// Jeu de données uniquement disponible avec `?demo=1` en développement. Il
// permet la recette visuelle de l'espace privé sans compte ni document réel ;
// la condition NODE_ENV est éliminée du bundle de production.
function indexDemonstration(): IndexCoffre {
  const date = '2026-09-25T08:00:00.000Z';
  return {
    objets: {
      demo1: { nom: 'Facture EDF septembre', taille: 284_000, type: 'application/pdf', categorie: 'Énergie', deposeLe: date, montant: '89,90 €', emetteur: 'EDF', echeance: { presente: true, date: '2026-10-04', libelle: 'Paiement EDF', confiance: 'haute' } },
      demo2: { nom: 'Attestation mutuelle', taille: 612_000, type: 'image/jpeg', categorie: 'Santé', deposeLe: date },
      demo3: { nom: 'Carte grise Scénic', taille: 940_000, type: 'image/jpeg', categorie: 'Véhicule', deposeLe: date },
      demo4: { nom: 'Avis impôts 2026', taille: 1_250_000, type: 'application/pdf', categorie: 'Impôts', deposeLe: date },
      demo5: { nom: 'Contrat habitation', taille: 780_000, type: 'application/pdf', categorie: 'Assurance', deposeLe: date },
    },
    rendezVous: {
      rdv1: { id: 'rdv1', libelle: 'Renouvellement passeport', date: '2026-10-12', heure: '10:30' },
    },
    identite: { nom: 'Alex Martin', adresse: '12 rue des Fleurs', codePostal: '35000', ville: 'Rennes' },
  };
}

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

async function executerAvecConcurrence<T>(
  elements: T[], limite: number, tache: (element: T) => Promise<void>,
): Promise<void> {
  let prochain = 0;
  async function travailleur() {
    while (prochain < elements.length) {
      const element = elements[prochain++] as T;
      await tache(element);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, elements.length) }, () => travailleur()));
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
  const [animationActive, setAnimationActive] = useState(true);
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
  const [vueDossiers, setVueDossiers] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [triAutoEnCours, setTriAutoEnCours] = useState(false);
  const [triAutoProgres, setTriAutoProgres] = useState<{ fait: number; total: number } | null>(null);
  // Plus de « non-documents » ici depuis le 10/09/2026 : tout fichier reçoit
  // toujours une catégorie (voir trierAutomatiquement) — ce bilan ne porte
  // plus que les vrais échecs techniques (réseau, quota).
  const [triAutoBilan, setTriAutoBilan] = useState<{ erreursTechniques: string[]; abandonnes: string[] } | null>(null);
  const [triAutoDetailOuvert, setTriAutoDetailOuvert] = useState(false);
  // Dossiers dépliés dans la vue « Ranger en dossiers » — vide par défaut,
  // donc tous repliés : voir le rendu de `dossiers.map` plus bas.
  const [dossiersOuverts, setDossiersOuverts] = useState<Set<string>>(new Set());
  const [etatCapture, setEtatCapture] = useState<EtatCapture>({ etat: 'repos', message: '' });
  const [etatImportIntelligent, setEtatImportIntelligent] = useState<EtatImportIntelligent>({
    etat: 'repos', fait: 0, total: 0, message: '',
  });
  const entreeFichier = useRef<HTMLInputElement>(null);
  const entreePhoto = useRef<HTMLInputElement>(null);
  const entreeDossier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previewDeBranche = /^mon-tiroir-secret-git-(?!main(?:-|$))[a-z0-9-]+-erwannchevallier-6916s-projects\.vercel\.app$/.test(window.location.hostname);
    const modeDemoAutorise = process.env.NODE_ENV !== 'production' || previewDeBranche;
    if (modeDemoAutorise && new URLSearchParams(window.location.search).get('demo') === '1') {
      void crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then((cleDemo) => {
        setUtilisateur({ id: 'demo-local', email: 'alex.martin@example.invalid', user_metadata: {} } as User);
        setCle(cleDemo);
        setIndex(indexDemonstration());
        setEtape('ouvert');
      });
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        routeur.replace('/');
        return;
      }
      setUtilisateur(data.session.user);
      const existe = await coffreExiste(data.session.user.id);
      const configurerAcces = data.session.user.user_metadata?.acces_direct_configure !== true;
      setEtape(configurerAcces ? 'configurer-acces' : existe ? 'deverrouiller' : 'creer');
    });
  }, [routeur]);

  async function configurerAcces(e: React.FormEvent) {
    e.preventDefault();
    const forme = new FormData(e.target as HTMLFormElement);
    const motDePasse = String(forme.get('mot-de-passe-compte') || '');
    const confirmation = String(forme.get('confirmation-mot-de-passe-compte') || '');
    setErreur('');
    if (motDePasse.length < 12) {
      setErreur('Choisis au moins 12 caractères pour protéger l’accès à ton compte.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({
      password: motDePasse,
      data: { ...utilisateur?.user_metadata, acces_direct_configure: true },
    });
    setEnCours(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    routeur.replace('/coffre');
  }

  // Le bouton retour du téléphone déclenche cet événement plutôt que de
  // recharger la page — voir ouvrirDetail/fermerDetail pour l'entrée
  // d'historique correspondante.
  useEffect(() => {
    function surRetourArriere() {
      setDetailOuvert(null);
      setCorrection(null);
    }
    window.addEventListener('popstate', surRetourArriere);
    return () => window.removeEventListener('popstate', surRetourArriere);
  }, []);

  const seDeconnecter = useCallback(async () => {
    await supabase.auth.signOut();
    routeur.replace('/');
  }, [routeur]);

  async function creerCoffre(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur) return;
    const forme = new FormData(e.target as HTMLFormElement);
    const m1 = String(forme.get('mdp1') || '');
    const m2 = String(forme.get('mdp2') || '');
    setErreur('');
    if (m1.length < 10) {
      setErreur("Au moins 10 caractères — c'est elle, et elle seule, qui protège tout le coffre.");
      return;
    }
    if (m1 !== m2) {
      setErreur('Les deux phrases ne correspondent pas.');
      return;
    }
    setEnCours(true);
    try {
      const nouvelleCle = await initialiserCoffre(utilisateur.id, m1);
      setCle(nouvelleCle);
      setIndex({ objets: {}, rendezVous: {} });
      setEtape('ouvert');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  async function deverrouiller(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur) return;
    const forme = new FormData(e.target as HTMLFormElement);
    const mdp = String(forme.get('mdp') || '');
    setErreur('');
    setEnCours(true);
    try {
      const cleTrouvee = await deverrouillerCoffre(utilisateur.id, mdp);
      const indexCharge = await chargerIndex(utilisateur.id, cleTrouvee);
      setCle(cleTrouvee);
      setIndex(indexCharge);
      setEtape('ouvert');
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Phrase secrète incorrecte.');
    } finally {
      setEnCours(false);
    }
  }

  // Un fichier choisi ne se dépose pas tout de suite : on prépare d'abord une
  // fiche simple, classée localement par type de fichier. Aucun document ne
  // part vers un modèle externe par défaut ; rien ne bouge tant que
  // l'utilisateur n'a pas validé chaque fiche.
  async function surDepot(fichiers: File[], analyseIntelligente = false) {
    if (!fichiers.length || !utilisateur || !cle) return;
    setErreur('');

    const messages: string[] = [];
    const tropGros = fichiers.filter((f) => f.size > TAILLE_MAX_OCTETS);
    if (tropGros.length > 0) {
      messages.push(
        `${tropGros.map((f) => f.name).join(', ')} dépasse ${formatTaille(TAILLE_MAX_OCTETS)} — ` +
        `non déposé. Le serveur refuserait aussi ce dépôt.`,
      );
    }

    // Quota par compte : la vraie garde vit dans le trigger Postgres (voir
    // supabase/schema.sql §6) — ici on prévient avant même de chiffrer quoi
    // que ce soit, plutôt que de laisser chaque dépôt échouer un par un.
    const tailleDejaUtilisee = Object.values(index.objets).reduce((total, o) => total + o.taille, 0);
    let tailleRestante = QUOTA_TOTAL_OCTETS - tailleDejaUtilisee;
    const acceptesParQuota: File[] = [];
    const refusesParQuota: File[] = [];
    for (const f of fichiers.filter((f) => f.size <= TAILLE_MAX_OCTETS)) {
      if (f.size <= tailleRestante) {
        acceptesParQuota.push(f);
        tailleRestante -= f.size;
      } else {
        refusesParQuota.push(f);
      }
    }
    if (refusesParQuota.length > 0) {
      messages.push(
        `${refusesParQuota.map((f) => f.name).join(', ')} dépasserait ton espace total de ` +
        `${formatTaille(QUOTA_TOTAL_OCTETS)} — non déposé. Le serveur refuserait aussi ce dépôt.`,
      );
    }

    if (messages.length > 0) setErreur(messages.join(' '));
    const fichiersValides = acceptesParQuota;
    if (fichiersValides.length === 0) {
      if (entreeFichier.current) entreeFichier.current.value = '';
      return;
    }

    const nouveaux: EnAttente[] = fichiersValides.map((fichier) => ({
      cle: `${fichier.name}-${fichier.size}-${crypto.randomUUID()}`,
      fichier, enAnalyse: true, categorie: '', nomAffiche: fichier.name, echeance: ECHEANCE_VIDE,
      emetteur: '', referenceClient: '', montant: '', texteExtrait: '',
    }));
    setAValider((precedent) => [...precedent, ...nouveaux]);
    if (entreeFichier.current) entreeFichier.current.value = '';
    if (entreeDossier.current) entreeDossier.current.value = '';

    if (analyseIntelligente) {
      setEtatImportIntelligent({
        etat: 'analyse', fait: 0, total: nouveaux.length,
        message: `Gemini analyse ${nouveaux.length} document${nouveaux.length > 1 ? 's' : ''}…`,
      });
    }

    // En parallèle, pas un par un : même sans IA externe, laisser chaque
    // fichier terminer sa préparation indépendamment rend les gros dépôts
    // plus fluides.
    // Chaque `setAValider` porte sa propre clé et utilise la forme
    // fonctionnelle — les réponses qui reviennent dans le désordre ne
    // s'écrasent jamais entre elles.
    //
    // La voie privée est la règle : proposerClassement reste une fonction de
    // confort locale, jamais un envoi automatique du document.
    const categoriesConnues = new Set(
      Object.values(index.objets).map((objet) => objet.categorie).filter(Boolean),
    );
    let analysesTerminees = 0;
    let documentsProduits = nouveaux.length;
    await executerAvecConcurrence(nouveaux, analyseIntelligente ? 2 : nouveaux.length, async (item) => {
      let proposition = analyseIntelligente
        ? await analyserDocumentPourClassement(item.fichier, Array.from(categoriesConnues))
        : await proposerClassement(item.fichier);

      if (analyseIntelligente && item.fichier.type === 'application/pdf' && (proposition.documentsDetectes?.length ?? 0) > 1) {
        try {
          const documents = await separerPdfParDocuments(item.fichier, proposition.documentsDetectes ?? []);
          const attentesSeparees: EnAttente[] = documents.map(({ fichier, proposition: detail }) => ({
            cle: `${fichier.name}-${fichier.size}-${crypto.randomUUID()}`,
            fichier,
            enAnalyse: false,
            categorie: detail.lisible ? detail.categorie : 'À vérifier',
            nomAffiche: detail.lisible ? detail.nomSuggere : fichier.name,
            echeance: detail.echeance,
            emetteur: detail.emetteur || '',
            referenceClient: detail.referenceClient || '',
            montant: detail.montant || '',
            texteExtrait: detail.texteExtrait || '',
          }));
          documentsProduits += attentesSeparees.length - 1;
          for (const attente of attentesSeparees) {
            if (attente.categorie && attente.categorie !== 'À vérifier') categoriesConnues.add(attente.categorie);
          }
          setAValider((precedent) => precedent.flatMap((p) => p.cle === item.cle ? attentesSeparees : [p]));
        } catch {
          // Une frontière invalide ou un PDF illisible reste entier et attend
          // une vérification humaine. Rien n'est classé au hasard.
          proposition = { ...proposition, lisible: false, documentsDetectes: [], segmentationIncertaine: true };
          setAValider((precedent) => precedent.map((p) => (p.cle === item.cle ? {
            ...p, enAnalyse: false, categorie: 'À vérifier', nomAffiche: p.fichier.name,
          } : p)));
        }
      } else {
        setAValider((precedent) => precedent.map((p) => (p.cle === item.cle ? {
          ...p, enAnalyse: false,
          categorie: proposition.lisible ? proposition.categorie : (analyseIntelligente ? 'À vérifier' : ''),
          nomAffiche: proposition.lisible && proposition.nomSuggere ? proposition.nomSuggere : p.fichier.name,
          echeance: proposition.echeance,
          emetteur: proposition.emetteur || '',
          referenceClient: proposition.referenceClient || '',
          montant: proposition.montant || '',
          texteExtrait: proposition.texteExtrait || '',
        } : p)));
      }
      if (analyseIntelligente && proposition.lisible && proposition.categorie) {
        categoriesConnues.add(proposition.categorie);
      }
      if (analyseIntelligente) {
        analysesTerminees += 1;
        setEtatImportIntelligent({
          etat: analysesTerminees === nouveaux.length ? 'pret' : 'analyse',
          fait: analysesTerminees,
          total: nouveaux.length,
          message: analysesTerminees === nouveaux.length
            ? `${documentsProduits} document${documentsProduits > 1 ? 's distincts sont prêts' : ' distinct est prêt'} : vérifie puis dépose tout en un clic.`
            : `Gemini analyse le dossier… ${analysesTerminees}/${nouveaux.length}`,
        });
      }
    });
  }

  // Parcours express demandé pour le téléphone : une photo, une lecture
  // intelligente, puis chiffrement et rangement sans fiche intermédiaire si
  // le document est réellement lisible. Au moindre doute ou incident, la
  // photo rejoint la file de vérification au lieu d'être rangée au hasard.
  async function photographierEtRanger(fichiers: File[]) {
    const fichier = fichiers[0];
    if (!fichier || !utilisateur || !cle) return;
    if (fichier.size > TAILLE_MAX_OCTETS) {
      setEtatCapture({ etat: 'erreur', message: `Cette photo dépasse ${formatTaille(TAILLE_MAX_OCTETS)}.` });
      return;
    }
    const tailleDejaUtilisee = Object.values(index.objets).reduce((total, o) => total + o.taille, 0);
    if (tailleDejaUtilisee + fichier.size > QUOTA_TOTAL_OCTETS) {
      setEtatCapture({ etat: 'erreur', message: `Ton espace de ${formatTaille(QUOTA_TOTAL_OCTETS)} est atteint.` });
      return;
    }

    setErreur('');
    setEtatCapture({ etat: 'analyse', message: 'Je lis le document et cherche le bon dossier…' });
    const proposition = await analyserDocumentPourClassement(fichier);
    if (!proposition.lisible || proposition.erreurTechnique) {
      setEtatCapture({
        etat: 'a-verifier',
        message: proposition.erreurTechnique
          ? "L'analyse intelligente est indisponible. La photo est prête à être vérifiée, rien n'est perdu."
          : "Je ne peux pas lire ce document avec assez de certitude. Vérifie son nom et son dossier avant dépôt.",
      });
      await surDepot([fichier]);
      return;
    }

    setEtatCapture({ etat: 'chiffrement', message: 'Classement trouvé. Je chiffre la photo avant de la ranger…' });
    try {
      const avant = new Set(Object.keys(index.objets));
      const nouvelIndex = await deposerFichier(
        utilisateur.id, cle, fichier, proposition.categorie, index,
        proposition.nomSuggere || fichier.name, proposition.echeance,
        proposition.emetteur, proposition.referenceClient, proposition.montant,
        proposition.texteExtrait,
      );
      setIndex(nouvelIndex);
      const cleDocument = Object.keys(nouvelIndex.objets).find((nom) => !avant.has(nom));
      setEtatCapture({
        etat: 'range',
        message: `« ${proposition.nomSuggere || fichier.name} » est chiffré et rangé dans ${proposition.categorie}.`,
        cleDocument,
      });
    } catch (err) {
      setEtatCapture({
        etat: 'erreur',
        message: `Le rangement n'a pas abouti : ${err instanceof Error ? err.message : String(err)}.`,
      });
      await surDepot([fichier]);
    }
  }

  function modifierAttente(cleItem: string, champs: Partial<EnAttente>) {
    setAValider((precedent) => precedent.map((p) => (p.cle === cleItem ? { ...p, ...champs } : p)));
  }

  function retirerAttente(cleItem: string) {
    setAValider((precedent) => precedent.filter((p) => p.cle !== cleItem));
  }

  async function confirmerDepot(item: EnAttente) {
    if (!utilisateur || !cle) return;
    setEnCours(true);
    setErreur('');
    try {
      const nouvelIndex = await deposerFichier(
        utilisateur.id, cle, item.fichier, item.categorie, index, item.nomAffiche, item.echeance,
        item.emetteur || null, item.referenceClient || null, item.montant || null,
        item.texteExtrait || null,
      );
      setIndex(nouvelIndex);
      retirerAttente(item.cle);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  // Dépose tous les papiers prêts d'un coup, plutôt que de cliquer
  // « Déposer » sur chacun — le geste qui rendait le dépôt d'un dossier
  // interminable. Les dépôts s'enchaînent l'un après l'autre (jamais en
  // parallèle) sur un index local plutôt que sur l'état React : deux appels
  // à deposerFichier lancés côte à côte partiraient tous les deux du même
  // index de départ, et le second écraserait le premier au lieu de s'y
  // ajouter.
  //
  // Boucle plutôt qu'une seule passe sur `prets` : sur un gros lot, la
  // préparation de chaque fiche peut se terminer en désordre. Le bouton
  // reste cliquable dès qu'UN SEUL fichier est prêt, pas tous. Une
  // seule passe déposait alors ce sous-ensemble et abandonnait les fichiers
  // encore « en lecture » à cet instant : ils restaient coincés dans la
  // liste d'attente pour de bon, jamais redéposés tout seuls, et un tri
  // automatique lancé juste après ne les voyait jamais — d'où un compteur
  // de papiers plus bas que ce qui avait été réellement déposé. Tant qu'il
  // reste un fichier en lecture, on l'attend au lieu de s'arrêter.
  async function confirmerTout() {
    if (!utilisateur || !cle) return;
    if (aValiderRef.current.every((p) => p.enAnalyse)) return;
    setEnCours(true);
    setErreur('');
    let indexCourant = index;
    const echecs: string[] = [];
    // Un fichier dont le dépôt échoue reste dans la liste d'attente (pour
    // que l'utilisateur le voie et le corrige) mais ne doit pas être
    // retenté à chaque tour de la boucle ci-dessous — sinon un échec
    // persistant (réseau, quota) transforme l'attente des fichiers encore
    // en lecture en une boucle infinie sur ce même fichier en échec.
    const dejaEnEchec = new Set<string>();
    for (;;) {
      const prets = aValiderRef.current.filter((p) => !p.enAnalyse && !dejaEnEchec.has(p.cle));
      if (prets.length === 0) {
        if (aValiderRef.current.some((p) => p.enAnalyse)) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        break;
      }
      for (const item of prets) {
        try {
          indexCourant = await deposerFichier(
            utilisateur.id, cle, item.fichier, item.categorie, indexCourant, item.nomAffiche, item.echeance,
            item.emetteur || null, item.referenceClient || null, item.montant || null,
            item.texteExtrait || null,
          );
          setIndex(indexCourant);
          retirerAttente(item.cle);
        } catch (err) {
          echecs.push(`${item.nomAffiche} (${err instanceof Error ? err.message : String(err)})`);
          dejaEnEchec.add(item.cle);
        }
      }
    }
    if (echecs.length > 0) setErreur(`Non déposés : ${echecs.join(', ')}.`);
    setEnCours(false);
  }

  // Tri automatique privé : une passe locale pose un dossier général sur
  // chaque fichier. Aucun fichier ne reste « non classé » après cet appel,
  // quel que soit son type.
  //
  // Une ancienne seconde passe IA peut revenir un jour sous consentement
  // explicite. Elle est désactivée par défaut : la promesse du produit est
  // d'abord de créer un repère fiable sans exposer les papiers.
  async function trierAutomatiquement() {
    if (!utilisateur || !cle) return;
    const nonClasses = Object.keys(index.objets).filter((n) => !index.objets[n]?.categorie?.trim());

    setTriAutoEnCours(true);
    setTriAutoProgres(null);
    setTriAutoBilan(null);
    setTriAutoDetailOuvert(false);

    // Passe 1 : instantanée, un seul aller-retour de sauvegarde pour tout le
    // lot, quelle que soit sa taille.
    const instantanes: Record<string, { categorie: string }> = {};
    for (const nom of nonClasses) {
      const info = index.objets[nom];
      if (info) instantanes[nom] = { categorie: categorieInstantanee(info.type) };
    }
    let indexCourant: IndexCoffre;
    try {
      // Une relance peut ne contenir que des fichiers déjà classés localement.
      // Elle doit atteindre la passe IA sans réécrire un index inchangé.
      indexCourant = nonClasses.length > 0
        ? await modifierPlusieursObjets(utilisateur.id, cle, instantanes, index)
        : index;
      if (nonClasses.length > 0) setIndex(indexCourant);
    } catch (err) {
      setTriAutoBilan({ erreursTechniques: [err instanceof Error ? err.message : String(err)], abandonnes: [] });
      setTriAutoEnCours(false);
      return;
    }
    setTriAutoEnCours(false);
    setTriAutoProgres(null);
  }

  async function telecharger(nom: string) {
    if (!utilisateur || !cle) return;
    const info = index.objets[nom];
    if (!info) return;
    try {
      const blob = await recupererFichier(utilisateur.id, cle, nom, info);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = info.nom;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      alert(`Déchiffrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function supprimer(nom: string) {
    if (!utilisateur || !cle) return;
    const info = index.objets[nom];
    if (!info) return;
    if (!confirm(`Supprimer définitivement « ${info.nom} » ? Aucun retour en arrière possible.`)) return;
    try {
      const nouvelIndex = await supprimerFichier(utilisateur.id, cle, nom, index);
      setIndex(nouvelIndex);
      if (detailOuvert === nom) fermerDetail();
    } catch (err) {
      alert(`Suppression impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fiche détail : ouverte au clic sur un document, porte la correction du
  // classement (nom, catégorie, montant) — jamais l'échéance ni la lettre,
  // qui restent celles calculées au dépôt.
  //
  // L'ouverture pousse une entrée d'historique : sans elle, le bouton retour
  // du téléphone n'a rien à consommer dans l'app et saute directement à la
  // page précédente (souvent le mail d'où vient le lien), donnant
  // l'impression que la fiche fait quitter le site entier au lieu de se
  // refermer. Voir le popstate ci-dessous et fermerDetail, qui consomme
  // cette même entrée à la fermeture.
  function ouvrirDetail(nom: string) {
    const info = index.objets[nom];
    if (!info) return;
    setCorrection({ nom: info.nom, categorie: info.categorie, montant: info.montant || '' });
    setDetailOuvert(nom);
    window.history.pushState({ ficheDetail: nom }, '');
  }

  function fermerDetail() {
    const etatHistorique = window.history.state as { ficheDetail?: string } | null;
    if (etatHistorique?.ficheDetail) {
      // Consomme l'entrée poussée par ouvrirDetail plutôt que d'en laisser
      // une orpheline en avant — le popstate qui suit referme la fiche.
      window.history.back();
    } else {
      setDetailOuvert(null);
      setCorrection(null);
    }
  }

  // Point d'entrée unique vers l'assistant, depuis la barre de recherche :
  // avec une question, elle vient d'une recherche locale restée sans
  // résultat (ou sans rapport avec un document précis) et part directement
  // en premier message ; vide, le chat s'ouvre à blanc comme avant. Vide la
  // recherche locale pour ne pas laisser un texte de recherche périmé une
  // fois le chat refermé.
  function demanderAAssistant(question: string) {
    setQuestionAssistant(question);
    setAssistantOuvert(true);
    setRecherche('');
  }

  function fermerAssistant() {
    setAssistantOuvert(false);
    setQuestionAssistant('');
  }

  // Exécute une action que l'assistant a proposée (classer, supprimer) —
  // jamais depuis le serveur, qui n'a ni la clé de chiffrement ni le
  // fichier : le nom affiché envoyé à l'assistant se résout d'abord vers sa
  // ou ses clés de stockage réelles (voir clesParNomAffiche), puis l'action
  // passe par les mêmes fonctions qu'un geste manuel. Rend un message court,
  // affiché à la place du bouton une fois fait.
  async function executerActionAssistant(action: ActionAssistant): Promise<string> {
    if (!utilisateur || !cle) return 'Coffre verrouillé — réessaie une fois déverrouillé.';
    const cles = clesParNomAffiche(index, action.nom);
    if (cles.length === 0) return `« ${action.nom} » n'existe plus.`;
    if (cles.length > 1) return `Plusieurs papiers portent ce nom. Je n’ai rien modifié : ouvre la fiche voulue et range-la toi-même pour éviter toute ambiguïté.`;
    if (action.type === 'supprimer') {
      const cleStockage = cles[0] as string;
      try {
        const nouvelIndex = await supprimerFichier(utilisateur.id, cle, cleStockage, index);
        setIndex(nouvelIndex);
        if (detailOuvert === cleStockage) fermerDetail();
        return `« ${action.nom} » supprimé.`;
      } catch (err) {
        return `Suppression impossible : ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    try {
      const indexCourant = await modifierObjet(utilisateur.id, cle, cles[0] as string, { categorie: action.categorie }, index);
      setIndex(indexCourant);
      return `« ${action.nom} » classé dans « ${action.categorie} ».`;
    } catch (err) {
      return `Classement impossible : ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Télécharge le CERFA trouvé par l'assistant (voir formulaireCerfa),
  // en lit les champs (pdf-lib, dans ce navigateur) et propose des valeurs
  // tirées des papiers du coffre — puis ouvre l'écran de remplissage déjà
  // rempli. Rien n'est jamais généré ni téléchargé ici : l'utilisateur voit
  // et corrige chaque champ dans RemplirFormulaire avant de produire le PDF,
  // exactement comme pour un formulaire déposé à la main.
  function documentsAutorisesPourIA(clesSelectionnees: string[]): DigestDocument[] {
    const objets = Object.fromEntries(clesSelectionnees
      .filter((cleDocument) => Boolean(index.objets[cleDocument]))
      .map((cleDocument) => [cleDocument, index.objets[cleDocument]!]));
    return digestIndex({ objets });
  }

  async function proposerValeursFormulaire(champs: string[], clesSelectionnees: string[]): Promise<Record<string, string>> {
    if (clesSelectionnees.length === 0) throw new Error('Choisis au moins un document à transmettre à Gemini.');
    return suggererChampsFormulaire(champs, documentsAutorisesPourIA(clesSelectionnees));
  }

  async function preparerFormulaireCerfa(demarche: string, url: string, clesSelectionnees: string[] = []): Promise<void> {
    const bytes = await recupererFormulaireCerfa(url);
    const champs = await champsFormulaire(bytes);
    if (champs.length === 0) {
      throw new Error("Ce formulaire n'a pas de champs détectables — dépose-le à la main pour le remplir.");
    }
    const documents = documentsAutorisesPourIA(clesSelectionnees);
    const suggestionsDocument = documents.length
      ? await suggererChampsFormulaire(champs.map((c) => c.nom), documents, demarche)
      : {};
    setFormulairePrerempli({
      nomFichier: `${demarche}.pdf`, demarche, bytes, suggestionsDocument,
      sourcesTransmises: clesSelectionnees.map((cleDocument) => index.objets[cleDocument]?.nom).filter((nom): nom is string => Boolean(nom)),
    });
    setFormulaireOuvert(true);
    fermerAssistant();
  }

  async function enregistrerCorrection() {
    if (!utilisateur || !cle || !detailOuvert || !correction) return;
    setEnCours(true);
    setErreur('');
    try {
      const nouvelIndex = await modifierObjet(utilisateur.id, cle, detailOuvert, {
        nom: correction.nom.trim() || index.objets[detailOuvert]?.nom,
        categorie: correction.categorie.trim(),
        montant: correction.montant.trim() || null,
      }, index);
      setIndex(nouvelIndex);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  // « Ce n'est pas une échéance » (faux positif) ou « c'est réglé » — retire
  // seulement la date et la lettre associées, jamais le document lui-même.
  // Avant cette fonction, la seule façon de faire taire une échéance mal
  // détectée était de supprimer tout le papier avec.
  async function ecarter(nom: string) {
    if (!utilisateur || !cle) return;
    setEnCours(true);
    setErreur('');
    try {
      const nouvelIndex = await ecarterEcheance(utilisateur.id, cle, nom, index);
      setIndex(nouvelIndex);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  async function surAjoutRendezVous(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur || !cle) return;
    const forme = new FormData(e.target as HTMLFormElement);
    const libelle = String(forme.get('libelle') || '').trim();
    const date = String(forme.get('date') || '');
    const heure = String(forme.get('heure') || '').trim();
    if (!libelle || !date) return;
    setEnCours(true);
    setErreur('');
    try {
      const nouvelIndex = await ajouterRendezVous(utilisateur.id, cle, libelle, date, index, heure || null);
      setIndex(nouvelIndex);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  // Fabrique le .ics à la volée et le fait ouvrir par le téléphone, comme
  // telecharger() pour un document — genererICS ne touche jamais le réseau.
  function ajouterAuCalendrier(libelle: string, date: string, heure?: string) {
    const contenu = genererICS(libelle, date, heure);
    const blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'rendez-vous.ics';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function retirerRendezVous(id: string) {
    if (!utilisateur || !cle) return;
    const rdv = index.rendezVous?.[id];
    if (!rdv) return;
    if (!confirm(`Retirer le rendez-vous « ${rdv.libelle} » ?`)) return;
    try {
      const nouvelIndex = await supprimerRendezVous(utilisateur.id, cle, id, index);
      setIndex(nouvelIndex);
    } catch (err) {
      alert(`Suppression impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function surEnregistrementIdentite(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur || !cle) return;
    const forme = new FormData(e.target as HTMLFormElement);
    const identite: Identite = {
      nom: String(forme.get('nom') || '').trim(),
      adresse: String(forme.get('adresse') || '').trim(),
      codePostal: String(forme.get('codePostal') || '').trim(),
      ville: String(forme.get('ville') || '').trim(),
    };
    if (!identite.nom || !identite.adresse) return;
    setEnCours(true);
    setErreur('');
    setIdentiteEnregistree(false);
    try {
      const nouvelIndex = await enregistrerIdentite(utilisateur.id, cle, identite, index);
      setIndex(nouvelIndex);
      setIdentiteEnregistree(true);
      setTimeout(() => setIdentiteEnregistree(false), 3000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  // Une carte de document, partagée entre la vue liste et la vue dossiers —
  // seul le conteneur autour change entre les deux.
  function carteDocument(nom: string) {
    const info = index.objets[nom];
    if (!info) return null;
    const { icone: Icone, classe } = styleCategorie(info.categorie);
    const jours = info.echeance?.presente && info.echeance.date
      ? joursRestants(info.echeance.date) : null;
    return (
      <li key={nom}>
        <button
          type="button"
          onClick={() => ouvrirDetail(nom)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-raised p-4 text-left transition hover:border-accent/60"
        >
          <div className={`shrink-0 rounded-2xl p-3 ${classe}`}><Icone size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{info.nom}</p>
            <p className="text-sm leading-snug text-ink-soft">
              {info.emetteur || info.categorie || 'Document'}
              {info.montant ? ` · ${info.montant}` : ''}
            </p>
            {jours !== null && (
              <div className="mt-2 max-w-40">
                <JaugeEcheance jours={jours} />
              </div>
            )}
          </div>
          {jours !== null && (
            <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <BadgeStatut jours={jours} />
              <span className={`text-xs font-semibold ${CLASSE_STATUT_TEXTE[statutEcheance(jours)]}`}>
                {LIBELLE_STATUT[statutEcheance(jours)]}
              </span>
            </span>
          )}
          {jours !== null && <span className="sm:hidden"><BadgeStatut jours={jours} /></span>}
          <ChevronRight size={18} className="shrink-0 text-ink-soft" />
        </button>
      </li>
    );
  }

  if (etape === 'chargement') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-ink-soft">
        Chargement…
      </main>
    );
  }

  if (etape === 'configurer-acces') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Mon Tiroir Secret</p>
          <h1 className="mt-2 font-affiche text-4xl texte-degrade">Crée ton accès direct</h1>
          <p className="mt-3 text-ink-soft">La prochaine fois, tu entreras directement avec ce mot de passe.</p>
        </div>
        <div className="rounded-xl border border-violet/40 bg-violet/10 p-4 text-sm text-ink-soft">
          Ce mot de passe ouvre ton compte. Ta phrase secrète reste séparée : elle seule chiffre tes documents.
        </div>
        <form onSubmit={configurerAcces} className="flex flex-col gap-3">
          <label className="text-sm text-ink-soft" htmlFor="mot-de-passe-compte">Mot de passe d’accès</label>
          <Champ id="mot-de-passe-compte" name="mot-de-passe-compte" type="password" autoComplete="new-password" />
          <label className="text-sm text-ink-soft" htmlFor="confirmation-mot-de-passe-compte">Retape-le</label>
          <Champ id="confirmation-mot-de-passe-compte" name="confirmation-mot-de-passe-compte" type="password" autoComplete="new-password" />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-bleu px-4 py-3 font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
            {enCours ? 'Enregistrement…' : 'Activer mon accès direct'}
          </button>
        </form>
      </main>
    );
  }

  if (etape === 'creer') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Mon Tiroir Secret</p>
          <h1 className="mt-2 font-affiche text-4xl texte-degrade">Choisis ta phrase secrète</h1>
          <p className="mt-3 text-ink-soft">
            Elle chiffre chaque document déposé, entièrement dans ce navigateur. Nous ne la
            recevons jamais.
          </p>
        </div>
        <div className="rounded-xl border border-wine/40 bg-wine/10 p-4 text-sm">
          ⚠️ Il n&apos;existe aucun moyen de la récupérer si tu l&apos;oublies. Personne — pas même
          nous — ne peut la retrouver ni contourner le chiffrement.
        </div>
        <form onSubmit={creerCoffre} className="flex flex-col gap-3">
          <label className="text-sm text-ink-soft" htmlFor="mdp1">Phrase secrète</label>
          <Champ id="mdp1" name="mdp1" type="password" autoComplete="new-password" />
          <label className="text-sm text-ink-soft" htmlFor="mdp2">Retape-la</label>
          <Champ id="mdp2" name="mdp2" type="password" autoComplete="new-password" />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-bleu px-4 py-3 font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
            {enCours ? 'Création…' : 'Créer le coffre'}
          </button>
        </form>
      </main>
    );
  }

  if (etape === 'deverrouiller') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Mon Tiroir Secret</p>
          <h1 className="mt-2 font-affiche text-4xl texte-degrade">Entre ta phrase secrète</h1>
        </div>
        <form onSubmit={deverrouiller} className="flex flex-col gap-3">
          <Champ name="mdp" type="password" autoComplete="current-password" autoFocus />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-bleu px-4 py-3 font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
            {enCours ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
        <button onClick={seDeconnecter} className="text-sm text-ink-soft underline">Se déconnecter</button>
      </main>
    );
  }

  const tousLesNoms = Object.keys(index.objets);
  // Catégories déjà utilisées — sert aux chips de filtre : inutile de
  // proposer un filtre pour une catégorie qui ne contient aucun papier.
  const categoriesConnues = Array.from(
    new Set(tousLesNoms.map((n) => index.objets[n]?.categorie).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b, 'fr'));
  // Les dix catégories prévues, plus celles déjà tapées à la main (aValider
  // comme fiche détail) — jamais une liste fermée : la <datalist> ci-dessous
  // suggère les dix, mais un nom personnalisé passe toujours, et revient en
  // suggestion la fois suivante.
  const categoriesSuggerees = Array.from(
    new Set([...Object.keys(STYLE_CATEGORIE), ...categoriesConnues]),
  ).sort((a, b) => a.localeCompare(b, 'fr'));
  // interpreterQuestion comprend « mes photos », « un pdf », un mot isolé, ou
  // une phrase complète (« le papier de la mutuelle ») — rechercheCorrespond
  // reste utilisée telle quelle à l'intérieur, pour chaque mot-clé retenu.
  const { reponse: reponseRecherche, noms: nomsTrouves, action: actionRecherche } = interpreterQuestion(index, recherche);
  // Dérivé plutôt que synchronisé par effet : un filtre qui ne correspond
  // plus à aucun papier (tri automatique, correction, suppression — tout ce
  // qui a fait migrer les papiers d'une catégorie devenue vide) s'efface de
  // lui-même au rendu suivant, sans laisser un « 0 sur N » sur un choix que
  // l'utilisateur n'a pas refait lui-même.
  const filtreCategorieEffectif = filtreCategorie && categoriesConnues.includes(filtreCategorie) ? filtreCategorie : null;
  const noms = tousLesNoms
    .filter((n) => !filtreCategorieEffectif || index.objets[n]?.categorie === filtreCategorieEffectif)
    .filter((n) => nomsTrouves.includes(n));
  // Un dossier par catégorie déjà utilisée sur ces papiers, « À trier »
  // toujours en dernier — jamais une liste fermée, juste ce qui existe dans
  // les papiers affichés (mêmes filtres que la vue liste).
  const dossiers = (() => {
    const groupes: Record<string, string[]> = {};
    for (const nom of noms) {
      const categorie = index.objets[nom]?.categorie?.trim() || DOSSIER_SANS_CATEGORIE;
      (groupes[categorie] ??= []).push(nom);
    }
    return Object.entries(groupes).sort(([a], [b]) => {
      if (a === DOSSIER_SANS_CATEGORIE) return 1;
      if (b === DOSSIER_SANS_CATEGORIE) return -1;
      return a.localeCompare(b, 'fr');
    });
  })();
  const rendezVousTries = Object.values(index.rendezVous || {})
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const alerte = prochaineAlerte(index);
  const prenom = (index.identite?.nom || utilisateur?.email || '').trim().split(/\s+/)[0];
  const papiersAvecEcheance = tousLesNoms.filter((n) => index.objets[n]?.echeance?.presente).length;
  const aCompleter = tousLesNoms.filter((n) => {
    const objet = index.objets[n];
    if (!objet) return false;
    return !objet.categorie?.trim() || (objet.echeance?.presente && !objet.echeance.date);
  }).length;

  return (
    <main
      className={`coffre-page min-h-screen bg-paper pb-32 transition ${survole ? 'bg-accent/5 ring-2 ring-accent ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setSurvole(true); }}
      onDragLeave={() => setSurvole(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvole(false);
        // Glisser un dossier entier passe par ici (fichiers imbriqués
        // aplatis) ; un simple glisser de fichiers marche aussi, inchangé.
        fichiersDuGlisserDeposer(e.dataTransfer).then(surDepot);
      }}
    >
      <input
        ref={entreeFichier}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const fichiers = Array.from(e.target.files || []);
          e.target.value = '';
          if (fichiers.length) void surDepot(fichiers);
        }}
      />
      {/* Sur mobile, capture=environment demande l'appareil photo arrière.
          La photo rejoint le même aperçu et la même validation que tout dépôt. */}
      <input
        ref={entreePhoto}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const fichiers = Array.from(e.target.files || []);
          e.target.value = '';
          if (fichiers.length) void photographierEtRanger(fichiers);
        }}
      />
      <input
        ref={entreeDossier}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          const fichiers = Array.from(e.target.files || []);
          e.target.value = '';
          if (fichiers.length) void surDepot(fichiers, true);
        }}
      />
      {/* Suggestions d'étiquettes déjà utilisées — jamais une liste imposée,
          juste ce que l'utilisateur a lui-même déjà tapé. */}
      <datalist id="categories-connues">
        {categoriesSuggerees.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="coffre-shell mx-auto flex max-w-[1700px] flex-col gap-8 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        {/* Marque persistante — visible sur le tableau de bord, pas
            seulement sur l'écran de connexion. Violet plutôt que turquoise :
            les deux sont censés dominer à parts égales, et le turquoise
            porte déjà l'eyebrow « Bonjour » juste en dessous. */}
        <div className="coffre-topbar">
          <p className="coffre-wordmark"><span>Mon</span> Tiroir Secret</p>
          <p className="coffre-private"><ShieldCheck size={14} /> Chiffré avant stockage</p>
        </div>
        {/* En-tête */}
        <header className="coffre-hero coffre-hero--scene studio-overview rounded-3xl border border-line bg-paper-raised p-6 sm:p-8">
          <div className="coffre-vault" aria-hidden="true"><span className="coffre-vault__bar" /><span className="coffre-vault__dial" /></div>
          <div className="coffre-hero__content">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">
              Bonjour {prenom || 'toi'}
            </p>
            <h1 className="mt-2 font-affiche text-3xl sm:text-4xl texte-degrade">Tes papiers rangés.<br />Ta tête plus légère.</h1>
            <p className="mt-3 max-w-md text-ink-soft">
              Photographier, classer, retrouver, préparer : ton espace privé s&apos;occupe du désordre et te laisse les décisions.
            </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-vert">
              <ShieldCheck size={16} /> Tes papiers restent privés tant que tu ne choisis pas de les partager avec Gemini.
            </p>
          </div>
          <div className="coffre-hero__scene">
            <CoffreMer
              compact
              animationActive={animationActive}
              onBasculerAnimation={() => setAnimationActive((active) => !active)}
            />
          </div>
          <div className="coffre-hero__actions">
            <button onClick={seDeconnecter}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-paper-raised/70 px-3 py-2 text-sm text-ink-soft transition hover:border-wine/60 hover:text-wine">
              <LogOut size={16} /> Se déconnecter
            </button>
            <dl className="coffre-reperes">
              <div className="coffre-repere"><dt>Documents</dt><dd>{tousLesNoms.length} rangés</dd></div>
              <div className="coffre-repere"><dt>Prochain repère</dt><dd>{rendezVousTries[0] ? rendezVousTries[0].date : 'Aucun rendez-vous'}</dd></div>
            </dl>
          </div>
        </header>

        {/* Barre « pose ta question » — hors de la grille et juste sous
            l'en-tête (10/09/2026), plus haut de page mais plus respirée :
            avant, elle vivait tout en bas de la colonne de gauche, dans la
            même condition que la liste de papiers (`tousLesNoms.length > 0`)
            — donc absente du DOM pour un coffre encore vide, exactement le
            moment où avoir un point d'entrée pour demander de l'aide compte
            le plus. Elle est désormais toujours affichée, centrée dans son
            propre bloc plutôt que collée au bord supérieur de l'écran. */}
        <div id="assistant-du-tiroir" className="coffre-question rounded-3xl border border-line bg-paper-raised p-6 sm:p-7">
          <div className="coffre-question__heading">
            <div>
              <p className="coffre-kicker"><Bot size={15} /> Copilote LLM</p>
              <p className="coffre-question__title font-affiche text-xl texte-degrade sm:text-2xl">
                Un vrai copilote Gemini, pour tout ce que tu as en tête.
              </p>
            </div>
            <span className="coffre-question__badge">Comprend · raisonne · agit</span>
          </div>
          <p className="coffre-question__lead">
            Rédige, résume, compare, comprends une démarche, prépare un courrier ou explore une question récente. Ajoute seulement les documents que tu veux lui faire lire.
          </p>
          {/* Un seul champ est monté à la fois. La saisie initiale disparaît
              dès que la conversation s'ouvre ; le champ du fil devient alors
              l'unique point de saisie, jusqu'à la fermeture du fil. */}
          {!assistantOuvert && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (recherche.trim()) demanderAAssistant(recherche.trim());
                }}
                className="relative"
              >
                {/* Bulle de discussion plutôt qu'une loupe (10/09/2026) : cette
                    barre interroge un assistant en langage naturel, elle ne
                    filtre pas une liste par mots-clés — la loupe suggérait le
                    mauvais geste. */}
                <MessageCircle size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Ex. « Retrouve ma dernière facture EDF et dis-moi quand elle arrive à échéance »"
                  className="w-full rounded-2xl border border-line bg-paper py-3.5 pr-4 pl-12 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </form>
              <div className="coffre-prompts" aria-label="Exemples de demandes">
                {[
                  'Retrouve ma dernière facture',
                  'Aide-moi pour une démarche',
                  'Range mes papiers',
                ].map((invite) => (
                  <button key={invite} type="button" onClick={() => demanderAAssistant(invite)}>{invite}</button>
                ))}
              </div>
              <button type="button" className="coffre-question__open" onClick={() => setAssistantOuvert(true)}>
                Ouvrir le copilote et choisir des documents
              </button>
              <p className="coffre-question__privacy">
                <ShieldCheck size={14} /> Ta phrase secrète ne quitte jamais ton appareil. Aucun document n&apos;est partagé sans sélection explicite.
              </p>
              {recherche.trim() && (
                <div className="mx-auto mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2">
                  <p className="text-sm text-accent">{reponseRecherche}</p>
                  {actionRecherche === 'rangement' && (
                    <button
                      type="button"
                      onClick={() => { setRecherche(''); setVueDossiers(true); }}
                      className="flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <Folder size={12} /> Ranger en dossiers
                    </button>
                  )}
                  {actionRecherche === 'formulaire' && (
                    <button
                      type="button"
                      onClick={() => { setRecherche(''); setFormulaireOuvert(true); }}
                      className="flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <FileText size={12} /> Remplir un formulaire
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {assistantOuvert && (
            <div className="mx-auto mt-5 max-w-4xl">
              <AssistantCoffre
                index={index}
                questionInitiale={questionAssistant}
                onFermer={fermerAssistant}
                // `documentsCites` porte le nom AFFICHÉ (voir digestIndex
                // côté serveur), jamais la clé opaque qu'attend
                // ouvrirDetail — sans cette résolution, cliquer un document
                // cité n'ouvrait rien.
                onOuvrirDocument={(nomAffiche) => {
                  const cleStockage = clesParNomAffiche(index, nomAffiche)[0];
                  if (cleStockage) ouvrirDetail(cleStockage);
                }}
                onOuvrirFormulaire={() => setFormulaireOuvert(true)}
                onOuvrirRangement={() => setVueDossiers(true)}
                onOuvrirImportDossier={() => entreeDossier.current?.click()}
                onExecuterAction={executerActionAssistant}
                onPreparerFormulaireCerfa={preparerFormulaireCerfa}
                triAuto={{
                  enCours: triAutoEnCours,
                  progres: triAutoProgres,
                  bilan: triAutoBilan,
                  detailOuvert: triAutoDetailOuvert,
                }}
                onLancerTriAutomatique={trierAutomatiquement}
                onBasculerDetailTriAutomatique={() => setTriAutoDetailOuvert((v) => !v)}
                documentsDisponibles={Object.entries(index.objets).map(([cle, document]) => ({ cle, nom: document.nom, type: document.type }))}
                lireDocument={async (document) => {
                  if (!utilisateur || !cle) throw new Error('Déverrouille ton tiroir avant de joindre un papier.');
                  const info = index.objets[document.cle];
                  if (!info) throw new Error('Ce papier n’est plus disponible dans le tiroir.');
                  const contenu = await recupererFichier(utilisateur.id, cle, document.cle, info);
                  return new globalThis.File([contenu], info.nom, { type: info.type });
                }}
              />
            </div>
          )}
        </div>

        <section className="coffre-command" aria-labelledby="titre-actions-rapides">
          <div className="coffre-command__intro">
            <p className="coffre-kicker"><Sparkles size={15} /> Ajouter à ton espace</p>
            <h2 id="titre-actions-rapides">Une photo, un fichier, un lot.</h2>
            <p>
              La conversation Gemini est au centre. Choisis une photo ou un fichier seulement quand tu veux une analyse ; l&apos;import privé reste disponible.
            </p>
          </div>
          <div className="coffre-command__actions">
            <button type="button" onClick={() => entreePhoto.current?.click()} className="coffre-action coffre-action--primary">
              <span className="coffre-action__icon"><ScanLine size={24} /></span>
              <span className="coffre-action__copy">
                <strong>Photographier et ranger</strong>
                <small>Gemini lit la photo ; le tiroir la chiffre ensuite et la classe.</small>
              </span>
              <ArrowUpRight size={19} className="coffre-action__arrow" />
            </button>
            <button type="button" onClick={() => entreeFichier.current?.click()} className="coffre-action">
              <span className="coffre-action__icon"><Upload size={23} /></span>
              <span className="coffre-action__copy">
                <strong>Importer des fichiers</strong>
                <small>PDF, photos et dossiers, avec validation avant dépôt.</small>
              </span>
              <ChevronRight size={19} className="coffre-action__arrow" />
            </button>
            <button type="button" onClick={() => entreeDossier.current?.click()} className="coffre-action">
              <span className="coffre-action__icon"><FolderUp size={23} /></span>
              <span className="coffre-action__copy">
                <strong>Analyser un dossier complet</strong>
                <small>Gemini lit les PDF, images et textes, puis crée les dossiers utiles.</small>
              </span>
              <ChevronRight size={19} className="coffre-action__arrow" />
            </button>
          </div>
            <p className="coffre-command__privacy">
            Gemini gratuit : Google peut utiliser les données transmises pour améliorer ses produits.
            Pour ne transmettre aucun document à une IA, choisis « Importer des fichiers ».
          </p>
          {etatImportIntelligent.etat !== 'repos' && (
            <div className={`coffre-capture-status coffre-capture-status--${etatImportIntelligent.etat}`} role="status" aria-live="polite">
              <span className="coffre-capture-status__icon">
                {etatImportIntelligent.etat === 'analyse'
                  ? <LoaderCircle size={20} className="animate-spin" />
                  : etatImportIntelligent.etat === 'pret' ? <CheckCircle2 size={20} /> : <FolderUp size={20} />}
              </span>
              <p>{etatImportIntelligent.message}</p>
              {etatImportIntelligent.total > 0 && (
                <span className="text-xs text-ink-soft">{etatImportIntelligent.fait}/{etatImportIntelligent.total}</span>
              )}
              {(etatImportIntelligent.etat === 'pret' || etatImportIntelligent.etat === 'erreur') && (
                <button type="button" className="coffre-capture-status__close" onClick={() => setEtatImportIntelligent({ etat: 'repos', fait: 0, total: 0, message: '' })} aria-label="Fermer">
                  <X size={17} />
                </button>
              )}
            </div>
          )}
          {etatCapture.etat !== 'repos' && (
            <div className={`coffre-capture-status coffre-capture-status--${etatCapture.etat}`} role="status" aria-live="polite">
              <span className="coffre-capture-status__icon">
                {etatCapture.etat === 'analyse' || etatCapture.etat === 'chiffrement'
                  ? <LoaderCircle size={20} className="animate-spin" />
                  : etatCapture.etat === 'range' ? <CheckCircle2 size={20} /> : <Camera size={20} />}
              </span>
              <p>{etatCapture.message}</p>
              {etatCapture.etat === 'range' && etatCapture.cleDocument && (
                <button type="button" onClick={() => ouvrirDetail(etatCapture.cleDocument!)}>Voir le document</button>
              )}
              {(etatCapture.etat === 'range' || etatCapture.etat === 'erreur') && (
                <button type="button" className="coffre-capture-status__close" onClick={() => setEtatCapture({ etat: 'repos', message: '' })} aria-label="Fermer">
                  <X size={17} />
                </button>
              )}
            </div>
          )}
        </section>

        <section className="coffre-vitals grid gap-3 sm:grid-cols-3" aria-label="Vue d'attention du tiroir secret">
          <div className="coffre-vital rounded-2xl border border-line bg-paper-raised p-5">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-accent uppercase">
              <ShieldCheck size={15} /> Privé d&apos;abord
            </p>
            <p className="mt-2 font-affiche text-2xl">{tousLesNoms.length}</p>
            <p className="mt-1 text-sm text-ink-soft">
              papier{tousLesNoms.length > 1 ? 's' : ''} gardé{tousLesNoms.length > 1 ? 's' : ''} dans le tiroir.
            </p>
          </div>
          <div className="coffre-vital rounded-2xl border border-line bg-paper-raised p-5">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-violet uppercase">
              <Bell size={15} /> À surveiller
            </p>
            <p className="mt-2 font-affiche text-2xl">{papiersAvecEcheance + rendezVousTries.length}</p>
            <p className="mt-1 text-sm text-ink-soft">
              échéance{papiersAvecEcheance + rendezVousTries.length > 1 ? 's' : ''} ou rendez-vous à garder en tête.
            </p>
          </div>
          <div className="coffre-vital rounded-2xl border border-line bg-paper-raised p-5">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-widest text-vert uppercase">
              <Folder size={15} /> À clarifier
            </p>
            <p className="mt-2 font-affiche text-2xl">{aCompleter}</p>
            <p className="mt-1 text-sm text-ink-soft">
              repère{aCompleter > 1 ? 's' : ''} à nommer ou ranger à la main.
            </p>
          </div>
        </section>

        {/* Accès direct à rendez-vous / identité / formulaire, en un tap
            depuis le haut de l'écran — sans ça, un coffre chargé (89 papiers
            vus en usage réel) oblige à faire défiler tout le fil des
            documents pour atteindre ce qui vit en dessous, sur téléphone où
            tout s'empile en une seule colonne. Masqué à partir de `lg` : la
            grille à trois colonnes y montre déjà tout côte à côte, sans
            défilement à raccourcir. */}
        {tousLesNoms.length > 0 && (
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:hidden">
            <a href="#rendez-vous" className="text-ink-soft underline decoration-dotted transition hover:text-ink">
              Aller aux rendez-vous
            </a>
            <a href="#mon-identite" className="text-ink-soft underline decoration-dotted transition hover:text-ink">
              Aller à mon identité
            </a>
            <a href="#remplir-formulaire" className="text-ink-soft underline decoration-dotted transition hover:text-ink">
              Aller au formulaire
            </a>
          </nav>
        )}

        {/* Bannière d'alerte — cliquable seulement quand elle porte sur un
            document (jamais un rendez-vous, qui n'a pas de fiche) : ouvre
            directement la fiche détail concernée. */}
        {alerte && (
          <button
            type="button"
            onClick={alerte.nom ? () => ouvrirDetail(alerte.nom as string) : undefined}
            disabled={!alerte.nom}
            className={`flex w-full items-start gap-4 rounded-2xl border border-line bg-paper-raised p-5 text-left transition ${
              alerte.nom ? 'cursor-pointer hover:border-accent/60' : 'cursor-default'
            }`}
          >
            <div className="rounded-xl bg-accent/15 p-2.5 text-accent"><Bell size={20} /></div>
            <div>
              <p className="text-sm tracking-widest text-ink-soft uppercase">On te prévient à l&apos;avance</p>
              <p className="mt-1">
                <span className="font-semibold text-accent">{alerte.libelle}</span>
                {' '}— {formatJours(alerte.jours)} ({alerte.date})
              </p>
            </div>
          </button>
        )}

        {erreur && (
          <p className="rounded-lg border border-wine/40 bg-wine/10 px-4 py-3 text-sm text-wine">{erreur}</p>
        )}

        {/* File d'attente de validation */}
        {aValider.length > 0 && (
          <>
            {aValider.length > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {aValider.length} papiers en attente
                  {aValider.some((p) => p.enAnalyse) && ' — lecture en cours…'}
                </p>
                <button
                  type="button"
                  onClick={confirmerTout}
                  disabled={enCours || aValider.every((p) => p.enAnalyse)}
                  className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60"
                >
                  Déposer tout ({aValider.filter((p) => !p.enAnalyse).length})
                </button>
              </div>
            )}
          <ul className="flex flex-col gap-3">
            {aValider.map((item) => (
              <li key={item.cle} className="rounded-2xl border border-accent/40 bg-paper-raised p-5">
                {item.enAnalyse ? (
                  <p className="text-sm text-ink-soft">Lecture de « {item.fichier.name} »…</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                        <div className="flex-1">
                          <label className="text-sm text-ink-soft" htmlFor={`nom-${item.cle}`}>Nom</label>
                          <Champ id={`nom-${item.cle}`} value={item.nomAffiche}
                            onChange={(e) => modifierAttente(item.cle, { nomAffiche: e.target.value })} />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-ink-soft" htmlFor={`cat-${item.cle}`}>Catégorie</label>
                          <Champ id={`cat-${item.cle}`} value={item.categorie} list="categories-connues"
                            placeholder="Non proposée — à préciser ou laisser vide"
                            onChange={(e) => modifierAttente(item.cle, { categorie: e.target.value })} />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-ink-soft" htmlFor={`montant-${item.cle}`}>Montant</label>
                          <Champ id={`montant-${item.cle}`} value={item.montant}
                            placeholder="Non lu — à préciser ou laisser vide"
                            onChange={(e) => modifierAttente(item.cle, { montant: e.target.value })} />
                        </div>
                      </div>
                      <button onClick={() => retirerAttente(item.cle)}
                        className="rounded-lg p-1.5 text-ink-soft transition hover:bg-wine/10 hover:text-wine" aria-label="Annuler">
                        <X size={18} />
                      </button>
                    </div>
                    {item.echeance.presente && (
                      <div className="flex items-start gap-3 rounded-lg border border-bleu/40 bg-bleu/10 p-3 text-sm">
                        <Bell size={16} className="mt-0.5 shrink-0 text-bleu" />
                        <div>
                          <p className="font-medium">Échéance détectée : {item.echeance.libelle}</p>
                          <p className="text-ink-soft">
                            {item.echeance.date} — confiance {item.echeance.confiance}. À vérifier avant de valider.
                          </p>
                        </div>
                      </div>
                    )}
                    {item.echeance.presente && CATEGORIES_RESILIABLES.includes(item.categorie) && (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex-1">
                          <label className="text-sm text-ink-soft" htmlFor={`emetteur-${item.cle}`}>
                            Émetteur (pour la lettre de résiliation)
                          </label>
                          <Champ id={`emetteur-${item.cle}`} value={item.emetteur}
                            placeholder="Non lu — à préciser pour obtenir une lettre"
                            onChange={(e) => modifierAttente(item.cle, { emetteur: e.target.value })} />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-ink-soft" htmlFor={`ref-${item.cle}`}>Référence client (si connue)</label>
                          <Champ id={`ref-${item.cle}`} value={item.referenceClient}
                            onChange={(e) => modifierAttente(item.cle, { referenceClient: e.target.value })} />
                        </div>
                      </div>
                    )}
                    {item.emetteur && index.identite && item.echeance.date && (
                      <LettrePreview
                        identite={index.identite} emetteur={item.emetteur}
                        referenceClient={item.referenceClient || null} date={item.echeance.date}
                      />
                    )}
                    {item.emetteur && !index.identite && (
                      <p className="text-sm text-wine">
                        Renseigne ton identité plus bas pour obtenir une lettre de résiliation prête à signer.
                      </p>
                    )}
                    <div>
                      <button onClick={() => confirmerDepot(item)} disabled={enCours}
                        className="rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60">
                        Déposer
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
        <div className="studio-grid grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="studio-documents lg:col-span-2">
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
                    <div key={categorie} className="studio-folder rounded-2xl border border-line bg-paper-raised p-4">
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

          <div className="studio-side flex flex-col gap-8">
            {/* Carte en verre demandée le 10/09/2026 : ces trois sections
                n'avaient jamais reçu la même carte que le reste de la page
                (en-tête, barre de recherche, fiches document) — sans
                `border-line bg-paper-raised`, elles ne portent aucun fond,
                donc pas la règle CSS partagée qui pose le dégradé
                turquoise-violet. Seul le turquoise des boutons et des bords
                de champ y ressortait, perçu comme « tout en vert » face au
                duo turquoise-violet visible ailleurs. */}
            <section id="rendez-vous" className="studio-module scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
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

            <section id="mon-identite" className="studio-module scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
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

            <section id="remplir-formulaire" className="studio-module scroll-mt-6 rounded-2xl border border-line bg-paper-raised p-6">
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
          documentsDisponibles={Object.entries(index.objets).map(([cleDocument, document]) => ({ cle: cleDocument, nom: document.nom }))}
          onSuggérerValeurs={proposerValeursFormulaire}
        />
      )}

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
