'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AudioEngine } from '@/lib/audio';
import { boxContains, type CaptionBox, type FontSet } from '@/lib/captions';
import { GradePipeline } from '@/lib/grade';
import { guessTier, PanicDetector, QualityGovernor, QUALITY_TIERS, tierById } from '@/lib/quality';
import { ClipVideoPool, preloadCaptionFonts, renderFrame, syncPlayback } from '@/lib/renderer';
import type { Project } from '@/lib/types';
import { useStudio } from '@/lib/store';
import { layoutClips, type PlacedClip } from '@/lib/timeline';
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from '@/lib/types';

/**
 * Boucle de lecture.
 *
 * Une seule `requestAnimationFrame` pilote tout : elle avance la tête de
 * lecture, recale les éléments vidéo, programme les bruitages et trace l'image.
 * La boucle tourne aussi à l'arrêt — c'est ce qui permet de voir immédiatement
 * l'effet d'un réglage sans avoir à relancer la lecture.
 *
 * L'état vivant est lu par `getState()` plutôt que capturé dans la portée du
 * `useEffect` : sans cela, chaque modification du projet obligerait à détruire
 * et recréer la boucle, avec une coupure visible à chaque frappe au clavier.
 */
export type PlaybackEngine = {
  /**
   * Déclare le canvas sur lequel dessiner.
   *
   * C'est le composant d'affichage qui détient son canvas et l'enregistre ici
   * depuis un effet, plutôt que le moteur qui exposerait une ref. L'inverse
   * ferait transiter une ref par les props, ce que React déconseille.
   */
  setCanvas: (canvas: HTMLCanvasElement | null) => void;
  /** Canvas courant, à n'appeler que depuis un gestionnaire ou un effet. */
  getCanvas: () => HTMLCanvasElement | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  /**
   * Sous-titre situé sous un point de l'écran, ou null.
   *
   * Les coordonnées attendues sont celles de la fenêtre ; la conversion vers le
   * repère de sortie est faite ici, puisque le facteur dépend de la taille
   * d'affichage du canvas, qui change avec la mise en page.
   */
  captionAt: (clientX: number, clientY: number) => string | null;
  /** Convertit une position verticale d'écran en hauteur de 0 à 1. */
  toRelativeY: (clientY: number) => number;
  /** Ressources internes, dont l'export a besoin. */
  resources: () => { pool: ClipVideoPool; grade: GradePipeline; audio: AudioEngine | null };
  /** Prépare le mixage audio ; nécessite un geste utilisateur préalable. */
  ensureAudio: () => Promise<AudioEngine>;
  /**
   * Repasse en pleine définition et attend que le canvas soit redimensionné.
   *
   * L'export capture le flux du canvas : sa taille doit être définitive avant
   * que l'enregistrement ne commence, sinon le fichier sortirait à la
   * définition réduite de la prévisualisation.
   */
  beginExport: (scale?: number, horsLigne?: boolean) => Promise<void>;
  /**
   * Compose l'image d'un instant précis et ne rend la main qu'une fois prête.
   *
   * Réservé à l'encodage hors ligne : la boucle d'animation cède le canvas tant
   * que `beginExport` a été appelé avec `horsLigne`.
   */
  composerA: (temps: number, image: number) => Promise<void>;
  /** Rend la main à la surveillance de qualité. */
  endExport: () => void;
  /**
   * Images composées pendant le dernier export.
   *
   * Rapportée à la durée du montage, elle donne la cadence réellement obtenue —
   * la seule façon de dire à l'utilisateur que son fichier saccade avant qu'il
   * ne le découvre en le regardant.
   */
  exportedFrames: () => number;
};

/**
 * Contexte de dessin du canvas courant, mis en cache.
 *
 * La taille du canvas suit le palier de qualité, pas la définition de sortie :
 * un téléphone dessine moins de pixels, tandis que la composition reste écrite
 * en coordonnées 1080 × 1920. L'affichage à l'écran reste affaire de CSS.
 */
function resolveContext(
  canvas: HTMLCanvasElement | null,
  cache: React.RefObject<ContextCache | null>,
  scale: number,
): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  if (cache.current?.canvas === canvas && cache.current.scale === scale) return cache.current.ctx;

  // Redimensionner un canvas vide son contenu et réinitialise son contexte :
  // on ne le fait donc qu'au changement réel d'échelle, pas à chaque image.
  canvas.width = Math.round(OUTPUT_WIDTH * scale);
  canvas.height = Math.round(OUTPUT_HEIGHT * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  cache.current = { canvas, ctx, scale };
  return ctx;
}

