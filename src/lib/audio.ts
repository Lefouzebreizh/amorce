'use client';

import { scheduleSfx } from './sfx.ts';
import { duckTarget, timelineSpeech, type SpeechSegment } from './voice.ts';
import type { Project, SfxId, VoiceCue } from './types.ts';

/**
 * Mixage audio du montage.
 *
 * Quatre sources se rejoignent sur un même bus : le son d'origine des clips, les
 * bruitages de synthèse, la musique de fond et la voix off. Passer par Web Audio plutôt que
 * par le volume des éléments <video> est ce qui rend l'export possible — un
 * `MediaStreamAudioDestinationNode` fournit une piste sonore que
 * `MediaRecorder` sait enregistrer, ce qu'un élément média ne sait pas faire.
 */

/** Avance à laquelle les bruitages sont programmés avant de sonner. */
const SCHEDULE_HORIZON = 0.25;

export class AudioEngine {
  readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly sfxBus: GainNode;
  private readonly clipsBus: GainNode;
  private readonly musicBus: GainNode;
  private readonly voiceBus: GainNode;
  /** Nœuds de baisse, sous les seules sources que la voix doit couvrir. */
  private readonly clipsDuck: GainNode;
  private readonly musicDuck: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly recordDestination: MediaStreamAudioDestinationNode;

  private clipNodes = new Map<string, { source: MediaElementAudioSourceNode; gain: GainNode }>();
  private musicElement: HTMLAudioElement | null = null;
  private musicNodes: { source: MediaElementAudioSourceNode; gain: GainNode } | null = null;
  private musicUrl: string | null = null;

  private voiceNodes = new Map<
    string,
    { element: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; url: string }
  >();

  /**
   * Passages parlés en cache, et la liste dont ils viennent.
   *
   * Les recalculer à chaque image coûterait un parcours de toutes les répliques
   * soixante fois par seconde pour un résultat identique : la liste du projet
   * est immuable, sa seule identité suffit à savoir si elle a changé.
   */
  private duckSource: VoiceCue[] | null = null;
  private duckSegments: SpeechSegment[] = [];
  private duckLevel = 1;

  /** Bruitages déjà programmés pour la lecture en cours. */
  private scheduledCues = new Set<string>();
  /** Sources en vol, conservées pour pouvoir les couper net à la pause. */
  private liveSources: AudioScheduledSourceNode[] = [];

  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();

    /*
     * Un limiteur en bout de chaîne.
     *
     * Sans lui, il fallait garder chaque bruitage bas pour éviter que la somme
     * des trois sources ne sature — et le résultat s'entendait à peine. Le
     * limiteur écrête proprement les crêtes, ce qui autorise des niveaux bien
     * plus francs sans jamais distordre.
     */
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;

    /*
     * Les bruitages ont leur propre bus, plus fort que le reste.
     *
     * Ils doivent percer le son d'origine des plans et la musique : c'est leur
     * fonction même — marquer une coupe, souligner un impact. Noyés au même
     * niveau que le fond, ils ne servent à rien.
     */
    this.sfxBus = this.context.createGain();
    this.sfxBus.gain.value = 2.2;
    this.sfxBus.connect(this.master);

    /*
     * Un bus par source.
     *
     * Chaque famille de sons arrive sur son propre point de réglage, ce qui
     * permet de baisser le fond sans toucher aux bruitages — ou l'inverse —
     * d'un seul geste, plutôt que plan par plan.
     */
    this.clipsBus = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.voiceBus = this.context.createGain();

    /*
     * Le fond passe par un nœud de baisse avant le mélange, la voix non.
     *
     * Un nœud séparé plutôt qu'un réglage du bus lui-même, parce que les deux
     * valeurs n'ont ni la même origine ni le même rythme : l'une vient de la
     * table de mixage et ne bouge qu'au geste de l'utilisateur, l'autre suit la
     * parole en continu. Les écrire au même endroit ferait s'effacer l'une
     * l'autre.
     *
     * Les bruitages y échappent volontairement : un impact qui fléchit parce
     * qu'une réplique commence s'entend comme un défaut, pas comme un mixage.
     */
    this.clipsDuck = this.context.createGain();
    this.musicDuck = this.context.createGain();
    this.clipsBus.connect(this.clipsDuck);
    this.clipsDuck.connect(this.master);
    this.musicBus.connect(this.musicDuck);
    this.musicDuck.connect(this.master);

    // La voix ne subit aucune baisse : c'est elle qui la provoque.
    this.voiceBus.connect(this.master);

    this.master.connect(this.limiter);
    this.recordDestination = this.context.createMediaStreamDestination();

