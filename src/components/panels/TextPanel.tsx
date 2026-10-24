'use client';

import { useEffect, useRef, useState } from 'react';
import { BANDE_SURE, CAPTION_STYLES } from '@/lib/captions';
import { HOOK_WINDOW, captionCoverage } from '@/lib/analysis';
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
  const clips = useStudio((s) => s.project.clips);
  const assets = useStudio((s) => s.project.assets);
  const music = useStudio((s) => s.project.music);
  const hasParoles = music !== null && music.kind !== 'ambience';
  const [transcriptionMessage, setTranscriptionMessage] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');
  const transcriptionFile = useRef<HTMLInputElement>(null);

  /*
   * Le chemin rapide n'est pas dans ce panneau, et rien ne le disait.
   *
   * Couvrir 70 % d'un montage de trente secondes demande une vingtaine de
   * sous-titres. Posés un par un par « + Ajouter », c'est une vingtaine de
   * fois : ajouter, écrire, régler le début, régler la fin. L'outil qui le
   * fait en une passe — écrire son texte une fois, l'application le cale sur
   * la voix — vit dans l'étape Monter, sur le plan sélectionné.
   *
   * Or c'est ici que le guide envoie quand la couverture est faible. Quelqu'un
   * qui le suit tombe donc sur la méthode lente sans jamais apprendre que
   * l'autre existe. Le raccourci est donc nommé là où le besoin se manifeste,
   * et seulement quand il peut servir : il faut du son dans un plan pour
   * qu'une voix se cale dessus.
   */
  const aDeLaVoix = clips.some((clip) => assets.find((a) => a.id === clip.assetId)?.hasAudio);
  const couverture = captionCoverage(captions, duration);

  const selected = selection?.kind === 'caption' ? captions.find((c) => c.id === selection.id) : undefined;

  /*
   * L'éditeur vient à l'utilisateur, il ne l'attend pas.
   *
   * Sélectionner un texte — par « Modifier ce texte » ou en le touchant dans
   * l'aperçu — faisait apparaître ce panneau **à 1 138 px**, soit 265 px sous
   * le bas d'un écran de téléphone. Rien ne bougeait à l'écran : on appuyait,
   * il ne se passait rien de visible, et le bouton était donc réputé cassé
   * alors qu'il faisait exactement son travail.
   *
   * `scroll-mt` compense l'aperçu collé, sans quoi le titre du panneau se
   * range derrière l'image.
   */
  const editeur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) return;
    // Après le rendu suivant, et non tout de suite : sélectionner un texte
    // change aussi l'étape ouverte, et le parent défile alors vers le haut de
    // l'étape. Les effets d'un enfant passent avant ceux de son parent — le
    // nôtre partait donc en premier et se faisait écraser. Une image plus tard,
    // c'est lui qui a le dernier mot.
    const t = requestAnimationFrame(() => {
      editeur.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(t);
    // Sur l'identifiant seul : rouvrir le même texte ne doit pas ramener la
    // page en haut à chaque frappe dans le champ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  const hook = [...captions].sort((a, b) => a.start - b.start).find((c) => c.start <= 1.2);

  const importerCalageLocal = async (file: File) => {
    try {
      if (!music) throw new Error('Ajoute une musique au projet avant d’importer son calage.');
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !('format' in data) || data.format !== 'amorce.word-timings.v1' || !('words' in data) || !Array.isArray(data.words)) {
        throw new Error('Ce fichier ne contient pas un calage WhisperX reconnu par Amorce.');
      }
      if ('audio' in data && typeof data.audio === 'string' && data.audio.toLocaleLowerCase('fr-FR') !== music.name.toLocaleLowerCase('fr-FR')) {
        throw new Error(`Ce calage a été créé pour « ${data.audio} », mais la musique du projet est « ${music.name} ».`);
      }
      const mots = data.words.flatMap((item) => {
        if (!item || typeof item !== 'object' || !('text' in item) || !('start' in item) || !('end' in item)) return [];
        const { text, start, end } = item;
        if (typeof text !== 'string' || !text.trim() || typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
        return [{ text: text.trim(), start, end }];
      });
      if (mots.length === 0) throw new Error('Aucun repère mot à mot valide n’a été trouvé dans ce fichier.');

      const musicOffset = music.offset;
      const clipDuration = useStudio.getState().duration();
      if (clipDuration <= 0) throw new Error('Ajoute d’abord au moins un plan au montage pour y placer les paroles.');
      const transcript = 'transcript' in data && typeof data.transcript === 'string' ? data.transcript : '';
      const lignes = transcript
        ? transcript.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        : [];
      const nombreDeMots = (line: string) => line.split(/\s+/).filter(Boolean).length;
      const nombreAnnonce = lignes.reduce((total, line) => total + nombreDeMots(line), 0);
      if (lignes.length === 0 || nombreAnnonce !== mots.length) {
        throw new Error('Le texte et les repères mot à mot ne correspondent pas. Réexporte le calage avec une ligne par phrase.');
      }

      let curseur = 0;
      let derniereSelection: string | undefined;
      let captionsImportees = 0;
      for (const line of lignes) {
        const count = nombreDeMots(line);
        const motsDeLaLigne = mots.slice(curseur, curseur + count);
        curseur += count;
        const timedWords = motsDeLaLigne
          .filter((word) => word.end > musicOffset && word.start - musicOffset < clipDuration)
          .map((word) => ({
            text: word.text,
            start: Math.max(0, word.start - musicOffset),
            end: Math.min(clipDuration, word.end - musicOffset),
          }))
          .filter((word) => word.end > word.start);
        if (timedWords.length === 0) continue;
        const first = timedWords[0];
        const last = timedWords.at(-1)!;
        addCaption('karaoke');
        const created = useStudio.getState().project.captions.at(-1);
        if (!created) throw new Error('Un sous-titre n’a pas pu être ajouté au projet.');
        updateCaption(created.id, {
          text: timedWords.map((word) => word.text).join(' '),
          start: first.start,
          end: last.end,
          mots: timedWords,
          wordTimingSource: 'transcript',
          wordTimingReviewed: false,
        });
        derniereSelection = created.id;
        captionsImportees += 1;
      }
      if (!derniereSelection) throw new Error('Aucune parole ne tombe dans la durée du montage. Allonge le montage ou déplace la musique.');
      if (derniereSelection) select({ kind: 'caption', id: derniereSelection });
      setTranscriptionMessage(`${mots.length} mots importés en ${captionsImportees} lignes — écoute et corrige les passages incertains.`);
      setTranscriptionError('');
    } catch (error) {
      setTranscriptionMessage('');
      setTranscriptionError(error instanceof Error ? error.message : 'Le calage local n’a pas pu être importé.');
    }
  };

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
            {/*
              `ghost` et non `subtle` : ce dernier n'a pour tout indice qu'un
              fond au survol, et un téléphone ne survole pas — le bouton
              s'affichait en gris permanent, indistinguable du texte au-dessus.
            */}
            <Button
              variant="ghost"
              className="mt-2 w-full"
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
        title={hasParoles ? 'Paroles et sous-titres' : 'Sous-titres'}
        subtitle={hasParoles
          ? 'Préserve les paroles exactes, puis écoute le morceau pour relire le texte et son calage.'
          : 'La majorité regarde sans le son. Vise environ 70 % de la vidéo couverte par du texte.'}
        action={
          <div className="flex gap-1">
            {hasParoles && (
              <Button variant="ghost" onClick={() => transcriptionFile.current?.click()} title="Importer une transcription WhisperX calculée localement">
                Importer le calage
              </Button>
            )}
            <Button variant="ghost" onClick={() => addCaption('punch')} title="Ajouter à la position de lecture">
            + Ajouter
            </Button>
          </div>
        }
      >
        {hasParoles && (
          <div className="mb-3 rounded-xl border border-edge bg-slab p-3">
            <p className="text-xs font-semibold text-mist">Paroles de « {music.name} »</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Transcris ce fichier avec le script WhisperX local fourni dans <code>scripts/transcription-locale/</code>, puis importe son JSON ici. L’audio reste sur ton appareil.
            </p>
            {transcriptionMessage && <p className="mt-2 text-[11px] text-accent" aria-live="polite">{transcriptionMessage}</p>}
            {transcriptionError && <p className="mt-2 text-[11px] text-danger" role="alert">{transcriptionError}</p>}
            <input
              ref={transcriptionFile}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Choisir un fichier de calage WhisperX"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importerCalageLocal(file);
              }}
            />
          </div>
        )}
        {aDeLaVoix && couverture < 0.5 && (
          <div className="mb-3">
            <Hint>
            Tu parles dans tes rushes ? Plus rapide qu’un par un : va dans <strong>Monter</strong>,
            choisis un plan, ouvre <strong>« Sous-titrer ce que je dis »</strong>, écris ton texte
            d’un bloc et touche <strong>« Caler sur ma voix »</strong>. L’application découpe et
              place les sous-titres elle-même.
            </Hint>
          </div>
        )}

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
        <div ref={editeur} className="scroll-mt-[40dvh]">
        <Panel
          title="Texte sélectionné"
          action={
            <Button variant="danger" onClick={() => removeCaption(selected.id)}>
              Supprimer
            </Button>
          }
        >
          <Field
            label="Texte"
            help={hasParoles
              ? 'Garde les paroles exactes. Une ligne par phrase facilite la relecture et le calage.'
              : 'Court et frappant. Une idée par phrase, pas deux.'}
          >
            <textarea
              value={selected.text}
              rows={2}
              onChange={(event) => {
                const text = event.target.value;
                const words = text.trim().split(/\s+/).filter(Boolean);
                const sameWords = selected.mots?.length === words.length
                  && selected.mots.every((word, index) => word.text === words[index]);
                updateCaption(selected.id, {
                  text,
                  // Toute retouche du texte — ponctuation comprise — invalide
                  // l’écoute précédente. On conserve les repères seulement si
                  // chaque mot reste strictement identique et dans le même ordre.
                  wordTimingReviewed: text === selected.text ? selected.wordTimingReviewed : false,
                  ...(sameWords ? {} : { mots: undefined }),
                });
              }}
              className="w-full resize-none min-h-11 rounded-xl bg-slab px-3 py-2 text-sm text-mist outline-none focus:border-accent"
            />
          </Field>

          {selected.style === 'karaoke' && (
            <Field
              label="Calage mot à mot"
              help="Ajuste chaque début et chaque fin sur la timeline. Modifier les paroles efface les repères devenus incompatibles."
            >
              {selected.mots?.length ? (
                <>
                  <p className="mb-2 text-[11px] text-muted">
                    {selected.wordTimingSource === 'transcript'
                      ? 'Brouillon automatique — les paroles et les temps peuvent contenir des erreurs.'
                      : selected.wordTimingSource === 'manual'
                        ? 'Repères retouchés à la main — vérifie aussi les mots non retouchés.'
                        : selected.wordTimingSource === 'estimated'
                          ? 'Répartition estimée à partir des passages parlés, non vérifiée mot à mot.'
                          : 'Repères hérités sans origine confirmée.'}
                  </p>
                  <ol className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-edge bg-slab p-2">
                  {selected.mots.map((word, index) => (
                    <li key={`${selected.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] items-center gap-2">
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-xs font-semibold text-mist hover:text-accent"
                        title={`Aller à ${word.start.toFixed(2)} secondes`}
                        onClick={() => useStudio.setState({ playhead: word.start })}
                      >
                        {index + 1}. {word.text}
                      </button>
                      <label className="sr-only" htmlFor={`mot-debut-${selected.id}-${index}`}>Début de « {word.text} » en secondes</label>
                      <input
                        id={`mot-debut-${selected.id}-${index}`}
                        aria-label={`Début de ${word.text}`}
                        type="number"
                        min={0}
                        max={duration}
                        step={0.01}
                        value={word.start.toFixed(2)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          const previousEnd = selected.mots![index - 1]?.end ?? 0;
                          const mots = selected.mots!.map((item, i) => i === index
                            ? { ...item, start: Math.max(previousEnd, Math.min(value, item.end - 0.02)) }
                            : item);
                          updateCaption(selected.id, { mots, wordTimingReviewed: false, start: mots[0].start, end: mots.at(-1)!.end });
                        }}
                        className="w-full rounded-lg border border-edge bg-raised px-1.5 py-1 text-center font-mono text-[11px] text-mist"
                      />
                      <label className="sr-only" htmlFor={`mot-fin-${selected.id}-${index}`}>Fin de « {word.text} » en secondes</label>
                      <input
                        id={`mot-fin-${selected.id}-${index}`}
                        aria-label={`Fin de ${word.text}`}
                        type="number"
                        min={0}
                        max={duration}
                        step={0.01}
                        value={word.end.toFixed(2)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          const nextStart = selected.mots![index + 1]?.start ?? duration;
                          const mots = selected.mots!.map((item, i) => i === index
                            ? { ...item, end: Math.max(item.start + 0.02, Math.min(value, nextStart)) }
                            : item);
                          updateCaption(selected.id, { mots, wordTimingReviewed: false, start: mots[0].start, end: mots.at(-1)!.end });
                        }}
                        className="w-full rounded-lg border border-edge bg-raised px-1.5 py-1 text-center font-mono text-[11px] text-mist"
                      />
                    </li>
                  ))}
                  </ol>
                </>
              ) : (
                <Hint tone="warn">
                  Aucun repère audio mot à mot n’est enregistré pour ce texte. Le surlignage actuel répartit sa durée uniformément ; il ne doit pas être présenté comme un calage vérifié.
                  <Button
                    variant="ghost"
                    className="mt-2 w-full"
                    onClick={() => {
                      const words = selected.text.trim().split(/\s+/).filter(Boolean);
                      const span = Math.max(0, selected.end - selected.start);
                      const mots = words.map((text, index) => ({
                        text,
                        start: selected.start + (span * index) / Math.max(1, words.length),
                        end: selected.start + (span * (index + 1)) / Math.max(1, words.length),
                      }));
                      updateCaption(selected.id, {
                        mots,
                        wordTimingSource: selected.wordTimingSource === 'transcript' ? 'transcript' : 'estimated',
                        wordTimingReviewed: false,
                      });
                    }}
                  >
                    Créer une base à retoucher mot par mot
                  </Button>
                </Hint>
              )}
            </Field>
          )}

          {selected.wordTimingSource === 'transcript' && (
            <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border border-edge bg-raised p-3 text-xs leading-relaxed text-mist">
              <input
                type="checkbox"
                checked={selected.wordTimingReviewed === true}
                disabled={!selected.mots?.length}
                onChange={(event) => updateCaption(selected.id, { wordTimingReviewed: event.target.checked })}
                className="mt-0.5 size-4 accent-accent"
              />
              <span>
                J’ai écouté le morceau et vérifié les paroles ainsi que les débuts et fins des mots.
                {!selected.mots?.length && <span className="mt-1 block text-muted">Rétablis ou crée d’abord les repères mot à mot ci-dessus.</span>}
              </span>
            </label>
          )}

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
              onChange={(value) => updateCaption(selected.id, { start: Math.min(value, selected.end - 0.2), ...(selected.wordTimingSource === 'transcript' ? { wordTimingReviewed: false } : {}) })}
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
              onChange={(value) => updateCaption(selected.id, { end: Math.max(value, selected.start + 0.2), ...(selected.wordTimingSource === 'transcript' ? { wordTimingReviewed: false } : {}) })}
            />
          </Field>

          <Field
            label="Hauteur à l’écran"
            value={`${Math.round(selected.y * 100)} %`}
            help={`Tu peux aussi le faire glisser dans l’aperçu. La bande sûre commune à TikTok, Instagram et Facebook va de ${Math.round(BANDE_SURE.haut * 100)} % à ${Math.round(BANDE_SURE.bas * 100)} % de la hauteur.`}
          >
            <Slider
              ariaLabel="Position verticale"
              min={BANDE_SURE.haut}
              max={BANDE_SURE.bas}
              step={0.01}
              value={selected.y}
              onChange={(value) => updateCaption(selected.id, { y: value })}
            />
          </Field>
        </Panel>
        </div>
      )}
    </div>
  );
}
