/*
 * Les quelques valeurs qui changent d'un déploiement à l'autre.
 *
 * Elles sont lues par leur nom complet et non construites dynamiquement : Next
 * remplace `process.env.NEXT_PUBLIC_…` à la compilation, et une clé calculée
 * ressort `undefined` dans le navigateur sans rien signaler.
 *
 * Une valeur absente ne casse rien et n'invente rien. Le dossier de commande
 * est toujours écrit ; c'est l'envoi du courriel qui se tait, et la page le dit
 * au client plutôt que de lui laisser croire que c'est parti.
 */

/** Là où atterrissent les dossiers de commande. */
export const DOSSIER_COMMANDES = process.env.DOSSIER_COMMANDES ?? '/tmp/titan-commandes';

/** La boîte qui reçoit les dossiers. */
export const DESTINATAIRE = process.env.COMMANDE_DESTINATAIRE ?? 'erwannchevallier@gmail.com';

/**
 * L'expéditeur déclaré à Resend. Le domaine partagé fonctionne mais tombe plus
 * souvent en indésirable : le jour où un domaine est vérifié, c'est ici.
 */
export const EXPEDITEUR = process.env.COMMANDE_EXPEDITEUR ?? 'TITAN BUILDER <onboarding@resend.dev>';

export const CLE_RESEND = process.env.RESEND_API_KEY ?? '';

export const aUnCourriel = CLE_RESEND !== '' && DESTINATAIRE !== '';
