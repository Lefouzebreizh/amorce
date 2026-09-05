'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  Bell, Briefcase, Car, ChevronRight, File, FileText, Heart, Home, Landmark, LogOut, Plus,
  Search, Shield, ShieldCheck, Wallet, Wifi, X, Zap, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  enregistrerIdentite, composerLettreResiliation, modifierObjet, statutEcheance, rechercheCorrespond,
  type IndexCoffre, type Echeance, type Identite, type StatutEcheance, type ObjetIndex,
} from '@/lib/coffre';

type Etape = 'chargement' | 'creer' | 'deverrouiller' | 'ouvert';

const ECHEANCE_VIDE: Echeance = { presente: false, date: null, libelle: null, confiance: 'basse' };
const CATEGORIES_RESILIABLES = ['Assurance', 'Énergie', 'Téléphonie et internet'];
// Doit correspondre à storage.buckets.file_size_limit sur coffre-objets — le
// contrôle client donne un message clair et immédiat, celui du serveur reste
// le vrai garde-fou (voir SECURITY.md).
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

// Une couleur reconnaissable par catégorie — les mêmes trois teintes que le
// reste de l'appli (accent, violet, wine), jamais d'orange/jaune. La
// couleur porte un sens grossier (santé/logement en accent, argent en
// violet, urgence/abonnement en wine), pas une charte arbitraire par mot.
const STYLE_CATEGORIE: Record<string, { icone: LucideIcon; classe: string }> = {
  'Administratif': { icone: FileText, classe: 'bg-violet/15 text-violet' },
  'Impôts': { icone: Landmark, classe: 'bg-violet/15 text-violet' },
  'Santé': { icone: Heart, classe: 'bg-accent/15 text-accent' },
  'Logement': { icone: Home, classe: 'bg-accent/15 text-accent' },
  'Banque': { icone: Wallet, classe: 'bg-violet/15 text-violet' },
  'Assurance': { icone: Shield, classe: 'bg-wine/15 text-wine' },
  'Énergie': { icone: Zap, classe: 'bg-wine/15 text-wine' },
  'Téléphonie et internet': { icone: Wifi, classe: 'bg-violet/15 text-violet' },
  'Emploi': { icone: Briefcase, classe: 'bg-accent/15 text-accent' },
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
// voir globals.css) : violet pour l'intermédiaire, pas d'ambre.
const LIBELLE_STATUT: Record<StatutEcheance, string> = {
  urgent: 'Urgent', bientot: 'Bientôt', calme: 'Calme',
};
const CLASSE_STATUT: Record<StatutEcheance, string> = {
  urgent: 'bg-wine', bientot: 'bg-violet', calme: 'bg-accent',
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
// navigateur sur l'index déjà déchiffré, jamais envoyé nulle part.
function prochaineAlerte(index: IndexCoffre): { libelle: string; date: string; jours: number } | null {
  const items: { libelle: string; date: string; jours: number }[] = [];
  for (const objet of Object.values(index.objets)) {
    if (objet.echeance?.presente && objet.echeance.date) {
      items.push({
        libelle: objet.echeance.libelle || objet.nom,
        date: objet.echeance.date,
        jours: joursRestants(objet.echeance.date),
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

// Aperçu instantané dans la fiche détail, sans passer par un téléchargement.
// Monté avec key={nom} par l'appelant : changer de document remonte ce
// composant à neuf plutôt que de réinitialiser son état depuis un effet, qui
// déclencherait un rendu en cascade évitable. Seuls image et PDF savent se
// montrer dans la page — les autres types gardent le bouton Télécharger.
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
  return apercu.type === 'application/pdf' ? (
    <iframe src={apercu.url} title={info.nom} className="h-80 w-full rounded-xl border border-line bg-paper" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- blob: local, next/image ne s'applique pas
    <img src={apercu.url} alt={info.nom} className="max-h-80 w-full rounded-xl border border-line object-contain" />
  );
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
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
  const [filtreCategorie, setFiltreCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [correction, setCorrection] = useState<Correction | null>(null);
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

    const tropGros = fichiers.filter((f) => f.size > TAILLE_MAX_OCTETS);
    if (tropGros.length > 0) {
      setErreur(
        `${tropGros.map((f) => f.name).join(', ')} dépasse ${formatTaille(TAILLE_MAX_OCTETS)} — ` +
        `non déposé. Le serveur refuserait aussi le dépôt au-delà de cette taille.`,
      );
    }
    const fichiersValides = fichiers.filter((f) => f.size <= TAILLE_MAX_OCTETS);
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

    for (const item of nouveaux) {
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
  function ouvrirDetail(nom: string) {
    const info = index.objets[nom];
    if (!info) return;
    setCorrection({ nom: info.nom, categorie: info.categorie, montant: info.montant || '' });
    setDetailOuvert(nom);
  }

  function fermerDetail() {
    setDetailOuvert(null);
    setCorrection(null);
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

  async function surAjoutRendezVous(e: React.FormEvent) {
    e.preventDefault();
    if (!utilisateur || !cle) return;
    const forme = new FormData(e.target as HTMLFormElement);
    const libelle = String(forme.get('libelle') || '').trim();
    const date = String(forme.get('date') || '');
    if (!libelle || !date) return;
    setEnCours(true);
    setErreur('');
    try {
      const nouvelIndex = await ajouterRendezVous(utilisateur.id, cle, libelle, date, index);
      setIndex(nouvelIndex);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
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
          <h1 className="mt-2 font-affiche text-4xl">Choisis ta phrase secrète</h1>
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
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
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
          <h1 className="mt-2 font-affiche text-4xl">Entre ta phrase secrète</h1>
        </div>
        <form onSubmit={deverrouiller} className="flex flex-col gap-3">
          <Champ name="mdp" type="password" autoComplete="current-password" autoFocus />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
            {enCours ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
        <button onClick={seDeconnecter} className="text-sm text-ink-soft underline">Se déconnecter</button>
      </main>
    );
  }

  const tousLesNoms = Object.keys(index.objets);
  // Étiquettes existantes, dérivées des documents déjà déposés — jamais une
  // liste fixe : l'utilisateur écrit ce qu'il veut dans le champ « Catégorie »
  // (aValider comme fiche détail), et ce qu'il a déjà écrit revient en
  // suggestion la fois suivante, via la <datalist> ci-dessous.
  const categoriesConnues = Array.from(
    new Set(tousLesNoms.map((n) => index.objets[n]?.categorie).filter((c): c is string => Boolean(c))),
  ).sort((a, b) => a.localeCompare(b, 'fr'));
  const noms = tousLesNoms
    .filter((n) => !filtreCategorie || index.objets[n]?.categorie === filtreCategorie)
    .filter((n) => {
      const objet = index.objets[n];
      return objet ? rechercheCorrespond(objet, recherche) : false;
    });
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
        {categoriesConnues.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        {/* En-tête */}
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-line bg-paper-raised p-6 sm:p-8">
          <div>
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">
              Bonjour {prenom || 'toi'}
            </p>
            <h1 className="mt-2 font-affiche text-3xl sm:text-4xl">Voici où en sont tes papiers</h1>
            <p className="mt-3 max-w-md text-ink-soft">
              Tout est déjà lu et rangé pour toi — il ne reste qu&apos;à jeter un œil.
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-accent">
              <ShieldCheck size={16} /> Personne d&apos;autre ne peut voir tes papiers. Même nous.
            </p>
          </div>
          <button onClick={seDeconnecter}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition hover:border-wine/60 hover:text-wine">
            <LogOut size={16} /> Se déconnecter
          </button>
        </header>

        {/* Bannière d'alerte */}
        {alerte && (
          <div className="flex items-start gap-4 rounded-2xl border border-line bg-paper-raised p-5">
            <div className="rounded-xl bg-accent/15 p-2.5 text-accent"><Bell size={20} /></div>
            <div>
              <p className="text-sm tracking-widest text-ink-soft uppercase">On te prévient à l&apos;avance</p>
              <p className="mt-1">
                <span className="font-semibold text-accent">{alerte.libelle}</span>
                {' '}— {formatJours(alerte.jours)} ({alerte.date})
              </p>
            </div>
          </div>
        )}

        {erreur && (
          <p className="rounded-lg border border-wine/40 bg-wine/10 px-4 py-3 text-sm text-wine">{erreur}</p>
        )}

        {/* File d'attente de validation */}
        {aValider.length > 0 && (
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
                      <div className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                        <Bell size={16} className="mt-0.5 shrink-0 text-accent" />
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
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
                        Déposer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Grille principale : documents (large) + rendez-vous/identité (colonne) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <p className="mb-4 text-sm font-semibold tracking-widest text-ink-soft uppercase">
              Vos papiers ({noms.length})
            </p>
            {tousLesNoms.length > 0 && (
              <div className="relative mb-4">
                <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Chercher un nom, un émetteur, un mot du document…"
                  className="w-full rounded-xl border border-line bg-paper-raised py-2.5 pr-3 pl-10 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
            {categoriesConnues.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setFiltreCategorie(null)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    filtreCategorie === null ? 'bg-accent text-paper' : 'bg-paper-raised text-ink-soft hover:text-ink'
                  }`}>
                  Tout
                </button>
                {categoriesConnues.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setFiltreCategorie(filtreCategorie === c ? null : c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      filtreCategorie === c ? 'bg-accent text-paper' : 'bg-paper-raised text-ink-soft hover:text-ink'
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
                {filtreCategorie && recherche.trim()
                  ? `Aucun papier dans « ${filtreCategorie} » pour « ${recherche.trim()} ».`
                  : filtreCategorie
                    ? `Aucun papier dans « ${filtreCategorie} ».`
                    : `Aucun papier pour « ${recherche.trim()} ».`}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {noms.map((nom) => {
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
                        </div>
                        {jours !== null && <BadgeStatut jours={jours} />}
                        <ChevronRight size={18} className="shrink-0 text-ink-soft" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-4 font-affiche text-2xl">Rendez-vous</h2>
              <form onSubmit={surAjoutRendezVous} className="mb-4 flex flex-col gap-2">
                <Champ name="libelle" placeholder="Dentiste, cabinet Martin…" required />
                <div className="flex gap-2">
                  <Champ name="date" type="date" required />
                  <button type="submit" disabled={enCours}
                    className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
                    Ajouter
                  </button>
                </div>
              </form>
              {rendezVousTries.length === 0 ? (
                <p className="text-sm text-ink-soft">Aucun rendez-vous noté.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rendezVousTries.map((rdv) => (
                    <li key={rdv.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3">
                      <div>
                        <p className="font-medium">{rdv.libelle}</p>
                        <p className="text-sm text-ink-soft">{rdv.date}</p>
                      </div>
                      <button onClick={() => retirerRendezVous(rdv.id)} className="text-sm text-wine hover:underline">
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
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
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
                    Enregistrer
                  </button>
                  {identiteEnregistree && (
                    <span className="text-sm text-accent">Identité enregistrée ✓</span>
                  )}
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>

      {/* Bouton flottant : seul point d'entrée visible pour ajouter un papier
          (la page entière reste aussi déposable, voir onDrop sur <main>). */}
      <div className="fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => entreeFichier.current?.click()}
          className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 font-semibold text-paper shadow-lg transition hover:bg-accent-strong"
        >
          <Plus size={20} /> Ajouter un papier
        </button>
        <span className="text-xs text-ink-soft">Une photo suffit — on s&apos;occupe du reste</span>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <BadgeStatut jours={jours} />
                    <span className="text-sm text-ink-soft">
                      {info.echeance.libelle} — {formatJours(jours)} ({info.echeance.date})
                    </span>
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
                    className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-paper transition hover:bg-accent-strong disabled:opacity-60">
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
