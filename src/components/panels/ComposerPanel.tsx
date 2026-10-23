'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { musicPrompt } from '@/lib/song';
import type { SongDraft, SyncedLyricLine } from '@/lib/types';
import { Button, Field, Hint, Panel } from '../ui';
import type { StepId } from '@/lib/steps';

const INPUT = 'w-full rounded-xl border border-edge bg-slab px-3 py-2.5 text-lg text-mist placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
type SongTextField = Exclude<keyof SongDraft, 'lyricTiming'>;

export function ComposerPanel({ onStep }: { onStep: (step: StepId) => void }) {
  const draft = useStudio((s) => s.project.song) ?? { title: '', lyrics: '', style: '', mood: '', voice: '' };
  const music = useStudio((s) => s.project.music);
  const update = useStudio((s) => s.updateSongDraft);
  const createSongCaptions = useStudio((s) => s.createSongCaptions);
  const playhead = useStudio((s) => s.playhead);
  const duration = useStudio((s) => s.duration());
  const hasClips = useStudio((s) => s.project.clips.length > 0);
  const [retour, setRetour] = useState('');
  const [showBrief, setShowBrief] = useState(false);
  const brief = musicPrompt(draft);
  const words = draft.lyrics.trim() ? draft.lyrics.trim().split(/\s+/).length : 0;
  const lines = draft.lyrics.split('\n').map((text) => text.trim()).filter(Boolean);
  const timingIsCurrent = draft.lyricTiming?.sourceText === draft.lyrics;
  const timedLines: SyncedLyricLine[] = timingIsCurrent ? draft.lyricTiming!.lines : [];
  const maxTime = music && duration > 0 ? Math.min(music.offset + music.duration, duration) : 0;
  const readyToCaption = Boolean(
    timingIsCurrent
    && music
    && hasClips
    && timedLines.length > 0
    && timedLines.every((line) =>
      line.start !== null
      && line.end !== null
      && Number.isFinite(line.start)
      && Number.isFinite(line.end)
      && line.start >= music.offset
      && line.end > line.start
      && line.end <= maxTime
    ),
  );

  const field = (key: SongTextField, label: string, placeholder: string, help: string) => (
    <Field label={label} help={help}>
      <input
        className={INPUT}
        value={draft[key]}
        onChange={(event) => update({ [key]: event.target.value })}
        placeholder={placeholder}
        aria-label={label}
      />
    </Field>
  );

  async function copier() {
    try {
      await navigator.clipboard.writeText(brief);
      setRetour('Brief copié. Tu peux le coller dans ton outil musical.');
    } catch {
      setShowBrief(true);
      setRetour('La copie automatique est bloquée par le navigateur. Sélectionne le brief affiché puis copie-le.');
    }
  }

  return (
    <div className="space-y-3">
      <Panel title="3 · Composer le morceau" subtitle="Garde paroles, intention et montage réunis dans le même projet.">
        <div className="mb-4 rounded-xl border border-accent/25 bg-accent/5 p-3">
          <p className="text-sm font-semibold text-accent">Ton atelier d’écriture</p>
          <p className="mt-1 text-sm leading-relaxed text-mist">
            Tes notes restent dans le projet enregistré sur cet appareil. Elles ne sont envoyées nulle part.
          </p>
        </div>

        {field('title', 'Titre du morceau', 'Ex. Les mots qui pansent', 'Un titre de travail suffit ; tu pourras le changer à tout moment.')}
        {field('style', 'Direction musicale', 'Ex. slam parlé, refrain chanté, piano et beat inspirant', 'Décris le son que tu imagines, avec tes mots.')}
        {field('mood', 'Émotion et énergie', 'Ex. intime au début, puis libérateur', 'Quelques adjectifs aident à garder une intention cohérente.')}
        {field('voice', 'Voix et interprétation', 'Ex. voix grave, proche, articulation naturelle', 'Indique le type de voix et la façon de l’interpréter.')}

        <Field label="Paroles" value={`${words} mot${words === 1 ? '' : 's'}`} help="Écris couplets, refrain et pont comme tu veux les entendre. Les retours à la ligne sont conservés dans le brief.">
          <textarea
            className={`${INPUT} min-h-64 resize-y leading-relaxed`}
            value={draft.lyrics}
            onChange={(event) => update({ lyrics: event.target.value })}
            placeholder={'Couplet 1…\n\nRefrain…\n\nCouplet 2…'}
            aria-label="Paroles du morceau"
            spellCheck
          />
        </Field>

        <div className="space-y-2">
          <Button variant="primary" className="min-h-12 w-full" onClick={() => { setShowBrief(true); setRetour(''); }}>
            Préparer le brief musical
          </Button>
          <p className="text-sm leading-relaxed text-muted">
            Amorce prépare ici ton brief. La génération audio intégrée n’est pas encore disponible : tu peux utiliser ce texte dans Suno ou un autre outil, puis importer le morceau ci-dessous.
          </p>
        </div>
      </Panel>

      {showBrief && (
        <Panel title="Brief prêt à utiliser" subtitle="Relis-le, puis copie-le vers ton générateur musical.">
          <textarea
            className={`${INPUT} min-h-56 resize-y leading-relaxed`}
            value={brief}
            readOnly
            aria-label="Brief musical à copier"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={copier}>Copier le brief</Button>
          {retour && <p role="status" className="mt-2 text-sm text-accent">{retour}</p>}
        </Panel>
      )}

      <Panel title="Relier la musique au clip" subtitle="Une fois ton morceau prêt, importe-le ici pour le mixer et le monter avec tes images.">
        {music ? (
          <Hint>{`Piste prête : ${music.name}. Tu peux régler son niveau dans Son.`}</Hint>
        ) : (
          <p className="text-sm leading-relaxed text-muted">Aucune piste importée pour le moment. Ton brief et tes paroles restent enregistrés dans le projet pendant que tu crées le son ailleurs.</p>
        )}
        <Button variant="ghost" className="mt-3 min-h-12 w-full" onClick={() => onStep('son')}>
          {music ? 'Ouvrir le mixage' : 'Importer ma piste dans Son'}
        </Button>
      </Panel>

      <Panel title="Caler les paroles sur le clip" subtitle="Marque le début et la fin de chaque ligne pendant l’écoute. Les mots seront répartis entre ces deux repères.">
        {lines.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">Ajoute les paroles plus haut pour préparer leur calage.</p>
        ) : !music || !hasClips ? (
          <Hint tone="warn">Importe la piste dans Son et ajoute tes images ou tes vidéos. Tu pourras ensuite écouter le montage et marquer chaque ligne au bon moment.</Hint>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-muted">
              Lance la lecture, puis touche « Début ici » et « Fin ici » au passage de chaque ligne. Les limites de ligne suivent tes repères ; le temps de chaque mot est estimé selon sa longueur et reste ajustable dans Accroche. Amorce ne reconnaît pas encore automatiquement les paroles chantées.
            </p>
            {!timingIsCurrent ? (
              <Button
                variant="ghost"
                className="min-h-12 w-full"
                onClick={() => update({ lyricTiming: { sourceText: draft.lyrics, lines: lines.map((text) => ({ text, start: null, end: null })) } })}
              >
                Préparer le calage de {lines.length} ligne{lines.length > 1 ? 's' : ''}
              </Button>
            ) : (
              <div className="space-y-2.5">
                {timedLines.map((line, index) => (
                  <div key={`${index}-${line.text}`} className="rounded-xl bg-slab p-3">
                    <p className="mb-2 text-sm font-semibold leading-relaxed text-mist">{line.text}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`lyric-start-${index}`} className="mb-1 block text-base text-muted">Début (secondes)</label>
                        <input
                          id={`lyric-start-${index}`}
                          className={INPUT}
                          type="number"
                          min={music?.offset ?? 0}
                          max={maxTime}
                          step="0.1"
                          value={line.start ?? ''}
                          onChange={(event) => {
                            const value = event.target.value === '' ? null : Number(event.target.value);
                            const updated = timedLines.map((item, i) => i === index ? { ...item, start: value } : item);
                            update({ lyricTiming: { sourceText: draft.lyrics, lines: updated } });
                          }}
                        />
                        <Button variant="ghost" className="mt-1 min-h-11 w-full text-sm" onClick={() => {
                          const updated = timedLines.map((item, i) => i === index ? { ...item, start: Math.round(playhead * 10) / 10 } : item);
                          update({ lyricTiming: { sourceText: draft.lyrics, lines: updated } });
                        }}>Début ici · {playhead.toFixed(1)} s</Button>
                      </div>
                      <div>
                        <label htmlFor={`lyric-end-${index}`} className="mb-1 block text-base text-muted">Fin (secondes)</label>
                        <input
                          id={`lyric-end-${index}`}
                          className={INPUT}
                          type="number"
                          min={music?.offset ?? 0}
                          max={maxTime}
                          step="0.1"
                          value={line.end ?? ''}
                          onChange={(event) => {
                            const value = event.target.value === '' ? null : Number(event.target.value);
                            const updated = timedLines.map((item, i) => i === index ? { ...item, end: value } : item);
                            update({ lyricTiming: { sourceText: draft.lyrics, lines: updated } });
                          }}
                        />
                        <Button variant="ghost" className="mt-1 min-h-11 w-full text-sm" onClick={() => {
                          const updated = timedLines.map((item, i) => i === index ? { ...item, end: Math.round(playhead * 10) / 10 } : item);
                          update({ lyricTiming: { sourceText: draft.lyrics, lines: updated } });
                        }}>Fin ici · {playhead.toFixed(1)} s</Button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="primary"
                  className="min-h-12 w-full"
                  disabled={!readyToCaption}
                  onClick={() => { createSongCaptions(timedLines); onStep('texte'); }}
                >
                  Créer les sous-titres synchronisés
                </Button>
                {!readyToCaption && <p className="text-sm text-muted">Marque des repères valides pour chaque ligne, dans la durée du clip et de la musique.</p>}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
