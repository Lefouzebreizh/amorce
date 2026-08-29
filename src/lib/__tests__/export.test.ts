import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debitVideo } from '../export.ts';

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
