import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    rules: {
      // Une page de vente n'a aucune raison de manipuler un `any` : la règle
      // arrête l'intégration plutôt que d'avertir.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);

export default eslintConfig;
