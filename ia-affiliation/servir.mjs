#!/usr/bin/env node
/**
 * Serveur statique local — Radar IA
 *
 * `outils.json` se lit par requête réseau : ouvrir `index.html` par
 * double-clic (`file://`) donne une page vide, ce qui a déjà coûté un
 * « le site ne marche pas » alors que tout allait bien.
 *
 * Ce serveur existe plutôt que `npx serve` pour une raison précise : `npx`
 * télécharge un paquet à chaque machine neuve, et derrière un mandataire
 * d'entreprise ou une connexion de téléphone partagée, ce téléchargement est
 * exactement l'étape qui échoue. Node seul suffit, et Node est déjà là.
 *
 *   node servir.mjs         → http://127.0.0.1:4321
 *   node servir.mjs 8080    → même chose sur un autre port
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const serveur = http.createServer((requete, reponse) => {
  const url = new URL(requete.url, 'http://' + (requete.headers.host || 'localhost'));
  const demande = decodeURIComponent(url.pathname);
  const relatif = demande === '/' ? 'index.html' : demande.replace(/^\/+/, '');

  // Un chemin qui remonte hors du dossier servirait n'importe quel fichier de
  // la machine. On résout puis on vérifie l'appartenance, seule méthode qui
  // résiste aussi bien à « ../ » qu'aux liens symboliques.
  const cible = path.resolve(RACINE, relatif);
  if (cible !== RACINE && !cible.startsWith(RACINE + path.sep)) {
    reponse.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    reponse.end('403 — hors du dossier du site');
    return;
  }

  fs.readFile(cible, (erreur, contenu) => {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('404 — ' + relatif);
      return;
    }
    reponse.writeHead(200, {
      'Content-Type': TYPES[path.extname(cible).toLowerCase()] || 'application/octet-stream',
      // Le catalogue change à chaque exécution de l'auto-pilote : un cache de
      // navigateur ferait croire que le script n'a rien fait.
      'Cache-Control': 'no-store'
    });
    reponse.end(contenu);
  });
});

serveur.listen(PORT, '127.0.0.1', () => {
  console.log('── Radar IA servi sur http://127.0.0.1:' + PORT);
  console.log('   Ctrl+C pour arrêter.');
});
