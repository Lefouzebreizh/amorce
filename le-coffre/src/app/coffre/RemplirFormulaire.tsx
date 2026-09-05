'use client';

import { useState } from 'react';
import { X, FileUp } from 'lucide-react';
import {
  champsFormulaire, remplirFormulaire, libelleSource,
  type ChampFormulaire, type SourceChamp,
} from '@/lib/formulaire';
import type { Identite } from '@/lib/coffre';

const SOURCES_DISPONIBLES: SourceChamp[] = [
  'identite.nomComplet', 'identite.adresse', 'identite.codePostal', 'identite.ville', '@aujourdhui',
];

type ValeurChamp = SourceChamp | 'libre' | '';

export function RemplirFormulaire({ identite, onFermer }: { identite: Identite | undefined; onFermer: () => void }) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [champs, setChamps] = useState<ChampFormulaire[]>([]);
  const [valeurs, setValeurs] = useState<Record<string, ValeurChamp>>({});
  const [texteLibre, setTexteLibre] = useState<Record<string, string>>({});
  const [cases, setCases] = useState<Record<string, boolean>>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function surChoixFichier(f: File | null) {
    setFichier(f);
    setErreur('');
    if (!f) { setChamps([]); return; }
    try {
      const buf = await f.arrayBuffer();
      const trouves = await champsFormulaire(buf);
      setChamps(trouves);
      const valeursInitiales: Record<string, ValeurChamp> = {};
      for (const champ of trouves) {
        valeursInitiales[champ.nom] = champ.sourceSuggeree ?? '';
      }
      setValeurs(valeursInitiales);
      setCases({});
      setTexteLibre({});
    } catch {
      setErreur("Ce fichier n'est pas un PDF lisible, ou n'a pas de champs de formulaire.");
      setChamps([]);
    }
  }

  async function surRemplir() {
    if (!fichier || !identite) return;
    setEnCours(true);
    setErreur('');
    try {
      const valeursFinales: Record<string, SourceChamp | string | boolean> = {};
      for (const champ of champs) {
        if (champ.type === 'case') {
          valeursFinales[champ.nom] = cases[champ.nom] ?? false;
          continue;
        }
        const v = valeurs[champ.nom];
        if (!v) continue;
        valeursFinales[champ.nom] = v === 'libre' ? (texteLibre[champ.nom] ?? '') : v;
      }
      const buf = await fichier.arrayBuffer();
      const rempli = await remplirFormulaire(buf, valeursFinales, identite);
      const blob = new Blob([rempli as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `rempli-${fichier.name}`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6" onClick={onFermer}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-paper-raised p-6 sm:max-w-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-affiche text-xl">Remplir un formulaire</h2>
          <button onClick={onFermer} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line/40" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-ink-soft">
          Dépose un formulaire PDF vierge (CERFA, mandat…). Ses champs sont lus dans ton navigateur —
          il ne quitte jamais cet appareil, ni pour être lu ni pour être rempli.
        </p>

        {!identite && (
          <div className="mb-4 rounded-lg border border-wine/40 bg-wine/10 p-3 text-sm">
            Renseigne d&apos;abord ton identité (nom, adresse) dans le panneau « Mon identité » du
            tableau de bord — sinon rien n&apos;a de quoi se remplir automatiquement.
          </div>
        )}

        <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-center transition hover:border-accent">
          <FileUp size={18} className="text-ink-soft" />
          <span className="text-sm">{fichier ? fichier.name : 'Choisir un fichier PDF'}</span>
          <input
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => surChoixFichier(e.target.files?.[0] ?? null)}
          />
        </label>

        {erreur && <p className="mb-4 text-sm text-wine">{erreur}</p>}

        {champs.length > 0 && (
          <div className="mb-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-ink-soft">
              {champs.length} champ{champs.length > 1 ? 's' : ''} détecté{champs.length > 1 ? 's' : ''} —
              vérifie chaque suggestion avant de remplir.
            </p>
            {champs.map((champ) => (
              <div key={champ.nom} className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper p-3">
                <p className="truncate text-xs text-ink-soft" title={champ.nom}>{champ.nom}</p>
                {champ.type === 'case' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cases[champ.nom] ?? false}
                      onChange={(e) => setCases((p) => ({ ...p, [champ.nom]: e.target.checked }))}
                    />
                    Cocher cette case
                  </label>
                ) : champ.type === 'liste' || champ.type === 'radio' ? (
                  <select
                    value={valeurs[champ.nom] ?? ''}
                    onChange={(e) => setValeurs((p) => ({ ...p, [champ.nom]: e.target.value as ValeurChamp }))}
                    className="rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    <option value="">— Laisser vide —</option>
                    {champ.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    <select
                      value={valeurs[champ.nom] ?? ''}
                      onChange={(e) => setValeurs((p) => ({ ...p, [champ.nom]: e.target.value as ValeurChamp }))}
                      className="flex-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-accent"
                    >
                      <option value="">— Laisser vide —</option>
                      {SOURCES_DISPONIBLES.map((s) => <option key={s} value={s}>{libelleSource(s)}</option>)}
                      <option value="libre">Texte libre…</option>
                    </select>
                    {valeurs[champ.nom] === 'libre' && (
                      <input
                        type="text"
                        value={texteLibre[champ.nom] ?? ''}
                        onChange={(e) => setTexteLibre((p) => ({ ...p, [champ.nom]: e.target.value }))}
                        placeholder="Valeur à écrire"
                        className="flex-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {fichier && champs.length === 0 && !erreur && (
          <p className="mb-4 text-sm text-ink-soft">
            Ce PDF n&apos;a pas de champ de formulaire détectable — seuls les vrais formulaires
            interactifs (AcroForm) sont pris en charge, pas un PDF « plat » à remplir à la main.
          </p>
        )}

        {champs.length > 0 && (
          <button
            type="button"
            onClick={surRemplir}
            disabled={enCours || !identite}
            className="w-full rounded-xl bg-bleu px-4 py-3 font-semibold text-paper transition hover:bg-bleu-strong disabled:opacity-60"
          >
            {enCours ? 'Remplissage…' : 'Remplir et télécharger'}
          </button>
        )}
      </div>
    </div>
  );
}
