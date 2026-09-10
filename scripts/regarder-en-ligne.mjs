/**
 * Regarder une page déployée, depuis une session distante.
 *
 * Le §8 du dépôt exige « regardé, pas seulement mesuré », et le §8 bis étend
 * l'exigence à toute session : couleurs relevées sur la page **servie**,
 * contrastes, erreurs de console, débordement au pouce. Sauf que Chromium ne
 * peut pas ouvrir `*.vercel.app` d'ici — `ERR_CONNECTION_RESET`, avec ou sans
 * `--proxy-server`, alors que `curl` rend 200 sur la même adresse à la même
 * seconde. Le filtrage est **par outil**, pas par hôte, et le message d'erreur
 * ne le dit pas.
 *
 * La parade est écrite depuis le 08/09/2026 dans
 * `second-brain/lecons/2026-09-08-le-mandataire-filtre-par-outil-pas-par-hote.md`
 * — « elle tient en trente lignes » — et elle n'était outillée nulle part :
 * chaque session qui voulait regarder sa production la réécrivait. C'est ce
 * fichier-ci.
 *
 * On met `curl` **entre** le navigateur et l'amont : un serveur local rejoue
 * chaque requête et rend les octets. Le navigateur croit visiter `localhost` ;
 * ce qu'il peint vient de la production.
 *
 *   node scripts/regarder-en-ligne.mjs https://exemple.vercel.app [port]
 *
 * Puis on conduit Playwright sur `http://127.0.0.1:<port>` — et
 * `getComputedStyle` y donne enfin ce que le navigateur **peint**, ce qui est
 * autre chose que ce que le CSS déclare.
 *
 * Deux pièges, et le second a coûté une capture d'écran :
 *
 * 1. **Rendre le `content-type` de l'amont.** Sans lui, le navigateur devine,
 *    et il devine mal sur les fontes et les feuilles de style.
 * 2. **Séparer entêtes et corps dans deux fichiers.** Les deux sur la sortie
 *    standard se mêlent, et le navigateur affiche l'entête HTTP comme du texte
 *    brut — une mesure qui rend 200 pendant que le rendu montre autre chose.
 *
 * Ce script ne sert qu'à *regarder* : il ne met rien en cache, ne réécrit
 * aucun corps, et ne connaît pas le montage. Il n'entre donc pas en conflit
 * avec l'invariant « le moteur de montage ne connaît pas le réseau » — il ne
 * vit pas dans `src/`.
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const AMONT = process.argv[2];
const PORT = Number(process.argv[3] ?? 8788);

if (!AMONT || !/^https?:\/\//.test(AMONT)) {
  console.error('usage : node scripts/regarder-en-ligne.mjs https://exemple.vercel.app [port]');
  process.exit(1);
}

let compteur = 0;

const serveur = createServer((requete, reponse) => {
  const base = join(tmpdir(), `regarder-${process.pid}-${compteur++}`);
  const fEntetes = `${base}.entetes`;
  const fCorps = `${base}.corps`;

  execFile(
    'curl',
    ['-s', '-L', '-D', fEntetes, '-o', fCorps, '--max-time', '40', AMONT + requete.url],
    { maxBuffer: 1 << 28 },
    async (erreur) => {
      if (erreur) {
        reponse.writeHead(502, { 'content-type': 'text/plain' });
        reponse.end(`relais : ${erreur.message}`);
        return;
      }
      try {
        const entetes = await readFile(fEntetes, 'latin1');
        const corps = await readFile(fCorps);
        // `-L` empile les entêtes de chaque saut : seul le dernier bloc décrit
        // la réponse qu'on rend.
        const dernier = entetes.trim().split(/\r?\n\r?\n/).pop() ?? '';
        const ligne = dernier.split(/\r?\n/).find((l) => /^content-type:/i.test(l));
        reponse.writeHead(200, {
          'content-type': ligne
            ? ligne.split(':').slice(1).join(':').trim()
            : 'application/octet-stream',
        });
        reponse.end(corps);
      } catch (echec) {
        reponse.writeHead(502, { 'content-type': 'text/plain' });
        reponse.end(`relais : ${echec.message}`);
      } finally {
        unlink(fEntetes).catch(() => {});
        unlink(fCorps).catch(() => {});
      }
    },
  );
});

serveur.listen(PORT, () => {
  console.error(`relais prêt : http://127.0.0.1:${PORT}  ->  ${AMONT}`);
});
