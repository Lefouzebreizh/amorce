/**
 * Rendre les bruitages en fichiers qu'on peut écouter.
 *
 * Rien ne permettait de les entendre hors du navigateur du propriétaire. Un
 * son se juge à l'oreille — le §8 l'exige, `/voir-le-son` le détaille — et le
 * studio n'avait aucun chemin pour sortir ses bruitages en fichier. Toutes les
 * mesures existantes portaient sur leur *nombre* et sur la position du curseur
 * de volume ; aucune sur ce qu'ils donnent.
 *
 * Deux sorties, et la seconde est celle qui décide :
 *
 * 1. **Chaque bruitage, seul.** Utile pour juger la fabrication — attaque,
 *    queue, texture — et pour comparer deux versions du code.
 * 2. **Chaque bruitage posé sur une coupe, par-dessus une voix.** C'est le cas
 *    réel et le seul qui tranche la question ouverte : un bruitage recouvre-t-il
 *    la parole du rush, ou se raccorde-t-il avec elle ? Le §1 ter demande que
 *    cette version-là atteigne un niveau qu'on puisse réactiver.
 *
 * Le rendu passe par un vrai Chromium et un `OfflineAudioContext`, donc par le
 * même code que l'export : `scheduleSfx` ne connaît que `BaseAudioContext` et
 * ne fait aucune différence entre les deux.
 *
 *   node scripts/ecouter-bruitages.mjs [dossier]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { cheminChromium } from './chromium.mjs';

const SORTIE = process.argv[2] ?? '.fixtures/bruitages';
/** Fréquence d'échantillonnage du rendu. 48 kHz, comme l'export. */
const TAUX = 48000;

mkdirSync(SORTIE, { recursive: true });

/*
 * Le code réel, retypé à la volée, injecté dans la page.
 *
 * Le studio sert son JavaScript en morceaux nommés par sa construction : rien
 * n'y permet d'importer `sfx.ts` par son nom. Le recopier ici en donnerait une
 * deuxième version qui dériverait au premier réglage — le défaut que le §0 bis
 * appelle un doublon, et le pire des trois, puisqu'on jugerait alors un son que
 * l'application ne joue pas.
 *
 * Node sait retirer les types d'un source depuis la 22.18 ; les deux fichiers
 * concernés n'ont aucune autre dépendance et n'appellent que des interfaces du
 * navigateur. On sert donc le fichier du dépôt, tel quel, moins ses types.
 */
function module(chemin) {
  return stripTypeScriptTypes(readFileSync(chemin, 'utf8'), { mode: 'strip' });
}

const SOURCE =
  module('src/lib/alea.ts').replace(/^export /gm, '') +
  '\n' +
  module('src/lib/sfx.ts')
    .replace(/^import[^;]+;\s*$/gm, '')
    .replace(/^export /gm, '');

const navigateur = await chromium.launch({ executablePath: cheminChromium });
const page = await navigateur.newPage();

// Une page vide suffit : c'est le contexte audio du navigateur qu'on vient
// chercher, pas l'interface du studio.
await page.goto('about:blank');
await page.addScriptTag({
  content: `${SOURCE}\nwindow.__sfx = { scheduleSfx, SFX_LIBRARY };`,
});

/**
 * Rend un tampon audio en WAV 16 bits.
 *
 * Écrit ici plutôt que côté page : le navigateur rend les échantillons, Node
 * fabrique l'enveloppe du fichier. Un WAV parce qu'il s'ouvre partout, y
 * compris sur un téléphone, sans rien installer.
 */
function versWav(canaux, taux) {
  const images = canaux[0].length;
  const nbCanaux = canaux.length;
  const octets = images * nbCanaux * 2;
  const tampon = Buffer.alloc(44 + octets);

  tampon.write('RIFF', 0);
  tampon.writeUInt32LE(36 + octets, 4);
  tampon.write('WAVE', 8);
  tampon.write('fmt ', 12);
  tampon.writeUInt32LE(16, 16);
  tampon.writeUInt16LE(1, 20);
  tampon.writeUInt16LE(nbCanaux, 22);
  tampon.writeUInt32LE(taux, 24);
  tampon.writeUInt32LE(taux * nbCanaux * 2, 28);
  tampon.writeUInt16LE(nbCanaux * 2, 32);
  tampon.writeUInt16LE(16, 34);
  tampon.write('data', 36);
  tampon.writeUInt32LE(octets, 40);

  let position = 44;
  for (let i = 0; i < images; i += 1) {
    for (let c = 0; c < nbCanaux; c += 1) {
      const valeur = Math.max(-1, Math.min(1, canaux[c][i]));
      tampon.writeInt16LE(Math.round(valeur * 32767), position);
      position += 2;
    }
  }
  return tampon;
}

