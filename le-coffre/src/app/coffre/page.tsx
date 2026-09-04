'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  coffreExiste, deposerFichier, deverrouillerCoffre, initialiserCoffre, recupererFichier,
  supprimerFichier, chargerIndex, proposerClassement, ajouterRendezVous, supprimerRendezVous,
  type IndexCoffre, type Echeance,
} from '@/lib/coffre';

type Etape = 'chargement' | 'creer' | 'deverrouiller' | 'ouvert';

const ECHEANCE_VIDE: Echeance = { presente: false, date: null, libelle: null, confiance: 'basse' };

type EnAttente = {
  cle: string;
  fichier: File;
  enAnalyse: boolean;
  categorie: string;
  nomAffiche: string;
  echeance: Echeance;
};

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
  const [index, setIndex] = useState<IndexCoffre>({ objets: {}, rendezVous: {} });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [aValider, setAValider] = useState<EnAttente[]>([]);
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
    } catch {
      setErreur('Phrase secrète incorrecte.');
    } finally {
      setEnCours(false);
    }
  }

  // Un fichier choisi ne se dépose pas tout de suite : on propose d'abord une
  // catégorie, un nom et une échéance éventuelle (fonction classer-document,
  // qui lit le fichier une fraction de seconde côté serveur puis ne garde
  // rien — voir SECURITY.md), et rien ne bouge tant que l'utilisateur n'a
  // pas validé chaque proposition.
  async function surDepot(fichiers: FileList | null) {
    if (!fichiers || !fichiers.length || !utilisateur || !cle) return;
    setErreur('');
    const nouveaux: EnAttente[] = Array.from(fichiers).map((fichier) => ({
      cle: `${fichier.name}-${fichier.size}-${crypto.randomUUID()}`,
      fichier, enAnalyse: true, categorie: '', nomAffiche: fichier.name, echeance: ECHEANCE_VIDE,
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
    } catch (err) {
      alert(`Suppression impossible : ${err instanceof Error ? err.message : String(err)}`);
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
  const rendezVousTries = Object.values(index.rendezVous || {})
    .sort((a, b) => (a.date < b.date ? -1 : 1));

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

      {erreur && <p className="mb-4 text-sm text-wine">{erreur}</p>}

      {aValider.length > 0 && (
        <ul className="mb-6 flex flex-col gap-3">
          {aValider.map((item) => (
            <li key={item.cle} className="rounded-xl border border-accent/40 bg-paper-raised p-4">
              {item.enAnalyse ? (
                <p className="text-sm text-ink-soft">Lecture de « {item.fichier.name} »…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-ink-soft" htmlFor={`nom-${item.cle}`}>Nom</label>
                  <input id={`nom-${item.cle}`} value={item.nomAffiche}
                    onChange={(e) => modifierAttente(item.cle, { nomAffiche: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
                  <label className="text-sm text-ink-soft" htmlFor={`cat-${item.cle}`}>Catégorie</label>
                  <input id={`cat-${item.cle}`} value={item.categorie}
                    placeholder="Non proposée — à préciser ou laisser vide"
                    onChange={(e) => modifierAttente(item.cle, { categorie: e.target.value })}
                    className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
                  {item.echeance.presente && (
                    <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                      <p className="font-medium">Échéance détectée : {item.echeance.libelle}</p>
                      <p className="text-ink-soft">
                        {item.echeance.date} — confiance {item.echeance.confiance}. À vérifier avant de valider.
                      </p>
                    </div>
                  )}
                  <div className="mt-1 flex gap-3 text-sm">
                    <button onClick={() => confirmerDepot(item)} disabled={enCours}
                      className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-paper hover:bg-accent-strong disabled:opacity-60">
                      Déposer
                    </button>
                    <button onClick={() => retirerAttente(item.cle)} className="text-ink-soft hover:underline">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-affiche text-xl">Rendez-vous</h2>
        <form onSubmit={surAjoutRendezVous} className="mb-4 flex flex-wrap gap-3">
          <input name="libelle" placeholder="Dentiste, cabinet Martin…" required
            className="min-w-[12rem] flex-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-accent" />
          <input name="date" type="date" required
            className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-accent" />
          <button type="submit" disabled={enCours}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-paper hover:bg-accent-strong disabled:opacity-60">
            Ajouter
          </button>
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

      <h2 className="mb-3 font-affiche text-xl">Documents</h2>
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
                  <p className="text-sm text-ink-soft">
                    {formatTaille(info.taille)}{info.categorie ? ` · ${info.categorie}` : ''}
                  </p>
                  {info.echeance?.presente && (
                    <p className="text-sm text-accent">
                      {info.echeance.libelle} — {info.echeance.date}
                    </p>
                  )}
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
