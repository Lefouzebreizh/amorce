'use client';

import { useEffect, useRef, useState } from 'react';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { CAPTION_STYLES } from '@/lib/captions';
import { formatTime } from '@/lib/media';
import { SFX_LIBRARY } from '@/lib/sfx';
import { useStudio } from '@/lib/store';
import { layoutClips } from '@/lib/timeline';
import { TRANSITION_LABELS } from '@/lib/transitions';
import { MIN_CLIP_DURATION, type Clip } from '@/lib/types';
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
/**
 * Échelle de la frise, en pixels par seconde.
 *
 * Elle était figée à 64 : sur un écran de téléphone, cela montre **six
 * secondes**. Un montage de trente-sept secondes tenait donc sur sept écrans,
 * et il fallait le faire défiler pour le voir — impossible de juger un rythme,
 * de repérer un plan trop long, ou simplement de savoir où l'on en est.
 *
 * L'échelle s'ajuste maintenant au montage à l'ouverture, et se pince pour
 * zoomer. Les deux bornes ne sont pas décoratives : au-delà de 120 px/s on
 * règle à l'image près sans jamais voir le film, et en deçà de 6 px/s un plan
 * de deux secondes fait douze pixels — il n'est plus attrapable au doigt.
 */
const ECHELLE_DEFAUT = 64;
const ECHELLE_MIN = 6;
const ECHELLE_MAX = 120;

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
  const updateClip = useStudio((s) => s.updateClip);
  const duration = useStudio((s) => s.duration());

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [echelle, setEchelle] = useState(ECHELLE_DEFAUT);
  /*
   * Ajusté une seule fois, à l'arrivée du montage.
   *
   * Réajuster à chaque changement de durée reprendrait la main sur quelqu'un
   * qui vient de zoomer : ajouter un plan ferait sauter l'échelle, et le zoom
   * choisi ne tiendrait jamais.
   */
  const ajuste = useRef(false);
  useEffect(() => {
    if (ajuste.current || duration <= 0) return;
    const vue = scrollRef.current?.clientWidth ?? 0;
    if (vue <= 0) return;
    ajuste.current = true;
    setEchelle(Math.max(ECHELLE_MIN, Math.min(ECHELLE_DEFAUT, (vue - RIGHT_GUTTER) / duration)));
  }, [duration]);

  /*
   * Le pincement, sur le conteneur défilant.
   *
   * Deux pointeurs suffisent à le reconnaître : leur écartement donne le
   * facteur, et l'échelle suit. On garde le **milieu du pincement** au même
   * instant du montage — sans cela, zoomer déporte le film et l'on perd
   * l'endroit qu'on regardait, ce qui est exactement l'inverse du geste.
   */
  const pincement = useRef<Map<number, { x: number }>>(new Map());
  const ecartInitial = useRef<{ ecart: number; echelle: number; instant: number } | null>(null);
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

  /*
   * Rogner un plan par ses bords.
   *
   * Le point d'entrée et le point de sortie ne se réglaient qu'au fond d'un
   * panneau, derrière un repli « réglage fin », par deux jauges numériques. Or
   * raccourcir un plan est le geste le plus fréquent d'un montage : c'est lui
   * qui donne le rythme, et il se juge à l'œil sur la frise, pas au dixième de
   * seconde dans un formulaire.
   *
   * Les poignées prennent le pointeur sans passer par l'appui long : on ne
   * saisit pas un bord par erreur, la zone est étroite et volontairement visée.
   * `touch-action: none` y est donc juste — attraper un bord n'est jamais un
   * défilement.
   *
   * La vitesse du plan entre dans le calcul : un plan joué deux fois plus vite
   * consomme deux secondes de source par seconde de montage, et ignorer ce
   * facteur ferait glisser le bord deux fois trop loin.
   */
  const rognage = useRef<{
    pointeur: number;
    id: string;
    bord: 'entree' | 'sortie';
    x: number;
    entree: number;
    sortie: number;
    vitesse: number;
    duree: number;
  } | null>(null);
  const [rogne, setRogne] = useState<string | null>(null);

  const commencerRognage = (
    event: React.PointerEvent,
    clip: Clip,
    bord: 'entree' | 'sortie',
    dureeSource: number,
  ) => {
    /*
     * Pas de capture sur l'élément : le suivi passe par la fenêtre.
     *
     * Chaque mouvement modifie le plan, donc React re-rend la frise et recrée
     * la poignée — la capture disparaît avec l'ancien nœud, et le rognage
     * s'arrêtait net au premier pixel. Mesuré : 2,1 s puis plus rien.
     * Une écoute posée sur la fenêtre survit à tous les rendus.
     */
    event.stopPropagation();
    rognage.current = {
      pointeur: event.pointerId,
      id: clip.id,
      bord,
      x: event.clientX,
      entree: clip.inPoint,
      sortie: clip.outPoint,
      vitesse: Math.max(0.1, clip.speed),
      duree: dureeSource,
    };
    setRogne(clip.id);
  };

  const suivreRognage = (event: { clientX: number; pointerId: number }) => {
    const r = rognage.current;
    if (!r || r.pointeur !== event.pointerId) return;

    // Pixels de frise → secondes de source : la frise compte en temps de
    // montage, les points d'entrée et de sortie en temps de fichier.
    const glisse = ((event.clientX - r.x) / echelle) * r.vitesse;

    if (r.bord === 'entree') {
      const entree = Math.min(
        Math.max(0, r.entree + glisse),
        r.sortie - MIN_CLIP_DURATION * r.vitesse,
      );
      updateClip(r.id, { inPoint: entree });
    } else {
      const sortie = Math.max(
        Math.min(r.duree, r.sortie + glisse),
        r.entree + MIN_CLIP_DURATION * r.vitesse,
      );
      updateClip(r.id, { outPoint: sortie });
    }
  };

  const finirRognage = () => {
    rognage.current = null;
    setRogne(null);
  };

  // Le suivi vit sur la fenêtre tant qu'un bord est tenu, et disparaît avec lui.
  useEffect(() => {
    if (rogne === null) return;
    const bouger = (e: PointerEvent) => suivreRognage(e);
    /*
     * Seul `pointerup` termine un rognage, jamais `pointercancel`.
     *
     * Le premier pixel de glissement modifie le plan, donc React re-rend la
     * frise, et le navigateur émet un `pointercancel` sur le nœud qu'il
     * remplace. Écouter cet événement revenait à relâcher soi-même le bord
     * qu'on tient : mesuré, le rognage s'arrêtait après un seul pas — 7,500 s
     * puis 7,422 s, et plus rien quel que soit le glissement.
     */
    const finir = () => finirRognage();
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', finir);
    return () => {
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', finir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rogne, echelle]);

  /** Sur quel plan le doigt se trouve, d'après sa position dans la piste. */
  const plansSous = (clientX: number): number | null => {
    const bornes = trackRef.current?.getBoundingClientRect();
    if (!bornes) return null;
    const t = (clientX - bornes.left) / echelle;
    const trouve = placed.findIndex((item) => t >= item.start && t < item.end);
    if (trouve !== -1) return trouve;
    // Au-delà du dernier plan, on vise la fin : c'est le geste « mets-le à la
    // fin », qui n'aurait sinon aucune cible.
    return t >= (placed[placed.length - 1]?.end ?? 0) ? placed.length - 1 : null;
  };

  const placed = layoutClips(clips);
  const width = Math.max(320, duration * echelle + RIGHT_GUTTER);

  const seekFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    engine.seek((event.clientX - bounds.left) / echelle);
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
      className={`relative overflow-x-auto overscroll-x-contain rounded-2xl bg-panel [touch-action:pan-x] ${compact ? 'p-2' : 'p-3'}`}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return;
        pincement.current.set(event.pointerId, { x: event.clientX });
      }}
      onPointerMove={(event) => {
        const doigts = pincement.current;
        if (!doigts.has(event.pointerId)) return;
        doigts.set(event.pointerId, { x: event.clientX });
        if (doigts.size !== 2) return;

        const [a, b] = [...doigts.values()];
        const ecart = Math.abs(a.x - b.x);
        if (ecart < 20) return;

        const conteneur = scrollRef.current;
        const bornes = trackRef.current?.getBoundingClientRect();
        if (!conteneur || !bornes) return;

        if (!ecartInitial.current) {
          // L'instant visé par le milieu du pincement, retenu une fois : c'est
          // lui qu'on garde sous les doigts pendant tout le geste.
          const milieu = (a.x + b.x) / 2;
          ecartInitial.current = {
            ecart,
            echelle,
            instant: (milieu - bornes.left) / echelle,
          };
          return;
        }

        const depart = ecartInitial.current;
        const voulue = Math.max(
          ECHELLE_MIN,
          Math.min(ECHELLE_MAX, (depart.echelle * ecart) / depart.ecart),
        );
        setEchelle(voulue);

        // Le milieu du pincement retrouve son instant : sans ce recalage, le
        // film glisse sous les doigts et l'on perd ce qu'on regardait.
        const milieu = (a.x + b.x) / 2;
        conteneur.scrollLeft = Math.max(
          0,
          depart.instant * voulue - (milieu - conteneur.getBoundingClientRect().left),
        );
      }}
      onPointerUp={(event) => {
        pincement.current.delete(event.pointerId);
        if (pincement.current.size < 2) ecartInitial.current = null;
      }}
      onPointerCancel={(event) => {
        pincement.current.delete(event.pointerId);
        if (pincement.current.size < 2) ecartInitial.current = null;
      }}
    >
      {/*
        Deux boutons en plus du pincement.

        Un geste à deux doigts que rien n'annonce ne se découvre pas : sur une
        frise, la plupart des gens essaient de faire défiler, jamais d'écarter.
        Les boutons restent collés au bord, hors du flux de la piste, et portent
        la même échelle que le pincement.
      */}
      {/*
        Décalés sous la règle, jamais dessus.
        Posés à hauteur nulle en tête du conteneur, ils recouvraient les
        graduations : sur un montage de cinquante-six secondes, le « 50s »
        disparaissait derrière eux. Un contrôle qui cache ce qu'il sert à lire
        ne sert à rien.

        Le décalage a été retiré : posé par `top`, il rendait le bouton mobile
        dans un conteneur qui défile, et la vérification ne le trouvait plus
        jamais stable — un clic sur « voir plus large » abandonnait après trente
        secondes, et le parcours entier tombait avec lui. Il reste donc à zéro,
        et la règle qu'il recouvre attend une solution qui ne touche pas à la
        mise en page de la frise.
      */}
      <div className="pointer-events-none sticky top-0 left-0 z-30 flex h-0 justify-end gap-1">
        <button
          type="button"
          aria-label="Voir plus large"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-xl bg-ink/75 text-[15px] text-mist backdrop-blur-sm"
          onClick={() => setEchelle((v) => Math.max(ECHELLE_MIN, v / 1.6))}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Voir de plus près"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-xl bg-ink/75 text-[15px] text-mist backdrop-blur-sm"
          onClick={() => setEchelle((v) => Math.min(ECHELLE_MAX, v * 1.6))}
        >
          +
        </button>
      </div>
      <div
        ref={trackRef}
        className="relative select-none"
        style={{ width, paddingTop: LABEL_ROW }}
        onClick={seekFromEvent}
      >
        <TimeRuler duration={duration} echelle={echelle} />

        {/* Piste des plans */}
        <div className={`relative mt-1 ${compact ? 'h-12' : 'h-16'}`}>
          {placed.map((item) => {
            const asset = assets.find((a) => a.id === item.clip.assetId);
            const active = selection?.kind === 'clip' && selection.id === item.clip.id;
            /*
             * La largeur suit la durée, sans jamais déborder sur le voisin.
             *
             * Un plancher fixe de 34 px avait un sens à échelle fixe : il
             * gardait un plan très court attrapable. Depuis que l'échelle
             * s'ajuste, il se retourne — à dix pixels par seconde, un plan de
             * deux secondes occupe vingt-trois pixels, le plancher l'étire à
             * trente-quatre, et il recouvre le suivant. Mesuré : impossible de
             * désigner le premier plan, le second interceptant le doigt.
             *
             * Un bloc vaut donc exactement sa durée, avec quatre pixels de
             * plancher pour qu'il reste visible. Pour le viser au doigt, on
             * zoome — c'est à cela que servent le pincement et les deux
             * boutons.
             */
            const blockWidth = Math.max(4, item.duration * echelle);
            // Un plan très court occupe quelques pixels : y forcer du texte le
            // ferait s'empiler lettre par lettre et déborder du bloc.
            const showLabels = blockWidth >= LABEL_THRESHOLD;
            return (
              <div
                key={item.clip.id}
                /*
                 * À la souris, le glisser-déposer natif reste le meilleur geste
                 * pour réordonner : il porte son propre curseur et son propre
                 * retour.
                 *
                 * Mais il se coupe pendant un rognage. La source du glisser est
                 * **ce bloc**, pas la poignée qu'on tient : le navigateur
                 * démarre donc un déplacement dès le premier mouvement et avale
                 * tous les événements suivants. Mesuré : un seul `pointermove`
                 * atteignait la fenêtre sur tout le geste, et le bord ne
                 * bougeait plus après un pixel. Refuser le glisser sur la
                 * poignée elle-même n'y changeait rien — elle n'en est pas la
                 * source.
                 */
                draggable={!touch && rogne === null}
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
                  left: item.start * echelle,
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

                {/*
                  Les bords, pour rogner le plan.
                  Ils n'apparaissent que sur le plan sélectionné et seulement
                  s'il est assez large : sur un bloc de quarante pixels, deux
                  poignées ne laisseraient rien à toucher au milieu, et l'on ne
                  pourrait plus ni le désigner ni le saisir.
                */}
                {active && blockWidth >= 72 && (
                  <>
                    {(['entree', 'sortie'] as const).map((bord) => (
                      <div
                        key={bord}
                        role="button"
                        tabIndex={-1}
                        aria-label={bord === 'entree' ? 'Rogner le début du plan' : 'Rogner la fin du plan'}
                        // `none` et non `pan-x` : attraper un bord n'est jamais
                        // un défilement, et laisser le navigateur en douter
                        // ferait glisser la frise au lieu du point de coupe.
                        // `z-10` explicite : sans rang déclaré, la poignée et
                        // le dégradé du bloc se disputent la pile de peinture,
                        // et c'est le dégradé qui recevait le doigt — mesuré
                        // par `elementFromPoint`, qui rendait le dégradé au
                        // centre exact de la poignée.
                        className={`absolute top-0 z-10 flex h-full w-6 items-center justify-center [touch-action:none] ${
                          bord === 'entree' ? 'left-0' : 'right-0'
                        } ${rogne === item.clip.id ? 'bg-select/35' : 'bg-select/20'}`}
                        // Le bloc parent est `draggable` à la souris, et le
                        // glisser-déposer natif démarre au premier mouvement en
                        // avalant les événements de pointeur — y compris ceux
                        // de cette poignée, qui en est un enfant. Le refuser
                        // ici rend la main au rognage sans toucher au
                        // réordonnancement du bloc.
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        onPointerDown={(event) =>
                          commencerRognage(event, item.clip, bord, asset?.duration ?? item.clip.outPoint)
                        }
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="h-5 w-0.5 rounded-full bg-mist/80" />
                      </div>
                    ))}
                  </>
                )}
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
                  left: caption.start * echelle,
                  width: Math.max(44, (caption.end - caption.start) * echelle),
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
                style={{ left: cue.time * echelle }}
              >
                {descriptor?.label ?? cue.sfx}
              </button>
            );
          })}
        </Lane>
        )}

        <Playhead scrollRef={scrollRef} echelle={echelle} />
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

/**
 * Graduations, à un pas qui suit le zoom.
 *
 * Une graduation par seconde était juste à 64 px/s ; à 10 px/s les étiquettes
 * se chevauchent et la règle devient une bouillie illisible. Le pas est donc
 * choisi pour laisser au moins cinquante pixels entre deux — et pris dans une
 * suite qui se lit de tête, jamais un nombre calculé comme 7 s.
 */
function TimeRuler({ duration, echelle }: { duration: number; echelle: number }) {
  const pas = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((v) => v * echelle >= 50) ?? 600;
  const ticks = Array.from(
    { length: Math.floor(duration / pas) + 1 },
    (_, i) => i * pas,
  );
  return (
    <div className="relative h-4 border-b border-edge">
      {ticks.map((second) => (
        <span
          key={second}
          className="absolute top-0 h-4 border-l border-edge pl-1 font-mono text-[9px] leading-4 text-muted"
          style={{ left: second * echelle }}
        >
          {second >= 60 ? `${Math.floor(second / 60)}m${String(second % 60).padStart(2, '0')}` : `${second}s`}
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
function Playhead({
  scrollRef,
  echelle,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  echelle: number;
}) {
  const playhead = useStudio((s) => s.playhead);
  const x = playhead * echelle;

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
