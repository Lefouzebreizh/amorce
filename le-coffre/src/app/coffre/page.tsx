'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Bell, Briefcase, Car, ChevronRight, File, FileText, Folder, Heart, Home, Landmark, LogOut,
  MessageCircle, Plus, Search, Shield, ShieldCheck, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  enregistrerIdentite, composerLettreResiliation, modifierObjet, modifierPlusieursObjets, ecarterEcheance, statutEcheance,
  interpreterQuestion, genererICS, SEUIL_BIENTOT_JOURS, clesParNomAffiche,
  type IndexCoffre, type Echeance, type Identite, type StatutEcheance, type ObjetIndex, type ActionAssistant,
} from '@/lib/coffre';
import { RemplirFormulaire } from './RemplirFormulaire';
import { AssistantCoffre } from './AssistantCoffre';

type Etape = 'chargement' | 'creer' | 'deverrouiller' | 'ouvert';

const ECHEANCE_VIDE: Echeance = { presente: false, date: null, libelle: null, confiance: 'basse' };
const CATEGORIES_RESILIABLES = ['Assurance', 'Énergie', 'Téléphonie et internet'];
// Dossier de repli pour la vue « Ranger en dossiers » — un papier sans
// catégorie (proposition de classement non lisible, jamais corrigée) doit
// quand même atterrir quelque part plutôt que de disparaître de la vue.
const DOSSIER_SANS_CATEGORIE = 'À trier';
// Plafond d'un lot de tri automatique — voir `trierAutomatiquement` pour la
// raison. Repris ici pour que le bouton annonce le bon compte avant de
// démarrer.
const LOT_MAX_TRI_AUTO = 24;
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
  const [survole, setSurvole] = useState(false);
  const [identiteEnregistree, setIdentiteEnregistree] = useState(false);
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  // Posée par la barre de recherche du haut quand elle n'a rien trouvé
  // localement, ou vide pour une question ouverte — voir demanderAAssistant.
  const [questionAssistant, setQuestionAssistant] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [vueDossiers, setVueDossiers] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [triAutoEnCours, setTriAutoEnCours] = useState(false);
  const [triAutoProgres, setTriAutoProgres] = useState<{ fait: number; total: number } | null>(null);
  const [triAutoBilan, setTriAutoBilan] = useState<{ nonDocuments: string[]; erreursTechniques: string[] } | null>(null);
  const [triAutoDetailOuvert, setTriAutoDetailOuvert] = useState(false);
  // Clés de stockage déjà confirmées comme non-documents CETTE session — un
  // document rejeté ne gagne jamais de catégorie, donc rien ne le distingue
  // des autres dans `tout` d'un lot au suivant : sans cette mémoire, un lot
  // entièrement composé de photos/vidéos (observé en usage réel : 24 rejets
  // sur 24) refaisait exactement le même lot à l'infini, sans jamais
  // atteindre les documents suivants. Remise à zéro au rechargement de la
  // page seulement — un rejet reste un rejet tant que la session dure.
  const [triAutoIgnores, setTriAutoIgnores] = useState<Set<string>>(new Set());
  // Dossiers dépliés dans la vue « Ranger en dossiers » — vide par défaut,
  // donc tous repliés : voir le rendu de `dossiers.map` plus bas.
  const [dossiersOuverts, setDossiersOuverts] = useState<Set<string>>(new Set());
  const entreeFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        routeur.replace('/');
        return;
      }
      setUtilisateur(data.session.user);
      const existe = await coffreExiste(data.session.user.id);
      setEtape(existe ? 'deverrouiller' : 'creer');
    });
  }, [routeur]);

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

  // Un fichier choisi ne se dépose pas tout de suite : on propose d'abord une
  // catégorie, un nom et une échéance éventuelle (fonction classer-document,
  // qui lit le fichier une fraction de seconde côté serveur puis ne garde
  // rien — voir SECURITY.md), et rien ne bouge tant que l'utilisateur n'a
  // pas validé chaque proposition.
  async function surDepot(fichiers: File[]) {
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

    // En parallèle, pas un par un : dix fichiers analysés en série, à
    // deux ou trois secondes chacun, rendaient un dossier « interminable ».
    // Chaque `setAValider` porte sa propre clé et utilise la forme
    // fonctionnelle — les réponses qui reviennent dans le désordre ne
    // s'écrasent jamais entre elles.
    await Promise.all(nouveaux.map(async (item) => {
      const proposition = await proposerClassement(item.fichier);
      setAValider((precedent) => precedent.map((p) => (p.cle === item.cle ? {
        ...p, enAnalyse: false,
        categorie: proposition.lisible ? proposition.categorie : '',
        nomAffiche: proposition.lisible && proposition.nomSuggere ? proposition.nomSuggere : p.fichier.name,
        echeance: proposition.echeance,
        emetteur: proposition.emetteur || '',
        referenceClient: proposition.referenceClient || '',
        montant: proposition.montant || '',
        texteExtrait: proposition.texteExtrait || '',
      } : p)));
    }));
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
  async function confirmerTout() {
    if (!utilisateur || !cle) return;
    const prets = aValider.filter((p) => !p.enAnalyse);
    if (prets.length === 0) return;
    setEnCours(true);
    setErreur('');
    let indexCourant = index;
    const echecs: string[] = [];
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
      }
    }
    if (echecs.length > 0) setErreur(`Non déposés : ${echecs.join(', ')}.`);
    setEnCours(false);
  }

  // Bouton « Trier automatiquement » : reclasse les papiers sans catégorie
  // (bouton « À trier » depuis l'accueil), en repassant chacun par
  // classer-document — la même analyse que celle qui propose déjà une
  // catégorie au dépôt.
  //
  // Plafonné à LOT_MAX_TRI_AUTO par clic : sur un très gros lot (128 papiers
  // vus en usage réel), traiter tout d'un coup prenait plusieurs minutes et
  // multipliait les appels à un service externe sans retenue. Le bouton
  // réaffiche le compte restant après chaque lot — on le reclique pour
  // continuer, jamais tout en une fois.
  //
  // Le classement (lecture du fichier + appel à classer-document) est mené
  // en parallèle, borné par CONCURRENCE_TRI_AUTO : c'est l'appel réseau qui
  // domine le temps, et rien n'empêche de le mener sur plusieurs fichiers à
  // la fois. Seule l'ÉCRITURE de l'index doit rester unique à un instant
  // donné (verrouillée par `flush` ci-dessous) : `sauvegarderIndex`
  // rechiffre et renvoie l'index ENTIER à chaque appel, et le faire une fois
  // par document (128 fois sur un gros lot) dominait largement le temps
  // passé — plus que le classement lui-même. `modifierPlusieursObjets`
  // regroupe plusieurs classements en une seule sauvegarde ; `CHECKPOINT_TRI_AUTO`
  // en déclenche une toutes les huit réussites plutôt qu'une seule à la fin,
  // pour ne pas tout reperdre si la page se ferme en cours de lot.
  async function trierAutomatiquement() {
    if (!utilisateur || !cle) return;
    const CONCURRENCE_TRI_AUTO = 3;
    const CHECKPOINT_TRI_AUTO = 8;

    const tout = Object.keys(index.objets).filter(
      (n) => !index.objets[n]?.categorie?.trim() && !triAutoIgnores.has(n),
    );
    if (tout.length === 0) return;
    const aTrier = tout.slice(0, LOT_MAX_TRI_AUTO);

    setTriAutoEnCours(true);
    setTriAutoProgres({ fait: 0, total: aTrier.length });
    setTriAutoBilan(null);
    setTriAutoDetailOuvert(false);

    const indexDepart = index;
    let indexCourant = index;
    let enAttente: Record<string, { categorie: string; montant?: string }> = {};
    let flushEnVol: Promise<void> | null = null;
    const nonDocuments: string[] = [];
    const nonDocumentsCles: string[] = [];
    const erreursTechniques: string[] = [];

    // Verrouillé : si un flush est déjà en vol, celui-ci se contente
    // d'attendre — les entrées accumulées depuis seront prises par le flush
    // suivant (le déclencheur du checkpoint, ou le flush final après la
    // boucle), jamais perdues, jamais écrites deux fois sur un index périmé.
    async function flush() {
      if (flushEnVol) {
        await flushEnVol;
        return;
      }
      const nomsEnAttente = Object.keys(enAttente);
      if (nomsEnAttente.length === 0) return;
      const aEcrire = enAttente;
      enAttente = {};
      flushEnVol = (async () => {
        indexCourant = await modifierPlusieursObjets(utilisateur!.id, cle!, aEcrire, indexCourant);
        setIndex(indexCourant);
      })();
      try {
        await flushEnVol;
      } finally {
        flushEnVol = null;
      }
    }

    let curseur = 0;
    async function suivant(): Promise<void> {
      const i = curseur++;
      if (i >= aTrier.length) return;
      const nom = aTrier[i];
      if (!nom) return suivant();
      const info = indexDepart.objets[nom];
      if (info) {
        try {
          const blob = await recupererFichier(utilisateur!.id, cle!, nom, info);
          // `File` est déjà importé plus haut comme icône lucide-react, qui
          // masque le constructeur DOM — d'où `globalThis.File` ici.
          const fichier = new globalThis.File([blob], info.nom, { type: info.type });
          const proposition = await proposerClassement(fichier);
          if (proposition.lisible) {
            enAttente[nom] = { categorie: proposition.categorie, montant: proposition.montant || undefined };
            if (Object.keys(enAttente).length >= CHECKPOINT_TRI_AUTO) await flush();
          } else if (proposition.erreurTechnique) {
            // L'appel a échoué (réseau, quota, service surchargé) — le
            // document reste sans catégorie et sera repris tel quel au
            // prochain tri, à la différence d'un vrai non-document.
            erreursTechniques.push(info.nom);
          } else {
            nonDocuments.push(info.nom);
            nonDocumentsCles.push(nom);
          }
        } catch (err) {
          erreursTechniques.push(`${info.nom} (${err instanceof Error ? err.message : String(err)})`);
        }
      }
      setTriAutoProgres((p) => (p ? { ...p, fait: p.fait + 1 } : null));
      return suivant();
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCE_TRI_AUTO, aTrier.length) }, suivant));
    await flush();

    if (nonDocumentsCles.length > 0) {
      setTriAutoIgnores((precedent) => {
        const suivant = new Set(precedent);
        for (const cleStockage of nonDocumentsCles) suivant.add(cleStockage);
        return suivant;
      });
    }
    if (nonDocuments.length > 0 || erreursTechniques.length > 0) {
      setTriAutoBilan({ nonDocuments, erreursTechniques });
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
    if (action.type === 'supprimer') {
      if (cles.length > 1) {
        return `Plusieurs papiers portent le nom « ${action.nom} » — supprime-le à la main pour choisir lequel.`;
      }
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
      let indexCourant: IndexCoffre;
      if (cles.length === 1) {
        indexCourant = await modifierObjet(utilisateur.id, cle, cles[0] as string, { categorie: action.categorie }, index);
      } else {
        const champs: Record<string, { categorie: string }> = {};
        for (const cleStockage of cles) champs[cleStockage] = { categorie: action.categorie };
        indexCourant = await modifierPlusieursObjets(utilisateur.id, cle, champs, index);
      }
      setIndex(indexCourant);
      return `« ${action.nom} » classé dans « ${action.categorie} ».`;
    } catch (err) {
      return `Classement impossible : ${err instanceof Error ? err.message : String(err)}`;
    }
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

  if (etape === 'creer') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Le Tiroir Secret</p>
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
          <p className="text-sm tracking-widest text-ink-soft uppercase">Le Tiroir Secret</p>
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
  // Papiers sans catégorie — même critère que le dossier « À trier » de la
  // vue « Ranger en dossiers » (DOSSIER_SANS_CATEGORIE), pour ne pas créer un
  // second sens au même mot.
  const nomsATrier = tousLesNoms.filter((n) => !index.objets[n]?.categorie?.trim());
  // Ce qu'un prochain clic sur « Trier automatiquement » offre réellement :
  // `nomsATrier` reste le compte brut (vrai, mais un document confirmé
  // non-document cette session ne redeviendra pas classable pour autant),
  // celui-ci exclut ce qui a déjà été vu et rejeté — voir triAutoIgnores.
  const nomsATrierRestants = nomsATrier.filter((n) => !triAutoIgnores.has(n));
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

  return (
    <main
      className={`min-h-screen bg-paper pb-32 transition ${survole ? 'bg-accent/5 ring-2 ring-accent ring-inset' : ''}`}
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
        onChange={(e) => surDepot(Array.from(e.target.files || []))}
      />
      {/* Suggestions d'étiquettes déjà utilisées — jamais une liste imposée,
          juste ce que l'utilisateur a lui-même déjà tapé. */}
      <datalist id="categories-connues">
        {categoriesSuggerees.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="mx-auto flex max-w-[1700px] flex-col gap-8 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        {/* Marque persistante — visible sur le tableau de bord, pas
            seulement sur l'écran de connexion. Violet plutôt que turquoise :
            les deux sont censés dominer à parts égales, et le turquoise
            porte déjà l'eyebrow « Bonjour » juste en dessous. */}
        <p className="text-sm font-semibold tracking-widest text-violet uppercase">Le Tiroir Secret</p>
        {/* En-tête */}
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-line bg-paper-raised bg-gradient-to-br from-paper-raised via-paper-raised to-vert/10 p-6 sm:p-8">
          <div>
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">
              Bonjour {prenom || 'toi'}
            </p>
            <h1 className="mt-2 font-affiche text-3xl sm:text-4xl texte-degrade">Voici où en sont tes papiers</h1>
            <p className="mt-3 max-w-md text-ink-soft">
              Tout est déjà lu et rangé pour toi — il ne reste qu&apos;à jeter un œil.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-vert">
              <ShieldCheck size={16} /> Personne d&apos;autre ne peut voir tes papiers. Même nous.
            </p>
          </div>
          <button onClick={seDeconnecter}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-wine/60 hover:text-wine">
            <LogOut size={16} /> Se déconnecter
          </button>
        </header>

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

        {/* Bouton « À trier » : reclasse les papiers déposés sans catégorie,
            plutôt que de les corriger un par un — visible seulement s'il y a
            quelque chose à trier, et par lots de LOT_MAX_TRI_AUTO (voir
            `trierAutomatiquement`) plutôt que tout d'un coup. */}
        {nomsATrier.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {nomsATrier.length} papier{nomsATrier.length > 1 ? 's' : ''} {DOSSIER_SANS_CATEGORIE.toLowerCase()}
                {nomsATrierRestants.length > LOT_MAX_TRI_AUTO && ` — traités par lots de ${LOT_MAX_TRI_AUTO}`}
                {/* Un papier déjà rejeté cette session (photo, vidéo…) ne
                    redeviendra pas classable au clic suivant — sans le dire,
                    le bouton semblerait proposer un lot qu'il ne peut plus
                    faire avancer. */}
                {triAutoIgnores.size > 0 && nomsATrierRestants.length > 0 &&
                  ` (${triAutoIgnores.size} déjà vu${triAutoIgnores.size > 1 ? 's' : ''} comme non-document${triAutoIgnores.size > 1 ? 's' : ''}, mis de côté)`}
              </p>
              {nomsATrierRestants.length > 0 ? (
                <button
                  type="button"
                  onClick={trierAutomatiquement}
                  disabled={triAutoEnCours}
                  className="shrink-0 rounded-lg bg-bleu px-4 py-2 text-sm font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60"
                >
                  {triAutoEnCours
                    ? `Tri en cours… (${triAutoProgres?.fait ?? 0}/${triAutoProgres?.total ?? nomsATrierRestants.length})`
                    : `Trier automatiquement (${Math.min(nomsATrierRestants.length, LOT_MAX_TRI_AUTO)})`}
                </button>
              ) : (
                <p className="text-sm text-ink-soft">
                  Tout le reste a déjà été vu comme non-document cette visite — recharge la page pour
                  réessayer, ou classe-les à la main ci-dessous.
                </p>
              )}
            </div>
            {triAutoProgres && (
              <div
                role="progressbar"
                aria-valuenow={triAutoProgres.fait}
                aria-valuemin={0}
                aria-valuemax={triAutoProgres.total}
                aria-label="Progression du tri automatique"
                className="relative h-1.5 w-full overflow-hidden rounded-full bg-line"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-vert via-accent to-violet" />
                <div
                  className="absolute inset-y-0 right-0 rounded-r-full bg-line transition-all"
                  style={{ width: `${100 - (triAutoProgres.fait / triAutoProgres.total) * 100}%` }}
                />
              </div>
            )}
            {/* Bilan du dernier lot : un compteur par nature d'échec, jamais
                un mur de noms — le détail complet reste disponible mais
                replié, dans une zone bornée en hauteur. */}
            {triAutoBilan && (triAutoBilan.nonDocuments.length > 0 || triAutoBilan.erreursTechniques.length > 0) && (
              <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
                {triAutoBilan.nonDocuments.length > 0 && (
                  <p className="text-ink-soft">
                    {triAutoBilan.nonDocuments.length} fichier{triAutoBilan.nonDocuments.length > 1 ? 's' : ''} non reconnu
                    {triAutoBilan.nonDocuments.length > 1 ? 's' : ''} comme document administratif (photo, vidéo ou image
                    sans texte lisible).
                  </p>
                )}
                {triAutoBilan.erreursTechniques.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-wine">
                      {triAutoBilan.erreursTechniques.length} fichier{triAutoBilan.erreursTechniques.length > 1 ? 's' : ''} non
                      analysé{triAutoBilan.erreursTechniques.length > 1 ? 's' : ''} (problème réseau ou service surchargé).
                    </p>
                    <button
                      type="button"
                      onClick={trierAutomatiquement}
                      disabled={triAutoEnCours}
                      className="shrink-0 font-semibold text-wine underline decoration-dotted hover:text-ink disabled:opacity-60"
                    >
                      Réessayer
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setTriAutoDetailOuvert((v) => !v)}
                  className="self-start text-ink-soft underline decoration-dotted hover:text-ink"
                >
                  {triAutoDetailOuvert ? 'Masquer le détail' : 'Voir le détail'}
                </button>
                {triAutoDetailOuvert && (
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-paper-raised p-3 text-xs text-ink-soft">
                    {[...triAutoBilan.nonDocuments, ...triAutoBilan.erreursTechniques].map((nom, i) => (
                      <p key={`${nom}-${i}`} className="truncate">{nom}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
            {tousLesNoms.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Pose une question : « mes photos », « le papier de la mutuelle »…"
                    className="w-full rounded-xl border border-line bg-paper-raised py-2.5 pr-3 pl-10 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
                {/* Réponse du coffre à la question posée — jamais affichée
                    pour une recherche vide, où elle n'apporterait rien.
                    Point d'entrée unique désormais : quand la recherche
                    locale (gratuite, instantanée) ne trouve rien, une puce
                    propose d'escalader vers l'assistant (payant) avec la
                    même question — jamais automatique, pour ne pas facturer
                    une simple faute de frappe. */}
                {recherche.trim() && (
                  <div className="flex flex-wrap items-center gap-2">
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
                    {nomsTrouves.length === 0 && !actionRecherche && (
                      <button
                        type="button"
                        onClick={() => demanderAAssistant(recherche.trim())}
                        className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/60"
                      >
                        <MessageCircle size={12} /> Demander à l&apos;assistant
                      </button>
                    )}
                  </div>
                )}
                {/* Toujours visible, discret : la porte vers une question qui
                    ne concerne aucun document précis (« comment résilier une
                    assurance habitation »), sans dupliquer la barre du haut
                    ni ouvrir un second champ de saisie. */}
                {!recherche.trim() && (
                  <button
                    type="button"
                    onClick={() => demanderAAssistant('')}
                    className="self-start text-xs text-ink-soft underline decoration-dotted transition hover:text-ink"
                  >
                    Une question plus large ? Demander à l&apos;assistant
                  </button>
                )}
              </div>
            )}
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
            <section id="rendez-vous" className="scroll-mt-6">
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

            <section id="mon-identite" className="scroll-mt-6">
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

            <section id="remplir-formulaire" className="scroll-mt-6">
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
        <RemplirFormulaire identite={index.identite} onFermer={() => setFormulaireOuvert(false)} />
      )}

      {assistantOuvert && (
        <AssistantCoffre
          index={index}
          questionInitiale={questionAssistant}
          onFermer={fermerAssistant}
          // `documentsCites` porte le nom AFFICHÉ (voir digestIndex côté
          // serveur), jamais la clé opaque qu'attend ouvrirDetail — sans
          // cette résolution, cliquer un document cité n'ouvrait rien.
          onOuvrirDocument={(nomAffiche) => {
            const cleStockage = clesParNomAffiche(index, nomAffiche)[0];
            if (cleStockage) ouvrirDetail(cleStockage);
          }}
          onOuvrirFormulaire={() => setFormulaireOuvert(true)}
          onOuvrirRangement={() => setVueDossiers(true)}
          onExecuterAction={executerActionAssistant}
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
