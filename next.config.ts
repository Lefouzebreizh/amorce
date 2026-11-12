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
  // Local Windows preparation on a small machine; hosted builds keep their defaults.
  ...(process.env.PHARE_LOW_MEMORY === 'true' ? { experimental: { cpus: 1 } } : {}),
};

export default nextConfig;
