import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * L'indicateur de développement se pose en bas à gauche de la fenêtre. Sur un
   * écran de téléphone, il recouvre le coin du panneau d'étape et intercepte les
   * appuis destinés aux commandes qui s'y trouvent — un réglage devient
   * simplement inatteignable. Comme le studio se travaille précisément sur
   * téléphone, l'indicateur est retiré.
   */
  devIndicators: false,
};

export default nextConfig;