/**
 * Rend un bruitage dans un contexte hors ligne et rend ses échantillons.
 *
 * `avecVoix` superpose une voix de synthèse au même endroit que dans un rush
 * qui parle : une porteuse autour de 180 Hz, ses harmoniques, et une enveloppe
 * de syllabes. Ce n'est pas de la vraie parole — on ne peut pas en fabriquer
 * ici — mais elle occupe la même bande et le même niveau, ce qui suffit pour
 * entendre si le bruitage la recouvre.
 */
async function rendre(id, { avecVoix, gain, duree }) {
  return page.evaluate(
    async ({ id, avecVoix, gain, duree, taux }) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(duree * taux), taux);
      const sortie = ctx.createGain();
      sortie.gain.value = 1;
      sortie.connect(ctx.destination);

      if (avecVoix) {
        // Voix de synthèse : porteuse + harmoniques, découpée en syllabes.
        const voix = ctx.createGain();
        voix.gain.value = 0;
        voix.connect(sortie);
        for (const [rang, poids] of [[1, 1], [2, 0.5], [3, 0.32], [4, 0.18], [6, 0.08]]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 178 * rang;
          const g = ctx.createGain();
          g.gain.value = poids * 0.09;
          osc.connect(g);
          g.connect(voix);
          osc.start(0);
          osc.stop(duree);
        }
        // Une syllabe toutes les 260 ms, comme un débit ordinaire.
        for (let t = 0.05; t < duree - 0.1; t += 0.26) {
          voix.gain.setValueAtTime(0.02, t);
          voix.gain.linearRampToValueAtTime(1, t + 0.05);
          voix.gain.setTargetAtTime(0.05, t + 0.12, 0.05);
        }
      }

      // Le bruitage tombe au tiers du fichier : on entend ce qu'il y a avant,
      // pendant et après, ce qui est exactement le jugement demandé.
      window.__sfx.scheduleSfx(ctx, sortie, id, duree / 3, gain);

      const rendu = await ctx.startRendering();
      return [Array.from(rendu.getChannelData(0)), Array.from(rendu.getChannelData(1))];
    },
    { id, avecVoix, gain, duree, taux: TAUX },
  );
}

/**
 * Part de l'énergie du bruitage qui tombe dans la bande de la parole.
 *
 * C'est la mesure qui répond à « est-ce que ça recouvre ce qu'on dit ». La
 * voix porte son intelligibilité entre 300 et 3400 Hz — la bande téléphonique,
 * et ce n'est pas un hasard : c'est le minimum pour comprendre des mots. Un
 * bruitage qui loge l'essentiel de son énergie là masque la parole même à
 * niveau égal, tandis qu'un grave ou un aigu la laisse passer.
 *
 * Une **seule** grille de fréquences, et la bande de la voix en est un
 * sous-ensemble. La première version en balayait deux, l'une de 300 à 3400 et
 * l'autre de 40 à 16000, chacune par pas géométrique depuis sa propre borne :
 * les deux ne tombaient donc pas sur les mêmes fréquences, un pic vu par l'une
 * était manqué par l'autre, et le rapport a rendu jusqu'à 22 989 % — une part
 * de vingt-deux mille neuf cents pour cent. Une mesure impossible se repère à
 * l'œil ; une mesure simplement fausse, non.
 */