    // La chaîne part vers les enceintes ET vers la sortie d'enregistrement :
    // pendant un export, l'utilisateur entend ce qui est en train d'être gravé.
    this.limiter.connect(this.context.destination);
    this.limiter.connect(this.recordDestination);
  }

  /** Piste sonore à confier au `MediaRecorder` pendant l'export. */
  get stream(): MediaStream {
    return this.recordDestination.stream;
  }

  /**
   * Branche le son d'un clip sur le bus.
   *
   * Un élément média ne peut être relié qu'à une seule source Web Audio dans
   * toute sa vie : d'où le cache, qui évite l'exception en cas de second appel.
   */
  attachClip(clipId: string, video: HTMLVideoElement): void {
    if (this.clipNodes.has(clipId)) return;
    try {
      // Le son doit sortir par le graphe, jamais par l'élément lui-même.
      video.muted = false;
      const source = this.context.createMediaElementSource(video);
      const gain = this.context.createGain();
      source.connect(gain);
      gain.connect(this.clipsBus);
      this.clipNodes.set(clipId, { source, gain });
    } catch {
      // Élément déjà relié ailleurs : on continue sans son plutôt que de
      // laisser l'exception interrompre la mise en place de la lecture.
    }
  }

  /** Oublie les clips disparus du projet. */
  pruneClips(activeClipIds: Set<string>): void {
    for (const [clipId, nodes] of this.clipNodes) {
      if (activeClipIds.has(clipId)) continue;
      nodes.gain.disconnect();
      this.clipNodes.delete(clipId);
    }
  }

  /**
   * Applique l'équilibre entre les quatre sources.
   *
   * Le niveau des bruitages est multiplié par le facteur du bus, non remplacé :
   * ce facteur compense leur brièveté, qu'un réglage à 100 % ne doit pas
   * annuler.
   */
  applyMix(mix: { clips: number; sfx: number; music: number; voice: number }): void {
    this.clipsBus.gain.value = Math.max(0, Math.min(1, mix.clips));
    this.sfxBus.gain.value = 2.2 * Math.max(0, Math.min(1, mix.sfx));
    this.musicBus.gain.value = Math.max(0, Math.min(1, mix.music));
    this.voiceBus.gain.value = Math.max(0, Math.min(1, mix.voice));
  }

  setClipVolume(clipId: string, volume: number): void {
    const nodes = this.clipNodes.get(clipId);
    if (nodes) nodes.gain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /** Met en place la musique de fond, ou la retire si l'URL est nulle. */
  syncMusic(url: string | null, gain: number): void {
    if (url !== this.musicUrl) {
      this.musicNodes?.gain.disconnect();
      this.musicNodes = null;
      this.musicElement?.pause();
      this.musicElement = null;
      this.musicUrl = url;

      if (url) {
        const element = document.createElement('audio');
        element.src = url;
        element.preload = 'auto';
        element.loop = false;
        const source = this.context.createMediaElementSource(element);
        const gainNode = this.context.createGain();
        source.connect(gainNode);
        gainNode.connect(this.musicBus);
        this.musicElement = element;
        this.musicNodes = { source, gain: gainNode };
      }
    }

    if (this.musicNodes) this.musicNodes.gain.gain.value = Math.max(0, Math.min(1, gain));
  }

  /** Aligne la musique sur la tête de lecture. */
  syncMusicPosition(offset: number, time: number, playing: boolean): void {
    const element = this.musicElement;
    if (!element) return;

    const target = offset + time;
    if (!Number.isFinite(element.duration) || target >= element.duration) {
      if (!element.paused) element.pause();
      return;
    }

    if (Math.abs(element.currentTime - target) > 0.3) element.currentTime = Math.max(0, target);
    if (playing && element.paused) void element.play().catch(() => undefined);
    if (!playing && !element.paused) element.pause();
  }

  /**
   * Met en place les répliques de voix off.
   *
   * Un élément média par réplique, jamais un élément partagé : deux répliques
   * peuvent se chevaucher — une réponse qui coupe la fin d'une phrase — et un
   * élément unique ne peut pas être à deux positions de lecture à la fois.
   * C'est la même raison qui impose un `<video>` par clip côté image.
   */
  syncVoices(cues: VoiceCue[]): void {
    // Répliques disparues, ou dont le fichier a changé : on les débranche.
    for (const [id, nodes] of this.voiceNodes) {
      const cue = cues.find((c) => c.id === id);
      if (cue && cue.url === nodes.url) continue;
      nodes.element.pause();
      nodes.gain.disconnect();
      this.voiceNodes.delete(id);
    }

    for (const cue of cues) {
      let nodes = this.voiceNodes.get(cue.id);

      if (!nodes) {
        const element = document.createElement('audio');
        element.src = cue.url;
        element.preload = 'auto';
        const source = this.context.createMediaElementSource(element);
        const gain = this.context.createGain();
        source.connect(gain);
        gain.connect(this.voiceBus);
        nodes = { element, source, gain, url: cue.url };
        this.voiceNodes.set(cue.id, nodes);
      }

      nodes.gain.gain.value = Math.max(0, Math.min(1, cue.gain));
    }
  }

  /**
   * Aligne chaque réplique sur la tête de lecture.
   *
   * La tolérance est plus serrée que pour la musique : un décalage d'un tiers de
   * seconde ne s'entend pas sur un fond sonore, mais sur une voix il désaccorde
   * le sous-titre du mot prononcé — soit précisément ce que le calage vient de
   * mettre en place.
   */
  syncVoicePositions(cues: VoiceCue[], time: number, playing: boolean): void {
    for (const cue of cues) {
      const nodes = this.voiceNodes.get(cue.id);
      if (!nodes) continue;

      const target = time - cue.start;

      if (!playing || target < 0 || target >= cue.duration) {
        if (!nodes.element.paused) nodes.element.pause();
        // Remettre au début tant que la tête de lecture est en amont : sans
        // cela, relancer la lecture reprendrait la réplique en plein milieu.
        if (target < 0 && nodes.element.currentTime !== 0) nodes.element.currentTime = 0;
        continue;
      }

      if (Math.abs(nodes.element.currentTime - target) > 0.15) {
        nodes.element.currentTime = Math.max(0, target);
      }
      if (nodes.element.paused) void nodes.element.play().catch(() => undefined);
    }
  }

  /**
   * Baisse le fond pendant que la voix parle.
   *
   * On descend vite et on remonte lentement. L'inverse — remontée brusque —
   * s'entend comme un défaut : la musique semble sauter à chaque virgule, alors
   * qu'une remontée progressive passe pour un choix de mixage.
   */
  applyDucking(cues: VoiceCue[], depth: number, time: number): void {
    if (cues !== this.duckSource) {
      this.duckSegments = timelineSpeech(cues);
      this.duckSource = cues;
    }

    const target = duckTarget(this.duckSegments, time, Math.max(0, Math.min(1, depth)));
    if (target === this.duckLevel) return;

    const constant = target < this.duckLevel ? 0.04 : 0.18;
    this.clipsDuck.gain.setTargetAtTime(target, this.context.currentTime, constant);
    this.musicDuck.gain.setTargetAtTime(target, this.context.currentTime, constant);
    this.duckLevel = target;
  }

  /**
   * Joue un bruitage immédiatement, pour le faire écouter avant de le poser.
   *
   * Il passe par le même bus que les bruitages du montage : une écoute plus
   * faible que le résultat final induirait en erreur au moment de choisir.
   */
  audition(id: SfxId, gain = 0.85): void {
    scheduleSfx(this.context, this.sfxBus, id, this.context.currentTime + 0.02, gain);
  }

  /** Le navigateur suspend tout contexte audio créé hors d'un geste utilisateur. */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /**
   * Programme les bruitages qui vont sonner dans l'instant.
   *
   * Web Audio exige de connaître l'heure de déclenchement à l'avance pour être
   * précis. On programme donc légèrement en amont plutôt que de déclencher au
   * moment où la tête de lecture croise le repère, ce qui produirait un décalage
   * audible et variable selon la charge de la machine.
   */
  scheduleUpcoming(project: Project, time: number): void {
    for (const cue of project.cues) {
      if (this.scheduledCues.has(cue.id)) continue;
      const delta = cue.time - time;
      if (delta < -0.05 || delta > SCHEDULE_HORIZON) continue;

      this.scheduledCues.add(cue.id);
      this.liveSources.push(
        ...scheduleSfx(this.context, this.sfxBus, cue.sfx, this.context.currentTime + Math.max(0, delta), cue.gain),
      );
    }
  }

  /**
   * Coupe tout ce qui est en cours et repart d'une programmation vierge.
   * Indispensable à chaque pause ou déplacement de la tête de lecture, faute de
   * quoi un bruitage programmé pour l'ancienne position sonnerait dans le vide.
   */
  resetSchedule(): void {
    for (const source of this.liveSources) {
      try {
        source.stop();
      } catch {
        // Source déjà terminée : rien à interrompre.
      }
    }
    this.liveSources = [];
    this.scheduledCues.clear();
  }

  setMasterGain(value: number): void {
    this.master.gain.value = Math.max(0, Math.min(1, value));
  }

  dispose(): void {
    this.resetSchedule();
    this.musicElement?.pause();
    this.musicNodes?.gain.disconnect();
    for (const nodes of this.voiceNodes.values()) {
      nodes.element.pause();
      nodes.gain.disconnect();
    }
    this.voiceNodes.clear();
    for (const nodes of this.clipNodes.values()) nodes.gain.disconnect();
    this.clipNodes.clear();
    void this.context.close();
  }
}
