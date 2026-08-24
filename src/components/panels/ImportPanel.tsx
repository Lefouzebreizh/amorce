/* eslint-disable @next/next/no-img-element -- Les vignettes sont des data URL
   de 160 px déjà produites côté client : next/image n'aurait ni requête à
   optimiser, ni redimensionnement à faire. */
'use client';

import { useRef, useState } from 'react';
import { applyAutoEdit } from '@/lib/autoEdit';
import { formatTime, loadVideoAsset } from '@/lib/media';
import { useStudio } from '@/lib/store';
import { useIsHydrated } from '@/hooks/useMediaQuery';
import { Button, EmptyState, Hint, Panel } from '../ui';

/**
 * Import des rushes et bibliothèque.
 *
 * Le montage express est ici, au plus près de l'import : c'est le chemin le plus
 * court entre « j'ai des fichiers » et « j'ai une vidéo », et c'est celui que
 * prendra quiconque n'a jamais monté.
 */
export function ImportPanel() {
  const assets = useStudio((s) => s.project.assets);
  const clips = useStudio((s) => s.project.clips);
  const addAssets = useStudio((s) => s.addAssets);
  const removeAsset = useStudio((s) => s.removeAsset);
  const appendClip = useStudio((s) => s.appendClip);

  /**
   * Avancement de l'import, ou null au repos.
   *
   * Décoder une vidéo prend plusieurs secondes sur un téléphone : sans compteur,
   * l'utilisateur ne distingue pas une application qui travaille d'une
   * application bloquée, et recommence ou ferme l'onglet.
   */
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = useIsHydrated();

  const ingest = async (files: FileList | File[]) => {
    const videos = [...files].filter((file) => file.type.startsWith('video/'));
    if (videos.length === 0) {
      setError('Aucun fichier vidéo reconnu. Formats attendus : MP4, MOV, WebM.');
      return;
    }

    setError(null);
    const loaded = [];
    const failed: string[] = [];

    for (const [index, file] of videos.entries()) {
      setBusy({ done: index, total: videos.length });
      try {
        const asset = await loadVideoAsset(file);
        loaded.push(asset);
        // Chaque rush rejoint la bibliothèque dès qu'il est prêt : attendre le
        // dernier pour tout afficher donne l'impression que rien n'avance.
        addAssets([asset]);
      } catch {
        failed.push(file.name);
      }
    }

    // On importe ce qui passe et on nomme ce qui échoue, plutôt que de tout
    // rejeter parce qu'un seul fichier pose problème.
    if (failed.length > 0) setError(`Fichiers illisibles : ${failed.join(', ')}`);
    setBusy(null);
  };

  const autoEdit = () => {
    const state = useStudio.getState();
    const next = applyAutoEdit(state.project);
    useStudio.setState({ project: next, selection: null, playhead: 0, playing: false });
  };

  return (
    <div className="space-y-3">
      <Panel
        title="1 · Importer"
        subtitle="Tes fichiers restent sur ton ordinateur : rien n’est envoyé sur un serveur."
      >
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void ingest(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            !ready
              ? 'cursor-wait border-edge opacity-60'
              : dragging
                ? 'cursor-pointer border-accent bg-accent/5'
                : 'cursor-pointer border-edge hover:border-muted'
          }`}
        >
          <p className="text-sm font-semibold text-mist">
            {!ready
              ? 'Préparation du studio…'
              : busy
                ? `Lecture de la vidéo ${busy.done + 1} sur ${busy.total}…`
                : 'Dépose tes vidéos ici'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {!ready
              ? 'Encore un instant, l’application se met en place.'
              : busy
                ? 'Cela peut prendre un moment sur téléphone.'
                : 'ou clique pour les choisir · MP4, MOV, WebM'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void ingest(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {error && (
          <p className="mt-2 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>
        )}
      </Panel>

      {assets.length > 0 && (
        <Panel
          title="Montage express"
          subtitle="Assemble tout automatiquement : plans courts, transitions, bruitages, rendu cinéma."
        >
          <Button variant="primary" className="w-full" onClick={autoEdit}>
            ⚡ Monter automatiquement ({assets.length} rush{assets.length > 1 ? 'es' : ''})
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Point de départ, pas résultat final : chaque plan reste modifiable ensuite. Attention, cela
            remplace le montage en cours.
          </p>
        </Panel>
      )}

      <Panel title="Bibliothèque" subtitle={`${assets.length} rush${assets.length > 1 ? 'es' : ''} importé${assets.length > 1 ? 's' : ''}`}>
        {assets.length === 0 ? (
          <EmptyState title="Rien pour l’instant">
            Importe tes vidéos IA ci-dessus. Une dizaine de plans de 2 à 5 secondes suffit largement.
          </EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-2.5 rounded-xl bg-slab p-1.5"
              >
                {asset.thumbnail ? (
                  <img
                    src={asset.thumbnail}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-panel" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-mist">{asset.name}</p>
                  <p className="text-[11px] text-muted">
                    {formatTime(asset.duration)} · {asset.width}×{asset.height}
                    {asset.height < asset.width && ' · horizontal'}
                  </p>
                </div>

                <Button variant="ghost" onClick={() => appendClip(asset.id)} title="Ajouter à la timeline">
                  +
                </Button>
                <Button variant="subtle" onClick={() => removeAsset(asset.id)} title="Retirer de la bibliothèque">
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        )}

        {assets.some((a) => a.height < a.width) && clips.length > 0 && (
          <div className="mt-3">
            <Hint tone="warn">
              Certains rushes sont horizontaux. Ils seront recadrés au centre pour remplir le format
              vertical : ce qui se trouve sur les côtés sera coupé.
            </Hint>
          </div>
        )}
      </Panel>
    </div>
  );
}
