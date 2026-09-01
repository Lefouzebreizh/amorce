/**
 * Ce que tous les scripts de la chaîne ont en commun.
 *
 * Trois choses cassent systématiquement dans un conteneur neuf, et chacune
 * coûte un quart d'heure quand on la redécouvre : le Chromium de Playwright
 * n'est pas téléchargé, `ffmpeg` n'est pas installé, et `fetch` ne fonctionne
 * pas depuis une page `file://`. Les trois sont réglées ici, une fois.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

/**
 * Le Chromium à piloter.
 *
 * `chromium.launch()` sans chemin cherche la révision exacte qu'attend la
 * version de Playwright installée. Un conteneur qui en fournit une autre — ou
 * qui la range ailleurs — fait échouer le lancement sur un message qui invite à
 * lancer `playwright install`, alors qu'un navigateur parfaitement utilisable
 * est déjà là. On regarde donc d'abord les emplacements connus.
 */
export function cheminChromium() {
  const candidats = [
    process.env.AMORCE_CHROMIUM,
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter(Boolean);

  return candidats.find((c) => existsSync(c));
}

/** Ouvre un navigateur prêt à composer et à enregistrer. */
export async function ouvrirNavigateur() {
  return chromium.launch({
    executablePath: cheminChromium(),
    // Sans cette autorisation, le contexte audio reste suspendu et
    // l'enregistrement sort muet — sans qu'aucune erreur ne soit levée.
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
}

/**
 * Un `ffmpeg` complet, installé à la demande.
 *
 * Celui que livre Playwright est amputé : il ne sait ni démuxer un MP3, ni
 * réencoder quoi que ce soit — il ne sert qu'à ses propres captures d'écran.
 * S'y fier fait conclure à un fichier corrompu devant un fichier sain.
 */
export function cheminFfmpeg(dossierTravail) {
  if (process.env.AMORCE_FFMPEG && existsSync(process.env.AMORCE_FFMPEG)) {
    return process.env.AMORCE_FFMPEG;
  }

  const local = join(dossierTravail, 'node_modules', 'ffmpeg-static', 'ffmpeg');
  if (existsSync(local)) return local;

  mkdirSync(dossierTravail, { recursive: true });
  execFileSync('npm', ['install', 'ffmpeg-static', '--no-save', '--prefix', dossierTravail], {
    stdio: 'pipe',
  });

  if (!existsSync(local)) throw new Error('ffmpeg n’a pas pu être installé.');
  return local;
}

/**
 * Lance ffmpeg et rend tout ce qu'il a écrit, les deux sorties confondues.
 *
 * Les deux comptent, et pas pour les mêmes choses : les mesures de `metadata`
 * partent sur la sortie standard, tandis que la durée, les flux et le résultat
 * de `volumedetect` partent sur la sortie d'erreur — y compris quand tout va
 * bien. Ne lire que l'une des deux fait conclure à une mesure impossible
 * devant un fichier parfaitement mesurable.
 *
 * Le code de retour ne renseigne pas davantage : ffmpeg sort en échec pour des
 * motifs anodins, comme sonder un fichier sans rien produire.
 */
export function ffmpeg(binaire, args) {
  const resultat = spawnSync(binaire, ['-hide_banner', ...args], { encoding: 'utf8' });
  return `${resultat.stdout ?? ''}${resultat.stderr ?? ''}`;
}

/**
 * Sert un dossier en HTTP, le temps du rendu.
 *
 * Une page ouverte en `file://` n'a pas le droit de `fetch` ses voisines : la
 * voix ne se charge pas, et l'erreur — « Failed to fetch » — ne dit rien du
 * schéma d'URL. Un serveur local lève l'interdit sans rien changer d'autre.
 */
export function servir(dossier, port = 8099) {
  const serveur = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: dossier,
    stdio: 'ignore',
    detached: false,
  });

  const attendre = async () => {
    for (let essai = 0; essai < 40; essai++) {
      try {
        const reponse = await fetch(`http://127.0.0.1:${port}/`);
        if (reponse.ok || reponse.status === 404) return;
      } catch {
        // Le serveur n'écoute pas encore : on repasse dans un instant.
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Le serveur local n’a pas répondu sur le port ${port}.`);
  };

  return {
    base: `http://127.0.0.1:${port}`,
    pret: attendre(),
    arreter: () => serveur.kill(),
  };
}

/** Décode un fichier audio dans le navigateur et rend ses échantillons. */
export async function decoderAudio(page, octets, frequenceCible = 8000) {
  const b64 = Buffer.from(octets).toString('base64');
  return page.evaluate(
    async ({ b64, frequenceCible }) => {
      const binaire = atob(b64);
      const tampon = new Uint8Array(binaire.length);
      for (let i = 0; i < binaire.length; i++) tampon[i] = binaire.charCodeAt(i);

      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const buffer = await ctx.decodeAudioData(tampon.buffer);
      const source = buffer.getChannelData(0);

      // Un contour d'énergie n'a pas besoin de 44 kHz, et faire traverser des
      // millions d'échantillons à la frontière du navigateur coûte plus cher
      // que tout le reste du calcul.
      const facteur = Math.max(1, Math.round(buffer.sampleRate / frequenceCible));
      const reduit = [];
      for (let i = 0; i < source.length; i += facteur) reduit.push(source[i]);

      return {
        duree: buffer.duration,
        frequence: buffer.sampleRate,
        frequenceReduite: buffer.sampleRate / facteur,
        echantillons: reduit,
      };
    },
    { b64, frequenceCible },
  );
}

/** Écrit un WAV 16 bits mono à partir d'échantillons flottants. */
export function ecrireWav(pcm, frequence) {
  const octets = Buffer.alloc(44 + pcm.length * 2);
  octets.write('RIFF', 0);
  octets.writeUInt32LE(36 + pcm.length * 2, 4);
  octets.write('WAVE', 8);
  octets.write('fmt ', 12);
  octets.writeUInt32LE(16, 16);
  octets.writeUInt16LE(1, 20);
  octets.writeUInt16LE(1, 22);
  octets.writeUInt32LE(frequence, 24);
  octets.writeUInt32LE(frequence * 2, 28);
  octets.writeUInt16LE(2, 32);
  octets.writeUInt16LE(16, 34);
  octets.write('data', 36);
  octets.writeUInt32LE(pcm.length * 2, 40);

  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    octets.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), 44 + i * 2);
  }
  return octets;
}

/** Le dossier de travail par défaut, à côté du fichier demandé. */
export function dossierDe(chemin) {
  return dirname(chemin);
}
