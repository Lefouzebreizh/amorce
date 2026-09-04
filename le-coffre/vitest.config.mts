import { defineConfig, loadEnv } from 'vite';

// coffre.ts importe supabase.ts, qui exige NEXT_PUBLIC_SUPABASE_URL et
// NEXT_PUBLIC_SUPABASE_ANON_KEY dès le chargement du module (voir
// src/lib/supabase.ts) — sans ça, tout test qui touche à coffre.ts échoue
// avant même de démarrer, même s'il ne teste qu'une fonction pure. On
// recharge .env.local comme le ferait `next dev`, rien d'autre.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [cle, valeur] of Object.entries(env)) {
    if (cle.startsWith('NEXT_PUBLIC_')) process.env[cle] = valeur;
  }
  return { test: { environment: 'node' } };
});
