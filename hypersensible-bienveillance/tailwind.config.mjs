/**
 * Palette « cyberpunk éthique » : sombre, deux néons, rien d'autre.
 *
 * Tailwind v4 se configure normalement en CSS (`@theme`). On garde malgré tout
 * ce fichier JavaScript, chargé par `@config` depuis `src/styles/global.css` :
 * la palette est la seule chose que l'on retouche vraiment d'un mois sur
 * l'autre, et elle est plus facile à relire ici qu'au milieu d'une feuille de
 * style.
 *
 * Deux accents et pas trois : le cyan désigne ce qui est offert (l'accès
 * groupe, les actions gratuites), le violet ce qui relève de la mesure (le
 * radar, les prix). Dès qu'une troisième couleur apparaît, plus rien ne
 * signifie quoi que ce soit.
 */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        fond: '#0B0F19',
        carte: '#111827',
        bord: '#1F2937',
        texte: '#F3F4F6',
        estompe: '#9CA3AF',
        cyan: '#06B6D4',
        violet: '#8B5CF6',
        alerte: '#F59E0B',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
