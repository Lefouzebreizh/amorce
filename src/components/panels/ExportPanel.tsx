'use client';

import { useState } from 'react';
import { downloadBlob, pickFormat, recordMontage, safeFilename } from '@/lib/export';
import { formatTime } from '@/lib/media';
import { useStudio } from '@/lib/store';
import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from '@/lib/types';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { Button, Hint, Panel } from '../ui';

/**
 * Export.
 *
 * L'enregistrement se fait en temps réel : la barre de progression avance à la
 * vitesse de la vidéo, sans accélération possible. Le dire à l'avance évite que
 * l'utilisateur croie à un blocage et recharge la page en plein export.
 */
export function ExportPanel({ engine }: { engine: PlaybackEngine }) {
  const project = useStudio((s) => s.project);
  const duration = useStudio((s) => s.duration());
  const renameProject = useStudio((s) => s.renameProject);

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const format = pickFormat();
  const busy = progress !== null;

  const run = async () => {
    const canvas = engine.getCanvas();
    if (!canvas || duration <= 0) return;

    setError(null);
    setDone(null);
    setProgress(0);

    try {
      const audio = await engine.ensureAudio();
      engine.seek(0);

      const result = await recordMontage({
        canvas,
        audio,
        duration,
        startPlayback: engine.play,
        stopPlayback: engine.pause,
        currentTime: () => useStudio.getState().playhead,
        isPlaying: () => useStudio.getState().playing,
        onProgress: setProgress,
      });

      const filename = safeFilename(project.name, result.format.extension);
      downloadBlob(result.blob, filename);
      setDone(`${filename} — ${(result.blob.size / 1024 / 1024).toFixed(1)} Mo`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’export a échoué.');
    } finally {
      setProgress(null);
      engine.pause();
    }
  };

  return (
    <div className="space-y-3">
      <Panel title="7 · Exporter" subtitle={`${OUTPUT_WIDTH} × ${OUTPUT_HEIGHT}, ${OUTPUT_FPS} images par seconde.`}>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-mist">Nom du fichier</span>
          <input
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            className="w-full rounded-xl border border-edge bg-slab px-3 py-2 text-sm text-mist outline-none focus:border-accent"
          />
        </label>

        <Button variant="primary" className="w-full" onClick={run} disabled={busy || duration <= 0 || !format}>
          {busy ? `Enregistrement… ${Math.round((progress ?? 0) * 100)} %` : '⬇ Exporter la vidéo'}
        </Button>

        {busy && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slab">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        )}

        {done && (
          <p className="mt-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
            Fichier téléchargé : {done}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        <dl className="mt-3 space-y-1 border-t border-edge pt-3 text-[11px] text-muted">
          <Row label="Durée">{formatTime(duration)}</Row>
          <Row label="Format">{format ? format.label : 'non pris en charge'}</Row>
          <Row label="Temps d’export">environ {formatTime(duration)}</Row>
        </dl>
      </Panel>

      {duration > 60 && (
        <Hint tone="warn">
          {formatTime(duration)}, c’est long pour du format vertical. En dessous de 35 secondes, la part
          de spectateurs qui vont jusqu’au bout monte nettement — et c’est ce taux qui décide de ta
          diffusion.
        </Hint>
      )}

      {!format && (
        <Hint tone="warn">
          Ce navigateur ne sait pas enregistrer de vidéo. Utilise Chrome, Edge ou Firefox à jour.
        </Hint>
      )}

      <Hint>
        L’export filme la prévisualisation pendant qu’elle joue : il dure donc aussi longtemps que ta
        vidéo, et tu l’entends défiler. Ne change pas d’onglet pendant ce temps, certains navigateurs
        ralentissent les onglets en arrière-plan.
      </Hint>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-mono text-mist">{children}</dd>
    </div>
  );
}
