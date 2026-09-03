import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Le Coffre — tes papiers, tes échéances',
  description:
    'Dépose tes papiers administratifs, chiffrés de bout en bout — rien de lisible ne sort de ton navigateur, pas même vers nous.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#16151a',
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
      <body>{children}</body>
    </html>
  );
}
