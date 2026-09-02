import type { Metadata } from 'next';

import { Remise } from './Remise';

export const metadata: Metadata = {
  title: 'Merci — votre clé Amorce',
  /* `noindex` : cette page ne vaut que par le paramètre que Stripe y met, et une
     adresse indexée sans lui n'affiche qu'un message d'erreur. */
  robots: { index: false, follow: false },
};

/**
 * Là où Stripe renvoie l'acheteur, et où il reçoit sa clé.
 *
 * L'adresse de succès doit porter `?session={CHECKOUT_SESSION_ID}` — c'est le
 * seul réglage de la console Stripe qu'aucun test ne peut rattraper : sans lui
 * le paiement aboutit et la clé reste inatteignable.
 */
export default function Page() {
  return <Remise />;
}
