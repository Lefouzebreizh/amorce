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
export function Preview({ engine }: { engine: PlaybackEngine }) {
  const playing = useStudio((s) => s.playing);
  const clipCount = useStudio((s) => s.project.clips.length);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        <canvas
          ref={canvasRef}
          width={OUTPUT_WIDTH}
          height={OUTPUT_HEIGHT}
          onClick={engine.toggle}
          aria-label="Prévisualisation du montage"
          className="h-full max-h-full w-auto cursor-pointer rounded-2xl border border-edge bg-black shadow-2xl shadow-black/60"
          style={{ aspectRatio: '9 / 16' }}
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
      className="w-full max-w-md shrink-0 rounded-2xl border border-edge bg-panel/70 px-3 py-2.5"
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

        <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
          {formatTime(playhead)} / {formatTime(duration)}
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
