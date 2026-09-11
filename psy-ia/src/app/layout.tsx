import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Psy IA — accompagnement, pas thérapie',
  description:
    "Un accompagnement conversationnel de bien-être psychologique. Psy IA n'est pas un professionnel de santé et le dit toujours clairement.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0f1115',
};

export default function RacineMiseEnPage({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
