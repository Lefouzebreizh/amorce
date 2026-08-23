'use client';

import { useStudio } from '@/lib/store';
import { clipDuration } from '@/lib/timeline';
import { TRANSITION_LABELS } from '@/lib/transitions';
import { MIN_CLIP_DURATION, type ClipMotion, type TransitionKind } from '@/lib/types';
import { Actions, Button, Choice, Collapsible, EmptyState, Field, Hint, Panel, Slider } from '../ui';

/**
 * Réglages du plan sélectionné.
 *
 * L'ordre est délibéré : d'abord des gestes qui produisent un résultat
 * prévisible en un appui, ensuite seulement les jauges, repliées.
 *
 * Une jauge demande de choisir une valeur — « quel point de sortie ? », « quelle
 * vitesse ? » — ce que quelqu'un qui n'a jamais monté ne sait pas trancher, et
 * ne devrait pas avoir à trancher pour obtenir un résultat correct. « Découper
 * en plans de 2 s » ne demande rien et fait exactement ce que l'analyse
 * réclame.
 */

/** Durée visée par le découpage automatique, en secondes. */
const CHOP_TARGET = 2;

/** Au-delà, un plan gagne à être découpé. */
const LONG_SHOT = 3.5;

/** Ce que chaque transition raconte, sans jargon de monteur. */
const TRANSITION_HELP: Record<TransitionKind, string> = {
  cut: 'Passage instantané. Le plus nerveux.',
  fade: 'Les deux plans se mélangent. Doux.',
  whipPan: 'L’image est balayée sur le côté.',
  zoomPunch: 'Le plan suivant arrive en force.',
  slideUp: 'Le nouveau plan monte par le bas.',
  flash: 'Un éclair blanc masque le raccord.',
  glitch: 'L’image décroche une fraction de seconde.',
};

const MOTION_LABELS: Record<ClipMotion, { label: string; help: string }> = {
  none: { label: 'Fixe', help: 'Plan fixe.' },
  zoomIn: { label: 'Zoom avant', help: 'On se rapproche lentement.' },
  zoomOut: { label: 'Zoom arrière', help: 'On s’éloigne lentement.' },
  panLeft: { label: 'Vers la gauche', help: 'Glissement vers la gauche.' },
  panRight: { label: 'Vers la droite', help: 'Glissement vers la droite.' },
  shake: { label: 'Tremblement', help: 'Tremblement, pour l’impact.' },
};

