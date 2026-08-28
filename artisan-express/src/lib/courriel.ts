/*
 * L'envoi du courriel de demande, isolé derrière deux fonctions pures et une
 * seule qui touche au réseau.
 *
 * Pourquoi Resend en appel HTTP direct, sans son SDK : le paquet ajoute une
 * dépendance et une surface de mise à jour pour une seule requête POST. Ici, la
 * requête tient en dix lignes, se simule en test sans `--experimental-*`, et
 * s'échange contre un autre prestataire en changeant ce fichier seul.
 *
 * Attention, et c'est écrit exprès : le corps de la requête a été rédigé sans
 * pouvoir relire la documentation — `resend.com` est refusé par le mandataire
 * de cette machine. `construireCorpsResend` est donc isolée et éprouvée pour
 * elle-même : si le premier envoi réel rend une erreur de champ, c'est cette
 * fonction-là qu'on corrige, et rien d'autre.
 */

import type { Demande } from '@/lib/demande';

export type Reglages = {
  cle: string | undefined;
  destinataire: string | undefined;
  expediteur: string | undefined;
};

export type Resultat =
  /** Le courriel est parti. */
  | { statut: 'envoye' }
  /** Ni clé ni destinataire : la page bascule sur le téléphone et WhatsApp. */
  | { statut: 'non-configure' }
  /** Le prestataire a refusé. Le détail part dans les journaux, pas au visiteur. */
  | { statut: 'echec'; detail: string };

const URL_RESEND = 'https://api.resend.com/emails';

/*
 * Expéditeur de repli : le domaine partagé que Resend ouvre à tout compte neuf,
 * sans vérification DNS. Il permet d'encaisser la première demande le jour même
 * ; un domaine à soi se règle ensuite dans `DEVIS_EXPEDITEUR`.
 */
const EXPEDITEUR_PAR_DEFAUT = 'Artisan Express <onboarding@resend.dev>';

export function construireCourriel(demande: Demande): { sujet: string; texte: string } {
  const lignes = [
    `Métier : ${demande.metier}`,
    `Ville : ${demande.ville}`,
    `Téléphone : ${demande.telephone}`,
    `Courriel : ${demande.courriel === '' ? '(pas donné)' : demande.courriel}`,
    '',
    demande.message === '' ? '(pas de message)' : demande.message,
  ];

  return {
    sujet: `Site artisan 299 € — ${demande.nom} (${demande.metier}, ${demande.ville})`,
    texte: lignes.join('\n'),
  };
}

export function construireCorpsResend(demande: Demande, reglages: Reglages) {
  const { sujet, texte } = construireCourriel(demande);

  return {
    from: reglages.expediteur ?? EXPEDITEUR_PAR_DEFAUT,
    to: [reglages.destinataire ?? ''],
    subject: sujet,
    text: texte,
    /*
     * Répondre au courriel écrit directement à l'artisan quand il a laissé son
     * adresse. Sans cette ligne, la réponse part vers le domaine d'envoi et se
     * perd.
     */
    ...(demande.courriel === '' ? {} : { reply_to: demande.courriel }),
  };
}

export async function envoyerDemande(
  demande: Demande,
  reglages: Reglages,
  requete: typeof fetch = fetch,
): Promise<Resultat> {
  if (!reglages.cle || !reglages.destinataire) {
    return { statut: 'non-configure' };
  }

  let reponse: Response;

  try {
    reponse = await requete(URL_RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${reglages.cle}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(construireCorpsResend(demande, reglages)),
    });
  } catch (erreur) {
    return { statut: 'echec', detail: erreur instanceof Error ? erreur.message : 'réseau injoignable' };
  }

  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '');
    return { statut: 'echec', detail: `HTTP ${reponse.status} ${corps.slice(0, 300)}` };
  }

  return { statut: 'envoye' };
}

export function lireReglages(env: Record<string, string | undefined>): Reglages {
  return {
    cle: env.RESEND_API_KEY,
    destinataire: env.DEVIS_DESTINATAIRE,
    expediteur: env.DEVIS_EXPEDITEUR,
  };
}
