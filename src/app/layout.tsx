import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Inter } from 'next/font/google';
import './globals.css';

/**
 * Deux polices, deux rôles : une grasse très lourde pour les accroches, une
 * neutre pour l'interface et les sous-titres discrets. Elles sont aussi tracées
 * dans le canvas, d'où l'exposition de leurs variables CSS.
 */
const display = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-src',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body-src',
  display: 'swap',
});

/**
 * Sert à résoudre les adresses relatives des métadonnées (image de partage,
 * URL canonique) en adresses absolues — Open Graph et Twitter n'acceptent que
 * ça. Un nom de domaine définitif n'est pas encore choisi ; ce réglage se
 * corrige d'un seul endroit le jour où il l'est, voir `.env.example`.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://amorce-erwannchevallier-6916s-projects.vercel.app';

const TITRE = 'Amorce — le studio qui rend tes vidéos IA virales';
const DESCRIPTION =
  'Monte tes vidéos IA au format vertical : transitions, bruitages, sous-titres, rendu cinéma et note de montage. Tout se passe dans ton navigateur, aucun fichier n’est envoyé sur un serveur.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITRE,
  description: DESCRIPTION,
  /*
   * Sans ce bloc, un lien Amorce collé sur WhatsApp, X ou Instagram n'affiche
   * aucune vignette — juste une adresse nue. Le public visé est justement
   * celui qui partage ce qu'il vient de monter : c'est le pire endroit où
   * rester silencieux.
   */
  openGraph: {
    title: TITRE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Amorce',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITRE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#08080c',
  width: 'device-width',
  initialScale: 1,
  // L'interface va jusque sous l'encoche et la barre système ; les marges de
  // sécurité sont reprises là où elles comptent, pas imposées à toute la page.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-ink text-mist antialiased">
        {/*
          Le repli sans script pour `.revele` (voir `RevealArea.tsx` et
          `globals.css`) : si JavaScript ne tourne pas, l'observateur qui pose
          `est-visible` ne tourne pas non plus, et ce contenu resterait à son
          opacité de départ pour toujours. Cette règle prime dans ce cas précis
          et rend tout visible d'emblée.
        */}
        <noscript>
          <style>{'.revele{opacity:1 !important;transform:none !important;}'}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
