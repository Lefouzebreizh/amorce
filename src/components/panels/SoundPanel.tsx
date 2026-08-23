'use client';

import { useState } from 'react';
import { loadMusicTrack } from '@/lib/media';
import { scheduleSfx, SFX_LIBRARY } from '@/lib/sfx';
import { useStudio } from '@/lib/store';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Button, Field, Hint, Panel, Slider } from '../ui';

/**
 * Bruitages et musique.
 *
 * Chaque bruitage s'écoute d'un clic avant d'être posé : entendre vaut mieux que
 * lire un nom, et c'est ce qui évite de couvrir la timeline de sons choisis au
 * hasard puis retirés un par un.
 */
export function SoundPanel({ engine }: { engine: PlaybackEngine }) {
  const cues = useStudio((s) => s.project.cues);
  const music = useStudio((s) => s.project.music);
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const addCue = useStudio((s) => s.addCue);
  const updateCue = useStudio((s) => s.updateCue);
  const removeCue = useStudio((s) => s.removeCue);
  const setMusic = useStudio((s) => s.setMusic);
  const updateMusic = useStudio((s) => s.updateMusic);
  const duration = useStudio((s) => s.duration());

  const [musicError, setMusicError] = useState<string | null>(null);
  const selected = selection?.kind === 'cue' ? cues.find((c) => c.id === selection.id) : undefined;

  const audition = async (id: (typeof SFX_LIBRARY)[number]['id']) => {
    const audio = await engine.ensureAudio();
    scheduleSfx(audio.context, audio.context.destination, id, audio.context.currentTime + 0.02, 0.8);
  };

  return (
    <div className="space-y-3">
      <Panel
        title="4 · Bruitages"
        subtitle="Pose-en un sur chaque coupe : c’est ce qui transforme une suite de plans en rythme."
      >
        <ul className="space-y-1.5">
          {SFX_LIBRARY.map((sfx) => (
            <li key={sfx.id} className="flex items-center gap-2 rounded-xl border border-edge bg-slab p-1.5 pl-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-mist">{sfx.label}</p>
                <p className="text-[11px] text-muted">{sfx.description}</p>
              </div>
              <Button variant="subtle" onClick={() => void audition(sfx.id)} title="Écouter">
                ♪
              </Button>
              <Button variant="ghost" onClick={() => addCue(sfx.id)} title="Poser à la position de lecture">
                +
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-3">
          <Hint>
            Ces sons sont fabriqués à la volée par ton navigateur — ils ne viennent d’aucune
            bibliothèque, donc aucune question de droits ne se pose.
          </Hint>
        </div>
      </Panel>

      {cues.length > 0 && (
        <Panel title="Sons posés" subtitle={`${cues.length} sur la timeline`}>
          <ul className="space-y-1.5">
            {[...cues]
              .sort((a, b) => a.time - b.time)
              .map((cue) => (
                <li key={cue.id}>
                  <button
                    type="button"
                    onClick={() => select({ kind: 'cue', id: cue.id })}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                      selected?.id === cue.id ? 'border-accent bg-accent/10' : 'border-edge bg-slab hover:border-muted'
                    }`}
                  >
                    <span className="text-xs font-semibold text-mist">
                      {SFX_LIBRARY.find((s) => s.id === cue.sfx)?.label ?? cue.sfx}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{cue.time.toFixed(2)} s</span>
                  </button>
                </li>
              ))}
          </ul>
        </Panel>
      )}

      {selected && (
        <Panel
          title="Son sélectionné"
          action={
            <Button variant="danger" onClick={() => removeCue(selected.id)}>
              Supprimer
            </Button>
          }
        >
          <Field
            label="Position"
            value={`${selected.time.toFixed(2)} s`}
            help="Cale-le très légèrement avant la coupe : le son doit annoncer l’image, pas la suivre."
          >
            <Slider
              ariaLabel="Position du bruitage"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.01}
              value={selected.time}
              onChange={(value) => updateCue(selected.id, { time: value })}
            />
          </Field>

          <Field label="Volume" value={`${Math.round(selected.gain * 100)} %`}>
            <Slider
              ariaLabel="Volume du bruitage"
              min={0}
              max={1}
              step={0.05}
              value={selected.gain}
              onChange={(value) => updateCue(selected.id, { gain: value })}
            />
          </Field>
        </Panel>
      )}

      <Panel title="Musique de fond" subtitle="Facultative, mais elle soude les plans entre eux.">
        {music ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-edge bg-slab px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-mist">{music.name}</p>
              <Button variant="subtle" onClick={() => setMusic(null)} title="Retirer la musique">
                ✕
              </Button>
            </div>

            <Field
              label="Volume"
              value={`${Math.round(music.gain * 100)} %`}
              help="Reste bas : la musique porte l’ambiance, elle ne doit pas couvrir le reste."
            >
              <Slider
                ariaLabel="Volume de la musique"
                min={0}
                max={1}
                step={0.05}
                value={music.gain}
                onChange={(value) => updateMusic({ gain: value })}
              />
            </Field>

            <Field
              label="Départ dans le morceau"
              value={`${music.offset.toFixed(1)} s`}
              help="Décale pour tomber sur le refrain plutôt que sur l’introduction."
            >
              <Slider
                ariaLabel="Décalage de la musique"
                min={0}
                max={Math.max(0.1, music.duration - 1)}
                step={0.1}
                value={music.offset}
                onChange={(value) => updateMusic({ offset: value })}
              />
            </Field>
          </>
        ) : (
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-edge px-4 py-5 text-center transition-colors hover:border-muted">
            <span className="text-xs font-semibold text-mist">Choisir un fichier audio</span>
            <span className="mt-1 block text-[11px] text-muted">MP3, WAV, M4A</span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try {
                  setMusic(await loadMusicTrack(file));
                  setMusicError(null);
                } catch {
                  setMusicError('Fichier audio illisible par le navigateur.');
                }
              }}
            />
          </label>
        )}

        {musicError && <p className="mt-2 text-xs text-danger">{musicError}</p>}
      </Panel>
    </div>
  );
}
