import type { Session } from '@/lib/supabase/session';
import type { InstantanePatrimoine } from '@/lib/types';

const PLAFOND = 60;

export async function listerBilans(session: Session): Promise<InstantanePatrimoine[]> {
  const { data, error } = await session.client
    .from('patrimony_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(PLAFOND);

  if (error) {
    console.error('[financia]', error);
    return [];
  }

  return data;
}

export function evolutionEur(bilans: readonly InstantanePatrimoine[]): number | null {
  const recent = bilans.at(0);
  const ancien = bilans.at(-1);
  if (!recent || !ancien || recent === ancien) return null;
  return recent.total_eur - ancien.total_eur;
}
