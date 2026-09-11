// Logique d'orchestration des couches 1, 2 et 3 — extraite ici pour être
// appelée depuis la route Next.js (src/app/api/repondre/), qui sert le
// prototype de démonstration tant que le projet Supabase n'existe pas.
//
// La fonction Edge Supabase (supabase/functions/repondre/) garde SA PROPRE
// copie de cette logique plutôt que d'importer ce fichier : Deno exige des
// imports avec extension explicite (`./crisisDetection.ts`) là où ce
// fichier, consommé par Next.js, les écrit sans extension — les deux
// conventions ne coexistent pas dans un seul fichier. Les deux copies
// doivent donc être tenues à jour ensemble tant que ce choix n'est pas
// réglé autrement ; ce n'est pas un oubli.
//
// L'ORDRE ci-dessous est l'invariant le plus important du projet : la
// couche 1 tourne EN PREMIER, ne dépend d'aucun modèle, et peut intercepter
// la réponse avant qu'un seul jeton n'ait été généré — voir SECURITY.md,
// « la sécurité ne repose jamais sur le LLM seul ».

import { detecterCrise } from './crisisDetection';
import { MESSAGE_CRISE } from './crisisMessage';
import { PROMPT_SYSTEME } from './systemPrompt';
import { evaluerLimitesSession, type EtatSession } from './sessionLimits';

export type Tour = { role: 'user' | 'assistant'; texte: string };

export interface ResultatOrchestration {
  reponse: string;
  crise: boolean;
  niveau?: 'modere' | 'fort';
  rappelDiscret?: boolean;
  redirectionFerme?: boolean;
  erreur?: string;
}

// Modèle le plus récent au moment de l'écriture (11/09/2026) — provisoire,
// comme le fournisseur lui-même (voir TODO.md).
const MODELE_ANTHROPIC = 'claude-sonnet-5';

export async function traiterMessage(
  message: string,
  historique: Tour[],
  session: EtatSession | undefined,
  cleAnthropic: string | undefined,
  appelerLlm: typeof fetch = fetch,
): Promise<{ corps: ResultatOrchestration; statut: number }> {
  // --- Couche 1 : détection de crise, hors LLM, sur toute la conversation. ---
  const messagesPersonne = [...historique.filter((t) => t.role === 'user').map((t) => t.texte), message];
  const detection = detecterCrise(messagesPersonne);

  if (detection.niveau !== 'aucun') {
    // Le message figé part TEL QUEL, jamais généré, jamais reformulé par le
    // LLM — voir crisisMessage.ts. Aucun appel au modèle n'a lieu ici.
    return { corps: { reponse: MESSAGE_CRISE, crise: true, niveau: detection.niveau }, statut: 200 };
  }

  // --- Couche 3 : limites structurelles de session. ---
  const limites = session ? evaluerLimitesSession(session) : { rappelDiscret: false, redirectionFerme: false };

  if (!cleAnthropic) {
    // Échec explicite plutôt qu'une réponse simulée : faire semblant de
    // répondre coûterait plus cher qu'un message d'erreur honnête.
    return {
      corps: { reponse: '', crise: false, erreur: 'Fournisseur LLM non configuré côté serveur (ANTHROPIC_API_KEY absente).' },
      statut: 500,
    };
  }

  // Une clé qui contient un espace ou un saut de ligne n'est jamais valide
  // — c'est le signe d'un copier-coller accidentel (valeur dupliquée, retour
  // à la ligne collé avec). Sans ce garde-fou, `fetch` plante avec un
  // `TypeError: Headers.append: … is an invalid header value` qui ne dit
  // rien de la cause, et le message d'erreur brut finit dans les journaux —
  // exactement l'endroit où une clé ne doit jamais apparaître deux fois.
  const cleNettoyee = cleAnthropic.trim();
  if (/\s/.test(cleNettoyee)) {
    return {
      corps: {
        reponse: '',
        crise: false,
        erreur:
          "ANTHROPIC_API_KEY contient un espace ou un saut de ligne — probablement collée en double. Revoir la variable d'environnement côté Vercel.",
      },
      statut: 500,
    };
  }

  // --- Couche 2 : prompt système anti-sycophancie, puis appel au modèle. ---
  const reponseAnthropic = await appelerLlm('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': cleNettoyee,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELE_ANTHROPIC,
      max_tokens: 1024,
      system: PROMPT_SYSTEME,
      messages: [...historique.map((t) => ({ role: t.role, content: t.texte })), { role: 'user', content: message }],
    }),
  });

  if (!reponseAnthropic.ok) {
    // Journalisé côté serveur uniquement (jamais renvoyé au client) : sans
    // ça, un refus d'Anthropic (clé invalide, facturation absente, modèle
    // inconnu, quota) rend tous le même message générique et un diagnostic
    // à distance devient impossible.
    const corpsErreur = await reponseAnthropic.text().catch(() => '(corps illisible)');
    console.error(`Anthropic a refusé la requête : ${reponseAnthropic.status} ${corpsErreur}`);
    return { corps: { reponse: '', crise: false, erreur: 'Le fournisseur LLM a refusé la requête.' }, statut: 502 };
  }
  const resultat = await reponseAnthropic.json();
  // claude-sonnet-5 réfléchit en amont par défaut (réflexion adaptative, sans
  // paramètre `thinking` à poser) : le premier bloc de `content` est alors de
  // type `thinking` (pas de champ `.text`), et le texte réel arrive dans un
  // bloc `text` plus loin dans le tableau. Lire `content[0].text` à l'aveugle
  // rendait donc une chaîne vide à chaque appel, sans jamais planter.
  interface BlocContenu { type: string; text?: string }
  const blocTexte = (resultat?.content as BlocContenu[] | undefined)?.find((bloc) => bloc.type === 'text');
  const texte = blocTexte?.text ?? '';

  return {
    corps: {
      reponse: texte,
      crise: false,
      rappelDiscret: limites.rappelDiscret,
      redirectionFerme: limites.redirectionFerme,
    },
    statut: 200,
  };
}
