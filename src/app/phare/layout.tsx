import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Le Phare — Lefouzèbreizh',
  description: 'Le Phare transforme le brouillard en repères clairs pour avancer à ton rythme.',
  robots: { index: false, follow: false },
};

export default function PhareLayout({ children }: { children: ReactNode }) {
  return children;
}
