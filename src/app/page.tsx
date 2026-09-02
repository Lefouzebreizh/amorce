import { Accueil } from '@/components/Accueil';

/**
 * La racine porte la page qui explique, plus le studio.
 *
 * Elle rendait `<Studio />` : un visiteur qui n'avait jamais entendu parler
 * d'Amorce tombait sur une timeline vide, sans savoir ce qu'il regardait ni ce
 * que ça coûtait. Le studio a désormais son adresse propre, `/studio`, et tout
 * ce qui l'ouvrait a suivi — le manifeste, la cible de partage et les cinq
 * parcours de vérification.
 */
export default function Page() {
  return <Accueil />;
}
