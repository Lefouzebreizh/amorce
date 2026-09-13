import UniversPage from './univers/page';

/**
 * La racine est la porte d'entrée de Lefouzèbreizh Studio.
 *
 * Amorce garde sa page de vente et son atelier sous `/studio`. La page d'accueil
 * ne doit pas emprisonner l'écosystème dans un seul produit : elle oriente vers
 * les projets, leurs usages et leurs accès réels.
 */
export default function Page() {
  return <UniversPage />;
}
