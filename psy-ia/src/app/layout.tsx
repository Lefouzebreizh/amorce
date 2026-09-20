import type { Metadata } from 'next';
import './globals.css';

const TITRE = 'Respire — Espace d’écoute et d’apaisement par IA';
const DESCRIPTION =
  'Un espace d’écoute bienveillante et confidentielle disponible 24h/24 pour poser vos émotions, relâcher la pression et clarifier vos pensées.';

export const metadata: Metadata = {
  metadataBase: new URL('https://psy-ia-ecru.vercel.app'),
  title: {
    default: TITRE,
    template: '%s | Respire'
  },
  description: DESCRIPTION,
  applicationName: 'Respire',
  authors: [{ name: 'Respire IA' }],
  keywords: ['santé mentale', 'écoute active', 'bien-être', 'gestion du stress', 'IA bienveillante'],
  openGraph: {
    title: TITRE,
    description: DESCRIPTION,
    url: 'https://psy-ia-ecru.vercel.app',
    siteName: 'Respire',
    locale: 'fr_FR',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: TITRE,
    description: DESCRIPTION
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark h-full antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="h-full bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/20 selection:text-teal-300">
        <div className="flex min-h-full flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
