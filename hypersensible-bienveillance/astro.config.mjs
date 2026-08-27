// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

/**
 * Sortie statique, et non `output: 'server'` avec l'adaptateur Cloudflare.
 *
 * La raison est mécanique, pas esthétique : sur Cloudflare Pages, un
 * `_worker.js` — ce que produit `@astrojs/cloudflare` — prend la main sur tout
 * le routage et **désactive le dossier `functions/`**. Or c'est là que vivent
 * le quota des cinq analyses et le moteur CNV. Les deux ne peuvent pas
 * coexister ; entre un rendu serveur dont on n'a pas besoin (aucune page ne
 * dépend de la requête) et des Pages Functions dont on ne peut pas se passer,
 * le choix est vite fait.
 *
 * Conséquence assumée : la coquille part en HTML pur — premier octet immédiat,
 * pas de rendu à la demande — et les données du radar arrivent ensuite par
 * `/api/radar`. C'est ce que « Single Page ultra-rapide » veut dire ici.
 */
export default defineConfig({
  output: 'static',
  site: 'https://hypersensible-bienveillance.com',
  vite: {
    plugins: [tailwind()],
  },
});
