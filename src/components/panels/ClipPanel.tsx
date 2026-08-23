'use client';

import { useStudio } from '@/lib/store';
import { clipDuration } from '@/lib/timeline';
import { TRANSITION_LABELS } from '@/lib/transitions';
import { MIN_CLIP_DURATION, type ClipMotion, type TransitionKind } from '@/lib/types';
import { Button, Choice, EmptyState, Field, Hint, Panel, Slider } from '../ui';

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

const MOTION_HELP: Record<ClipMotion, string> = {
  none: 'Plan fixe.',
  zoomIn: 'On se rapproche lentement.',
  zoomOut: 'On s’éloigne lentement.',
  panLeft: 'Glissement vers la gauche.',
  panRight: 'Glissement vers la droite.',
  shake: 'Tremblement, pour l’impact.',
};

/**
 * Réglages du plan sélectionné.
 *
 * Les points d'entrée et de sortie sont exprimés dans le média source, pas sur
 * la timeline : raccourcir un plan ne déplace donc rien de ce qui précède.
 */
export function ClipPanel() {
  const selection = useStudio((s) => s.selection);
  const clips = useStudio((s) => s.project.clips);
  const assets = useStudio((s) => s.project.assets);
  const updateClip = useStudio((s) => s.updateClip);
  const removeClip = useStudio((s) => s.removeClip);
  const duplicateClip = useStudio((s) => s.duplicateClip);
  const moveClip = useStudio((s) => s.moveClip);

  const clip = selection?.kind === 'clip' ? clips.find((c) => c.id === selection.id) : undefined;

  if (!clip) {
    return (
      <Panel title="2 · Monter" subtitle="Sélectionne un plan sur la timeline pour le régler.">
        <EmptyState title="Aucun plan sélectionné">
          Clique sur un bloc de la timeline. Tu pourras y régler sa durée, sa vitesse, la transition qui
          l’amène et son mouvement de caméra.
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

  return (
    <div className="space-y-3">
      <Panel
        title={`Plan ${index + 1}`}
        subtitle={asset?.name}
        action={
          <Button variant="danger" onClick={() => removeClip(clip.id)} title="Supprimer ce plan">
            Supprimer
          </Button>
        }
      >
        <Field
          label="Place dans le montage"
          value={`${index + 1} sur ${clips.length}`}
          help="Sur téléphone, le glisser-déposer n’est pas fiable : ces boutons déplacent le plan."
        >
          <div className="flex gap-1.5">
            <Button
              className="flex-1"
              onClick={() => moveClip(index, index - 1)}
              disabled={index === 0}
              title="Déplacer vers le début"
            >
              ◀ Reculer
            </Button>
            <Button
              className="flex-1"
              onClick={() => moveClip(index, index + 1)}
              disabled={index === clips.length - 1}
              title="Déplacer vers la fin"
            >
              Avancer ▶
            </Button>
          </div>
        </Field>

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
          help={`Coupe avant que le plan ne s’essouffle. Tu ne peux pas dépasser ${sourceDuration.toFixed(1)} s, la longueur du rush d’origine.`}
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
          help="Au-dessus de 1, le plan est accéléré et raccourci. En dessous, il ralentit et s’allonge : à 0,50×, un rush de 2 s en occupe 4."
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

        <p className="rounded-xl border border-edge bg-slab/60 px-3 py-2 text-xs text-muted">
          Durée à l’écran : <span className="font-mono text-mist">{shown.toFixed(2)} s</span>
          {shown > 3.5 && ' — c’est long, pense à raccourcir.'}
        </p>

        <Button className="mt-3 w-full" onClick={() => duplicateClip(clip.id)}>
          ⧉ Dupliquer ce plan
        </Button>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Ton rush est court ? Duplique-le et règle la copie autrement — autre cadrage, autre vitesse,
          autre transition. C’est ce qui permet d’atteindre 15 à 30 s à partir de quelques secondes de
          matière.
        </p>
      </Panel>

      <Panel title="Mouvement" subtitle="Un plan qui bouge retient mieux qu’un plan fixe.">
        <Choice
          value={clip.motion}
          onChange={(motion) => updateClip(clip.id, { motion })}
          options={(Object.keys(MOTION_HELP) as ClipMotion[]).map((id) => ({
            value: id,
            label: { none: 'Fixe', zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière', panLeft: 'Vers la gauche', panRight: 'Vers la droite', shake: 'Tremblement' }[id],
            description: MOTION_HELP[id],
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

          {clip.transition !== 'cut' && (
            <div className="mt-3">
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
            </div>
          )}
        </Panel>
      ) : (
        <Hint>
          Le premier plan n’a pas de transition entrante : il doit démarrer net. Les premières images
          sont trop précieuses pour être passées en fondu.
        </Hint>
      )}
    </div>
  );
}
