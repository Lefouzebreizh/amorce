import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { EnregistrerServiceWorker } from './EnregistrerServiceWorker';

const URL_PUBLIQUE = 'https://coffre-puce.vercel.app';
const IMAGE_PARTAGE = '/brand/tiroir-secret-coffre-mer-phare-v2.jpg';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(URL_PUBLIQUE),
  title: {
    default: 'Mon Tiroir Secret — tes papiers, tes échéances',
    template: '%s | Mon Tiroir Secret',
  },
  description:
    'Tes documents chiffrés avant stockage, tes papiers et tes échéances au même endroit. Les fonctions IA transmettent les informations nécessaires à leur traitement.',
  alternates: { canonical: '/' },
  applicationName: 'Mon Tiroir Secret',
  creator: 'Lefouzèbreizh Studio',
  publisher: 'Lefouzèbreizh Studio',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: 'Mon Tiroir Secret',
    title: 'Mon Tiroir Secret — tes papiers, tes échéances',
    description:
      'Un espace personnel pour retrouver ses papiers et ses échéances, avec chiffrement dans le navigateur avant stockage.',
    images: [
      {
        url: IMAGE_PARTAGE,
        width: 1536,
        height: 864,
        alt: 'Un coffre secret ouvert sur la mer et un phare, symbole de rangement calme et privé.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mon Tiroir Secret — tes papiers, tes échéances',
    description:
      'Un espace personnel pour retrouver ses papiers et ses échéances, avec chiffrement dans le navigateur avant stockage.',
    images: [IMAGE_PARTAGE],
  },
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
      <body className={`${instrumentSerif.variable} ${plusJakartaSans.variable}`}>
        {children}
        <EnregistrerServiceWorker />
      </body>
    </html>
  );
}
