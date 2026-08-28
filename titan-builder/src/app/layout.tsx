import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TITAN BUILDER — ton site époustouflant livré en 48 h',
  description:
    'Choisis ton modèle, configure ton site en cinq étapes, reçois-le sous 48 heures. À partir de 299 €, une fois, sans abonnement.',
};

/*
 * `viewportFit: 'cover'` pour que le fond passe sous l'encoche, et un thème
 * sombre déclaré : sans lui, la barre d'état d'Android reste claire et coupe
 * le haut de la page d'un bandeau blanc.
 */
export const viewport: Viewport = {
  themeColor: '#05050b',
  viewportFit: 'cover',
};

export default function Racine({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
