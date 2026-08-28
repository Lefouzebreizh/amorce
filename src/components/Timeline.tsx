'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { CAPTION_STYLES } from '@/lib/captions';
import { formatTime } from '@/lib/media';
import { SFX_LIBRARY } from '@/lib/sfx';
import { useStudio } from '@/lib/store';
import { layoutClips } from '@/lib/timeline';
import { TRANSITION_LABELS } from '@/lib/transitions';
import type { PlaybackEngine } from '@/hooks/usePlayback';

/**
 * Timeline.
 *
 * Trois pistes superposées et alignées sur le même axe temporel : les plans, les
 * sous-titres, les bruitages. Voir les trois d'un coup est ce qui rend visible le
 * problème que l'analyse chiffre — un long plan sans texte ni son au-dessus de
 * lui saute aux yeux avant même de lire la note.
 */

/** Échelle d'affichage. Un plan de 2 s occupe ainsi une largeur confortable. */
const PX_PER_SEC = 64;

/**
 * Marge ajoutée à droite de la piste.
 *
 * Les éléments sont positionnés par leur bord gauche à leur instant : le
 * dernier bruitage d'un montage déborderait donc de la largeur calculée, et son
 * intitulé serait tronqué par le défilement horizontal.
 */
const RIGHT_GUTTER = 96;

/** Hauteur réservée en haut pour l'étiquette de la tête de lecture. */
const LABEL_ROW = 14;

/** Marge conservée entre la tête de lecture et le bord, au défilement suivi. */
const FOLLOW_MARGIN = 72;

/** Largeur plancher d'un bloc, pour qu'il reste attrapable au doigt. */
const MIN_BLOCK_WIDTH = 34;

/** En dessous, le bloc n'a plus la place d'afficher quoi que ce soit. */
const LABEL_THRESHOLD = 64;