type ContextCache = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number };

/**
 * @param marque Texte à graver en bas de l'image, ou rien.
 *   Le moteur reçoit un texte et jamais un état d'abonnement : qui décide de
 *   la marque est l'affaire de l'interface, qui la lui passe. C'est ce qui
 *   garde le moteur ignorant du réseau et de la licence.
 *
 *   Elle ne s'appelle pas `signature`, et ce n'est pas un détail : une variable
 *   locale de cette fonction porte déjà ce nom — l'empreinte qui décide si une
 *   image mérite d'être retracée. Nommer les deux pareil aurait passé cette
 *   empreinte au moteur, qui l'aurait gravée sur chaque image :
 *   `12.500|true|fluide|0.5|540x960|37.200`. Les deux sont des chaînes, donc
 *   ni le compilateur ni les tests n'auraient bronché.
 */
/** Écart en deçà duquel un rush est considéré déjà au bon endroit. */
const TOLERANCE_HORS_LIGNE = 0.004;

/**
 * Délai au-delà duquel on renonce à attendre un déplacement.
 *
 * Un `seeked` qui n'arrive jamais figerait l'export entier. Mieux vaut une
 * image prise un peu tôt qu'un export qui ne rend jamais la main — et le cas
 * ne se produit que sur un fichier abîmé, où l'image d'après sera fausse de
 * toute façon.
 */
const ATTENTE_MAX_MS = 3000;

/**
 * Place un rush à l'instant voulu et attend que l'image y soit réellement.
 *
 * Régler `currentTime` ne change pas l'image tout de suite : le décodeur doit
 * atteindre la position demandée. Dessiner sans attendre `seeked` grave donc
 * l'image **précédente** — et comme l'écart est d'une fraction de seconde, le
 * défaut ne se voit qu'en regardant le film, jamais dans une mesure.
 *
 * Une image fixe n'a rien à déplacer : `getVideo` ne rend que les rushes, et
 * c'est voulu — brancher quoi que ce soit sur un `<img>` lèverait.
 */
function placerA(pool: ClipVideoPool, item: PlacedClip, temps: number): Promise<void> {
  const video = pool.getVideo(item.clip.id);
  if (!video) return Promise.resolve();

  const visible = temps >= item.start && temps < item.end;
  if (!visible) {
    if (!video.paused) video.pause();
    return Promise.resolve();
  }

  // Hors ligne, un rush ne joue jamais : on le déplace image par image. Le
  // laisser jouer le ferait dériver entre deux compositions.
  if (!video.paused) video.pause();

  if (!Number.isFinite(video.duration) || video.readyState === 0) return Promise.resolve();

  const vise = item.clip.inPoint + (temps - item.start) * item.clip.speed;
  const borne = Math.max(0, Math.min(vise, video.duration - 0.02));

  if (Math.abs(video.currentTime - borne) <= TOLERANCE_HORS_LIGNE) return Promise.resolve();

  return new Promise<void>((resoudre) => {
    let fini = false;
    const finir = () => {
      if (fini) return;
      fini = true;
      video.removeEventListener('seeked', finir);
      clearTimeout(minuteur);
      resoudre();
    };
    const minuteur = setTimeout(finir, ATTENTE_MAX_MS);
    video.addEventListener('seeked', finir, { once: true });
    video.currentTime = borne;
  });
}

