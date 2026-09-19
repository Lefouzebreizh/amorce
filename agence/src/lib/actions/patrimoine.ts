'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { rediger } from '@/lib/bilan/redaction';
import type { Situation } from '@/lib/bilan/modeles';
import { schemaSituationEnregistree } from '@/lib/bilan/validation';
import { exigerSession } from '@/lib/supabase/session';

export async function enregistrerBilan(donnees: FormData): Promise<void> {
  const brut = donnees.get('situation');
  if (typeof brut !== 'string') return;

  let decode: unknown;
  try {
    decode = JSON.parse(brut);
  } catch {
    return;
  }

  const analyse = schemaSituationEnregistree.safeParse(decode);
  if (!analyse.success) return;

  const situation = analyse.data as Situation;
  const bilan = rediger(situation, new Date());
  const { client, utilisateur } = await exigerSession();

  const { error } = await client.from('patrimony_snapshots').insert({
    user_id: utilisateur.id,
    situation,
    total_eur: bilan.patrimoine.totalEur,
    is_partial: bilan.patrimoine.partiel,
  });

  if (error) {
    console.error('[financia]', error);
    redirect('/patrimoine?erreur=enregistrement');
  }

  revalidatePath('/patrimoine');
  redirect('/patrimoine');
}

export async function supprimerBilan(donnees: FormData): Promise<void> {
  const identifiant = donnees.get('id');
  if (typeof identifiant !== 'string' || identifiant.length === 0) return;

  const { client, utilisateur } = await exigerSession();
  const { error } = await client
    .from('patrimony_snapshots')
    .delete()
    .eq('id', identifiant)
    .eq('user_id', utilisateur.id);

  if (error) {
    console.error('[financia]', error);
    redirect('/patrimoine?erreur=suppression');
  }

  revalidatePath('/patrimoine');
}
