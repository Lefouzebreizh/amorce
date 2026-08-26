import type { Metadata, Viewport } from 'next';

import { Toaster } from '@/components/ui/toaster';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Socle Agence — espace client',
    template: '%s · Socle Agence',
  },
  description:
    'Espace client sécurisé : suivi des projets, montants estimés et avancement, en accès privé.',
  // Un espace privé n'a rien à faire dans un index de moteur de recherche. Un
  // client qui veut une vitrine indexée redéclare `robots` dans sa page
  // d'accueil : la règle par défaut reste la plus prudente des deux.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Deux couleurs : la barre du navigateur suit le thème du système, comme le
  // reste de l'interface.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#12131a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
