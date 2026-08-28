/* eslint-disable @next/next/no-img-element -- Les vignettes sont des data URL
   de 160 px déjà produites côté client : next/image n'aurait ni requête à
   optimiser, ni redimensionnement à faire. */
'use client';

import { LOOKS } from '@/lib/grade';
import { QUALITY_TIERS, tierById } from '@/lib/quality';
import { useStudio, type QualityChoice } from '@/lib/store';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { Choice, Field, Hint, Panel, Slider } from '../ui';

/**
 * Rendu cinématographique.
 *
 * Les vignettes de prévisualisation reprennent le filtre CSS de chaque rendu
 * appliqué à la première image du montage : le choix se fait sur ce qu'on voit,
 * pas sur un nom de style qui ne dit rien à qui n'a jamais étalonné.
 */
export function CinemaPanel() {
  const cinema = useStudio((s) => s.project.cinema);
  const assets = useStudio((s) => s.project.assets);
  const clips = useStudio((s) => s.project.clips);

  const setCinema = (patch: Partial<typeof cinema>) =>
    useStudio.setState((state) => ({ project: { ...state.project, cinema: { ...state.project.cinema, ...patch } } }));

  // La vignette du premier plan sert d'aperçu : c'est l'image que l'étalonnage
  // touchera en premier à la lecture.
  const preview = assets.find((a) => a.id === clips[0]?.assetId)?.thumbnail;

  return (
    <div className="space-y-3">
      <Panel title="5 · Rendu cinéma" subtitle="Un étalonnage bien dosé sépare une vidéo amateur d’une vidéo tenue.">
        <div className="grid grid-cols-2 gap-2">
          {LOOKS.map((look) => {
            const active = look.id === cinema.look;
            return (
              <button
                key={look.id}
                type="button"
                onClick={() => setCinema({ look: look.id })}
                className={`overflow-hidden rounded-xl border text-left transition-colors ${
                  active ? 'border-select ring-1 ring-select' : 'border-edge hover:border-muted'
                }`}
              >
                <div className="relative h-16 bg-slab">
                  {preview && (
                    <img
                      src={preview}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ filter: look.filter === 'none' ? undefined : look.filter }}
                    />
                  )}
                </div>
                <div className="p-2">
                  <span className="block text-xs font-semibold text-mist">{look.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">{look.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Dosage">
        <Field
          label="Intensité"
          value={`${Math.round(cinema.intensity * 100)} %`}
          help="Le réflexe du débutant est de pousser à fond. Entre 60 % et 80 %, l’effet se sent sans se voir."
        >
          <Slider
            ariaLabel="Intensité du rendu"
            min={0}
            max={1}
            step={0.05}
            value={cinema.intensity}
            onChange={(intensity) => setCinema({ intensity })}
          />
        </Field>

        <Field
          label="Bandes cinéma"
          value={cinema.bars === 0 ? 'aucune' : `${Math.round(cinema.bars * 100)} %`}
          help="Les bandes noires évoquent le grand écran, mais mangent de la hauteur — attention aux sous-titres."
        >
          <Slider
            ariaLabel="Hauteur des bandes"
            min={0}
            max={1}
            step={0.05}
            value={cinema.bars}
            onChange={(bars) => setCinema({ bars })}
          />
        </Field>

        <Hint>
          Le rendu s’applique à toute la vidéo, jamais aux sous-titres : le texte reste net et
          parfaitement lisible même avec un grain marqué.
        </Hint>
      </Panel>

      <QualityPanel />
    </div>
  );
}

/**
 * Réglage de la finesse d'aperçu.
 *
 * Le point capital, répété ici parce qu'il est contre-intuitif : ce réglage ne
 * touche qu'à l'aperçu. Sans cette précision, personne n'oserait le baisser, de
 * peur d'abîmer la vidéo produite.
 */
function QualityPanel() {
  const choice = useStudio((s) => s.qualityChoice);
  const effective = useStudio((s) => s.effectiveQuality);
  const setChoice = useStudio((s) => s.setQualityChoice);
  const rescued = useStudio((s) => s.qualityRescued);
  const touch = useIsTouch();

  // Sur un appareil modeste, imposer la pleine définition ne dégrade pas que
  // l'aperçu : la boucle de rendu accapare le processeur au point que
  // l'interface elle-même cesse de répondre aux gestes.
  const risky = touch && (choice === 'full' || choice === 'high');

  const options: { value: QualityChoice; label: string; description?: string }[] = [
    { value: 'auto', label: 'Automatique', description: 'S’ajuste si l’appareil peine.' },
    ...QUALITY_TIERS.map((tier) => ({
      value: tier.id as QualityChoice,
      label: tier.label,
      description: `${Math.round(tier.scale * 100)} % de la définition${tier.bloom ? '' : ', sans halo'}`,
    })),
  ];

  return (
    <Panel title="Finesse de l’aperçu" subtitle="N’affecte que l’affichage, jamais le fichier exporté.">
      <Choice
        value={choice}
        onChange={setChoice}
        options={options}
        columns={2}
      />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Palier appliqué :{' '}
        <span className="text-mist">{choice === 'auto' ? tierById(effective).label : tierById(choice).label}</span>
        {choice === 'auto' && ' — ajusté automatiquement selon la fluidité mesurée.'}
      </p>

      <div className="mt-3 space-y-2">
        {rescued && (
          <Hint tone="warn">
            Ce palier bloquait l’application : elle ne répondait plus assez vite pour que tu puisses
            revenir en arrière. La qualité est repassée en automatique. Ton montage est intact.
          </Hint>
        )}
        {risky ? (
          <Hint tone="warn">
            Ce palier est lourd pour un téléphone : l’aperçu risque de saccader, et l’interface de
            répondre au ralenti. Repasse en « Automatique » si tu sens que ça traîne — la qualité du
            fichier exporté ne changera pas d’un iota.
          </Hint>
        ) : (
          <Hint>
            Sur téléphone, l’aperçu est volontairement moins fin pour rester fluide : juger un montage
            sur une image qui saccade est impossible. L’export, lui, repasse toujours en 1080 × 1920.
          </Hint>
        )}
      </div>
    </Panel>
  );
}
