'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { analyseVoice } from '@/lib/voice';
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
  const cutSilences = useStudio((s) => s.cutSilences);
  const captionsFromClip = useStudio((s) => s.captionsFromClip);
  const moveClip = useStudio((s) => s.moveClip);

  /*
   * Déclaré ici, avant le retour anticipé du cas « aucun plan sélectionné » :
   * un état posé plus bas ne serait pas appelé au même rang à chaque rendu, ce
   * que React refuse.
   */
  const [analyse, setAnalyse] = useState<
    'repos' | 'en cours' | 'fait' | 'rien à retirer' | 'audio illisible'
  >('repos');
  const [dit, setDit] = useState('');
  const [calage, setCalage] = useState<'repos' | 'en cours' | 'fait' | 'raté'>('repos');

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

  /** Le plan montre-t-il moins que ce que contient le rush. */
  const trimmed = sourceDuration - (clip.outPoint - clip.inPoint) > 0.4;

  /*
   * Le son est-il tronqué avec l'image.
   *
   * Un plan raccourci coupe aussi ce qu'on y entend. Sur un rush muet, aucune
   * conséquence ; sur une voix off, la phrase s'arrête au milieu — et rien ne
   * le signalait, alors que c'est la seule chose que le spectateur remarquera.
   */
  const soundCut = trimmed && clip.volume > 0 && (asset?.hasAudio ?? true);

  /** Ne garde que le début du plan, sur la durée demandée. */
  const keepFirst = (seconds: number) =>
    updateClip(clip.id, { outPoint: Math.min(sourceDuration, clip.inPoint + seconds * clip.speed) });

  return (
    <div className="space-y-3">
      <Panel title={`Plan ${index + 1} sur ${clips.length}`} subtitle={asset?.name}>
        <p className="mb-3 rounded-xl bg-slab px-3 py-2.5 text-xs text-muted">
          Durée à l’écran : <span className="font-mono text-mist">{shown.toFixed(1)} s</span>
          {trimmed && (
            <>
              {' '}
              sur <span className="font-mono text-mist">{sourceDuration.toFixed(1)} s</span> de rush
            </>
          )}
          {shown > LONG_SHOT && ' — trop long, l’attention retombe.'}
        </p>

        {soundCut && (
          <div className="mb-1.5">
            <Hint tone="warn">
              Ce plan ne montre que {shown.toFixed(1)} s sur {sourceDuration.toFixed(1)} s. Si ton rush
              contient une voix, elle est coupée en plein milieu — le bouton ci-dessous rétablit le plan
              entier.
            </Hint>
          </div>
        )}

        {trimmed && (
          <Button
            variant={soundCut ? 'primary' : 'ghost'}
            className="mb-1.5 w-full"
            onClick={() =>
              updateClip(clip.id, { inPoint: 0, outPoint: sourceDuration, speed: 1 })
            }
          >
            ⟺ Tout le plan ({sourceDuration.toFixed(1)} s)
          </Button>
        )}

        {asset && (
          <>
            {/*
              Le premier défaut d'un rush tourné au téléphone n'est pas le
              cadrage, c'est le temps mort : on lance l'enregistrement, on
              cherche ses mots, on termine sa phrase, on cherche le bouton.
              Trois secondes de rien au début et deux à la fin, sur chaque plan,
              et le film perd son rythme sans qu'aucun réglage ne soit en cause.
            */}
            <Button
              variant="primary"
              className="mb-1.5 w-full"
              disabled={analyse === 'en cours'}
              onClick={async () => {
                setAnalyse('en cours');
                try {
                  /*
                   * Un contexte hors ligne, et non celui de la lecture : décoder
                   * n'a pas besoin d'une sortie audio, et le studio n'ouvre
                   * qu'un seul contexte de lecture — le mobiliser ici couperait
                   * le son pendant l'analyse.
                   *
                   * L'URL est une URL objet : `fetch` relit le fichier depuis
                   * la mémoire de l'onglet. Rien ne part sur un réseau.
                   */
                  const contexte = new OfflineAudioContext(1, 1, 44100);
                  const { segments } = await analyseVoice(contexte, asset.url);
                  const avant = clips.length;
                  cutSilences(clip.id, segments);
                  setAnalyse(useStudio.getState().project.clips.length === avant
                    ? 'rien à retirer'
                    : 'fait');
                } catch {
                  // Un rush sans piste sonore, ou dans un format que ce
                  // navigateur ne décode pas : on le dit, on ne casse rien.
                  setAnalyse('audio illisible');
                }
              }}
            >
              {analyse === 'en cours' ? '⏳ Analyse du son…' : '✄ Retirer les blancs'}
            </Button>
            {analyse !== 'repos' && analyse !== 'en cours' && (
              <p className="mb-1.5 text-[11.5px] text-muted">
                {analyse === 'fait' && 'Blancs retirés. Le bouton ↶ du bandeau annule.'}
                {analyse === 'rien à retirer' && 'Aucun blanc assez long à retirer sur ce plan.'}
                {analyse === 'audio illisible' && 'Ce plan n’a pas de son exploitable.'}
              </p>
            )}
          </>
        )}

        {asset && (
          <Collapsible label="Sous-titrer ce que je dis">
            {/*
              Écrire le texte plutôt que le deviner.

              Le calage d'un texte sur la parole existait déjà, mais seulement
              pour une voix off importée. Or le cas le plus courant est
              l'inverse : on se filme en parlant. Il fallait alors écrire chaque
              sous-titre à la main, un par un, en cherchant ses bornes à la
              jauge — le travail le plus long d'un montage court.

              L'application ne devine pas les mots : elle mesure **quand** on
              parle, et cale dessus le texte qu'on lui donne. C'est moins
              magique qu'une transcription, et c'est exact — une transcription
              qui se trompe d'un mot coûte plus à corriger qu'à taper.
            */}
            <Field
              label="Ce que tu dis dans ce plan"
              help="Tape la phrase telle que tu la prononces. Le découpage et le rythme sont mesurés sur ta voix."
            >
              <textarea
                value={dit}
                rows={3}
                placeholder="Personne ne t’a expliqué ça…"
                className="w-full rounded-xl bg-slab p-3 text-[15px] text-mist outline-none"
                onChange={(event) => {
                  setDit(event.target.value);
                  setCalage('repos');
                }}
              />
            </Field>
            <Button
              variant="primary"
              className="mt-2 w-full"
              disabled={dit.trim() === '' || calage === 'en cours'}
              onClick={async () => {
                setCalage('en cours');
                try {
                  const contexte = new OfflineAudioContext(1, 1, 44100);
                  const { segments } = await analyseVoice(contexte, asset.url);
                  const avant = useStudio.getState().project.captions.length;
                  captionsFromClip(clip.id, dit, segments);
                  setCalage(
                    useStudio.getState().project.captions.length === avant ? 'raté' : 'fait',
                  );
                } catch {
                  setCalage('raté');
                }
              }}
            >
              {calage === 'en cours' ? '⏳ Analyse de la voix…' : '✎ Caler sur ma voix'}
            </Button>
            {calage === 'fait' && (
              <p className="mt-1.5 text-[11.5px] text-muted">
                Sous-titres posés. Retouche-les dans « L’accroche ».
              </p>
            )}
            {calage === 'raté' && (
              <p className="mt-1.5 text-[11.5px] text-muted">
                Aucune parole mesurée sur ce plan : vérifie qu’il a bien du son.
              </p>
            )}
          </Collapsible>
        )}

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
          <Button
            onClick={() => updateClip(clip.id, { speed: clip.speed === 1 ? 0.5 : 1 })}
            title="Allonge le plan, mais étire aussi le son : à éviter sur une voix."
          >
            {clip.speed === 1 ? '🐢 Ralentir ×2' : '↺ Vitesse normale'}
          </Button>
          <Button onClick={() => moveClip(index, index - 1)} disabled={index === 0}>
            ◀ Reculer
          </Button>
          <Button onClick={() => moveClip(index, index + 1)} disabled={index === clips.length - 1}>
            Avancer ▶
          </Button>
        </Actions>

        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          « Ralentir » allonge le plan mais étire aussi le son : à éviter si ton rush contient une voix.
        </p>

        <Button variant="danger" className="mt-2 w-full" onClick={() => removeClip(clip.id)}>
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