export function ClipPanel() {
  const selection = useStudio((s) => s.selection);
  const clips = useStudio((s) => s.project.clips);
  const assets = useStudio((s) => s.project.assets);
  const updateClip = useStudio((s) => s.updateClip);
  const removeClip = useStudio((s) => s.removeClip);
  const duplicateClip = useStudio((s) => s.duplicateClip);
  const chopClip = useStudio((s) => s.chopClip);
  const moveClip = useStudio((s) => s.moveClip);

  const clip = selection?.kind === 'clip' ? clips.find((c) => c.id === selection.id) : undefined;

  if (!clip) {
    return (
      <Panel title="2 · Monter" subtitle="Touche un plan sur la timeline pour le régler.">
        <EmptyState title="Aucun plan sélectionné">
          Les blocs juste au-dessus de cette zone sont tes plans. Touches-en un.
        </EmptyState>
        <div className="mt-3">
          <Hint>
            Vise 1 à 3 secondes par plan. Au-delà de 3 secondes sans qu’il se passe quelque chose,
            l’attention retombe et le spectateur passe à la vidéo suivante.
          </Hint>
        </div>
      </Panel>
    );
  }

  const asset = assets.find((a) => a.id === clip.assetId);
  const index = clips.findIndex((c) => c.id === clip.id);
  const sourceDuration = asset?.duration ?? clip.outPoint;
  const shown = clipDuration(clip);
  const pieces = Math.floor(shown / CHOP_TARGET);

  /** Ne garde que le début du plan, sur la durée demandée. */
  const keepFirst = (seconds: number) =>
    updateClip(clip.id, { outPoint: Math.min(sourceDuration, clip.inPoint + seconds * clip.speed) });

  return (
    <div className="space-y-3">
      <Panel title={`Plan ${index + 1} sur ${clips.length}`} subtitle={asset?.name}>
        <p className="mb-3 rounded-xl border border-edge bg-slab/60 px-3 py-2 text-xs text-muted">
          Durée à l’écran : <span className="font-mono text-mist">{shown.toFixed(1)} s</span>
          {shown > LONG_SHOT && ' — trop long, l’attention retombe.'}
        </p>

        {shown > LONG_SHOT && (
          <Button
            variant="primary"
            className="mb-1.5 w-full"
            onClick={() => chopClip(clip.id, CHOP_TARGET)}
          >
            ✂ Découper en {pieces} plans de {CHOP_TARGET} s
          </Button>
        )}

        <Actions>
          <Button onClick={() => keepFirst(2)} disabled={shown <= 2.05}>
            Garder 2 s
          </Button>
          <Button onClick={() => keepFirst(shown / 2)} disabled={shown / 2 < MIN_CLIP_DURATION}>
            Couper de moitié
          </Button>
          <Button onClick={() => duplicateClip(clip.id)}>⧉ Dupliquer</Button>
          <Button onClick={() => updateClip(clip.id, { speed: clip.speed === 1 ? 0.5 : 1 })}>
            {clip.speed === 1 ? '🐢 Ralentir ×2' : '↺ Vitesse normale'}
          </Button>
          <Button onClick={() => moveClip(index, index - 1)} disabled={index === 0}>
            ◀ Reculer
          </Button>
          <Button onClick={() => moveClip(index, index + 1)} disabled={index === clips.length - 1}>
            Avancer ▶
          </Button>
        </Actions>

        <Button variant="danger" className="mt-1.5 w-full" onClick={() => removeClip(clip.id)}>
          Supprimer ce plan
        </Button>
      </Panel>

      <Panel title="Mouvement" subtitle="Un plan qui bouge retient mieux qu’un plan fixe.">
        <Choice
          value={clip.motion}
          onChange={(motion) => updateClip(clip.id, { motion })}
          options={(Object.keys(MOTION_LABELS) as ClipMotion[]).map((id) => ({
            value: id,
            label: MOTION_LABELS[id].label,
            description: MOTION_LABELS[id].help,
          }))}
        />
      </Panel>

      {index > 0 ? (
        <Panel title="Transition entrante" subtitle="Comment ce plan succède au précédent.">
          <Choice
            value={clip.transition}
            onChange={(transition) => updateClip(clip.id, { transition })}
            options={(Object.keys(TRANSITION_LABELS) as TransitionKind[]).map((id) => ({
              value: id,
              label: TRANSITION_LABELS[id],
              description: TRANSITION_HELP[id],
            }))}
          />
        </Panel>
      ) : (
        <Hint>
          Le premier plan n’a pas de transition entrante : il doit démarrer net. Les premières images
          sont trop précieuses pour être passées en fondu.
        </Hint>
      )}

      <Collapsible label="Réglage fin — si tu veux ajuster toi-même">
        <Field
          label="Début dans le rush"
          value={`${clip.inPoint.toFixed(2)} s`}
          help={`Ce qui se trouve avant ce point est ignoré. Le rush dure ${sourceDuration.toFixed(1)} s en tout.`}
        >
          <Slider
            ariaLabel="Point de début"
            min={0}
            max={Math.max(0, sourceDuration - MIN_CLIP_DURATION)}
            step={0.05}
            value={clip.inPoint}
            onChange={(value) =>
              updateClip(clip.id, { inPoint: Math.min(value, clip.outPoint - MIN_CLIP_DURATION) })
            }
          />
        </Field>

        <Field
          label="Fin dans le rush"
          value={`${clip.outPoint.toFixed(2)} s`}
          help={`Tu ne peux pas dépasser ${sourceDuration.toFixed(1)} s, la longueur du rush d’origine.`}
        >
          <Slider
            ariaLabel="Point de fin"
            min={MIN_CLIP_DURATION}
            max={sourceDuration}
            step={0.05}
            value={clip.outPoint}
            onChange={(value) =>
              updateClip(clip.id, { outPoint: Math.max(value, clip.inPoint + MIN_CLIP_DURATION) })
            }
          />
        </Field>

        <Field
          label="Vitesse"
          value={`${clip.speed.toFixed(2)}×`}
          help="Au-dessus de 1, le plan est accéléré et raccourci. En dessous, il ralentit et s’allonge."
        >
          <Slider
            ariaLabel="Vitesse de lecture"
            min={0.25}
            max={4}
            step={0.05}
            value={clip.speed}
            onChange={(value) => updateClip(clip.id, { speed: value })}
          />
        </Field>

        <Field
          label="Volume du plan"
          value={`${Math.round(clip.volume * 100)} %`}
          help="Son d’origine du rush. À zéro, seuls la musique et les bruitages restent."
        >
          <Slider
            ariaLabel="Volume du plan"
            min={0}
            max={1}
            step={0.05}
            value={clip.volume}
            onChange={(value) => updateClip(clip.id, { volume: value })}
          />
        </Field>

        {index > 0 && clip.transition !== 'cut' && (
          <Field
            label="Durée de la transition"
            value={`${clip.transitionDuration.toFixed(2)} s`}
            help="Au-delà de 45 % du plus court des deux plans, la durée est automatiquement ramenée sous cette limite."
          >
            <Slider
              ariaLabel="Durée de la transition"
              min={0.05}
              max={1.5}
              step={0.05}
              value={clip.transitionDuration}
              onChange={(value) => updateClip(clip.id, { transitionDuration: value })}
            />
          </Field>
        )}
      </Collapsible>
    </div>
  );
}
