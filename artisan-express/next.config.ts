import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Racine du projet, déclarée explicitement.
   *
   * Le dépôt héberge plusieurs projets et donc plusieurs `package-lock.json` :
   * sans cette ligne, la détection automatique remonte à la racine et surveille
   * l'arbre d'Amorce à la place de celui-ci.
   */
  turbopack: { root: __dirname },

  /*
   * En-têtes de sécurité posés ici et non dans la console de l'hébergeur : ce
   * qui n'est pas dans le dépôt s'oublie au déploiement suivant.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
