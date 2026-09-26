import { createClient } from '@supabase/supabase-js';
import { verifierEnv } from './env-check';

// Harnais de validation : vérifie l'environnement avant tout
const env = verifierEnv();

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