function partDansLaVoix(canaux, taux) {
  const mono = canaux[0].map((v, i) => (v + canaux[1][i]) / 2);

  /** Énergie à une fréquence, par Goertzel. */
  const aLaFrequence = (f) => {
    const w = (2 * Math.PI * f) / taux;
    const coef = 2 * Math.cos(w);
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < mono.length; i += 1) {
      s0 = mono[i] + coef * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.max(0, s1 * s1 + s2 * s2 - coef * s1 * s2);
  };

  let voix = 0;
  let total = 0;
  // Un sixième d'octave de 40 Hz à 16 kHz : assez fin pour ne pas manquer une
  // résonance, assez large pour tenir en quelques dizaines de points.
  for (let f = 40; f <= 16000; f *= 2 ** (1 / 6)) {
    const e = aLaFrequence(f);
    total += e;
    if (f >= 300 && f <= 3400) voix += e;
  }
  return { part: total > 0 ? voix / total : 0, voix };
}

/**
 * Instant de la crête, relatif au déclenchement.
 *
 * Un bruitage de raccord doit frapper **sur** la coupe. S'il frappe trente
 * millisecondes après, il ne ponctue plus le raccord, il commente le plan
 * suivant — et c'est une des formes du « pas raccordé » rapporté. Le limiteur
 * ajouté dans l'étage de sortie pouvait retarder l'attaque : cette colonne
 * existe pour que ça ne passe pas inaperçu.
 */
function instantDeLaCrete(canaux, taux, debut) {
  const de = Math.floor(debut * taux);
  let meilleur = de;
  let crete = 0;
  for (let i = de; i < canaux[0].length; i += 1) {
    const v = Math.max(Math.abs(canaux[0][i]), Math.abs(canaux[1][i]));
    if (v > crete) {
      crete = v;
      meilleur = i;
    }
  }
  return ((meilleur - de) / taux) * 1000;
}

/**
 * Crête et niveau efficace, sur la fenêtre où le bruitage sonne.
 *
 * Mesurer sur le fichier entier comparait des choses incomparables : un
 * `click` de 0,08 s noyé dans 1,6 s de silence rendait 15 dB de moins qu'un
 * `boom` de 2 s dans 2,8 s, sans qu'aucun des deux ne soit plus fort à
 * l'oreille. La fenêtre suit donc la durée déclarée du bruitage.
 */
function niveaux(canaux, taux, debut = 0, longueur = Infinity) {
  const de = Math.max(0, Math.floor(debut * taux));
  const a = Math.min(canaux[0].length, Math.ceil((debut + longueur) * taux));
  let crete = 0;
  let somme = 0;
  let n = 0;
  for (const canal of canaux) {
    for (let i = de; i < a; i += 1) {
      const v = canal[i];
      crete = Math.max(crete, Math.abs(v));
      somme += v * v;
      n += 1;
    }
  }
  const rms = Math.sqrt(somme / Math.max(1, n));
  const dB = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x));
  return { crete: dB(crete), rms: dB(rms) };
}

const LISTE = await page.evaluate(() =>
  window.__sfx.SFX_LIBRARY.map((s) => ({ id: s.id, duration: s.duration })),
);

if (LISTE.length === 0) throw new Error('bibliothèque de bruitages vide — le module ne se charge pas');

console.log(`${LISTE.length} bruitages, rendus dans ${SORTIE}\n`);
console.log('id           crête    efficace   bande voix : part / niveau   attaque   écrêtage');

for (const { id, duration } of LISTE) {
  const duree = Math.max(1.6, duration + 0.8);

  const seul = await rendre(id, { avecVoix: false, gain: 0.85, duree });
  writeFileSync(join(SORTIE, `${id}-seul.wav`), versWav(seul, TAUX));
  const a = niveaux(seul, TAUX, duree / 3, duration);

  // Le fichier mêlé sert à la mesure de masquage, jamais à l'écoute : sa voix
  // est fabriquée, et une voix fabriquée s'entend comme une sonnerie.
  const mele = await rendre(id, { avecVoix: true, gain: 0.85, duree });
  writeFileSync(join(SORTIE, `${id}-sur-voix.wav`), versWav(mele, TAUX));

  const { part, voix } = partDansLaVoix(seul, TAUX);
  const dB = (x) => (x <= 0 ? -99 : 10 * Math.log10(x / seul[0].length));
  const pointe = instantDeLaCrete(seul, TAUX, duree / 3);
  console.log(
    `${id.padEnd(12)} ${a.crete.toFixed(1).padStart(5)} dB ${a.rms.toFixed(1).padStart(7)} dB   ` +
      `${(part * 100).toFixed(0).padStart(9)} % ${dB(voix).toFixed(1).padStart(8)} dB   ` +
      `${pointe.toFixed(0).padStart(4)} ms   ` +
      `${a.crete > 0 ? `OUI +${a.crete.toFixed(1)} dB` : 'non'}`,
  );
}

