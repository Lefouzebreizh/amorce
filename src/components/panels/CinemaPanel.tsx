/* eslint-disable @next/next/no-img-element -- Les vignettes sont des data URL
   de 160 px déjà produites côté client : next/image n'aurait ni requête à
   optimiser, ni redimensionnement à faire. */
'use client';

import { LOOKS } from '@/lib/grade';
import { useStudio } from '@/lib/store';
import { Field, Hint, Panel, Slider } from '../ui';

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
                  active ? 'border-accent ring-1 ring-accent' : 'border-edge hover:border-muted'
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
    </div>
  );
}
