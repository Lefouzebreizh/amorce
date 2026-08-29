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
const config: NextConfig = {}

export default config
