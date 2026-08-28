import type { NextConfig } from 'next'

/*
 * Rien à configurer côté rendu. Le seul point notable est ailleurs : le cache
 * s'ouvre par `node:sqlite`, encore expérimental sous Node 22, ce qui demande
 * un drapeau au démarrage. Il est posé dans les scripts npm par `NODE_OPTIONS`
 * plutôt qu'ici — `next.config.ts` est lu *par* le processus, trop tard pour
 * décider des modules natifs qu'il expose.
 */
const config: NextConfig = {}

export default config
