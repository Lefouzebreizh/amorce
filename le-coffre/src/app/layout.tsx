import type { Metadata, Viewport } from 'next';
import './globals.css';
import { EnregistrerServiceWorker } from './EnregistrerServiceWorker';

export const metadata: Metadata = {
  title: 'Mon Tiroir Secret — tes papiers, tes échéances',
  description:
    'Tes documents chiffrés avant stockage, tes papiers et tes échéances au même endroit. Les fonctions IA transmettent les informations nécessaires à leur traitement.',
  robots: { index: true, follow: true },
  // PWA installable, lancée sans chrome de navigateur visible — voir
  // `manifest.ts` pour les icônes et `sw.js` pour ce qui la rend
  // installable et rechargeable hors ligne.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mon Tiroir Secret',
  },
};

export const viewport: Viewport = {
  // Turquoise lagon (`--color-accent` de globals.css), la couleur d'action
  // de l'application — remplace un `#16151a` qui ne correspondait à aucune
  // teinte de la palette (10/09/2026).
  themeColor: '#40e0d0',
};

export default function RacineMiseEnPage({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <EnregistrerServiceWorker />
      </body>
    </html>
  );
}
