/* eslint-disable @next/next/no-img-element -- Les vignettes sont des data URL
   de 160 px déjà produites côté client : next/image n'aurait ni requête à
   optimiser, ni redimensionnement à faire. */
'use client';

import { useRef, useState } from 'react';
import { applyAutoEdit, PLANS_MAX } from '@/lib/autoEdit';
import { formatTime, loadAsset, loadSampleCue, loadVoiceCue } from '@/lib/media';
import { isVisuel, toFile } from '@/lib/share';
import { useStudio } from '@/lib/store';
import { placeOnCuts, placeWithoutOverlap, shotStarts } from '@/lib/timeline';
import { useIsHydrated } from '@/hooks/useMediaQuery';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Button, EmptyState, Hint, Panel } from '../ui';

/**
 * Fichiers arrivés par le bouton « Partager ».
 *
 * Rien dans un fichier audio ne dit s'il s'agit d'une réplique ou d'un bruitage.
 * Deviner mènerait la moitié du temps au mauvais panneau, où l'utilisateur ne
 * les chercherait pas : on demande, une fois pour le lot entier. Les vidéos et
 * les images, elles, n'ont aucune ambiguïté et rejoignent la bibliothèque quoi
 * qu'il arrive.
 */
function SharedTray({ engine }: { engine: PlaybackEngine }) {
  const shared = useStudio((s) => s.sharedFiles);
  const setShared = useStudio((s) => s.setSharedFiles);
  const clips = useStudio((s) => s.project.clips);
  const playhead = useStudio((s) => s.playhead);
  const addAssets = useStudio((s) => s.addAssets);
  const addVoices = useStudio((s) => s.addVoices);
  const addSamples = useStudio((s) => s.addSamples);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (shared.length === 0) return null;

  const visuels = shared.filter(isVisuel);
  const sounds = shared.filter((file) => !isVisuel(file));

  const accept = async (kind: 'voix' | 'bruitage') => {
    setBusy(true);
    setError(null);

    try {
      if (visuels.length > 0) {
        const assets = [];
        for (const file of visuels) assets.push(await loadAsset(toFile(file)));
        addAssets(assets);
      }

      if (sounds.length > 0 && kind === 'voix') {
        const audio = await engine.ensureAudio();
        const loaded = [];
        for (const file of sounds) loaded.push(await loadVoiceCue(toFile(file), audio.context, playhead));

        const times = placeWithoutOverlap(shotStarts(clips), loaded.map((cue) => cue.duration), playhead);
        addVoices(loaded.map((cue, index) => ({ ...cue, start: times[index] ?? cue.start })));
      }

      if (sounds.length > 0 && kind === 'bruitage') {
        const times = placeOnCuts(shotStarts(clips), sounds.length, playhead);
        const loaded = [];
        for (const [index, file] of sounds.entries()) {
          loaded.push(await loadSampleCue(toFile(file), times[index] ?? playhead));
        }
        addSamples(loaded);
      }

      setShared([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fichier illisible par le navigateur.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={`${shared.length} fichier${shared.length > 1 ? 's' : ''} reçu${shared.length > 1 ? 's' : ''} par partage`}
      subtitle="Dis-moi ce que c'est, et je les place sur les coupes."
      action={
        <Button variant="ghost" onClick={() => setShared([])} title="Ignorer ces fichiers">
          Ignorer
        </Button>
      }
    >
      <ul className="mb-3 space-y-1.5">
        {shared.map((file, index) => (
          <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl bg-slab px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-mist">{file.name}</span>
            <span className="font-mono text-[11px] text-muted">{Math.round(file.blob.size / 1024)} Ko</span>
          </li>
        ))}
      </ul>

      {sounds.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="primary" disabled={busy} onClick={() => void accept('voix')}>
            Ce sont des voix
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void accept('bruitage')}>
            Ce sont des bruitages
          </Button>
        </div>
      ) : (
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void accept('voix')}>
          Ajouter à la bibliothèque
        </Button>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Panel>
  );
}

/**
 * Import des rushes et bibliothèque.
 *
 * Le montage express est ici, au plus près de l'import : c'est le chemin le plus
 * court entre « j'ai des fichiers » et « j'ai une vidéo », et c'est celui que
 * prendra quiconque n'a jamais monté.
 */
export function ImportPanel({ engine }: { engine: PlaybackEngine }) {
  const assets = useStudio((s) => s.project.assets);
  const storageError = useStudio((s) => s.storageError);
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
    const visuels = [...files].filter(
      (file) => file.type.startsWith('video/') || file.type.startsWith('image/'),
    );
    if (visuels.length === 0) {
      setError('Aucun fichier reconnu. Vidéos : MP4, MOV, WebM. Images : PNG, JPEG, WebP.');
      return;
    }

    setError(null);
    const failed: string[] = [];

    for (const [index, file] of visuels.entries()) {
      setBusy({ done: index, total: visuels.length });
      try {
        // Le type MIME choisit le décodeur : tenter une image avec un élément
        // <video> rendrait « format non pris en charge » sur un fichier sain.
        const asset = await loadAsset(file);
        // Chaque fichier rejoint la bibliothèque dès qu'il est prêt : attendre
        // le dernier pour tout afficher donne l'impression que rien n'avance.
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
      {/* En tête : c'est ce bloc qui a fait basculer l'utilisateur sur cette
          étape, le reléguer sous la zone d'import le mettrait hors de vue. */}
      <SharedTray engine={engine} />

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
                ? `Lecture du fichier ${busy.done + 1} sur ${busy.total}…`
                : 'Dépose tes vidéos ou tes images ici'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {!ready
              ? 'Encore un instant, l’application se met en place.'
              : busy
                ? 'Cela peut prendre un moment sur téléphone.'
                : 'ou clique pour les choisir · MP4, MOV, WebM · PNG, JPEG, WebP'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,image/*"
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

      {storageError && assets.length > 0 && (
        <Hint tone="warn">{storageError}</Hint>
      )}

      {assets.length > 0 && (
        <Panel
          title="Montage express"
          subtitle="Assemble tout automatiquement : plans courts, transitions, bruitages, rendu cinéma."
        >
          <Button variant="primary" className="w-full" onClick={autoEdit}>
            ⚡ Monter automatiquement (
            {assets.length > PLANS_MAX
              ? `${PLANS_MAX} des ${assets.length} rushes`
              : `${assets.length} rush${assets.length > 1 ? 'es' : ''}`}
            )
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Point de départ, pas résultat final : chaque plan reste modifiable ensuite. Attention, cela
            remplace le montage en cours.
          </p>
          {/*
            Le bouton dit combien il prend, et cette phrase dit pourquoi.
            Un montage qui écarterait des rushes sans le dire passerait pour un
            bogue — et un montage qui les prendrait tous dépasserait les
            trente-cinq secondes au-delà desquelles l'analyse elle-même
            pénalise le film.
          */}
          {assets.length > PLANS_MAX && (
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Les {assets.length - PLANS_MAX} autres restent dans ta bibliothèque : au-delà, le
              montage dépasse 35 s et on décroche avant la fin.
            </p>
          )}
        </Panel>
      )}

      {/*
        Sans cette consigne, la cible de partage resterait dormante : Android ne
        la propose qu'à une application installée, et rien dans l'interface ne
        laisserait deviner qu'elle existe.
      */}
      <Panel
        title="Un fichier refusé, ou arrivé vide ?"
        subtitle="Le sélecteur d’Android rend parfois un fichier de zéro octet quand il vient du nuage."
      >
        <Hint>
          Installe Amorce sur ton écran d’accueil — menu de ton navigateur, « Installer
          l’application ». Tu pourras alors envoyer tes fichiers par le bouton <b>Partager</b> depuis
          ton gestionnaire de fichiers : ce chemin transmet les octets réels, et il aboutit là où le
          sélecteur échoue. Rien ne part pour autant sur un serveur, le partage est reçu par ton
          navigateur.
        </Hint>
      </Panel>

      <Panel title="Bibliothèque" subtitle={`${assets.length} rush${assets.length > 1 ? 'es' : ''} importé${assets.length > 1 ? 's' : ''}`}>
        {assets.length === 0 ? (
          <EmptyState title="Rien pour l’instant">
            Importe tes vidéos IA ci-dessus. Une dizaine de plans de 2 à 5 secondes suffit largement.
            Une illustration, une page, une capture font aussi bien l’affaire : une image fixe devient
            un plan qu’un mouvement de caméra fait vivre.
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
                <Button variant="ghost" onClick={() => removeAsset(asset.id)} title="Retirer de la bibliothèque">
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