/*
 * La planche sonore : les treize à la suite, sur une voix, dans un fichier.
 *
 * Vingt-six fichiers séparés ne se jugent pas — on en écoute trois et on
 * abandonne. Celui-ci s'écoute d'un bout à l'autre en une demi-minute, et deux
 * versions du code se comparent en les mettant côte à côte. C'est la forme que
 * le §0 exige pour tout ce qui part chez le propriétaire : ouvrable en deux
 * gestes, pas un dossier à explorer.
 */
const PAS = 2.4;

/*
 * Deux planches, et l'ordre compte : les bruitages **seuls** d'abord.
 *
 * La première version n'en rendait qu'une, avec la voix de synthèse dessous.
 * Envoyée au propriétaire, elle a reçu « c'est quoi ça c'est horrible » — et
 * il avait raison : cette voix est une dent-de-scie à 178 Hz hachée toutes les
 * 260 ms, présente sans interruption pendant trente-deux secondes à
 * −28,9 dBFS. Ce n'est pas une voix, c'est une sonnerie, et elle domine tout
 * ce qu'on voulait faire juger.
 *
 * **Une voix fabriquée sert à mesurer un masquage, jamais à faire écouter.**
 * Elle reste donc, parce que le chiffre qu'elle donne est juste ; mais ce
 * qu'on envoie pour un jugement à l'oreille est la planche sans elle.
 */
async function rendrePlanche(avecVoix) {
  return page.evaluate(
  async ({ ids, pas, taux, avecVoix }) => {
    const duree = ids.length * pas + 1;
    const ctx = new OfflineAudioContext(2, Math.ceil(duree * taux), taux);
    const sortie = ctx.createGain();
    sortie.connect(ctx.destination);

    if (avecVoix) {
      const voix = ctx.createGain();
      voix.gain.value = 0;
      voix.connect(sortie);
      for (const [rang, poids] of [[1, 1], [2, 0.5], [3, 0.32], [4, 0.18], [6, 0.08]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 178 * rang;
        const g = ctx.createGain();
        g.gain.value = poids * 0.09;
        osc.connect(g);
        g.connect(voix);
        osc.start(0);
        osc.stop(duree);
      }
      for (let t = 0.05; t < duree - 0.1; t += 0.26) {
        voix.gain.setValueAtTime(0.02, t);
        voix.gain.linearRampToValueAtTime(1, t + 0.05);
        voix.gain.setTargetAtTime(0.05, t + 0.12, 0.05);
      }
    }

    ids.forEach((id, i) => window.__sfx.scheduleSfx(ctx, sortie, id, 0.6 + i * pas, 0.85));

    const rendu = await ctx.startRendering();
    return [Array.from(rendu.getChannelData(0)), Array.from(rendu.getChannelData(1))];
  },
    { ids: LISTE.map((s) => s.id), pas: PAS, taux: TAUX, avecVoix },
  );
}

for (const [avecVoix, nom, quoi] of [
  [false, 'planche-bruitages-seuls.wav', 'les bruitages seuls — la planche à écouter'],
  [true, 'planche-sur-voix.wav', 'les mêmes sur une voix fabriquée — pour mesurer, pas pour juger'],
]) {
  const planche = await rendrePlanche(avecVoix);
  const chemin = join(SORTIE, nom);
  writeFileSync(chemin, versWav(planche, TAUX));
  const p = niveaux(planche, TAUX);
  console.log(
    `\n${chemin}\n  ${quoi}` +
      `\n  ${LISTE.length} bruitages toutes les ${PAS} s — ` +
      `crête ${p.crete.toFixed(1)} dBFS, efficace ${p.rms.toFixed(1)} dBFS`,
  );
}
console.log(`\n  ordre : ${LISTE.map((s) => s.id).join(' · ')}`);

await navigateur.close();
