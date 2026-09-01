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

export const metadata: Metadata = {
  title: 'Amorce — le studio qui rend tes vidéos IA virales',
  description:
    'Monte tes vidéos IA au format vertical : transitions, bruitages, sous-titres, rendu cinéma et note de montage. Tout se passe dans ton navigateur, aucun fichier n’est envoyé sur un serveur.',
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
      <body className="min-h-screen bg-ink text-mist antialiased">{children}</body>
    </html>
  );
}
