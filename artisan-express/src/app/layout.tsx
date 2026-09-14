import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';

/*
 * Deux polices, et aucune ne vient d'un CDN.
 *
 * `next/font` télécharge les fichiers **au build** et les sert depuis notre
 * domaine, avec la balise de préchargement. C'est la leçon d'`annuaire-ia`,
 * écrite dans sa feuille de style : « un CDN injoignable ne dégradait pas le
 * site, il le détruisait » — mesuré, sans le script distant, une loupe de six
 * cents pixels de haut et des boutons de dix-neuf. Sur une page lue au bord
 * d'un chantier, avec une barre de réseau, la dépendance distante est le
 * défaut à ne pas introduire.
 *
 * **Bricolage Grotesque** pour le titrage. Le nom n'est pas un hasard et le
 * dessin non plus : une grotesque large, un peu brute, qui a du caractère sans
 * faire studio de design. Elle parle à qui travaille de ses mains.
 *
 * **Inter** pour la lecture, parce que c'est celle du réseau — `annuaire-ia`
 * la sert déjà. Deux sites du même propriétaire qui se ressemblent, c'est
 * exactement ce qui est demandé.
 *
 * `display: 'swap'` : le texte s'affiche tout de suite dans la police système
 * et bascule quand la nôtre arrive. L'inverse — attendre la police — laisse un
 * écran blanc à quelqu'un de pressé.
 */
const titrage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700', '800'],
  variable: '--font-titrage',
});

const lecture = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lecture',
});
import { adresseDuSite } from '@/lib/config';

export const metadata: Metadata = {
  /* Pas d'adresse réglée, pas de base de métadonnées : Next se contente alors
     d'URL relatives, là où une base inventée ferait pointer chaque partage vers
     un domaine que personne ne sert. */
  metadataBase: adresseDuSite ? new URL(adresseDuSite) : undefined,
  title: 'Site vitrine artisan express — 300 €, livré en 48 h',
  description:
    'Tes réalisations et tes services sur un site clair. Création : 300 €, sans abonnement à Artisan Express. Domaine en supplément. 48 h après réception des éléments.',
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
      'Un site pour présenter ton activité. Création : 300 €, domaine en supplément. Sans abonnement à Artisan Express. 48 h après réception des éléments.',
    ...(adresseDuSite ? { url: adresseDuSite } : {}),
  },
  robots: { index: true, follow: true },
};

/*
 * `themeColor` sur le fond de page : Chrome Android colore sa barre d'adresse
 * avec, et une page qui ne déclare rien se fait appliquer un thème automatique.
 *
 * Il valait `#004aad`, le bleu d'avant la charte. Sur une page désormais
 * sombre, une barre d'adresse bleu vif au-dessus d'un fond `#0f1115` fait une
 * bande de couleur qui n'appartient à rien — le genre de détail qu'on ne voit
 * que sur l'appareil, jamais dans une capture de navigateur de bureau.
 */
export const viewport: Viewport = {
  themeColor: '#0f1115',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${titrage.variable} ${lecture.variable}`}>
      <body>{children}</body>
    </html>
  );
}
