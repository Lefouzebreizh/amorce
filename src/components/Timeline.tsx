'use client';

import { useRef, useState } from 'react';
import { CAPTION_STYLES } from '@/lib/captions';
import { formatTime } from '@/lib/media';
import { SFX_LIBRARY } from '@/lib/sfx';
import { useStudio } from '@/lib/store';
import { layoutClips } from '@/lib/timeline';
import { TRANSITION_LABELS } from '@/lib/transitions';
import type { PlaybackEngine } from '@/hooks/usePlayback';

/**
 * Timeline.
 *
 * Trois pistes superposées et alignées sur le même axe temporel : les plans, les
 * sous-titres, les bruitages. Voir les trois d'un coup est ce qui rend visible le
 * problème que l'analyse chiffre — un long plan sans texte ni son au-dessus de
 * lui saute aux yeux avant même de lire la note.
 */

/** Échelle d'affichage. Un plan de 2 s occupe ainsi une largeur confortable. */
const PX_PER_SEC = 64;

/**
 * Marge ajoutée à droite de la piste.
 *
 * Les éléments sont positionnés par leur bord gauche à leur instant : le
 * dernier bruitage d'un montage déborderait donc de la largeur calculée, et son
 * intitulé serait tronqué par le défilement horizontal.
 */
const RIGHT_GUTTER = 96;

/** Hauteur réservée en haut pour l'étiquette de la tête de lecture. */
const LABEL_ROW = 14;

export function Timeline({ engine }: { engine: PlaybackEngine }) {
  const clips = useStudio((s) => s.project.clips);
  const captions = useStudio((s) => s.project.captions);
  const cues = useStudio((s) => s.project.cues);
  const assets = useStudio((s) => s.project.assets);
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const moveClip = useStudio((s) => s.moveClip);
  const duration = useStudio((s) => s.duration());

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const placed = layoutClips(clips);
  const width = Math.max(320, duration * PX_PER_SEC + RIGHT_GUTTER);

  const seekFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    engine.seek((event.clientX - bounds.left) / PX_PER_SEC);
  };

  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-slab/40 px-4 py-6 text-center text-xs text-muted">
        La timeline est vide. Ajoute un rush depuis la bibliothèque, à gauche.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-panel/70 p-3">
      <div
        ref={trackRef}
        className="relative select-none"
        style={{ width, paddingTop: LABEL_ROW }}
        onClick={seekFromEvent}
      >
        <TimeRuler duration={duration} />

        {/* Piste des plans */}
        <div className="relative mt-1 h-16">
          {placed.map((item) => {
            const asset = assets.find((a) => a.id === item.clip.assetId);
            const active = selection?.kind === 'clip' && selection.id === item.clip.id;
            return (
              <div
                key={item.clip.id}
                draggable
                onDragStart={() => setDragIndex(item.index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== item.index) moveClip(dragIndex, item.index);
                  setDragIndex(null);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'clip', id: item.clip.id });
                }}
                title={`${asset?.name ?? 'Plan'} — ${item.duration.toFixed(1)} s`}
                className={`absolute top-0 h-16 cursor-grab overflow-hidden rounded-lg border bg-cover bg-center transition-colors active:cursor-grabbing ${
                  active ? 'border-accent ring-1 ring-accent' : 'border-edge hover:border-muted'
                }`}
                style={{
                  left: item.start * PX_PER_SEC,
                  width: Math.max(18, item.duration * PX_PER_SEC),
                  backgroundImage: asset?.thumbnail ? `url(${asset.thumbnail})` : undefined,
                }}
              >
                <div className="flex h-full flex-col justify-between bg-gradient-to-t from-black/85 via-black/30 to-black/50 p-1.5">
                  <span className="truncate text-[10px] font-semibold text-mist">
                    {item.index + 1}. {asset?.name ?? 'Plan'}
                  </span>
                  <span className="text-[10px] text-mist/70">
                    {item.duration.toFixed(1)} s
                    {item.transitionIn > 0 && ` · ${TRANSITION_LABELS[item.clip.transition]}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Piste des sous-titres */}
        <Lane label="Texte">
          {captions.map((caption) => {
            const active = selection?.kind === 'caption' && selection.id === caption.id;
            return (
              <button
                key={caption.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'caption', id: caption.id });
                }}
                title={`${caption.text} — style ${CAPTION_STYLES[caption.style].label}`}
                className={`absolute top-0 h-7 overflow-hidden rounded-md border px-1.5 text-left text-[10px] leading-7 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-accent bg-accent/20 text-mist'
                    : 'border-edge bg-slab text-muted hover:border-muted hover:text-mist'
                }`}
                style={{
                  left: caption.start * PX_PER_SEC,
                  width: Math.max(28, (caption.end - caption.start) * PX_PER_SEC),
                }}
              >
                {caption.text || '(texte vide)'}
              </button>
            );
          })}
        </Lane>

        {/* Piste des bruitages */}
        <Lane label="Son">
          {cues.map((cue) => {
            const active = selection?.kind === 'cue' && selection.id === cue.id;
            const descriptor = SFX_LIBRARY.find((s) => s.id === cue.sfx);
            return (
              <button
                key={cue.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'cue', id: cue.id });
                }}
                title={`${descriptor?.label ?? cue.sfx} à ${cue.time.toFixed(2)} s`}
                className={`absolute top-0 h-7 rounded-md border px-1.5 text-[10px] leading-7 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-accent bg-accent/20 text-mist'
                    : 'border-edge bg-slab text-muted hover:border-muted hover:text-mist'
                }`}
                style={{ left: cue.time * PX_PER_SEC }}
              >
                {descriptor?.label ?? cue.sfx}
              </button>
            );
          })}
        </Lane>

        <Playhead />
      </div>
    </div>
  );
}

function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative mt-1.5 h-7">
      <span className="absolute -left-0 top-0 z-10 hidden text-[10px] text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Graduations, une par seconde. */
function TimeRuler({ duration }: { duration: number }) {
  const ticks = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);
  return (
    <div className="relative h-4 border-b border-edge">
      {ticks.map((second) => (
        <span
          key={second}
          className="absolute top-0 h-4 border-l border-edge pl-1 font-mono text-[9px] leading-4 text-muted"
          style={{ left: second * PX_PER_SEC }}
        >
          {second}s
        </span>
      ))}
    </div>
  );
}

/**
 * Marqueur de lecture, isolé dans son propre composant.
 *
 * Il est le seul élément à changer soixante fois par seconde : le sortir de la
 * timeline évite de recalculer et de retracer toutes les pistes à chaque image.
 */
function Playhead() {
  const playhead = useStudio((s) => s.playhead);
  const x = playhead * PX_PER_SEC;

  return (
    <>
      <div
        className="pointer-events-none absolute bottom-0 z-20 w-px bg-accent"
        style={{ left: x, top: LABEL_ROW }}
      >
        <span className="absolute -top-0.5 -left-1 h-2 w-2 rounded-full bg-accent" />
      </div>

      {/* L'étiquette occupe sa propre bande, au-dessus de la règle des secondes,
          et reste collée au bord gauche tant que la tête n'a pas assez avancé
          pour la centrer sans la faire sortir du cadre. */}
      <span
        className="pointer-events-none absolute top-0 z-20 font-mono text-[9px] leading-none text-accent"
        style={{ left: Math.max(0, x - 16) }}
      >
        {formatTime(playhead)}
      </span>
    </>
  );
}
