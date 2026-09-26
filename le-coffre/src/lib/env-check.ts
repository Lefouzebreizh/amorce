import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('URL Supabase invalide'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'Clé API Supabase trop courte'),
});

export function verifierEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.success) {
    console.error('❌ Erreur de configuration:', result.error.format());
    throw new Error('Configuration environnement invalide');
  }
  return result.data;
}
