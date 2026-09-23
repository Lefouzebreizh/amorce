import type { Metadata } from 'next';
import UniversPage from './univers/page';

export const metadata: Metadata = {
  title: 'Lefouzèbreizh Studio — Des horizons plus grands',
  description:
    'Sites professionnels, audits et outils numériques assistés par IA : découvrez les offres et les réalisations publiques de Lefouzèbreizh Studio.',
  openGraph: {
    title: 'Lefouzèbreizh Studio — Des horizons plus grands',
    description:
      'Sites professionnels, audits et outils numériques assistés par IA : découvrez les offres et les réalisations publiques de Lefouzèbreizh Studio.',
    url: '/',
    siteName: 'Lefouzèbreizh Studio',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lefouzèbreizh Studio — Des horizons plus grands',
    description:
      'Sites professionnels, audits et outils numériques assistés par IA : découvrez les offres et les réalisations publiques de Lefouzèbreizh Studio.',
  },
};

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
