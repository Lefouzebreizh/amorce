'use client';

import { useEffect, useRef } from 'react';
import { useStudio } from '@/lib/store';
import { formatTime } from '@/lib/media';
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from '@/lib/types';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Button } from './ui';

/**
 * Lecteur de prévisualisation.
 *
 * Le canvas conserve toujours sa définition de sortie réelle — 1080 × 1920 — et
 * n'est réduit que par CSS. Rendre dans un canvas plus petit ferait mentir la
 * prévisualisation sur la taille des sous-titres et sur la finesse du grain,
 * deux choses qui ne pardonnent pas à l'export.
 */
/** Déplacement en dessous duquel un geste reste un simple appui. */
const DRAG_THRESHOLD_PX = 6;

export function Preview({ engine }: { engine: PlaybackEngine }) {
  const playing = useStudio((s) => s.playing);
  const clipCount = useStudio((s) => s.project.clips.length);
  const select = useStudio((s) => s.select);
  const updateCaption = useStudio((s) => s.updateCaption);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Sous-titre saisi, et distance parcourue depuis l'appui initial. */
  const gesture = useRef<{ id: string | null; startY: number; moved: boolean } | null>(null);

  // Le canvas appartient à ce composant, qui le déclare au moteur une fois posé
  // dans le document. Le moteur n'a ainsi aucune ref à faire transiter.
  useEffect(() => {
    engine.setCanvas(canvasRef.current);
    return () => engine.setCanvas(null);
  }, [engine]);

  return (
    /*
     * Les hauteurs minimales ne sont pas décoratives : sans elles, un panneau
     * ouvert sur un téléphone dont la barre d'adresse mange déjà l'écran ne
     * laisse plus assez de place, l'aperçu s'écrase à zéro et la barre de
     * lecture déborde par-dessus la timeline.
     */
    <div className="flex min-h-[11rem] flex-1 flex-col items-center gap-2 overflow-hidden">
      <div className="relative flex min-h-[6rem] flex-1 items-center justify-center overflow-hidden">
        {/*
          Le canvas n'a pas d'enfants : un texte qui y est dessiné n'est pas un
          élément du document et ne peut donc pas recevoir d'évènement. La
          sélection passe par la table des rectangles remplie à chaque image, et
          le geste est interprété ici : un appui sélectionne, un glissement
          déplace, un appui hors texte lance ou arrête la lecture.
        */}
        <canvas
          ref={canvasRef}
          width={OUTPUT_WIDTH}
          height={OUTPUT_HEIGHT}
          aria-label="Prévisualisation du montage — touche un texte pour le régler"
          // Ni bordure ni cadre : ce qui compte ici est l'image, et un contour
          // la met au même rang que les panneaux qui l'entourent.
          className="h-full max-h-full w-auto max-w-full cursor-pointer touch-none rounded-[20px] bg-black shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)]"
          style={{ aspectRatio: '9 / 16' }}
          onPointerDown={(event) => {
            const id = engine.captionAt(event.clientX, event.clientY);
            gesture.current = { id, startY: event.clientY, moved: false };

            if (id) {
              // Saisir le pointeur garantit de recevoir les mouvements même si
              // le doigt sort du canvas en cours de glissement.
              event.currentTarget.setPointerCapture(event.pointerId);
              select({ kind: 'caption', id });
            }
          }}
          onPointerMove={(event) => {
            const current = gesture.current;
            if (!current?.id) return;

            if (!current.moved && Math.abs(event.clientY - current.startY) < DRAG_THRESHOLD_PX) return;
            current.moved = true;
            updateCaption(current.id, { y: engine.toRelativeY(event.clientY) });
          }}
          onPointerUp={(event) => {
            const current = gesture.current;
            gesture.current = null;
            if (current?.id) {
              event.currentTarget.releasePointerCapture(event.pointerId);
              return;
            }
            // Appui en dehors de tout texte : le canvas retrouve son rôle de
            // bouton de lecture.
            if (!current?.moved) engine.toggle();
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        />
        {clipCount === 0 && (
          // Message volontairement court et tronqué : dans un aperçu réduit à
          // quelques centimètres, un paragraphe déborderait par-dessus l'en-tête
          // et la barre de lecture.
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-4">
            <p className="line-clamp-3 max-w-[15rem] text-center text-xs leading-relaxed text-muted">
              Importe tes vidéos pour voir le montage ici.
            </p>
          </div>
        )}
      </div>

      <Transport engine={engine} playing={playing} />
    </div>
  );
}

function Transport({ engine, playing }: { engine: PlaybackEngine; playing: boolean }) {
  const playhead = useStudio((s) => s.playhead);
  const clips = useStudio((s) => s.project.clips);
  const splitClip = useStudio((s) => s.splitClipAtPlayhead);
  const duration = useStudio((s) => s.duration());
  const disabled = clips.length === 0;

  return (
    <div
      role="group"
      aria-label="Commandes de lecture"
      className="w-full max-w-md shrink-0 rounded-2xl bg-panel px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={engine.toggle} disabled={disabled} title="Espace">
          {playing ? '❚❚' : '▶'}
        </Button>

        <input
          type="range"
          className="min-w-0 flex-1"
          min={0}
          max={Math.max(0.01, duration)}
          step={0.01}
          value={Math.min(playhead, duration)}
          disabled={disabled}
          aria-label="Position dans le montage"
          onChange={(event) => engine.seek(Number(event.target.value))}
        />

        <span className="shrink-0 font-mono text-[13px] tabular-nums">
          <span className="text-mist">{formatTime(playhead)}</span>
          <span className="text-muted"> / {formatTime(duration)}</span>
        </span>

        <Button
          variant="ghost"
          onClick={splitClip}
          disabled={disabled}
          title="Couper le plan à la position de lecture (touche S)"
        >
          ✂
        </Button>
      </div>
    </div>
  );
}
