Warning: truncated output (original token count: 25777)
Total output lines: 2053

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  ArrowUpRight, Bell, Bot, Briefcase, Camera, Car, CheckCircle2, ChevronRight, File, FileText, Folder,
  FolderUp, Heart, Home, Landmark, LoaderCircle, LogOut, ScanLine, Shield, ShieldCheck,
  Sparkles, Upload, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { estApercuVercelDuCoffre } from '@/lib/demo';
import {
  analyserDocumentPourClassement, coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  enregistrerIdentite, composerLettreResiliation, modifierObjet, modifierPlusieursObjets, ecarterEcheance, statutEcheance,
  genererICS, SEUIL_BIENTOT_JOURS, clesParNomAffiche,
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
  const modeDemo = utilisateur?.id === 'demo-local';
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
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
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
    const modeDemoAutorise = process.env.NODE_ENV !== 'production' || estApercuVercelDuCoffre(window.location.hostname);
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
          montant: propos…9777 tokens truncated…coffre-capture-status coffre-capture-status--${etatImportIntelligent.etat}`} role="status" aria-live="polite">
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
            {!vueDossiers && categoriesConnues.length > 0 && (
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
                {filtreCategorieEffectif
                  ? `Aucun papier dans « ${filtreCategorieEffectif} ».`
                  : 'Aucun papier correspondant pour le moment.'}
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
            className="coffre-detail fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6"
            onClick={fermerDetail}
          >
            <div
              className="coffre-detail__panel max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-paper-raised p-6 sm:max-w-lg sm:rounded-3xl"
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

                {utilisateur && cle && (modeDemo ? (
                  <div className="coffre-demo-document flex items-start gap-3 rounded-2xl border p-4" role="status">
                    <FileText size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Document d’exemple</p>
                      <p className="mt-1 text-sm">Ce document est fictif : aucun fichier n’est stocké dans la démo. Le rappel ci-dessous illustre une échéance et ne peut pas ouvrir de véritable aperçu.</p>
                    </div>
                  </div>
                ) : (
                  <FichePreview key={detailOuvert} nom={detailOuvert} info={info} userId={utilisateur.id} cle={cle} />
                ))}

                {jours !== null && info.echeance && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <BadgeStatut jours={jours} />
                        <span className="text-sm text-ink-soft">
                          {info.echeance.libelle} — {formatJours(jours)} ({info.echeance.date})
                        </span>
                      </span>
                      {!modeDemo && (
                        <button
                          type="button"
                          onClick={() => ecarter(detailOuvert)}
                          disabled={enCours}
                          className="text-xs text-ink-soft underline decoration-dotted transition hover:text-wine disabled:opacity-60"
                        >
                          Ce n&apos;est pas une échéance
                        </button>
                      )}
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

                {!modeDemo && (
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
                )}
                
                {!modeDemo && (
                  <div className="flex gap-4 text-sm">
                    <button onClick={() => telecharger(detailOuvert)} className="text-accent hover:underline">
                      Télécharger
                    </button>
                    <button onClick={() => supprimer(detailOuvert)} className="text-wine hover:underline">
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
