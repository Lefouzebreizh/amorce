'use client';

import { useState } from 'react';
import { loadMusicTrack, loadSampleCue, loadVoiceCue } from '@/lib/media';
import { SFX_LIBRARY } from '@/lib/sfx';
import { useStudio } from '@/lib/store';
import { placeOnCuts, placeWithoutOverlap, shotStarts } from '@/lib/timeline';
import type { SampleCue, VoiceCue } from '@/lib/types';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Button, Field, Hint, Panel, Slider } from '../ui';

/**
 * Types acceptés par les sélecteurs de fichiers audio.
 *
 * Les extensions sont listées en plus du type générique : sur Android, le
 * sélecteur ouvert par le seul `audio/*` renvoie régulièrement un fichier de
 * zéro octet quand l'entrée choisie vient d'un espace de stockage en ligne.
 * Nommer les extensions oriente le système vers le fournisseur de documents,
 * qui rend le fichier réel.
 */
const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac';

/**
 * Bruitages et musique.
 *
 * Chaque bruitage s'écoute d'un clic avant d'être posé : entendre vaut mieux que
 * lire un nom, et c'est ce qui évite de couvrir la timeline de sons choisis au
 * hasard puis retirés un par un.
 */
/**
 * Table de mixage.
 *
 * Placée avant la bibliothèque de bruitages, parce que c'est le premier réglage
 * qu'on cherche quand un son ne s'entend pas : ce n'est presque jamais le
 * bruitage qui est trop faible, c'est le fond qui est trop fort.
 */
function MixerPanel() {
  const mix = useStudio((s) => s.project.mix);
  const setMix = useStudio((s) => s.setMix);
  const hasMusic = useStudio((s) => s.project.music !== null);
  const cueCount = useStudio((s) => s.project.cues.length);
  const voiceCount = useStudio((s) => s.project.voices.length);

  // Le niveau d'avant la coupure, pour que la remettre restitue l'équilibre
  // choisi plutôt qu'une valeur arbitraire.
  const [memory, setMemory] = useState<Partial<typeof mix>>({});

  const sources = [
    {
      key: 'clips' as const,
      label: 'Son des vidéos',
      help: 'Le son d’origine de tes rushes. Baisse-le si tes bruitages sont couverts.',
      available: true,
    },
    {
      key: 'sfx' as const,
      label: 'Bruitages',
      help: cueCount === 0 ? 'Aucun bruitage posé pour l’instant.' : `${cueCount} bruitage${cueCount > 1 ? 's' : ''} sur la timeline.`,
      available: cueCount > 0,
    },
    {
      key: 'music' as const,
      label: 'Musique',
      help: hasMusic ? 'Garde-la basse : elle porte l’ambiance, elle ne raconte rien.' : 'Aucune musique importée.',
      available: hasMusic,
    },
    {
      key: 'voice' as const,
      label: 'Voix off',
      help:
        voiceCount === 0
          ? 'Aucune réplique importée.'
          : 'Laisse-la en haut : dès qu’un mot se devine au lieu de s’entendre, le reste ne compte plus.',
      available: voiceCount > 0,
    },
  ];

  return (
    <Panel title="Table de mixage" subtitle="Chaque source se règle séparément.">
      {sources.map((source) => {
        const value = mix[source.key];
        const muted = value === 0;

        return (
          <Field
            key={source.key}
            label={source.label}
            value={muted ? 'coupé' : `${Math.round(value * 100)} %`}
            help={source.help}
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                title={muted ? 'Remettre le son' : 'Couper cette source'}
                onClick={() => {
                  if (muted) setMix({ [source.key]: memory[source.key] ?? 0.75 });
                  else {
                    setMemory((previous) => ({ ...previous, [source.key]: value }));
                    setMix({ [source.key]: 0 });
                  }
                }}
              >
                {muted ? '🔇' : '🔊'}
              </Button>
              <div className="min-w-0 flex-1">
                <Slider
                  ariaLabel={source.label}
                  min={0}
                  max={1}
                  step={0.05}
                  value={value}
                  onChange={(next) => setMix({ [source.key]: next })}
                />
              </div>
            </div>
          </Field>
        );
      })}

      {voiceCount > 0 && (
        <Field
          label="Baisse sous la voix"
          value={mix.ducking === 0 ? 'aucune' : `−${Math.round(mix.ducking * 100)} %`}
          help="Les plans et la musique descendent pendant que tu parles, puis remontent. Les bruitages n’y touchent pas : un impact qui fléchit s’entend comme un défaut."
        >
          <Slider
            ariaLabel="Baisse du fond sous la voix"
            min={0}
            max={1}
            step={0.05}
            value={mix.ducking}
            onChange={(next) => setMix({ ducking: next })}
          />
        </Field>
      )}

      <Hint>
        Ce réglage s’applique à tout le montage et se retrouve tel quel dans le fichier exporté. Pour
        couper le son d’un seul plan, passe par « Réglage fin » dans l’étape Monter.
      </Hint>
    </Panel>
  );
}

