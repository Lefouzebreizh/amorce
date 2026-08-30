'use client';

import { useState } from 'react';
import { debitVideo, downloadBlob, pickFormat, recordMontage, relireLExport, safeFilename } from '@/lib/export';
import { encodageHorsLigneDisponible, encoderFilm } from '@/lib/exportHorsLigne';
import { crochetsARemplir } from '@/lib/captions';
import { groupesSemblables } from '@/lib/ressemblance';
import { formatTime } from '@/lib/media';
import { useStudio } from '@/lib/store';
import { EXPORT_PRESETS, exportPreset, OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH } from '@/lib/types';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { Button, Choice, Field, Hint, Panel } from '../ui';

/**
 * Export.
 *
 * L'enregistrement se fait en temps réel : la barre de progression avance à la
 * vitesse de la vidéo, sans accélération possible. Le dire à l'avance évite que
 * l'utilisateur croie à un blocage et recharge la page en plein export.
 */
/**
 * Cadence en deçà de laquelle le mouvement se voit haché.
 *
 * Le cinéma tient à 24, et l'œil ne réclame pas les 30 de la sortie. En
 * dessous de 20, en revanche, un panoramique se décompose en marches — et
 * l'export mesuré chez l'utilisateur était à 12,7.
 */
const CADENCE_MINIMALE = 20;

