import type { MetadataRoute } from 'next';

// Manifest PWA — installable sur l'écran d'accueil, sans chrome de
// navigateur visible (`display: standalone`). Couleurs alignées sur
// `globals.css` : fond quasi noir (`--color-paper`), turquoise lagon
// (`--color-accent`) en theme-color, comme demandé le 10/09/2026.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Le Tiroir Secret',
    short_name: 'Tiroir Secret',
    description:
      'Tes papiers administratifs, chiffrés entièrement dans ton navigateur avant d’être envoyés.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0f1115',
    theme_color: '#40e0d0',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
