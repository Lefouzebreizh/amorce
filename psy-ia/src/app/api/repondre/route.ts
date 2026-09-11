// Route Next.js qui sert le prototype de démonstration — tant que le projet
// Supabase n'existe pas (voir TODO.md), c'est ici, et non dans la fonction
// Edge, que tourne l'orchestration réelle des couches 1 à 3. Voir
// src/lib/orchestrer.ts pour la logique elle-même et pourquoi elle n'est
// pas partagée telle quelle avec la fonction Edge (Deno vs Node).
import { NextRequest, NextResponse } from 'next/server';
import { traiterMessage, type Tour } from '@/lib/orchestrer';
import type { EtatSession } from '@/lib/sessionLimits';

interface CorpsRequete {
  message?: string;
  historique?: Tour[];
  session?: EtatSession;
}

export async function POST(requete: NextRequest) {
  let corps: CorpsRequete;
  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Corps JSON attendu : { message, historique, session }.' }, { status: 400 });
  }

  const { message, historique, session } = corps;
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ erreur: 'Le champ "message" est requis.' }, { status: 400 });
  }

  const { corps: resultat, statut } = await traiterMessage(message, historique ?? [], session, process.env.ANTHROPIC_API_KEY);
  return NextResponse.json(resultat, { status: statut });
}