export function Timeline({
  engine,
  compact = false,
}: {
  engine: PlaybackEngine;
  /**
   * Version resserrée : seule la piste des plans est conservée.
   *
   * Sur un téléphone panneau ouvert, la hauteur manque. Les pistes texte et son
   * sont alors les premières sacrifiées — leur contenu est de toute façon listé
   * dans le panneau correspondant, alors que désigner un plan n'a pas
   * d'équivalent ailleurs.
   */
  compact?: boolean;
}) {
  const clips = useStudio((s) => s.project.clips);
  const captions = useStudio((s) => s.project.captions);
  const cues = useStudio((s) => s.project.cues);
  const assets = useStudio((s) => s.project.assets);
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const moveClip = useStudio((s) => s.moveClip);
  const duration = useStudio((s) => s.duration());

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const touch = useIsTouch();

  /*
   * Réordonner un plan au doigt.
   *
   * Le glisser-déposer HTML5 ne répond pas au tactile : sur téléphone, la seule
   * façon de déplacer un plan était de le sélectionner puis d'appuyer sur des
   * flèches dans un panneau, plusieurs écrans plus bas. Sur la frise elle-même,
   * un plan ne bougeait pas — c'est ce qui sépare un jouet d'un studio.
   *
   * **Appui long pour saisir, pas glissé direct.** La frise défile
   * horizontalement au doigt : un glissé qui déplacerait un plan volerait le
   * geste du défilement, et un montage un peu long deviendrait impossible à
   * parcourir. Après trois cent cinquante millisecondes sans bouger, en
   * revanche, l'intention n'est plus ambiguë — c'est le geste que le pouce
   * connaît déjà partout ailleurs.
   *
   * Le mouvement pendant l'attente annule la saisie : quelqu'un qui fait
   * défiler ne doit jamais se retrouver à déplacer un plan sans l'avoir voulu.
   */
  const saisie = useRef<{
    pointeur: number;
    depart: number;
    x: number;
    y: number;
    minuterie: number;
  } | null>(null);
  const [saisi, setSaisi] = useState<number | null>(null);
  const [survole, setSurvole] = useState<number | null>(null);

  /*
   * Une fois le plan saisi, le défilement du navigateur doit se taire.
   *
   * `touch-action` est consulté au début du geste, donc le changer maintenant
   * ne suffit pas. Seul un écouteur non passif qui refuse l'événement arrête un
   * défilement en cours — et React pose les siens en passif.
   */
  useEffect(() => {
    if (saisi === null) return;
    const refuser = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', refuser, { passive: false });
    return () => document.removeEventListener('touchmove', refuser);
  }, [saisi]);

  const relacher = () => {
    if (saisie.current) window.clearTimeout(saisie.current.minuterie);
    saisie.current = null;
    setSaisi(null);
    setSurvole(null);
  };

  /** Sur quel plan le doigt se trouve, d'après sa position dans la piste. */
  const plansSous = (clientX: number): number | null => {
    const bornes = trackRef.current?.getBoundingClientRect();
    if (!bornes) return null;
    const t = (clientX - bornes.left) / PX_PER_SEC;
    const trouve = placed.findIndex((item) => t >= item.start && t < item.end);
    if (trouve !== -1) return trouve;
    // Au-delà du dernier plan, on vise la fin : c'est le geste « mets-le à la
    // fin », qui n'aurait sinon aucune cible.
    return t >= (placed[placed.length - 1]?.end ?? 0) ? placed.length - 1 : null;
  };

  const placed = layoutClips(clips);
  const width = Math.max(320, duration * PX_PER_SEC + RIGHT_GUTTER);

  const seekFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    engine.seek((event.clientX - bounds.left) / PX_PER_SEC);
  };

  if (clips.length === 0) {
    return (
      <div className="rounded-2xl bg-panel px-4 py-6 text-center text-[12.5px] text-muted">
        La timeline est vide. Ajoute un rush depuis la bibliothèque.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="group"
      aria-label="Timeline du montage"
      // `pan-x` laisse le doigt faire défiler la timeline horizontalement tout
      // en réservant le geste vertical à la page : sans cette précision, le
      // navigateur choisit l'un ou l'autre et se trompe une fois sur deux.
      className={`overflow-x-auto overscroll-x-contain rounded-2xl bg-panel [touch-action:pan-x] ${compact ? 'p-2' : 'p-3'}`}
    >
      <div
        ref={trackRef}
        className="relative select-none"
        style={{ width, paddingTop: LABEL_ROW }}
        onClick={seekFromEvent}
      >
        <TimeRuler duration={duration} />

        {/* Piste des plans */}
        <div className={`relative mt-1 ${compact ? 'h-12' : 'h-16'}`}>
          {placed.map((item) => {
            const asset = assets.find((a) => a.id === item.clip.assetId);
            const active = selection?.kind === 'clip' && selection.id === item.clip.id;
            const blockWidth = Math.max(MIN_BLOCK_WIDTH, item.duration * PX_PER_SEC);
            // Un plan très court occupe quelques pixels : y forcer du texte le
            // ferait s'empiler lettre par lettre et déborder du bloc.
            const showLabels = blockWidth >= LABEL_THRESHOLD;
            return (
              <div
                key={item.clip.id}
                // À la souris, le glisser-déposer natif reste le meilleur
                // geste : il porte son propre curseur et son propre retour.
                draggable={!touch}
                onDragStart={() => setDragIndex(item.index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex !== null && dragIndex !== item.index) moveClip(dragIndex, item.index);
                  setDragIndex(null);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === 'mouse') return;
                  const cible = event.currentTarget;
                  saisie.current = {
                    pointeur: event.pointerId,
                    depart: item.index,
                    x: event.clientX,
                    y: event.clientY,
                    minuterie: window.setTimeout(() => {
                      setSaisi(item.index);
                      setSurvole(item.index);
                      // La capture garde les événements sur ce bloc même quand
                      // le doigt le quitte : sans elle, déplacer un plan
                      // au-delà de son voisin coupe le geste au premier bord.
                      try {
                        cible.setPointerCapture(event.pointerId);
                      } catch {
                        // Un pointeur déjà relâché : rien à capturer.
                      }
                      // Une courte vibration dit que le plan est en main. Sans
                      // elle, on ne sait pas si l'appui a été assez long.
                      navigator.vibrate?.(12);
                    }, 350),
                  };
                }}
                onPointerMove={(event) => {
                  const s = saisie.current;
                  if (!s || s.pointeur !== event.pointerId) return;
                  if (saisi === null) {
                    // Encore en attente : tout mouvement franc est un
                    // défilement, pas une saisie.
                    const bouge = Math.hypot(event.clientX - s.x, event.clientY - s.y);
                    if (bouge > 10) relacher();
                    return;
                  }
                  const dessous = plansSous(event.clientX);
                  if (dessous !== null && dessous !== survole) setSurvole(dessous);
                }}
                onPointerUp={(event) => {
                  const s = saisie.current;
                  const arrivee = survole;
                  const depart = s?.depart ?? null;
                  const enMain = saisi !== null;
                  relacher();
                  if (enMain && depart !== null && arrivee !== null && arrivee !== depart) {
                    moveClip(depart, arrivee);
                    event.stopPropagation();
                  }
                }}
                onPointerCancel={relacher}
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'clip', id: item.clip.id });
                }}
                title={`${asset?.name ?? 'Plan'} — ${item.duration.toFixed(1)} s`}
                className={`absolute top-0 ${compact ? 'h-12' : 'h-16'} cursor-grab overflow-hidden rounded-lg border bg-cover bg-center transition-colors active:cursor-grabbing ${
                  saisi === item.index
                    ? 'z-20 border-select opacity-90 shadow-[0_10px_24px_-6px_rgba(0,0,0,0.9)] ring-2 ring-select'
                    : survole === item.index && saisi !== null
                      ? 'border-select ring-1 ring-select/60'
                      : active
                        ? 'border-select ring-1 ring-select'
                        : 'border-edge hover:border-muted'
                }`}
                style={{
                  left: item.start * PX_PER_SEC,
                  width: blockWidth,
                  backgroundImage: asset?.thumbnail ? `url(${asset.thumbnail})` : undefined,
                  // Le plan saisi se soulève : sans ce déplacement, rien ne
                  // distingue « en main » de « sélectionné », et l'on relâche
                  // sans savoir si le geste avait pris.
                  transform: saisi === item.index ? 'translateY(-6px) scale(1.04)' : undefined,
                }}
              >
                <div className="flex h-full flex-col justify-between overflow-hidden bg-gradient-to-t from-black/85 via-black/30 to-black/50 p-1.5">
                  {showLabels ? (
                    <>
                      <span className="truncate text-[10px] font-semibold whitespace-nowrap text-mist">
                        {item.index + 1}. {asset?.name ?? 'Plan'}
                      </span>
                      <span className="truncate text-[10px] whitespace-nowrap text-mist/70">
                        {item.duration.toFixed(1)} s
                        {item.transitionIn > 0 && ` · ${TRANSITION_LABELS[item.clip.transition]}`}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-semibold text-mist">{item.index + 1}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Piste des sous-titres */}
        {!compact && (
        <Lane label="Texte">
          {captions.map((caption) => {
            const active = selection?.kind === 'caption' && selection.id === caption.id;
            return (
              <button
                key={caption.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'caption', id: caption.id });
                }}
                title={`${caption.text} — style ${CAPTION_STYLES[caption.style].label}`}
                className={`absolute top-0 h-9 overflow-hidden rounded-md border px-2 text-left text-[11px] leading-9 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-select bg-select/20 text-mist'
                    : 'border-edge bg-slab text-muted hover:border-muted hover:text-mist'
                }`}
                style={{
                  left: caption.start * PX_PER_SEC,
                  width: Math.max(44, (caption.end - caption.start) * PX_PER_SEC),
                }}
              >
                {caption.text || '(texte vide)'}
              </button>
            );
          })}
        </Lane>
        )}

        {/* Piste des bruitages */}
        {!compact && (
        <Lane label="Son">
          {cues.map((cue) => {
            const active = selection?.kind === 'cue' && selection.id === cue.id;
            const descriptor = SFX_LIBRARY.find((s) => s.id === cue.sfx);
            return (
              <button
                key={cue.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  select({ kind: 'cue', id: cue.id });
                }}
                title={`${descriptor?.label ?? cue.sfx} à ${cue.time.toFixed(2)} s`}
                className={`absolute top-0 h-9 rounded-md border px-2 text-[11px] leading-9 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-select bg-select/20 text-mist'
                    : 'border-edge bg-slab text-muted hover:border-muted hover:text-mist'
                }`}
                style={{ left: cue.time * PX_PER_SEC }}
              >
                {descriptor?.label ?? cue.sfx}
              </button>
            );
          })}
        </Lane>
        )}

        <Playhead scrollRef={scrollRef} />
      </div>
    </div>
  );
}

