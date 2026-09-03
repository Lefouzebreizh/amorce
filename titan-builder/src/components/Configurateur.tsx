'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  type Commande, type Modele, OPTIONS, PRIX_BASE, prixTotal, reproches,
} from '@/lib/commande';
import { METIERS_PROPOSES, teinteDeCharte } from '@/lib/charte';

/*
 * Le configurateur en cinq étapes.
 *
 * **Aucun sous-composant n'est défini à l'intérieur du rendu.** Une fonction
 * écrite dans le corps du composant est redéfinie à chaque rendu ; React y voit
 * un type différent, démonte le sous-arbre et le remonte — sur un champ de
 * saisie, le curseur saute à chaque frappe. Le défaut ne se voit dans aucun
 * test unitaire et se paie une heure de recherche. Tout ce qui suit vit donc au
 * niveau du module et reçoit ce dont il a besoin en propriétés.
 */

const ETAPES = ['Infos', 'Fonctions', 'Contenu', 'Récap', 'Merci'] as const;

/* ── Briques ──────────────────────────────────────────────────────────────── */

function Progression({ etape }: { etape: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progression">
      {ETAPES.map((nom, index) => {
        const atteinte = index <= etape;
        return (
          <li key={nom} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${atteinte ? 'bg-gradient-to-r from-neon to-cyan' : 'bg-bord'}`}
              aria-hidden="true"
            />
            <span className={`text-[0.7rem] ${atteinte ? 'text-neon-clair' : 'text-sourdine'}`}>
              {nom}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type ChampProps = {
  id: string;
  libelle: string;
  aide?: string;
  valeur: string;
  onChange: (valeur: string) => void;
  type?: string;
  placeholder?: string;
  multiligne?: boolean;
};

function Champ({ id, libelle, aide, valeur, onChange, type = 'text', placeholder, multiligne }: ChampProps) {
  const classe =
    'w-full rounded-2xl border border-bord bg-fond-doux px-4 py-3 text-base text-white outline-none transition placeholder:text-sourdine/60 focus:border-neon-clair focus:ring-2 focus:ring-neon/40';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{libelle}</label>
      {multiligne ? (
        <textarea id={id} value={valeur} placeholder={placeholder} rows={4}
          onChange={(e) => onChange(e.target.value)} className={classe} />
      ) : (
        <input id={id} type={type} value={valeur} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} className={classe} />
      )}
      {aide ? <p className="text-xs text-sourdine">{aide}</p> : null}
    </div>
  );
}

function EtapeInfos({ commande, modifier }: { commande: Commande; modifier: (p: Partial<Commande>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Champ id="entreprise" libelle="Nom de l’entreprise" valeur={commande.entreprise}
        onChange={(v) => modifier({ entreprise: v })} placeholder="Maçonnerie Dupont" />
      <Champ id="telephone" libelle="Téléphone" type="tel" valeur={commande.telephone}
        onChange={(v) => modifier({ telephone: v })} placeholder="06 12 34 56 78"
        aide="C’est le numéro qui s’affichera sur le bouton Appel." />
      <Champ id="ville" libelle="Ville" valeur={commande.ville}
        onChange={(v) => modifier({ ville: v })} placeholder="Rennes" />
      <Champ id="slogan" libelle="Slogan" valeur={commande.slogan}
        onChange={(v) => modifier({ slogan: v })} placeholder="Le mur droit du premier coup."
        aide="Facultatif. Si tu n’en as pas, j’en propose un." />

      {/*
        * Le métier, et non plus un nuancier.
        *
        * Cet écran portait un `input type="color"` : seize millions de valeurs,
        * dont l'orange que la charte refuse et toutes celles qui ne se lisent
        * pas. Deux artisans livrés la même semaine ne se ressemblaient alors
        * par rien, et c'est exactement ce qu'une charte doit empêcher.
        *
        * Le champ garde son nom — `couleur` — parce qu'il voyage dans les
        * dossiers déjà écrits et dans la route d'API. Ce qui a changé est ce
        * qu'on y met : un métier, que `charte.ts` traduit en teinte.
        *
        * La pastille montre le résultat tout de suite : sans elle, choisir son
        * métier reviendrait à choisir une couleur à l'aveugle.
        */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="couleur" className="text-sm font-semibold">Ton métier</label>
        <div className="flex items-center gap-3">
          <select id="couleur" value={commande.couleur}
            onChange={(e) => modifier({ couleur: e.target.value })}
            className="min-h-11 flex-1 rounded-xl border border-bord bg-fond-doux px-3 py-2 text-sm">
            {METIERS_PROPOSES.map((m) => (
              <option key={m.cle} value={m.cle}>{m.libelle}</option>
            ))}
          </select>
          <span className="inline-block h-8 w-8 shrink-0 rounded-lg border border-bord"
            style={{ background: teinteDeCharte(commande.couleur).accent }} />
        </div>
        <p className="text-xs text-sourdine">
          C’est lui qui donne la teinte de ton site. Cinq teintes, toutes tenues par la charte
          Artisan Express — un client reconnaît la patte, quel que soit le métier.
        </p>
      </div>
    </div>
  );
}

function EtapeOptions({ choisies, basculer }: { choisies: string[]; basculer: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((option) => {
        const active = choisies.includes(option.id);
        return (
          <label
            key={option.id}
            data-cible
            className={`lueur flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
              active ? 'border-neon-clair bg-neon/12' : 'border-bord bg-fond-doux'
            }`}
          >
            <input type="checkbox" checked={active} onChange={() => basculer(option.id)}
              className="mt-1 h-5 w-5 accent-[var(--color-neon)]" />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {option.nom}
                {option.supplement > 0 ? (
                  <span className="rounded-full bg-cyan/20 px-2 py-0.5 text-xs font-bold text-cyan">
                    + {option.supplement} €
                  </span>
                ) : (
                  <span className="rounded-full bg-succes/15 px-2 py-0.5 text-xs text-succes">compris</span>
                )}
              </span>
              <span className="text-sm text-sourdine">{option.aquoiCaSert}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

type Fichier = { id: string; fichier: File; apercu: string };

function Vignette({ item, retirer }: { item: Fichier; retirer: (id: string) => void }) {
  return (
    <li className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- un aperçu local
          (`blob:`) ne passe pas par l'optimiseur d'images de Next. */}
      <img src={item.apercu} alt={item.fichier.name}
        className="h-24 w-full rounded-xl border border-bord object-cover" />
      <button type="button" onClick={() => retirer(item.id)}
        aria-label={`Retirer ${item.fichier.name}`}
        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-bord bg-fond text-sourdine hover:border-neon-clair hover:text-white">
        ×
      </button>
    </li>
  );
}

type EtapeContenuProps = {
  commande: Commande;
  modifier: (p: Partial<Commande>) => void;
  photos: Fichier[];
  ajouter: (liste: FileList | null) => void;
  retirer: (id: string) => void;
};

function EtapeContenu({ commande, modifier, photos, ajouter, retirer }: EtapeContenuProps) {
  const [survol, setSurvol] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Tes photos</span>
        <div
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files); }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
            survol ? 'border-neon-clair bg-neon/10' : 'border-bord bg-fond-doux'
          }`}
        >
          <p className="text-sm text-sourdine">Glisse tes photos ici, ou</p>
          <button type="button" onClick={() => champFichier.current?.click()}
            className="mt-3 rounded-xl border border-bord bg-verre px-5 text-sm font-semibold hover:border-neon-clair">
            Choisir des fichiers
          </button>
          <input ref={champFichier} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { ajouter(e.target.files); e.target.value = ''; }} />
          <p className="mt-3 text-xs text-sourdine">
            Chantiers, camion, réalisations, ton logo. JPEG ou PNG.
          </p>
        </div>

        {photos.length > 0 ? (
          <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((item) => <Vignette key={item.id} item={item} retirer={retirer} />)}
          </ul>
        ) : null}
      </div>

      <Champ id="presentation" libelle="Parle-moi de toi" multiligne valeur={commande.presentation}
        onChange={(v) => modifier({ presentation: v })}
        placeholder="Vingt ans de métier, je bosse seul, je réponds toujours au téléphone…"
        aide="Trois lignes suffisent. C’est ce qui remplace le texte creux." />

      <Champ id="services" libelle="Tes services et tes prix" multiligne valeur={commande.services}
        onChange={(v) => modifier({ services: v })}
        placeholder={'Enduit façade — à partir de 45 €/m²\nDallage terrasse — sur devis'}
        aide="Un service par ligne. Le prix si tu veux l’afficher." />
    </div>
  );
}

