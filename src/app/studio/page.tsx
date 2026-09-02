import { Studio } from '@/components/Studio';

/**
 * Le studio, à son adresse propre.
 *
 * Il vivait à la racine, ce qui faisait tomber un visiteur inconnu dans une
 * timeline vide sans savoir ce qu'il regardait. La racine porte désormais la
 * page qui explique, et le studio se rejoint d'un lien.
 *
 * Le manifeste ouvre l'application installée **ici** et non à la racine : qui
 * l'a posée sur son écran d'accueil connaît déjà le produit, et n'a rien à
 * faire d'une page de vente.
 */
export default function Page() {
  return <Studio />;
}
