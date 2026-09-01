import type { Metadata, Viewport } from 'next';
import './globals.css';
import { adresseDuSite } from '@/lib/config';

export const metadata: Metadata = {
  /* Pas d'adresse réglée, pas de base de métadonnées : Next se contente alors
     d'URL relatives, là où une base inventée ferait pointer chaque partage vers
     un domaine que personne ne sert. */
  metadataBase: adresseDuSite ? new URL(adresseDuSite) : undefined,
  title: 'Site vitrine artisan express — 300 €, livré en 48 h',
  description:
    'Maçon, couvreur, électricien : un site qui te trouve des chantiers, livré en 48 h. 300 € une fois, pas d’abonnement.',
  keywords: [
    'site internet artisan',
    'site vitrine maçon',
    'site couvreur',
    'site électricien',
    'création site artisan pas cher',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    title: 'Ton site artisan, livré en 48 h — 300 €',
    description:
      'Un site d’une page qui te trouve des chantiers. 300 € une fois, pas d’abonnement, livré en 48 h.',
    ...(adresseDuSite ? { url: adresseDuSite } : {}),
  },
  robots: { index: true, follow: true },
};

/*
 * `themeColor` en bleu : Chrome Android colore sa barre d'adresse avec, et une
 * page qui ne déclare rien se fait appliquer un thème sombre automatique.
 */
export const viewport: Viewport = {
  themeColor: '#004aad',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
