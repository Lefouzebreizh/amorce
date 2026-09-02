/**
 * Où trouver le Chromium que Playwright doit conduire.
 *
 * Pourquoi ce fichier existe, alors que les sept scripts de ce dossier sont
 * par ailleurs autonomes : la même expression y était recopiée, et elle avait
 * déjà dérivé. Six scripts lisaient `AMORCE_CHROMIUM` puis retombaient sur
 * `undefined` ; `planche.mjs`, lui, ne lisait rien du tout. Une règle écrite
 * sept fois est une règle qui se désynchronise, et c'est déjà arrivé ici.
 *
 * Le problème qu'elle résout : le conteneur des sessions distantes porte un
 * Chromium préinstallé dont la révision n'est pas celle que le Playwright de
 * la racine attend — 1194 contre 1234, relevé le 01/09/2026. Lancé sans
 * indication, Playwright réclame un téléchargement que la politique réseau
 * refuse, et `npm run fixtures` meurt sur un « Executable doesn't exist »
 * suivi d'un conseil — `npx playwright install` — qui ne peut pas aboutir.
 *
 * `iptv` et `annuaire-ia` avaient tous les deux la parade ; Amorce, qui
 * déclare pourtant Playwright, ne l'avait pas. Ce fichier lui donne la même.
 *
 * L'ordre est délibéré : la variable d'environnement d'abord, pour garder la
 * main sur une machine où le binaire est ailleurs ; le lien du conteneur
 * ensuite, s'il existe ; et `undefined` en dernier, qui rend exactement le
 * comportement d'origine — Playwright choisit son propre navigateur.
 */
import { existsSync } from 'node:fs';

const LIEN_CONTENEUR = '/opt/pw-browsers/chromium';

export const cheminChromium =
  process.env.AMORCE_CHROMIUM || (existsSync(LIEN_CONTENEUR) ? LIEN_CONTENEUR : undefined);

/** Les options de `chromium.launch()`, à étaler dans celles du script appelant. */
export const optionsChromium = { executablePath: cheminChromium };
