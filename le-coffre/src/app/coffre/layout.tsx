import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Espace privé',
  alternates: {},
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  },
};

export default function MiseEnPageCoffrePrive({ children }: { children: React.ReactNode }) {
  return children;
}
