import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    rules: {
      // Le cahier des charges de l'agence interdit `any` : la règle est ici une
      // erreur et non un avertissement, pour qu'elle arrête l'intégration.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);

export default eslintConfig;