type EtapeRecapProps = {
  modele: Modele;
  commande: Commande;
  photos: Fichier[];
  total: number;
  envoi: 'repos' | 'en-cours' | 'echec';
  erreur: string;
  envoyer: () => void;
};

function EtapeRecap({ modele, commande, photos, total, envoi, erreur, envoyer }: EtapeRecapProps) {
  const retenues = OPTIONS.filter((o) => commande.options.includes(o.id));
  return (
    <div className="flex flex-col gap-5">
      <div className="verre rounded-2xl p-5">
        <h3 className="text-lg font-bold">{modele.nom}</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-sourdine">Entreprise</dt><dd className="font-medium">{commande.entreprise}</dd></div>
          <div><dt className="text-sourdine">Ville</dt><dd className="font-medium">{commande.ville}</dd></div>
          <div><dt className="text-sourdine">Téléphone</dt><dd className="font-medium">{commande.telephone}</dd></div>
          <div>
            <dt className="text-sourdine">Métier</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span className="inline-block h-4 w-4 rounded border border-bord"
                style={{ background: teinteDeCharte(commande.couleur).accent }} />
              {METIERS_PROPOSES.find((m) => m.cle === commande.couleur)?.libelle ?? commande.couleur}
            </dd>
          </div>
        </dl>
        {commande.slogan ? <p className="mt-3 text-sm text-sourdine">« {commande.slogan} »</p> : null}
      </div>

      <div className="verre rounded-2xl p-5">
        <h3 className="text-lg font-bold">Ce que tu reçois</h3>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {retenues.length === 0 ? <li className="text-sourdine">Aucune fonction cochée.</li> : null}
          {retenues.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3">
              <span>{o.nom}</span>
              <span className={`whitespace-nowrap ${o.supplement > 0 ? 'font-bold text-cyan' : 'text-succes'}`}>
                {o.supplement > 0 ? `+ ${o.supplement} €` : 'compris'}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 pt-1 text-sourdine">
            <span>Photos jointes</span><span>{photos.length}</span>
          </li>
        </ul>
      </div>

      <div className="verre flex items-center justify-between rounded-2xl p-5">
        <div>
          <p className="text-sm text-sourdine">Total, une fois, sans abonnement</p>
          <p className="text-3xl font-extrabold">{total} €</p>
        </div>
        <p className="text-right text-xs text-sourdine">
          Base {PRIX_BASE} €<br />
          {total > PRIX_BASE ? `+ ${total - PRIX_BASE} € d’options` : 'aucune option payante'}
        </p>
      </div>

      {erreur ? (
        <p role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {erreur}
        </p>
      ) : null}

      <button type="button" onClick={envoyer} disabled={envoi === 'en-cours'}
        className="lueur min-h-14 rounded-2xl bg-gradient-to-r from-neon to-cyan text-lg font-bold text-white disabled:opacity-60">
        {envoi === 'en-cours' ? 'Envoi en cours…' : `Envoyer mon dossier — ${total} €`}
      </button>
      <p className="text-center text-xs text-sourdine">
        Rien n’est débité ici : le paiement arrive après, une fois le dossier reçu.
      </p>
    </div>
  );
}

function EtapeMerci({ reference }: { reference: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-succes/15 text-3xl">✓</span>
      <h2 className="text-3xl font-extrabold">Dossier reçu</h2>
      <p className="max-w-md text-slate-300">
        Je te livre en <strong className="text-white">48 heures</strong>. Si une pièce manque, je
        t’appelle — je ne relance jamais par courriel automatique.
      </p>
      {reference ? (
        <p className="verre rounded-xl px-4 py-2 font-mono text-sm text-sourdine">{reference}</p>
      ) : null}
      <Link href="/" className="mt-2 inline-flex items-center rounded-xl border border-bord px-5 text-sm hover:border-neon-clair">
        Retour aux modèles
      </Link>
    </div>
  );
}

/* ── Le configurateur ─────────────────────────────────────────────────────── */

export function Configurateur({ modele }: { modele: Modele }) {
  const [etape, setEtape] = useState(0);
  const [photos, setPhotos] = useState<Fichier[]>([]);
  const [envoi, setEnvoi] = useState<'repos' | 'en-cours' | 'echec'>('repos');
  const [erreur, setErreur] = useState('');
  const [reference, setReference] = useState('');
  const [commande, setCommande] = useState<Commande>({
    modele: modele.id,
    entreprise: '', telephone: '', ville: '', couleur: 'couvreur', slogan: '',
    options: ['appel', 'devis'], presentation: '', services: '',
  });

  const modifier = useCallback((partiel: Partial<Commande>) => {
    setCommande((actuelle) => ({ ...actuelle, ...partiel }));
  }, []);

  const basculer = useCallback((id: string) => {
    setCommande((actuelle) => ({
      ...actuelle,
      options: actuelle.options.includes(id)
        ? actuelle.options.filter((o) => o !== id)
        : [...actuelle.options, id],
    }));
  }, []);

  const ajouter = useCallback((liste: FileList | null) => {
    if (!liste) return;
    const images = Array.from(liste).filter((f) => f.type.startsWith('image/'));
    setPhotos((actuelles) => [
      ...actuelles,
      ...images.map((fichier) => ({
        id: `${fichier.name}-${fichier.size}-${Math.random().toString(36).slice(2, 8)}`,
        fichier,
        apercu: URL.createObjectURL(fichier),
      })),
    ]);
  }, []);

  /* Un aperçu retiré libère son lien objet. Sans cela le navigateur garde le
     fichier entier en mémoire jusqu'au rechargement de la page — quinze photos
     de téléphone suffisent à faire ramer un appareil d'entrée de gamme. */
  const retirer = useCallback((id: string) => {
    setPhotos((actuelles) => {
      const partant = actuelles.find((p) => p.id === id);
      if (partant) URL.revokeObjectURL(partant.apercu);
      return actuelles.filter((p) => p.id !== id);
    });
  }, []);

  /* Même raison au démontage. La référence tient la liste courante pour que le
     nettoyage final la voie sans figurer dans les dépendances de l'effet — sans
     quoi il se relancerait à chaque ajout et libérerait des aperçus encore
     affichés. Elle est mise à jour dans un effet et non pendant le rendu :
     écrire dans une `ref` en plein rendu est refusé par `react-hooks/refs`, et
     à raison — le rendu peut être abandonné, la valeur écrite reste. */
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => { photosRef.current.forEach((p) => URL.revokeObjectURL(p.apercu)); }, []);

  const total = useMemo(() => prixTotal(commande.options), [commande.options]);
  const manques = useMemo(() => reproches(commande), [commande]);
  const peutAvancer = etape !== 0 || manques.length === 0;

  const envoyer = useCallback(async () => {
    setEnvoi('en-cours');
    setErreur('');
    try {
      const corps = new FormData();
      corps.append('commande', JSON.stringify(commande));
      photos.forEach((p) => corps.append('photos', p.fichier, p.fichier.name));

      const reponse = await fetch('/api/commande', { method: 'POST', body: corps });
      const donnees: { reference?: string; erreur?: string } = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.erreur ?? 'Envoi refusé.');

      setReference(donnees.reference ?? '');
      setEtape(4);
      setEnvoi('repos');
    } catch (e) {
      setEnvoi('echec');
      setErreur(
        e instanceof Error && e.message !== 'Failed to fetch'
          ? e.message
          : 'L’envoi n’est pas passé. Réessaie, ou appelle-moi directement.',
      );
    }
  }, [commande, photos]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-24 pt-8 sm:pt-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center text-sm text-sourdine hover:text-white">
          ← Modèles
        </Link>
        <span className="verre rounded-full px-3 py-1 text-xs">{modele.emoji} {modele.nom}</span>
      </div>

      {etape < 4 ? <Progression etape={etape} /> : null}

      <section className="verre rounded-3xl p-5 sm:p-7">
        {etape === 0 ? <EtapeInfos commande={commande} modifier={modifier} /> : null}
        {etape === 1 ? <EtapeOptions choisies={commande.options} basculer={basculer} /> : null}
        {etape === 2 ? (
          <EtapeContenu commande={commande} modifier={modifier} photos={photos} ajouter={ajouter} retirer={retirer} />
        ) : null}
        {etape === 3 ? (
          <EtapeRecap modele={modele} commande={commande} photos={photos} total={total}
            envoi={envoi} erreur={erreur} envoyer={envoyer} />
        ) : null}
        {etape === 4 ? <EtapeMerci reference={reference} /> : null}
      </section>

      {etape === 0 && manques.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-amber-300">
          {manques.map((m) => <li key={m}>{m}</li>)}
        </ul>
      ) : null}

      {etape < 3 ? (
        <div className="flex items-center gap-3">
          {etape > 0 ? (
            <button type="button" onClick={() => setEtape((e) => e - 1)}
              className="min-h-12 flex-1 rounded-2xl border border-bord text-sm font-semibold hover:border-neon-clair">
              Retour
            </button>
          ) : null}
          <button type="button" disabled={!peutAvancer} onClick={() => setEtape((e) => e + 1)}
            className="lueur min-h-12 flex-[2] rounded-2xl bg-gradient-to-r from-neon to-cyan font-bold text-white disabled:opacity-50">
            Continuer
          </button>
        </div>
      ) : null}

      {etape === 3 ? (
        <button type="button" onClick={() => setEtape(2)}
          className="min-h-12 rounded-2xl border border-bord text-sm font-semibold hover:border-neon-clair">
          Retour au contenu
        </button>
      ) : null}
    </main>
  );
}
