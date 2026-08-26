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
  ]),
]);

export default eslintConfig;