function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative mt-1.5 h-9">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Graduations, une par seconde. */
function TimeRuler({ duration }: { duration: number }) {
  const ticks = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);
  return (
    <div className="relative h-4 border-b border-edge">
      {ticks.map((second) => (
        <span
          key={second}
          className="absolute top-0 h-4 border-l border-edge pl-1 font-mono text-[9px] leading-4 text-muted"
          style={{ left: second * PX_PER_SEC }}
        >
          {second}s
        </span>
      ))}
    </div>
  );
}

/**
 * Marqueur de lecture, isolé dans son propre composant.
 *
 * Il est le seul élément à changer soixante fois par seconde : le sortir de la
 * timeline évite de recalculer et de retracer toutes les pistes à chaque image.
 */
function Playhead({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const playhead = useStudio((s) => s.playhead);
  const x = playhead * PX_PER_SEC;

  /*
   * Sur un écran étroit, la tête de lecture sort du cadre au bout de quelques
   * secondes. Le défilement la suit — en lecture **comme à l'arrêt**.
   *
   * Il ne suivait d'abord qu'en lecture, au motif qu'à l'arrêt cela volerait le
   * geste de quelqu'un qui explore sa frise à la main. Le motif ne tient pas :
   * un doigt qui fait glisser la frise ne déplace pas la tête de lecture, et
   * cet effet ne part donc jamais pour lui. Ce qu'il interdisait, c'était
   * l'autre geste — déplacer le curseur de lecture — après lequel la frise
   * restait où elle était, tête de lecture hors champ. On ne pouvait alors plus
   * choisir une image précise ni voir quel texte lui correspond, ce qui est
   * pourtant tout l'objet du curseur.
   */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const vue = container.clientWidth;
    // Une largeur nulle arrive pendant une passe de mise en page : la marge
    // deviendrait plus grande que la vue et la condition ci-dessous se
    // déclencherait toujours, ou jamais, selon le signe.
    if (vue <= 0) return;

    const left = container.scrollLeft;
    const right = left + vue;
    // La marge ne peut pas dépasser le tiers de la vue : sur une frise étroite,
    // les 72 px fixes se chevauchaient et la fenêtre utile devenait vide.
    const marge = Math.min(FOLLOW_MARGIN, vue / 3);
    if (x < left + marge || x > right - marge) {
      /*
       * Recentrage **immédiat**, pas animé.
       *
       * En `smooth`, un nouveau défilement partait à chaque image sans laisser
       * le précédent finir : chacun annulait le suivant, et sur un téléphone la
       * frise se recentrait une fois puis se figeait — mesuré sur un montage de
       * 19,6 s où elle affichait encore 0-5 s pendant que la lecture passait
       * 11,2 s. La tête de lecture était alors hors champ, et l'on ne pouvait
       * plus savoir où l'on était dans son propre montage.
       *
       * Une animation n'a de toute façon rien à apporter ici : ce qui bouge est
       * la lecture, et elle bouge déjà.
       */
      // Affectation directe plutôt que `scrollTo`. En `smooth`, un nouveau
      // défilement partait à chaque image sans laisser le précédent finir, et
      // chacun annulait le suivant ; même en `auto`, `scrollTo` reste soumis à
      // un `scroll-behavior` hérité que le style peut poser ailleurs. Une
      // affectation ne s'anime jamais et ne s'annule pas.
      container.scrollLeft = Math.max(0, x - vue / 2);
    }
  }, [x, scrollRef]);

  return (
    <>
      <div
        className="pointer-events-none absolute bottom-0 z-20 w-px bg-accent"
        style={{ left: x, top: LABEL_ROW }}
      >
        <span className="absolute -top-0.5 -left-1 h-2 w-2 rounded-full bg-accent" />
      </div>

      {/* L'étiquette occupe sa propre bande, au-dessus de la règle des secondes,
          et reste collée au bord gauche tant que la tête n'a pas assez avancé
          pour la centrer sans la faire sortir du cadre. */}
      <span
        className="pointer-events-none absolute top-0 z-20 font-mono text-[9px] leading-none text-accent"
        style={{ left: Math.max(0, x - 16) }}
      >
        {formatTime(playhead)}
      </span>
    </>
  );
}