export function usePlayback(fonts: FontSet, marque?: string): PlaybackEngine {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<ContextCache | null>(null);
  const governorRef = useRef<QualityGovernor | null>(null);
  const panicRef = useRef<PanicDetector | null>(null);
  /**
   * Échelle imposée pendant un export, ou null hors export.
   *
   * La définition de sortie prime alors sur la fluidité — c'est le fichier
   * livré, il ne se rejoue pas.
   */
  const exportingRef = useRef<number | null>(null);

  /*
   * Images réellement composées pendant l'enregistrement.
   *
   * L'export capture le canvas **en temps réel** : le fichier ne reçoit que ce
   * que la boucle a eu le temps de dessiner. Un appareil qui ne tient pas la
   * cadence produit donc un fichier saccadé — et rien ne le disait.
   *
   * Mesuré sur un export livré par l'utilisateur : 222 images pour 17,5 s, soit
   * 12,7 par seconde au lieu de 30, avec des écarts de 9 à 517 ms. Il l'a
   * décrit comme un tremblement, un scintillement, une image qui vibre, et a
   * cherché du côté de l'entrelacement — les deux fichiers étaient pourtant
   * `progressive`. Ce n'est pas une image mal encodée, ce sont des images
   * absentes.
   *
   * Compter ici plutôt que relire le fichier après coup : la boucle sait
   * exactement combien de fois elle a composé, sans décoder quoi que ce soit.
   */
  const exportFramesRef = useRef(0);

  /*
   * Vrai pendant un encodage hors ligne.
   *
   * La boucle d'animation continue de tourner — on ne l'arrête pas, elle porte
   * la sécurité et l'état — mais elle cesse de **dessiner** : pendant un export
   * hors ligne, le canvas appartient à `composerA`, qui le remplit pour un
   * instant précis. Deux écrivains sur le même canvas donneraient une image sur
   * deux prise au mauvais moment, et le défaut ne se verrait qu'au montage.
   */
  const horsLigneRef = useRef(false);
  const poolRef = useRef<ClipVideoPool | null>(null);
  const gradeRef = useRef<GradePipeline | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const frameRef = useRef(0);

  /* Ce qui permet à la boucle de savoir qu'elle n'a rien à redessiner. */
  const signatureRef = useRef('');
  /*
   * La marque vit dans une référence, pas dans les dépendances de la boucle.
   *
   * L'y mettre reconstruirait la boucle d'animation à chaque changement
   * d'abonnement — pour une valeur que le tracé relit à chaque image de toute
   * façon. C'est l'idiome du fichier : ce que la boucle lit sans en dépendre
   * passe par une référence.
   */
  const marqueRef = useRef(marque);
  useEffect(() => {
    marqueRef.current = marque;
  }, [marque]);
  const projetRef = useRef<Project | null>(null);
  const dernierChangementRef = useRef(0);
  const captionBoxesRef = useRef(new Map<string, CaptionBox>());

  if (poolRef.current === null) poolRef.current = new ClipVideoPool();
  if (gradeRef.current === null) gradeRef.current = new GradePipeline();
  if (governorRef.current === null) governorRef.current = new QualityGovernor(guessTier());
  if (panicRef.current === null) panicRef.current = new PanicDetector();

  // Les polices doivent être résolues avant le premier tracé : le canvas ne
  // déclenche aucun chargement et substituerait silencieusement une autre police.
  useEffect(() => {
    void preloadCaptionFonts(fonts);
  }, [fonts]);

  useEffect(() => {
    const pool = poolRef.current;
    const grade = gradeRef.current;
    if (!pool || !grade) return;

    let raf = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const exporting = exportingRef.current !== null;

      /*
       * Le temps écoulé est borné pour absorber les longues interruptions —
       * onglet passé en arrière-plan, machine en veille — qui feraient sinon
       * bondir la tête de lecture de plusieurs secondes.
       *
       * Pendant un export, cette borne devient nuisible : sur un appareil lent,
       * une image peut prendre plus longtemps qu'elle, et la tête de lecture
       * avance alors moins vite que le temps réel. Le fichier produit s'allonge
       * — vingt secondes mesurées pour un montage de sept — pendant que le son,
       * lui, continue en temps réel : l'image et l'audio se désynchronisent.
       *
       * Sans borne, un appareil lent perd des images mais conserve la bonne
       * durée et la bonne synchronisation, ce qui vaut infiniment mieux.
       */
      const delta = exporting ? (now - previous) / 1000 : Math.min(0.25, (now - previous) / 1000);
      previous = now;

      const governor = governorRef.current!;
      const choice = useStudio.getState().qualityChoice;
      const pinned = choice === 'auto' ? null : tierById(choice);
      if (pinned && pinned.id !== governor.current().id) governor.set(pinned);

      // Copie, jamais l'objet du gouverneur : il vient de `QUALITY_TIERS`, et
      // le muter changerait la constante pour toute la session.
      if (exporting) exportFramesRef.current += 1;

      const tier = exporting
        ? { ...tierById('full'), scale: exportingRef.current! }
        : { ...governor.current() };

      /*
       * On ne compose jamais plus de pixels que l'écran n'en montre.
       *
       * L'invariant tient : la composition reste en 1080 × 1920, et la qualité
       * d'aperçu n'agit que par une transformation d'échelle. Mais l'échelle
       * était choisie sur une échelle fixe de quatre paliers, sans regarder la
       * taille à laquelle l'aperçu s'affiche réellement.
       *
       * Or dans le bloc collé d'un téléphone, l'image mesure 80 px de large.
       * On composait 756 px pour en montrer 80 : neuf fois trop, et neuf fois
       * payé. Mesuré, le coût suit la surface — 1080 px coûtent 901 ms par
       * image sur un processeur quatre fois plus lent, 367 px en coûtent 161.
       *
       * Le plancher garde une marge : un aperçu agrandi d'un doigt ne doit pas
       * attendre une recomposition, et un canvas redimensionné est vidé — d'où
       * le cache de `resolveContext`, qu'on ne veut pas invalider au pixel près.
       * L'échelle est donc arrondie par crans de 0,05.
       *
       * Un export n'y passe jamais : la définition de sortie prime, c'est le
       * fichier livré et il ne se rejoue pas.
       *
       * Un palier **choisi à la main** n'y passe pas non plus. Le dépôt garantit
       * qu'il écrase la surveillance, et rogner en silence un choix explicite
       * est précisément ce qu'on ne fait pas ici : quelqu'un qui demande la
       * qualité maximale la demande, y compris pour juger une image avant de
       * l'agrandir. La borne ne s'applique donc qu'en automatique — c'est-à-dire
       * dans le cas par défaut, celui de tout le monde.
       */
      const affiche = canvasRef.current?.getBoundingClientRect().width ?? 0;
      if (!exporting && !pinned && affiche > 0) {
        const besoin = (affiche * Math.min(3, window.devicePixelRatio || 1)) / OUTPUT_WIDTH;
        /*
         * Le plancher vaut le palier « Fluide », 0,34 — soit 367 px composés.
         *
         * Il était à 0,15. Sur un écran large où l'aperçu est petit, la borne
         * descendait alors sous ce que le palier le plus bas compose déjà, et
         * l'image devenait molle dès qu'on l'agrandissait d'un doigt : le temps
         * qu'un nouveau calcul arrive, on regardait une composition de 162 px
         * étirée sur toute la largeur. Mesuré à 324 px après avoir ajouté une
         * ligne de boutons sous la frise, ce qui suffisait à faire tomber
         * l'aperçu sous le palier.
         */
        const cran = Math.max(0.34, Math.ceil(besoin / 0.05) * 0.05);
        if (cran < tier.scale) tier.scale = cran;
      }

      // Le canvas est retrouvé à chaque image plutôt que capturé au démarrage :
      // la boucle devient insensible à l'ordre de montage des composants et
      // survit à un remplacement du canvas.
      // Pendant un encodage hors ligne, le canvas appartient à `composerA`.
      if (horsLigneRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const ctx = resolveContext(canvasRef.current, ctxRef, tier.scale);
      if (!ctx) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const store = useStudio.getState();
      const { project, playing } = store;
      const placed = layoutClips(project.clips);
      const duration = placed.length === 0 ? 0 : placed[placed.length - 1].end;

      /*
       * À l'arrêt, quand rien n'a changé, on ne redessine pas.
       *
       * La boucle composait une image complète soixante fois par seconde même
       * lorsque rien ne bougeait — c'était assumé, pour que le filet de sécurité
       * de la qualité veille en permanence. Mesuré sur un processeur quatre fois
       * plus lent qu'ici, ce qui est l'ordre de grandeur d'un téléphone :
       * **442 ms par image à l'arrêt**, soit deux images par seconde et tout le
       * budget processeur brûlé à redessiner une image identique. L'interface
       * paraissait alors figée partout à la fois — jusqu'à la frise, qu'on
       * croyait ne pas suivre alors qu'elle suivait deux fois par seconde.
       *
       * La signature ne compare que des valeurs déjà en main : le projet est
       * remplacé à chaque modification, donc son identité suffit ; `currentTime`
       * se lit sans forcer de mise en page, contrairement à toute mesure de
       * géométrie. Elle capte donc aussi la fin d'un repositionnement, qui
       * arrive après coup et doit être redessinée.
       *
       * Le délai de grâce couvre ce qui n'apparaît dans aucune de ces valeurs :
       * une police qui finit de charger, une vignette décodée, une première
       * image encore absente. Une seconde après le dernier changement, on
       * s'endort.
       */
      let horloge = 0;
      for (const item of placed) {
        const v = pool.getVideo(item.clip.id);
        if (v) horloge += v.currentTime;
      }
      const signature = `${store.playhead.toFixed(3)}|${playing}|${tier.id}|${tier.scale}|`
        + `${ctx.canvas.width}x${ctx.canvas.height}|${horloge.toFixed(3)}`;
      const change = signature !== signatureRef.current || project !== projetRef.current;
      if (change) {
        signatureRef.current = signature;
        projetRef.current = project;
        dernierChangementRef.current = now;
      }
      const REPOS_MS = 1000;
      if (!playing && !exporting && !change && now - dernierChangementRef.current > REPOS_MS) {
        raf = requestAnimationFrame(loop);
        return;
      }

      let time = store.playhead;
      if (playing && duration > 0) {
        time += delta;
        if (time >= duration) {
          time = duration;
          store.setPlaying(false);
          audioRef.current?.resetSchedule();
        }
        store.setPlayhead(time);
      }

      /*
       * Le pool ne garde chargés que les plans proches de la tête de lecture.
       * C'est ici, et pas dans un abonnement au store, parce que la fenêtre
       * dépend du temps courant autant que de la composition du projet.
       */
      const charges = pool.sync(placed, project.assets, time);

      syncPlayback(placed, pool, time, playing);

      const audio = audioRef.current;
      if (audio) {
        /*
         * Le graphe audio suit la même fenêtre.
         *
         * `attachClip` refuse de rebrancher un identifiant qu'il connaît déjà —
         * un élément média ne peut être relié qu'à une seule source Web Audio
         * dans toute sa vie. Sans la purge, un plan dont l'élément a été libéré
         * puis recréé reviendrait donc muet, sans que rien ne le signale.
         * Les deux appels sont sans effet quand la fenêtre n'a pas bougé.
         */
        audio.pruneClips(charges);
        for (const id of charges) {
          const video = pool.getVideo(id);
          if (video) audio.attachClip(id, video);
        }

        audio.applyMix(project.mix);
        for (const clip of project.clips) audio.setClipVolume(clip.id, clip.volume);
        audio.syncMusic(project.music?.url ?? null, project.music?.gain ?? 0);
        audio.syncMusicPosition(project.music?.offset ?? 0, time, playing);
        audio.syncSamples(project.samples);
        audio.syncSamplePositions(project.samples, time, playing);
        audio.syncVoices(project.voices);
        audio.syncVoicePositions(project.voices, time, playing);
        audio.applyDucking(project.voices, project.mix.ducking, time);
        if (playing) audio.scheduleUpcoming(project, time);
      }

      renderFrame(ctx, project, time, pool, fonts, {
        placed,
        grade,
        frame: frameRef.current++,
        scale: tier.scale,
        bloom: tier.bloom,
        captionBoxes: captionBoxesRef.current,
        signature: marqueRef.current,
      });

      const work = performance.now() - now;

      // Le filet de sécurité veille en permanence, lecture ou non : composer
      // l'image coûte le même prix à l'arrêt, et une interface figée l'est tout
      // autant. Seul un export y échappe, la pleine définition y étant imposée.
      if (pinned && !exporting) {
        if (panicRef.current!.observe(work)) {
          const index = QUALITY_TIERS.findIndex((t) => t.id === pinned.id);
          const fallback = QUALITY_TIERS[Math.min(index + 1, QUALITY_TIERS.length - 1)];
          governor.set(fallback);
          useStudio.setState({
            qualityChoice: 'auto',
            effectiveQuality: fallback.id,
            qualityRescued: true,
          });
          panicRef.current!.reset();
        }
      } else {
        panicRef.current!.reset();
      }

      // L'ajustement automatique, lui, n'a de sens qu'en lecture : à l'arrêt,
      // la charge mesurée ne dit rien de ce que coûtera le montage en marche.
      if (playing && !exporting && !pinned) {
        const changed = governor.observe(work, now);
        if (changed) useStudio.setState({ effectiveQuality: changed.id });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fonts]);

  // Libération des ressources au démontage : sans cela, les éléments vidéo et le
  // contexte audio survivraient à la page et retiendraient les fichiers en mémoire.
  useEffect(() => {
    const pool = poolRef.current;
    return () => {
      pool?.dispose();
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!audioRef.current) audioRef.current = new AudioEngine();
    const audio = audioRef.current;
    await audio.resume();

    // Le branchement ne peut avoir lieu qu'une fois le contexte audio créé,
    // donc au plus tôt au premier geste de l'utilisateur.
    // Le branchement des plans est tenu par la boucle de rendu, qui seule sait
    // quels éléments la fenêtre garde chargés. Ne reste ici que ce que le geste
    // de l'utilisateur débloque : le contexte audio lui-même.
    return audio;
  }, []);

  const play = useCallback(() => {
    const store = useStudio.getState();
    if (store.project.clips.length === 0) return;

    void ensureAudio().then((audio) => {
      audio.resetSchedule();
      // Repartir de zéro quand la lecture est déjà au bout évite le clic sur un
      // bouton qui, sinon, ne produirait rien.
      const state = useStudio.getState();
      if (state.playhead >= state.duration() - 0.05) state.setPlayhead(0);
      state.setPlaying(true);
    });
  }, [ensureAudio]);

  const pause = useCallback(() => {
    useStudio.getState().setPlaying(false);
    audioRef.current?.resetSchedule();
    poolRef.current?.pauseAll();
  }, []);

  const toggle = useCallback(() => {
    if (useStudio.getState().playing) pause();
    else play();
  }, [play, pause]);

  /*
   * Quitter l'application arrête la lecture.
   *
   * Sans cela, le son continuait dans le dos de l'utilisateur : on passe à une
   * autre application, on verrouille l'écran, et le montage joue toujours. Sur
   * un téléphone, c'est une bande-son qui démarre seule par-dessus ce qu'on
   * fait — et une batterie qui se vide pour rien.
   *
   * `visibilitychange` couvre le changement d'application et le verrouillage ;
   * `pagehide` couvre la fermeture de l'onglet et la mise en cache arrière, que
   * le premier ne signale pas toujours sur iOS. On met en pause plutôt que de
   * remettre à zéro : on revient là où l'on était, et rien n'est perdu.
   *
   * Pas de reprise automatique au retour. Un son qui repart tout seul quand on
   * rouvre une application est exactement ce qu'on cherche à supprimer ici.
   */
  useEffect(() => {
    const arreter = () => {
      if (useStudio.getState().playing) pause();
    };
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') arreter();
    };
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('pagehide', arreter);
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('pagehide', arreter);
    };
  }, [pause]);

  const seek = useCallback((time: number) => {
    const store = useStudio.getState();
    store.setPlayhead(time);
    // Les bruitages programmés pour l'ancienne position n'ont plus lieu d'être.
    audioRef.current?.resetSchedule();
  }, []);

  const resources = useCallback(
    () => ({ pool: poolRef.current!, grade: gradeRef.current!, audio: audioRef.current }),
    [],
  );

  const beginExport = useCallback(async (scale = 1, horsLigne = false) => {
    exportingRef.current = scale;
    exportFramesRef.current = 0;
    horsLigneRef.current = horsLigne;

    /*
     * Hors ligne, le redimensionnement se fait ici et non plus par la boucle.
     *
     * C'est `resolveContext` qui donne au canvas sa définition de sortie, et la
     * boucle cesse de l'appeler dès qu'elle cède le canvas. Sans cette ligne,
     * l'encodeur était configuré sur la taille de l'**aperçu** — mesuré à
     * 378 × 672 au lieu de 720 × 1280, et rien ne le signalait : le fichier
     * était lisible, à la bonne durée, à la bonne cadence, simplement quatre
     * fois trop petit.
     */
    if (horsLigne && canvasRef.current) resolveContext(canvasRef.current, ctxRef, scale);
    // Deux images d'attente : la première applique la nouvelle taille, la
    // seconde garantit qu'elle a bien été composée avant toute capture.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, []);

  const endExport = useCallback(() => {
    exportingRef.current = null;
    horsLigneRef.current = false;
  }, []);

  /** Nombre d'images composées depuis le dernier `beginExport`. */
  const exportedFrames = useCallback(() => exportFramesRef.current, []);

/*
 * Compositeur déterministe, pour l'encodage hors ligne.
 *
 * C'est le cœur du correctif d'export. L'ancien chemin filmait l'aperçu pendant
 * qu'il jouait : le fichier recevait ce que l'appareil avait eu le temps de
 * composer, et une image manquée ne se rattrapait jamais. Ici on demande une
 * image à un instant donné, et on **attend** qu'elle soit prête. Un téléphone
 * lent met plus longtemps ; il ne perd rien.
 *
 * L'attente porte sur le déplacement des rushes, et c'est le seul endroit où
 * elle est indispensable : régler `currentTime` ne change pas l'image tout de
 * suite, et dessiner sans attendre `seeked` grave l'image précédente. C'est
 * exactement ce défaut qui produisait des plans dupliqués.
 *
 * Le rendu passe par `renderFrame`, comme l'aperçu : l'invariant du chemin de
 * rendu unique tient, et l'export ne peut pas diverger de ce qu'on a vu.
 */
  const composerA = useCallback(async (temps: number, image: number): Promise<void> => {
    const pool = poolRef.current;
    const grade = gradeRef.current;
    const canvas = canvasRef.current;
    if (!pool || !grade || !canvas) return;

    const { project } = useStudio.getState();
    const placed = layoutClips(project.clips);

    // Même fenêtre de chargement que la lecture : au plus six décodeurs, ce que
    // le navigateur d'un téléphone accorde.
    pool.sync(placed, project.assets, temps);

    const ctx = resolveContext(canvas, ctxRef, exportingRef.current ?? 1);
    if (!ctx) return;

    await Promise.all(placed.map((item) => placerA(pool, item, temps)));

    renderFrame(ctx, project, temps, pool, fonts, {
      placed,
      grade,
      // Le numéro d'image vient du compteur d'export, jamais d'un compteur qui
      // court : le grain doit être reproductible d'un export à l'autre.
      frame: image,
      scale: exportingRef.current ?? 1,
      bloom: true,
      captionBoxes: captionBoxesRef.current,
      signature: marqueRef.current,
    });
  }, [fonts]);

  /** Position du point dans le repère de sortie, ou null hors du canvas. */
  const toOutput = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;

    return {
      x: ((clientX - bounds.left) / bounds.width) * OUTPUT_WIDTH,
      y: ((clientY - bounds.top) / bounds.height) * OUTPUT_HEIGHT,
      inside:
        clientX >= bounds.left &&
        clientX <= bounds.right &&
        clientY >= bounds.top &&
        clientY <= bounds.bottom,
    };
  }, []);

  const captionAt = useCallback(
    (clientX: number, clientY: number) => {
      const point = toOutput(clientX, clientY);
      if (!point || !point.inside) return null;

      // Le dernier tracé est au-dessus des autres : on parcourt à l'envers pour
      // que ce soit lui qui réponde en cas de chevauchement.
      const entries = [...captionBoxesRef.current.entries()].reverse();
      return entries.find(([, box]) => boxContains(box, point.x, point.y))?.[0] ?? null;
    },
    [toOutput],
  );

  const toRelativeY = useCallback(
    (clientY: number) => {
      const point = toOutput(0, clientY);
      return point ? Math.max(0.06, Math.min(0.94, point.y / OUTPUT_HEIGHT)) : 0.5;
    },
    [toOutput],
  );

  const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  const getCanvas = useCallback(() => canvasRef.current, []);

  // Identité stable : les consommateurs placent ce moteur dans les dépendances
  // de leurs effets, qui se relanceraient à chaque rendu sans cette mémoïsation.
  return useMemo(
    () => ({
      setCanvas,
      getCanvas,
      play,
      pause,
      toggle,
      seek,
      captionAt,
      toRelativeY,
      resources,
      ensureAudio,
      beginExport,
      endExport,
      exportedFrames,
      composerA,
    }),
    [setCanvas, getCanvas, play, pause, toggle, seek, captionAt, toRelativeY, resources, ensureAudio, beginExport, endExport, exportedFrames, composerA],
  );
}
