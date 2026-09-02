import type { NextConfig } from 'next'

/*
 * Rien à configurer côté rendu.
 *
 * Le cache s'ouvre par `node:sqlite`, et les scripts npm portaient un
 * `NODE_OPTIONS=--experimental-sqlite` posé par précaution. Mesuré : le module
 * est accessible **sans drapeau** dès Node 22.22, et stable en 24. Le drapeau
 * n'apportait donc rien — et il aurait fait échouer le démarrage sur une
 * version qui ne le connaît plus, par un « bad option » sans rapport visible
 * avec SQLite. `engines` dit la version minimale à sa place.
 */
const config: NextConfig = {
  /*
   * Sans cette liste, Next refuse en développement tout script demandé
   * depuis une autre origine que localhost — hls.js compris. Un téléphone
   * arrivé par l'adresse réseau (`npm run iptv -- adresse`) reçoit alors la
   * page mais aucun script : le catalogue s'affiche, rien ne joue. Mesuré
   * le 02/09/2026 dans les journaux du serveur. Cette adresse est celle de
   * la machine sur le réseau local : à mettre à jour si elle change (DHCP).
   */
  allowedDevOrigins: ['10.37.164.140'],
}

export default config
