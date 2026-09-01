import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // L'application Flutter voisine. Elle a son propre analyseur
    // (`flutter analyze`) et ses propres règles ; ESLint n'y trouverait que
    // les milliers de fichiers JavaScript générés par le SDK dans
    // `look_and_find/build/`, qu'aucune règle de ce dépôt ne concerne.
    "look_and_find/**",
    // Le socle de production livré aux clients. C'est un projet Next.js à part
    // entière, avec son propre `eslint.config.mjs`, son propre `tsconfig.json`
    // et ses propres alias `@/…` : analysé depuis la racine, chaque import y
    // pointerait vers `src/` d'Amorce. Il se vérifie depuis `agence/`.
    "agence/**",
    // La page de vente et la plateforme de configuration. Deux projets Next.js
    // autonomes, avec leur propre `eslint.config.mjs`, leur propre
    // `tsconfig.json` et leurs propres alias — même raison qu'`agence/`.
    //
    // Et une raison de plus, celle qui a rendu `main` rouge : le motif
    // `.next/**` ci-dessus est **ancré à la racine** et ne couvre pas
    // `artisan-express/.next/`. Le lint de la racine entrait donc dans les
    // fichiers de build du voisin, et comme la vérification lance tous les
    // projets **en parallèle**, il lisait un manifeste que le build d'à côté
    // était en train de remplacer : `ENOENT` sur `_buildManifest.js`, sans
    // qu'aucune ligne de code ne soit en cause.
    "artisan-express/**",
    "titan-builder/**",
    // Le tableau de bord IPTV : TypeScript à zéro dépendance d'exécution, son
    // propre `tsconfig.json`, et une vérification à lui (`npm run check`).
    "iptv/**",
    // Le réseau d'annuaires : onze sites de JavaScript servi tel quel, sans
    // build ni typage, avec leur propre validation (`npm run valider`).
    "annuaire-ia/**",
    // Le site hypersensible-bienveillance.com. Projet Astro + Cloudflare
    // autonome : ses propres `package.json`, `tsconfig.json` et `node_modules`,
    // ses propres types (`@cloudflare/workers-types`) que le TypeScript de la
    // racine ne connaît pas, et des Pages Functions qui n'ont rien de Next.js.
    // Il se vérifie depuis son dossier : `npm run check`, `npm test`.
    "hypersensible-bienveillance/**",
    // La copie de travail que le rejeu local de la CI dépose ici. Ce sont les
    // mêmes fichiers que ci-dessus, à un autre chemin : sans cette ligne, les
    // projets qu'on vient d'exclure reviennent par la porte de derrière.
    ".verif-ci/**",
  ]),
]);

export default eslintConfig;
