// Fonction Edge Supabase de Psy IA — le seul point où les couches 1, 2 et 3
// se rejoignent avant tout appel à un LLM. L'ORDRE ci-dessous est
// l'invariant le plus important du projet : la couche 1 tourne EN PREMIER,
// ne dépend d'aucun modèle, et peut intercepter la réponse avant qu'un seul
// jeton n'ait été généré. Un appel au LLM n'a jamais lieu quand la couche 1
// a détecté un signal — voir SECURITY.md, « la sécurité ne repose jamais
// sur le LLM seul ».
//
// STATUT : le fournisseur LLM n'est pas encore tranché (voir TODO.md) — la
// note d'initialisation demande explicitement de choisir sur le critère
// fiabilité > coût pour ce projet, contrairement à l'habitude du dépôt.
// Cette fonction utilise Claude (Anthropic) à titre provisoire, par
// cohérence avec le reste du dépôt (voir le-coffre/supabase/functions/), et
// parce que c'est aujourd'hui le seul fournisseur déjà éprouvé ici — ce
// n'est PAS la décision définitive.

import { detecterCrise } from '../../../src/lib/crisisDetection.ts';
import { construireMessageCrise } from '../../../src/lib/crisisMessage.ts';
import { PROMPT_SYSTEME } from '../../../src/lib/systemPrompt.ts';
import { evaluerLimitesSession, type EtatSession } from '../../../src/lib/sessionLimits.ts';

const CLE_ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');
const MODELE = 'claude-sonnet-4-5-20250929';

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Tour = { role: 'user' | 'assistant'; texte: string };

interface CorpsRequete {
  message: string;
  historique: Tour[];
  session: EtatSession;
}

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Journalise un déclenchement de la couche 1 — jamais le contenu du
 * message, seulement qu'un signal a eu lieu et à quel niveau (voir
 * supabase/schema.sql, table `journal_crise`). Sert au seuil 2 de la
 * couche 3 (détresse répétée sur plusieurs sessions) et à la revue humaine
 * périodique. Non branché tant que le projet Supabase n'existe pas — voir
 * TODO.md.
 */
async function journaliserDeclenchementCrise(_sessionId: string, _niveau: 'modere' | 'fort'): Promise<void> {
  // TODO(couche 4) : écrire dans `journal_crise` une fois le projet
  // Supabase créé. Ne jamais y écrire le texte du message.
}

Deno.serve(async (requete: Request) => {
  if (requete.method === 'OPTIONS') {
    return new Response('ok', { headers: ENTETES_CORS });
  }

  let corps: CorpsRequete;
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: 'Corps JSON attendu : { message, historique, session }.' }, 400);
  }
  const { message, historique, session } = corps;
  if (typeof message !== 'string' || !message.trim()) {
    return reponseJson({ erreur: 'Le champ "message" est requis.' }, 400);
  }

  // --- Couche 1 : détection de crise, hors LLM, sur toute la conversation. ---
  const messagesPersonne = [...(historique ?? []).filter((t) => t.role === 'user').map((t) => t.texte), message];
  const detection = detecterCrise(messagesPersonne);

  if (detection.niveau !== 'aucun') {
    await journaliserDeclenchementCrise(session?.demarreeLe ? String(session.demarreeLe) : 'inconnue', detection.niveau);
    // Le squelette du message part TEL QUEL, jamais généré, jamais reformulé
    // par le LLM — voir crisisMessage.ts. Aucun appel au modèle n'a lieu ici.
    // Voir orchestrer.ts pour le choix du motif reflété (dernier message en
    // priorité, sinon premier motif détecté sur toute la conversation).
    const motifDernierMessage = detecterCrise([message]).motifs[0];
    const motifAReflex = motifDernierMessage ?? detection.motifs[0];
    return reponseJson({ reponse: construireMessageCrise(motifAReflex), crise: true, niveau: detection.niveau });
  }

  // --- Couche 3 : limites structurelles de session. ---
  const limites = session ? evaluerLimitesSession(session) : { rappelDiscret: false, redirectionFerme: false };

  if (!CLE_ANTHROPIC) {
    // Échec explicite plutôt qu'une réponse simulée : le choix du
    // fournisseur LLM n'est pas encore arrêté (TODO.md), et faire semblant
    // de répondre coûterait plus cher qu'un message d'erreur honnête.
    return reponseJson({ erreur: 'Fournisseur LLM non configuré côté serveur (ANTHROPIC_API_KEY absente).' }, 500);
  }

  // --- Couche 2 : prompt système anti-sycophancie, puis appel au modèle. ---
  const reponseAnthropic = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLE_ANTHROPIC,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 1024,
      system: PROMPT_SYSTEME,
      messages: [
        ...(historique ?? []).map((t) => ({ role: t.role, content: t.texte })),
        { role: 'user', content: message },
      ],
    }),
  });

  if (!reponseAnthropic.ok) {
    return reponseJson({ erreur: 'Le fournisseur LLM a refusé la requête.' }, 502);
  }
  const resultat = await reponseAnthropic.json();
  const texte = resultat?.content?.[0]?.text ?? '';

  return reponseJson({
    reponse: texte,
    crise: false,
    rappelDiscret: limites.rappelDiscret,
    redirectionFerme: limites.redirectionFerme,
  });
});
