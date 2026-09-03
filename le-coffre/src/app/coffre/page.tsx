'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, type IndexCoffre,
} from '@/lib/coffre';

type Etape = 'chargement' | 'creer' | 'deverrouiller' | 'ouvert';

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function PageCoffre() {
  const routeur = useRouter();
  const [utilisateur, setUtilisateur] = useState<User | null>(null);
  const [etape, setEtape] = useState<Etape>('chargement');
  const [cle, setCle] = useState<CryptoKey | null>(null);
  const [index, setIndex] = useState<IndexCoffre>({ objets: {} });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
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
      setIndex({ objets: {} });
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
    } catch {
      setErreur('Phrase secrète incorrecte.');
    } finally {
      setEnCours(false);
    }
  }

  async function surDepot(fichiers: FileList | null) {
    if (!fichiers || !fichiers.length || !utilisateur || !cle) return;
    setEnCours(true);
    setErreur('');
    try {
      let indexCourant = index;
      for (const fichier of Array.from(fichiers)) {
        indexCourant = await deposerFichier(utilisateur.id, cle, fichier, '', indexCourant);
      }
      setIndex(indexCourant);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
      if (entreeFichier.current) entreeFichier.current.value = '';
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
    } catch (err) {
      alert(`Suppression impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (etape === 'chargement') {
    return <main className="flex min-h-screen items-center justify-center text-ink-soft">Chargement…</main>;
  }

  if (etape === 'creer') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Le Coffre</p>
          <h1 className="mt-2 font-affiche text-3xl">Choisis ta phrase secrète</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Elle chiffre chaque document déposé, entièrement dans ce navigateur. Nous ne la
            recevons jamais.
          </p>
        </div>
        <div className="rounded-xl border border-wine/40 bg-wine/10 p-4 text-sm text-ink">
          ⚠️ Il n&apos;existe aucun moyen de la récupérer si tu l&apos;oublies. Personne — pas même
          nous — ne peut la retrouver ni contourner le chiffrement.
        </div>
        <form onSubmit={creerCoffre} className="flex flex-col gap-3">
          <label className="text-sm text-ink-soft" htmlFor="mdp1">Phrase secrète</label>
          <input id="mdp1" name="mdp1" type="password" autoComplete="new-password"
            className="rounded-xl border border-line bg-paper-raised px-4 py-3 outline-none focus:border-accent" />
          <label className="text-sm text-ink-soft" htmlFor="mdp2">Retape-la</label>
          <input id="mdp2" name="mdp2" type="password" autoComplete="new-password"
            className="rounded-xl border border-line bg-paper-raised px-4 py-3 outline-none focus:border-accent" />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-paper hover:bg-accent-strong disabled:opacity-60">
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
          <p className="text-sm tracking-widest text-ink-soft uppercase">Le Coffre</p>
          <h1 className="mt-2 font-affiche text-3xl">Entre ta phrase secrète</h1>
        </div>
        <form onSubmit={deverrouiller} className="flex flex-col gap-3">
          <input name="mdp" type="password" autoComplete="current-password" autoFocus
            className="rounded-xl border border-line bg-paper-raised px-4 py-3 outline-none focus:border-accent" />
          {erreur && <p className="text-sm text-wine">{erreur}</p>}
          <button type="submit" disabled={enCours}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-paper hover:bg-accent-strong disabled:opacity-60">
            {enCours ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
        <button onClick={seDeconnecter} className="text-sm text-ink-soft underline">Se déconnecter</button>
      </main>
    );
  }

  const noms = Object.keys(index.objets);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm tracking-widest text-ink-soft uppercase">Le Coffre</p>
          <h1 className="font-affiche text-3xl">{utilisateur?.email}</h1>
        </div>
        <button onClick={seDeconnecter} className="text-sm text-ink-soft underline">Se déconnecter</button>
      </div>

      <label
        className="mb-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-paper-raised px-6 py-10 text-center transition hover:border-accent"
      >
        <span className="font-semibold">Choisir un ou plusieurs fichiers</span>
        <span className="text-sm text-ink-soft">ou les déposer ici</span>
        <input
          ref={entreeFichier}
          type="file"
          multiple
          hidden
          onChange={(e) => surDepot(e.target.files)}
          onDrop={(e) => {
            e.preventDefault();
            surDepot(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
        />
      </label>

      {enCours && <p className="mb-4 text-sm text-ink-soft">Chiffrement en cours…</p>}
      {erreur && <p className="mb-4 text-sm text-wine">{erreur}</p>}

      {noms.length === 0 ? (
        <p className="text-ink-soft">Le coffre est vide pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {noms.map((nom) => {
            const info = index.objets[nom];
            if (!info) return null;
            return (
              <li key={nom} className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3">
                <div>
                  <p className="font-medium">{info.nom}</p>
                  <p className="text-sm text-ink-soft">{formatTaille(info.taille)}</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button onClick={() => telecharger(nom)} className="text-accent hover:underline">Télécharger</button>
                  <button onClick={() => supprimer(nom)} className="text-wine hover:underline">Supprimer</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
