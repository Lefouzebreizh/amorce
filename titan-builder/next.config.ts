import type { NextConfig } from 'next';

/*
 * Rien à configurer, et c'est voulu : pas d'image distante, pas de réécriture,
 * pas d'en-tête sur mesure. Ce qui se déploie sans réglage se redéploie
 * ailleurs sans surprise — l'objectif étant Vercel en un clic.
 */
const config: NextConfig = {};

export default config;