export function ExportPanel({ engine }: { engine: PlaybackEngine }) {
  const project = useStudio((s) => s.project);
  const duration = useStudio((s) => s.duration());
  /*
   * Les gabarits laissent des crochets à remplir, et rien n'empêchait de les
   * exporter. Constaté sur un montage livré : quatre textes sur quatre étaient
   * des trous, gravés dans le fichier. Aucune mesure ne le disait — la
   * couverture texte était même bonne, puisqu'il y avait du texte.
   */
  const captions = useStudio((s) => s.project.captions);
  const aRemplir = crochetsARemplir(captions);

  /*
   * Un montage peut avoir la bonne cadence, la bonne durée, la bonne note, et
   * n'avancer nulle part : il suffit que les rushes montrent la même chose.
   * Constaté sur un montage rejeté — neuf rushes, dont sept au même cadrage,
   * et toutes les mesures au vert.
   *
   * On ne compte que les rushes réellement montés : un rush resté dans la
   * bibliothèque ne gêne personne.
   */
  const assets = useStudio((s) => s.project.assets);
  const clips = useStudio((s) => s.project.clips);
  const montes = new Set(clips.map((c) => c.assetId));
  const seRessemblent = groupesSemblables(assets.filter((a) => montes.has(a.id)));
  const plusGrand = seRessemblent[0]?.length ?? 0;
  const renameProject = useStudio((s) => s.renameProject);
  const presetId = useStudio((s) => s.exportPreset);
  const setPreset = useStudio((s) => s.setExportPreset);
  const touch = useIsTouch();

  const preset = exportPreset(presetId);
  const width = Math.round(OUTPUT_WIDTH * preset.scale);
  const height = Math.round(OUTPUT_HEIGHT * preset.scale);

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);

  const format = pickFormat(audioOnly);
  const busy = progress !== null;

  /*
   * Le poids annoncé avant l'export, pas après.
   *
   * On ne découvrait la taille du fichier qu'une fois produit — et un fichier
   * de trente mégaoctets ne s'envoie pas depuis un téléphone en réseau mobile.
   * C'est là que meurent des montages : on les exporte, on n'arrive pas à les
   * envoyer, on renonce. L'estimation permet de choisir la définition en
   * connaissance de cause, avant d'attendre la durée du film.
   *
   * Elle est approchée par construction : l'encodeur dépense moins sur une
   * image calme que sur un plan chargé, et le débit demandé n'est qu'une cible.
   * D'où « environ », qui n'est pas une précaution de style mais l'énoncé exact
   * de ce que le chiffre vaut.
   */
  const poidsEstime = ((debitVideo(width, height, OUTPUT_FPS) + 192_000) * duration) / 8 / 1024 / 1024;

  const run = async () => {
    const canvas = engine.getCanvas();
    if (!canvas || duration <= 0) return;

    setError(null);
    setDone(null);
    setCadence(null);
    setProgress(0);

    try {
      const audio = await engine.ensureAudio();
      engine.seek(0);

      /*
       * L'encodage hors ligne d'abord, l'enregistrement temps réel en repli.
       *
       * Le second filme l'aperçu pendant qu'il joue : le fichier ne reçoit que
       * les images composées à temps, et une image manquée ne se rattrape
       * jamais. Mesuré sur un export livré : 12,7 images par seconde au lieu de
       * 30, un écart montant à 517 ms.
       *
       * Le premier compose chaque image puis l'encode, sans horloge à tenir. Un
       * appareil lent met plus longtemps, il ne perd rien. Il demande WebCodecs,
       * présent sur Chrome et Edge — donc partout où l'export MP4 existait déjà.
       */
      if (!audioOnly && encodageHorsLigneDisponible()) {
        await engine.beginExport(preset.scale, true);
        const film = await encoderFilm({
          canvas,
          composer: engine.composerA,
          audio: null,
          duree: duration,
          images: OUTPUT_FPS,
          debit: debitVideo(width, height, OUTPUT_FPS),
          onProgress: setProgress,
        });

        const nom = safeFilename(project.name, 'mp4');
        downloadBlob(film.blob, nom);
        setCadence(OUTPUT_FPS);
        setDone(`${nom} — ${(film.blob.size / 1024 / 1024).toFixed(1)} Mo`);
        return;
      }

      // La prévisualisation tourne peut-être à définition réduite : on impose
      // celle de l'export avant que le flux du canvas ne soit capturé.
      await engine.beginExport(preset.scale);

      const result = await recordMontage({
        canvas,
        audio,
        duration,
        audioOnly,
        startPlayback: engine.play,
        stopPlayback: engine.pause,
        currentTime: () => useStudio.getState().playhead,
        isPlaying: () => useStudio.getState().playing,
        onProgress: setProgress,
      });

      /*
       * La cadence obtenue, avant même de relire le fichier.
       *
       * L'enregistrement se fait en temps réel : le fichier ne contient que les
       * images que la boucle a eu le temps de composer. Un appareil qui n'y
       * arrive pas rend une vidéo qui saccade, et jusqu'ici l'application n'en
       * disait rien — l'utilisateur le découvrait en regardant son export, puis
       * cherchait la cause du côté de l'encodage.
       *
       * Un export sonore seul ne compose aucune image : la mesure n'a pas de
       * sens et resterait à zéro.
       */
      if (!audioOnly && duration > 0) setCadence(engine.exportedFrames() / duration);

      const filename = safeFilename(project.name, result.format.extension);
      downloadBlob(result.blob, filename);

      /*
       * Le fichier est relu avant d'annoncer que tout va bien.
       *
       * Un export peut être parfaitement conforme et à moitié vide : durée
       * bonne, définition bonne, son présent, et l'image ne montre rien. Sans
       * cette relecture, on ne l'apprend qu'en regardant le fichier — donc
       * après l'avoir exporté, parfois après l'avoir publié.
       *
       * Le téléchargement part **avant** la relecture : elle prend deux ou
       * trois secondes, et un fichier peut-être bon vaut mieux qu'une attente
       * de plus. Ce qui suit ne fait qu'informer.
       */
      const relu = audioOnly ? null : await relireLExport(result.blob);
      const poids = `${(result.blob.size / 1024 / 1024).toFixed(1)} Mo`;
      if (relu && relu.vides > relu.total / 4) {
        setError(
          `${filename} est sorti mais ${relu.vides} images sur ${relu.total} sont vides. `
          + 'Ton appareil n’a pas eu le temps de décoder les plans pendant l’enregistrement : '
          + 'passe en 720 × 1280 et relance.',
        );
        setDone(null);
      } else {
        setDone(`${filename} — ${poids}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’export a échoué.');
    } finally {
      setProgress(null);
      engine.pause();
      engine.endExport();
    }
  };

  return (
    <div className="space-y-3">
      <Panel
        title="7 · Exporter"
        subtitle={audioOnly ? 'Le mixage seul, sans image.' : `${OUTPUT_FPS} images par seconde, format vertical.`}
      >
        <Field
          label="Que veux-tu récupérer ?"
          help={
            audioOnly
              ? 'Seule la bande-son, mixage compris : le son de tes plans, les bruitages et la musique, réunis dans un fichier audio.'
              : 'La vidéo complète, image et son.'
          }
        >
          <Choice
            value={audioOnly ? 'audio' : 'video'}
            onChange={(value) => setAudioOnly(value === 'audio')}
            options={[
              { value: 'video', label: 'Vidéo + son', description: 'Le fichier à publier.' },
              { value: 'audio', label: 'Son seul', description: 'La bande-son, à retoucher ailleurs.' },
            ]}
          />
        </Field>

        {!audioOnly && (
        <Field
          label="Définition"
          help={
            touch
              ? 'Sur téléphone, la définition réduite évite les images perdues : l’enregistrement se fait en direct, et l’appareil doit suivre.'
              : 'La définition supérieure convient à toutes les plateformes.'
          }
        >
          <Choice
            value={presetId}
            onChange={setPreset}
            options={EXPORT_PRESETS.map((item) => ({
              value: item.id,
              label: item.label,
              description: `${item.description} · environ ${(
                ((debitVideo(
                  Math.round(OUTPUT_WIDTH * item.scale),
                  Math.round(OUTPUT_HEIGHT * item.scale),
                  OUTPUT_FPS,
                ) + 192_000) * duration) / 8 / 1024 / 1024
              ).toFixed(1)} Mo`,
            }))}
          />
        </Field>
        )}

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-mist">Nom du fichier</span>
          <input
            value={project.name}
            onChange={(event) => renameProject(event.target.value)}
            className="w-full min-h-11 rounded-xl bg-slab px-3 py-2 text-sm text-mist outline-none focus:border-accent"
          />
        </label>

        {/*
          L'avertissement ne bloque pas, il rend le choix conscient.
          Bloquer l'export enfermerait quelqu'un qui veut sortir un brouillon ;
          se taire l'a laissé publier « QUEL [ROYAUME] TOMBE ENSUITE ? ». Le
          bouton change donc de mot — « quand même » — et la liste dit
          exactement quoi remplir.
        */}
        {!audioOnly && aRemplir.length > 0 && (
          <div className="mb-2 rounded-xl bg-warn/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-warn">
            <p className="font-semibold">
              {aRemplir.length === 1
                ? 'Un texte porte encore un crochet à remplir.'
                : `${aRemplir.length} textes portent encore un crochet à remplir.`}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {aRemplir.slice(0, 4).map((c) => (
                <li key={c.id} className="truncate">· {c.text}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-muted">
              Ils partiront tels quels dans le fichier. Va dans <strong>Textes</strong> pour les
              écrire.
            </p>
          </div>
        )}

        {!audioOnly && plusGrand > 2 && (
          <div className="mb-2 rounded-xl bg-warn/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-warn">
            <p className="font-semibold">
              {plusGrand} de tes {montes.size} plans montrent la même chose.
            </p>
            <p className="mt-1.5 text-muted">
              La cadence et la durée peuvent être bonnes, le film n’avance pas pour autant : on
              revoit {plusGrand} fois le même cadrage. Un plan large, un gros plan, un objet —
              c’est ce qui manque, et aucun réglage ne le remplace.
            </p>
          </div>
        )}

        <Button variant="primary" className="w-full" onClick={run} disabled={busy || duration <= 0 || !format}>
          {busy
            ? `Enregistrement… ${Math.round((progress ?? 0) * 100)} %`
            : audioOnly
              ? '⬇ Exporter la bande-son'
              : aRemplir.length > 0
                ? `⬇ Exporter quand même · ~${poidsEstime.toFixed(1)} Mo`
                // Le poids sur le bouton, pas dans une note à côté : c'est au
                // moment d'appuyer qu'il change une décision.
                : `⬇ Exporter la vidéo · ~${poidsEstime.toFixed(1)} Mo`}
        </Button>

        {busy && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slab">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        )}

        {done && (
          <p className="mt-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
            Fichier téléchargé : {done}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        {/*
          La cadence est dite après coup, pas prédite avant.
          Les capacités d'un appareil ne s'interrogent pas depuis une page web,
          et l'estimation d'avance se tromperait dans les deux sens. Ce qui est
          sûr, c'est ce que l'enregistrement vient de produire.
        */}
        {cadence !== null && cadence < CADENCE_MINIMALE && (
          <p className="mt-2 rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-xs leading-relaxed text-warn">
            <b>Ta vidéo saccade : {cadence.toFixed(0)} images par seconde au lieu de {OUTPUT_FPS}.</b>{' '}
            Ton appareil n’a pas suivi la cadence pendant l’enregistrement, et les images manquantes
            ne sont pas rattrapables — le fichier est bon, c’est le mouvement qui est haché.
            {presetId === 'full'
              ? ' Passe en 720 × 1280 juste au-dessus et relance : deux fois moins de pixels à composer.'
              : ' Ferme tes autres onglets et relance, ou descends d’un cran de définition.'}
          </p>
        )}

        <dl className="mt-3 space-y-1 border-t border-edge pt-3 text-[11px] text-muted">
          <Row label="Définition">{audioOnly ? 'son seul' : `${width} × ${height}`}</Row>
          <Row label="Durée">{formatTime(duration)}</Row>
          <Row label="Format">{format ? format.label : 'non pris en charge'}</Row>
          <Row label="Temps d’export">environ {formatTime(duration)}</Row>
        </dl>
      </Panel>

      {duration > 60 && (
        <Hint tone="warn">
          {formatTime(duration)}, c’est long pour du format vertical. En dessous de 35 secondes, la part
          de spectateurs qui vont jusqu’au bout monte nettement — et c’est ce taux qui décide de ta
          diffusion.
        </Hint>
      )}

      {!format && (
        <Hint tone="warn">
          Ce navigateur ne sait pas enregistrer de vidéo. Utilise Chrome, Edge ou Firefox à jour.
        </Hint>
      )}

      <Hint>
        L’export filme la prévisualisation pendant qu’elle joue : il dure donc aussi longtemps que ta
        vidéo, et tu l’entends défiler. Ne change pas d’onglet pendant ce temps, certains navigateurs
        ralentissent les onglets en arrière-plan. Même si l’aperçu tourne en définition réduite pour
        rester fluide, le fichier produit sort toujours dans la définition choisie ci-dessus.
      </Hint>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-mono text-mist">{children}</dd>
    </div>
  );
}
