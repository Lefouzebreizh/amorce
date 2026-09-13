import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Lefouzebreizh — La Bretagne en inspiration',
  description: 'Découvrez la direction artistique immersive de l’écosystème Lefouzebreizh : Bretagne, singularité, bienveillance et innovation.',
  robots: { index: false, follow: false },
};

export default function UniversLayout({ children }: { children: ReactNode }) {
  return children;
}
