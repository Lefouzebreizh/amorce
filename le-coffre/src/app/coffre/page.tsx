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
  categorieInstantanee, recupererFormulaireCerfa, suggererChampsFormulaire,
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
  const aValiderRef = useRef<EnAttente[]>([]);
  useEffect(() => { aValiderRef.current = aValider; }, [aValider]);
  const [survole, setSurvole] = useState(false);
  const [identiteEnregistree, setIdentiteEnregistree] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulairePrerempli, setFormulairePrerempli] = useState<FormulairePreRempli | undefined>(undefined);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  const [questionAssistant, setQuestionAssistant] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [vueDossiers, setVueDossiers] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [triAutoEnCours, setTriAutoEnCours] = useState(false);
  const [triAutoProgres, setTriAutoProgres] = useState<{ fait: number; total: number } | null>(null);
  const [triAutoBilan, setTriAutoBilan] = useState<{ erreursTechniques: string[]; abandonnes: string[] } | null>(null);
  const [triAutoDetailOuvert, setTriAutoDetailOuvert] = useState(false);
  const [dossiersOuverts, setDossiersOuverts] = useState<Set<string>>(new Set());
  const [etatCapture, setEtatCapture] = useState<EtatCapture>({ etat: 'repos', message: '' });
  const [etatImportIntelligent, setEtatImportIntelligent] = useState<EtatImportIntelligent>({ etat: 'repos', fait: 0, total: 0, message: '' });
  const entreeFichier = useRef<HTMLInputElement>(null);
  const entreePhoto = useRef<HTMLInputElement>(null);
  const entreeDossier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previewDeBranche = /^mon-tiroir-secret-.+-erwannchevallier-6916s-projects\.vercel\.app$/.test(window.location.hostname);
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
      if (!data.session) { routeur.replace('/'); return; }
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
