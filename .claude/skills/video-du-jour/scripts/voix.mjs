/**
 * La prise de voix : l'écouter, la rogner, en retirer ce qui est devenu faux.
 *
 * Tout part de `src/lib/voice.ts`, le module du studio. Refaire un découpage
 * maison ici donnerait deux calages différents pour un même fichier, et plus
 * personne ne saurait lequel fait foi le jour où les sous-titres dérivent.
 *
 *   node voix.mjs ecouter  <fichier>
 *   node voix.mjs rogner   <entrée> <sortie> [--marge 0.06]
 *   node voix.mjs garder   <entrée> <sortie> 0-2.16 6.30-15.02
 *   node voix.mjs caler    <fichier> --texte "phrase un. phrase deux."
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { decoderAudio, ecrireWav, ouvrirNavigateur } from './outils.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const { rmsEnvelope, speechSegments, captionsFromVoice } = await import(
  join(RACINE, 'src/lib/voice.ts')
);

/** Fondu court appliqué à chaque bord de coupe : une coupe franche claque. */
const BORD = 0.01;

/** Croisement au raccord : un silence porte le souffle de la pièce, pas du vide. */
const CROISEMENT = 0.06;

const [commande, entree, ...reste] = process.argv.slice(2);
if (!commande || !entree) {
  console.error('usage : node voix.mjs <ecouter|rogner|garder|caler> <fichier> …');
  process.exit(1);
}

const option = (nom, defaut) => {
  const i = reste.indexOf(`--${nom}`);
  return i === -1 ? defaut : reste[i + 1];
};

const navigateur = await ouvrirNavigateur();
const page = await navigateur.newPage();
await page.goto('about:blank');

const audio = await decoderAudio(page, readFileSync(entree));
const echantillons = Float32Array.from(audio.echantillons);
const segments = speechSegments(rmsEnvelope(echantillons, audio.frequenceReduite));

if (commande === 'ecouter') {
  console.log(`durée : ${audio.duree.toFixed(2)} s  (${audio.frequence} Hz)`);
  console.log(`passages parlés : ${segments.length}\n`);

  let precedent = 0;
  segments.forEach((s, i) => {
    const silence = s.start - precedent;
    if (silence > 0.12) console.log(`      silence ${silence.toFixed(2)} s`);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${s.start.toFixed(2)} → ${s.end.toFixed(2)}  (${(s.end - s.start).toFixed(2)} s)`,
    );
    precedent = s.end;
  });
  const queue = audio.duree - precedent;
  if (queue > 0.12) console.log(`      silence de fin ${queue.toFixed(2)} s`);

  let crete = 0;
  for (const v of echantillons) crete = Math.max(crete, Math.abs(v));
  const parle = segments.reduce((a, s) => a + (s.end - s.start), 0);
  console.log(`\ncrête : ${crete.toFixed(3)}   parole : ${parle.toFixed(1)} s sur ${audio.duree.toFixed(1)} s`);

  // Le silence de tête est le seul qui coûte vraiment : il tombe dans les trois
  // secondes qui décident de tout.
  if (segments.length && segments[0].start > 0.2) {
    console.log(`\n→ ${segments[0].start.toFixed(2)} s de silence au début. À rogner : c'est la fenêtre d'accroche.`);
  }
  if (queue > 0.5) {
    console.log(`→ ${queue.toFixed(2)} s de silence à la fin. À rogner aussi.`);
  }
}

if (commande === 'rogner' || commande === 'garder') {
  const sortie = reste.find((a) => !a.startsWith('--') && !/^[\d.]+-[\d.]+$/.test(a));
  if (!sortie) throw new Error('Il manque le fichier de sortie.');

  const gardes =
    commande === 'garder'
      ? reste.filter((a) => /^[\d.]+-[\d.]+$/.test(a)).map((a) => a.split('-').map(Number))
      : [
          [
            // Une marge avant le premier mot : couper au ras de l'attaque
            // mange la consonne initiale, et « je » devient « e ».
            Math.max(0, (segments[0]?.start ?? 0) - Number(option('marge', CROISEMENT))),
            Math.min(audio.duree, (segments.at(-1)?.end ?? audio.duree) + 0.25),
          ],
        ];

  if (gardes.length === 0) throw new Error('Aucun intervalle à garder.');

  const b64 = readFileSync(entree).toString('base64');
  const wav = await page.evaluate(
    async ({ b64, gardes, croisement, bord }) => {
      const binaire = atob(b64);
      const octets = new Uint8Array(binaire.length);
      for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);

      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const buffer = await ctx.decodeAudioData(octets.buffer);
      const rate = buffer.sampleRate;
      const src = buffer.getChannelData(0);

      const chevauche = Math.round(rate * croisement);
      const morceaux = gardes.map(([a, b]) =>
        src.subarray(Math.round(a * rate), Math.round(b * rate)),
      );

      const total = morceaux.reduce((n, m) => n + m.length, 0) - chevauche * (morceaux.length - 1);
      const pcm = new Float32Array(Math.max(0, total));

      let curseur = 0;
      morceaux.forEach((morceau, index) => {
        if (index === 0) {
          pcm.set(morceau, 0);
          curseur = morceau.length - chevauche;
          return;
        }
        // Les deux souffles se remplacent au lieu de se succéder : sans ce
        // croisement, le raccord fait un trou qu'on entend même dans un silence.
        for (let i = 0; i < chevauche; i++) {
          const t = i / chevauche;
          pcm[curseur + i] = pcm[curseur + i] * (1 - t) + morceau[i] * t;
        }
        pcm.set(morceau.subarray(chevauche), curseur + chevauche);
        curseur += morceau.length - chevauche;
      });

      const marge = Math.round(rate * bord);
      for (let i = 0; i < marge && i < pcm.length; i++) {
        pcm[i] *= i / marge;
        pcm[pcm.length - 1 - i] *= i / marge;
      }

      return { pcm: Array.from(pcm), rate };
    },
    { b64, gardes, croisement: CROISEMENT, bord: BORD },
  );

  writeFileSync(sortie, ecrireWav(Float32Array.from(wav.pcm), wav.rate));
  console.log(`${sortie} — ${(wav.pcm.length / wav.rate).toFixed(2)} s`);
}

if (commande === 'caler') {
  const texte = option('texte', null);
  if (!texte) throw new Error('Il manque --texte "la transcription exacte".');

  let n = 0;
  const soustitres = captionsFromVoice(texte, segments, () => `st${++n}`);

  console.log(`${segments.length} passages parlés → ${soustitres.length} sous-titres\n`);
  for (const c of soustitres) {
    console.log(`  ${c.start.toFixed(2)} → ${c.end.toFixed(2)}  ${c.text}`);
  }

  // Un sous-titre qui se termine sur un mot-outil laisse l'œil suspendu ; on le
  // signale plutôt que de le corriger en douce, parce que le déplacer change le
  // calage et que c'est un choix, pas une évidence.
  const outils = /\b(et|ou|de|du|la|le|les|un|une|à|au|aux|que|qui|pour|dans|sur|avec)$/i;
  for (const c of soustitres) {
    if (outils.test(c.text.replace(/[.,;:!?]$/, ''))) {
      console.log(`\n→ « ${c.text} » se termine sur un mot-outil. Reporte-le sur le bloc suivant.`);
    }
  }

  console.log(
    `\n${JSON.stringify(soustitres.map((c) => ({ texte: c.text, de: +c.start.toFixed(2), a: +c.end.toFixed(2) })), null, 2)}`,
  );
}

await navigateur.close();
