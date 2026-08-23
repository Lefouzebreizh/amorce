'use client';

import { scheduleSfx } from './sfx.ts';
import type { Project } from './types.ts';

/**
 * Mixage audio du montage.
 *
 * Trois sources se rejoignent sur un même bus : le son d'origine des clips, les
 * bruitages de synthèse et la musique de fond. Passer par Web Audio plutôt que
 * par le volume des éléments <video> est ce qui rend l'export possible — un
 * `MediaStreamAudioDestinationNode` fournit une piste sonore que
 * `MediaRecorder` sait enregistrer, ce qu'un élément média ne sait pas faire.
 */

/** Avance à laquelle les bruitages sont programmés avant de sonner. */
const SCHEDULE_HORIZON = 0.25;

export class AudioEngine {
  readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly recordDestination: MediaStreamAudioDestinationNode;

  private clipNodes = new Map<string, { source: MediaElementAudioSourceNode; gain: GainNode }>();
  private musicElement: HTMLAudioElement | null = null;
  private musicNodes: { source: MediaElementAudioSourceNode; gain: GainNode } | null = null;
  private musicUrl: string | null = null;

  /** Bruitages déjà programmés pour la lecture en cours. */
  private scheduledCues = new Set<string>();
  /** Sources en vol, conservées pour pouvoir les couper net à la pause. */
  private liveSources: AudioScheduledSourceNode[] = [];

  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.recordDestination = this.context.createMediaStreamDestination();

    // Le bus part vers les enceintes ET vers la sortie d'enregistrement :
    // pendant un export, l'utilisateur entend ce qui est en train d'être gravé.
    this.master.connect(this.context.destination);
    this.master.connect(this.recordDestination);
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
      gain.connect(this.master);
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
        gainNode.connect(this.master);
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
        ...scheduleSfx(this.context, this.master, cue.sfx, this.context.currentTime + Math.max(0, delta), cue.gain),
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
    for (const nodes of this.clipNodes.values()) nodes.gain.disconnect();
    this.clipNodes.clear();
    void this.context.close();
  }
}
