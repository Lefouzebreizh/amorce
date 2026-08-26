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
  ]),
]);

export default eslintConfig;
