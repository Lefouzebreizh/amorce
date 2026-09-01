import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debitVideo, pickFormat } from '../export.ts';

/*
 * Le débit décide du poids du fichier, et le poids décide si la vidéo part sur
 * un réseau mobile. Il valait 12 Mb/s en dur, quelle que soit la définition :
 * une vidéo de trente secondes pesait quarante-cinq mégaoctets, et le 720 ne
 * pesait pas moins que le 1080 alors qu'il a deux fois moins de pixels.
 */

test('le débit suit la définition, il n’est pas constant', () => {
  const plein = debitVideo(1080, 1920, 30);
  const leger = debitVideo(720, 1280, 30);
  assert.ok(leger < plein, 'moins de pixels doit coûter moins de débit');
  // Les surfaces sont dans un rapport de 2,25 : le débit doit suivre.
  assert.ok(Math.abs(plein / leger - 2.25) < 0.01, `rapport obtenu ${(plein / leger).toFixed(2)}`);
});

test('le débit reste dans ce que les plateformes acceptent', () => {
  const mbps = debitVideo(1080, 1920, 30) / 1e6;
  // Au-dessus de 4 Mb/s, où TikTok et Reels réencodent, et sous 8 où le
  // fichier devient trop lourd pour un envoi mobile sans qu'on y gagne rien.
  assert.ok(mbps > 4 && mbps < 8, `${mbps.toFixed(1)} Mb/s`);
});

test('un plancher garde une petite définition lisible', () => {
  // 360 × 640 à 24 images donnerait 0,41 Mb/s : les aplats se cassent en carrés.
  assert.equal(debitVideo(360, 640, 24), 1_000_000);
});

test('le préréglage de partage pèse vraiment moins que le 720', () => {
  /*
   * Un plancher trop haut rendait ce choix inutile : 540 × 960 demande
   * 1,2 Mb/s, un plancher à 2 le remontait au niveau du 720, et les deux
   * préréglages pesaient pareil. Un choix qui ne change rien n'est pas un
   * choix.
   */
  const partage = debitVideo(540, 960, 30);
  const leger = debitVideo(720, 1280, 30);
  assert.ok(partage < leger * 0.7, `${partage} contre ${leger}`);
});

test('trente images par seconde coûtent plus que vingt-quatre', () => {
  assert.ok(debitVideo(1080, 1920, 30) > debitVideo(1080, 1920, 24));
});

/*
 * Le profil H.264 demandé doit tenir la définition composée.
 *
 * `avc1.42E01E` se lit ainsi : `42` profil Baseline, `1E` niveau 3.0. Or le
 * niveau 3.0 plafonne à 1 620 macroblocs — 720p — quand 1080 × 1920 en demande
 * 8 160. On réclamait un profil trop petit pour l'image qu'on lui donne, et le
 * Baseline n'a ni CABAC ni images bidirectionnelles : à débit égal il rend
 * moins bien. Relevé sur un export livré : `profile=Baseline`, 2,35 Mb/s,
 * contre `High` à 9,6 Mb/s pour la source.
 *
 * Le test passe par un faux `MediaRecorder` : le Chromium de vérification est
 * bâti sans codecs propriétaires et refuse toutes les chaînes `avc1`, donc le
 * parcours réel ne départage rien ici.
 */
function avecCodecsAcceptes(acceptes: string[], corps: () => void): void {
  const avant = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
    isTypeSupported: (type: string) => acceptes.includes(type),
  };
  try {
    corps();
  } finally {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = avant;
  }
}

test('le profil H.264 retenu tient la définition de sortie', () => {
  // Un navigateur qui sait tout faire doit recevoir le profil le plus capable.
  avecCodecsAcceptes(
    [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1.4D4028,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
    ],
    () => {
      const choisi = pickFormat();
      assert.equal(choisi?.mimeType, 'video/mp4;codecs=avc1.640028,mp4a.40.2');
    },
  );
});

test('un navigateur sans High retombe sur Main, puis sur Baseline', () => {
  avecCodecsAcceptes(
    ['video/mp4;codecs=avc1.4D4028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'],
    () => assert.equal(pickFormat()?.mimeType, 'video/mp4;codecs=avc1.4D4028,mp4a.40.2'),
  );

  avecCodecsAcceptes(
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2'],
    () => assert.equal(pickFormat()?.mimeType, 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'),
  );
});

/*
 * Le repli qui a coûté quatre contrôles quand on l'a retiré.
 *
 * `MediaRecorder` n'écrit aucune durée dans un WebM : `ffprobe` rend
 * `duration=N/A`, un `<video>` rend `Infinity`, et de là tout s'effondre. Le
 * `video/mp4` nu, lui, porte sa durée même quand il contient du VP9.
 */
test('sans aucun H.264, le MP4 nu passe avant le WebM', () => {
  avecCodecsAcceptes(
    ['video/mp4', 'video/webm;codecs=vp9,opus'],
    () => assert.equal(pickFormat()?.mimeType, 'video/mp4'),
  );
});