/**
 * Bruitages importés.
 *
 * Les sons de synthèse couvrent ce qui est abstrait — une coupe, un souffle,
 * une tension. Ils ne peuvent rien pour ce qui doit être reconnaissable : un
 * rugissement, un coup d'orchestre, une explosion de film. Plutôt que de
 * prétendre le contraire, on laisse déposer les siens à côté.
 */
function SamplePanel() {
  const samples = useStudio((s) => s.project.samples);
  const clips = useStudio((s) => s.project.clips);
  const playhead = useStudio((s) => s.playhead);
  const duration = useStudio((s) => s.duration());
  const addSamples = useStudio((s) => s.addSamples);
  const updateSample = useStudio((s) => s.updateSample);
  const removeSample = useStudio((s) => s.removeSample);

  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel
      title="Tes propres bruitages"
      subtitle="Pour ce qu’aucune synthèse ne sait faire : un rugissement, une explosion, un coup d’orchestre."
    >
      {samples.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {[...samples]
            .sort((a, b) => a.start - b.start)
            .map((sample) => {
              const open = openId === sample.id;

              return (
                <li key={sample.id} className={`rounded-xl ${open ? 'bg-raised' : 'bg-slab'}`}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : sample.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-mist">{sample.name}</span>
                    <span className="font-mono text-[11px] text-muted">{sample.start.toFixed(2)} s</span>
                  </button>

                  {open && (
                    <div className="px-3 pt-1 pb-3">
                      <Field
                        label="Position"
                        value={`${sample.start.toFixed(2)} s`}
                        help="Cale-le très légèrement avant l’image qu’il ponctue : le son doit l’annoncer, pas la suivre."
                      >
                        <Slider
                          ariaLabel="Position du bruitage importé"
                          min={0}
                          max={Math.max(0.1, duration)}
                          step={0.01}
                          value={sample.start}
                          onChange={(value) => updateSample(sample.id, { start: value })}
                        />
                      </Field>

                      <Field
                        label="Volume"
                        help="Le niveau de ce son déposé. Un bruitage se remarque sans couvrir ce qu’il ponctue : poussé au-delà de 80 %, il passe devant la voix."
                        value={`${Math.round(sample.gain * 100)} %`}
                      >
                        <Slider
                          ariaLabel="Volume du bruitage importé"
                          min={0}
                          max={1}
                          step={0.05}
                          value={sample.gain}
                          onChange={(value) => updateSample(sample.id, { gain: value })}
                        />
                      </Field>

                      <Button variant="danger" className="w-full" onClick={() => removeSample(sample.id)}>
                        Retirer
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-edge px-4 py-5 text-center transition-colors hover:border-muted">
        <span className="text-xs font-semibold text-mist">Choisir un ou plusieurs fichiers</span>
        <span className="mt-1 block text-[11px] text-muted">MP3, WAV, M4A — posés sur les coupes, à partir de la lecture</span>
        <input
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          className="hidden"
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            if (files.length === 0) return;

            setError(null);
            try {
              // Une coupe chacun. Contrairement aux répliques de voix ils ont le
              // droit de se superposer, mais empiler trois sons sur le même
              // raccord n'en laisserait entendre qu'un.
              const times = placeOnCuts(shotStarts(clips), files.length, playhead);
              const imported: SampleCue[] = [];
              for (const [index, file] of files.entries()) {
                imported.push(await loadSampleCue(file, times[index] ?? playhead));
              }
              addSamples(imported);
              setOpenId(imported[0]?.id ?? null);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Fichier audio illisible par le navigateur.');
            }
          }}
        />
      </label>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3">
        <Hint>
          Ils passent par la même jauge « Bruitages » que les sons de synthèse, mais sans leur
          compensation de niveau : un fichier arrive déjà réglé, le remonter le ferait saturer.
        </Hint>
      </div>
    </Panel>
  );
}

/**
 * Voix off.
 *
 * Une liste de répliques posées sur la timeline, et pour chacune son texte. Le
 * texte n'est pas là pour la mémoire : c'est lui qu'on répartit sur le signal
 * pour obtenir les sous-titres. Écrire la réplique, c'est donc sous-titrer.
 *
 * Le calage reste un geste explicite, jamais automatique à la frappe. On
 * retouche un texte plusieurs fois de suite, et recaler à chaque lettre
 * remplacerait les sous-titres soixante fois par phrase — pour un résultat
 * intermédiaire qui n'a aucun sens.
 */
function VoicePanel({ engine }: { engine: PlaybackEngine }) {
  const voices = useStudio((s) => s.project.voices);
  const clips = useStudio((s) => s.project.clips);
  const playhead = useStudio((s) => s.playhead);
  const duration = useStudio((s) => s.duration());
  const addVoices = useStudio((s) => s.addVoices);
  const updateVoice = useStudio((s) => s.updateVoice);
  const removeVoice = useStudio((s) => s.removeVoice);
  const alignVoice = useStudio((s) => s.alignVoice);

  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Importe les fichiers choisis et les pose sur les coupes.
   *
   * Une réplique par plan : c'est ainsi qu'un montage court est écrit, et c'est
   * le seul placement qui tombe sur quelque chose. Les enchaîner bout à bout
   * depuis la tête de lecture faisait démarrer la parole au milieu d'un plan,
   * et il fallait ensuite déplacer chaque réplique à la main.
   *
   * Les durées ne sont connues qu'une fois les fichiers décodés : on les charge
   * tous avant de décider où ils vont, faute de quoi on ne saurait pas si l'un
   * déborde sur la coupe suivante.
   */
  const importFiles = async (files: File[]) => {
    setBusy(true);
    setError(null);

    try {
      // Le contexte audio sert à décoder le fichier pour l'analyser ; le clic
      // sur le sélecteur est le geste utilisateur qui autorise sa création.
      const audio = await engine.ensureAudio();
      const loaded: VoiceCue[] = [];
      for (const file of files) loaded.push(await loadVoiceCue(file, audio.context, playhead));

      const times = placeWithoutOverlap(
        shotStarts(clips),
        loaded.map((cue) => cue.duration),
        playhead,
      );
      const imported = loaded.map((cue, index) => ({ ...cue, start: times[index] ?? cue.start }));

      addVoices(imported);
      setOpenId(imported[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Fichier audio illisible par le navigateur.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Voix off"
      subtitle="Un fichier par réplique. Écris ce qui est dit, le studio en fait les sous-titres."
    >
      {voices.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {[...voices]
            .sort((a, b) => a.start - b.start)
            .map((voice) => {
              const open = openId === voice.id;
              const words = voice.script.split(/\s+/).filter(Boolean).length;

              return (
                <li key={voice.id} className={`rounded-xl ${open ? 'bg-raised' : 'bg-slab'}`}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : voice.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-mist">{voice.name}</span>
                    <span className="font-mono text-[11px] text-muted">{voice.start.toFixed(2)} s</span>
                  </button>

                  {open && (
                    <div className="px-3 pt-1 pb-3">
                      <Field
                        label="Ce qui est dit"
                        value={words > 0 ? `${words} mot${words > 1 ? 's' : ''}` : undefined}
                        help="Le texte exact, mot pour mot. C'est lui qui sera réparti sur le signal."
                      >
                        <textarea
                          value={voice.script}
                          rows={3}
                          placeholder="Alerte : le secteur 09 s'effondre…"
                          onChange={(event) => updateVoice(voice.id, { script: event.target.value })}
                          className="w-full resize-none rounded-xl bg-slab px-3 py-2 text-sm text-mist outline-none focus:border-accent"
                        />
                      </Field>

                      <div className="mb-5">
                        <Button
                          variant="primary"
                          className="w-full"
                          disabled={voice.script.trim() === '' || voice.segments.length === 0}
                          onClick={() => alignVoice(voice.id)}
                        >
                          Caler les sous-titres
                        </Button>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                          {voice.segments.length === 0
                            ? 'Le signal de cette réplique n’a pas pu être analysé : elle s’entend, mais il faudra écrire ses sous-titres à la main.'
                            : `${voice.segments.length} passage${voice.segments.length > 1 ? 's' : ''} parlé${
                                voice.segments.length > 1 ? 's' : ''
                              } détecté${voice.segments.length > 1 ? 's' : ''}. Recaler remplace les sous-titres précédents.`}
                        </p>
                      </div>

                      <Field
                        label="Position"
                        value={`${voice.start.toFixed(2)} s`}
                        help="Décale la réplique jusqu’à ce qu’elle tombe sur son plan. Les sous-titres suivront au prochain calage."
                      >
                        <Slider
                          ariaLabel="Position de la réplique"
                          min={0}
                          max={Math.max(0.1, duration)}
                          step={0.05}
                          value={voice.start}
                          onChange={(value) => updateVoice(voice.id, { start: value })}
                        />
                      </Field>

                      <Field
                        label="Volume"
                        help="Le niveau de cette réplique. Les plans et la musique baissent déjà d’eux-mêmes pendant qu’elle parle : inutile de la pousser pour l’entendre."
                        value={`${Math.round(voice.gain * 100)} %`}
                      >
                        <Slider
                          ariaLabel="Volume de la réplique"
                          min={0}
                          max={1}
                          step={0.05}
                          value={voice.gain}
                          onChange={(value) => updateVoice(voice.id, { gain: value })}
                        />
                      </Field>

                      <Button variant="danger" className="w-full" onClick={() => removeVoice(voice.id)}>
                        Supprimer la réplique et ses sous-titres
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-edge px-4 py-5 text-center transition-colors hover:border-muted">
        <span className="text-xs font-semibold text-mist">
          {busy ? 'Analyse en cours…' : 'Choisir un ou plusieurs fichiers'}
        </span>
        <span className="mt-1 block text-[11px] text-muted">MP3, WAV, M4A — une réplique par plan, à partir de la lecture</span>
        <input
          type="file"
          accept={AUDIO_ACCEPT}
          multiple
          className="hidden"
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            if (files.length > 0) await importFiles(files);
          }}
        />
      </label>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-3">
        <Hint>
          Le fichier est analysé dans ton navigateur et n’en sort pas. Le calage suit les silences
          entre les phrases : il est d’autant plus juste que l’enregistrement est propre.
        </Hint>
      </div>
    </Panel>
  );
}

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
    audio.audition(id);
  };

  return (
    <div className="space-y-3">
      <MixerPanel />
      <VoicePanel engine={engine} />
      <SamplePanel />

      <Panel
        title="4 · Bruitages"
        subtitle="Pose-en un sur chaque coupe : c’est ce qui transforme une suite de plans en rythme."
      >
        <ul className="space-y-1.5">
          {SFX_LIBRARY.map((sfx) => (
            <li key={sfx.id} className="flex items-center gap-2 rounded-xl bg-slab p-1.5 pl-3">
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
                    className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                      selected?.id === cue.id ? 'bg-raised ring-1 ring-accent/60' : 'bg-slab hover:bg-raised'
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

          <Field
            label="Volume"
            help="Le niveau de ce bruitage. Il doit se remarquer sans couvrir le mot qu’il ponctue."
            value={`${Math.round(selected.gain * 100)} %`}
          >
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
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-slab px-3 py-2">
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
              accept={AUDIO_ACCEPT}
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try {
                  setMusic(await loadMusicTrack(file));
                  setMusicError(null);
                } catch (cause) {
                  setMusicError(cause instanceof Error ? cause.message : 'Fichier audio illisible par le navigateur.');
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
