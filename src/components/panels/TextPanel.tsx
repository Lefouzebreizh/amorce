'use client';

import { CAPTION_STYLES } from '@/lib/captions';
import { HOOK_WINDOW } from '@/lib/analysis';
import { hooksByFamily } from '@/lib/hooks';
import { useStudio } from '@/lib/store';
import { CAPTION_COLORS, CAPTION_SCALES, type CaptionStyleId } from '@/lib/types';
import { Button, Choice, Field, Hint, Panel, Slider } from '../ui';

/**
 * Sous-titres et accroches.
 *
 * L'assistant d'accroche occupe la première place du panneau, et non une option
 * repliée quelque part : c'est le réglage qui pèse le plus lourd sur le résultat
 * final, et celui auquel un débutant ne penserait pas spontanément.
 */
export function TextPanel() {
  const captions = useStudio((s) => s.project.captions);
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const addCaption = useStudio((s) => s.addCaption);
  const updateCaption = useStudio((s) => s.updateCaption);
  const removeCaption = useStudio((s) => s.removeCaption);
  const playhead = useStudio((s) => s.playhead);
  const duration = useStudio((s) => s.duration());

  const selected = selection?.kind === 'caption' ? captions.find((c) => c.id === selection.id) : undefined;
  const hook = [...captions].sort((a, b) => a.start - b.start).find((c) => c.start <= 1.2);

  return (
    <div className="space-y-3">
      <Panel
        title={`3 · L’accroche (${HOOK_WINDOW} premières secondes)`}
        subtitle="Le spectateur ne décide pas de regarder ta vidéo. Il décide de ne pas la passer."
      >
        {hook ? (
          <div className="rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-accent">Accroche en place</p>
            <p className="mt-1 text-sm text-mist">« {hook.text} »</p>
            <Button
              variant="subtle"
              className="mt-1 px-0"
              onClick={() => select({ kind: 'caption', id: hook.id })}
            >
              Modifier ce texte
            </Button>
          </div>
        ) : (
          <Hint tone="warn">
            Aucun texte n’apparaît dans la première seconde. C’est le point le plus coûteux du montage :
            choisis une accroche ci-dessous.
          </Hint>
        )}

        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
          {hooksByFamily().map(({ family, templates }) => (
            <div key={family}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{family}</p>
              <div className="space-y-1.5">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      if (hook) {
                        updateCaption(hook.id, { text: template.text });
                        select({ kind: 'caption', id: hook.id });
                      } else {
                        // L'accroche doit tomber sur la toute première image,
                        // quelle que soit la position de la tête de lecture.
                        useStudio.setState({ playhead: 0 });
                        addCaption('punch');
                        const created = useStudio.getState().project.captions.at(-1);
                        if (created) {
                          updateCaption(created.id, {
                            text: template.text,
                            start: 0,
                            end: Math.min(2.4, Math.max(1.2, duration)),
                            y: 0.28,
                          });
                        }
                        useStudio.setState({ playhead });
                      }
                    }}
                    className="w-full rounded-xl bg-slab px-3 py-2 text-left transition-colors hover:border-muted"
                  >
                    <span className="block text-xs font-semibold text-mist">{template.text}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted">{template.why}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Sous-titres"
        subtitle="La majorité regarde sans le son. Vise environ 70 % de la vidéo couverte par du texte."
        action={
          <Button variant="ghost" onClick={() => addCaption('punch')} title="Ajouter à la position de lecture">
            + Ajouter
          </Button>
        }
      >
        {captions.length === 0 ? (
          <p className="text-xs text-muted">
            Aucun sous-titre. Le bouton « Ajouter » en pose un à la position de lecture actuelle.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...captions]
              .sort((a, b) => a.start - b.start)
              .map((caption) => (
                <li key={caption.id}>
                  <button
                    type="button"
                    onClick={() => select({ kind: 'caption', id: caption.id })}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      selected?.id === caption.id
                        ? 'bg-raised ring-1 ring-select/60'
                        : 'bg-slab hover:bg-raised'
                    }`}
                  >
                    <span className="block truncate text-xs font-semibold text-mist">
                      {caption.text || '(texte vide)'}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {caption.start.toFixed(1)} s → {caption.end.toFixed(1)} s ·{' '}
                      {CAPTION_STYLES[caption.style].label}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      {selected && (
        <Panel
          title="Texte sélectionné"
          action={
            <Button variant="danger" onClick={() => removeCaption(selected.id)}>
              Supprimer
            </Button>
          }
        >
          <Field label="Texte" help="Court et frappant. Une idée par phrase, pas deux.">
            <textarea
              value={selected.text}
              rows={2}
              onChange={(event) => updateCaption(selected.id, { text: event.target.value })}
              className="w-full resize-none rounded-xl bg-slab px-3 py-2 text-sm text-mist outline-none focus:border-accent"
            />
          </Field>

          <Field label="Couleur" help="Toutes très contrastées : sur une image vidéo, un ton pâle devient illisible.">
            <div className="flex flex-wrap gap-1.5">
              {CAPTION_COLORS.map((option) => {
                const active = (selected.color ?? '#ffffff') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    aria-label={`Couleur ${option.label}`}
                    aria-pressed={active}
                    onClick={() => updateCaption(selected.id, { color: option.value })}
                    className={`h-9 w-9 rounded-full border-2 transition-transform ${
                      active ? 'scale-110 border-select' : 'border-edge'
                    }`}
                    style={{ backgroundColor: option.value }}
                  />
                );
              })}
            </div>
          </Field>

          {CAPTION_STYLES[selected.style].highlight && (
            <Field
              label="Couleur du surlignage"
              help="La pastille qui allume le mot prononcé. Le texte posé dessus passe au noir ou au blanc tout seul, selon ce qui reste lisible."
            >
              <div className="flex flex-wrap gap-1.5">
                {CAPTION_COLORS.map((option) => {
                  const active =
                    (selected.highlightColor ?? CAPTION_STYLES[selected.style].highlight?.color) === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      aria-label={`Surlignage ${option.label}`}
                      aria-pressed={active}
                      onClick={() => updateCaption(selected.id, { highlightColor: option.value })}
                      className={`h-9 w-9 rounded-full border-2 transition-transform ${
                        active ? 'scale-110 border-select' : 'border-edge'
                      }`}
                      style={{ backgroundColor: option.value }}
                    />
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Taille" help="Un texte plus grand porte plus loin, mais mange l’image.">
            <Choice
              value={String(selected.scale ?? 1)}
              onChange={(value) => updateCaption(selected.id, { scale: Number(value) })}
              columns={3}
              options={CAPTION_SCALES.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
            />
          </Field>

          <Field
            label="Battement"
            help="Réserve-le à ce qui presse — un compte à rebours, la question finale. Si tout bat, plus rien n’attire l’œil."
          >
            <Choice
              value={selected.pulse ? 'oui' : 'non'}
              onChange={(value) => updateCaption(selected.id, { pulse: value === 'oui' })}
              options={[
                { value: 'non', label: 'Fixe' },
                { value: 'oui', label: 'Pulse' },
              ]}
            />
          </Field>

          <Field label="Style" help="Punch pour l’accroche, Karaoké pour la narration, Cartouche pour l’info.">
            <Choice
              value={selected.style}
              onChange={(style) => updateCaption(selected.id, { style })}
              options={(Object.keys(CAPTION_STYLES) as CaptionStyleId[]).map((id) => ({
                value: id,
                label: CAPTION_STYLES[id].label,
                description: CAPTION_STYLES[id].description,
              }))}
            />
          </Field>

          <Field
            label="Apparition"
            value={`${selected.start.toFixed(2)} s`}
            help="L’instant où le texte s’affiche. Il s’arrête toujours 0,2 s avant la disparition : en dessous, le sous-titre clignote sans être lu."
          >
            <Slider
              ariaLabel="Instant d’apparition"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.05}
              value={selected.start}
              onChange={(value) => updateCaption(selected.id, { start: Math.min(value, selected.end - 0.2) })}
            />
          </Field>

          <Field
            label="Disparition"
            value={`${selected.end.toFixed(2)} s`}
            help="Compte environ une seconde par tranche de trois mots pour laisser le temps de lire."
          >
            <Slider
              ariaLabel="Instant de disparition"
              min={0.2}
              max={Math.max(0.3, duration)}
              step={0.05}
              value={selected.end}
              onChange={(value) => updateCaption(selected.id, { end: Math.max(value, selected.start + 0.2) })}
            />
          </Field>

          <Field
            label="Hauteur à l’écran"
            value={`${Math.round(selected.y * 100)} %`}
            help="Tu peux aussi faire glisser le texte directement dans l’aperçu. Garde-le entre 25 % et 70 % : le bas de l’écran est masqué par l’interface de l’application."
          >
            <Slider
              ariaLabel="Position verticale"
              min={0.1}
              max={0.9}
              step={0.01}
              value={selected.y}
              onChange={(value) => updateCaption(selected.id, { y: value })}
            />
          </Field>
        </Panel>
      )}
    </div>
  );
}
