import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Racine du projet, déclarée explicitement.
   *
   * Le dépôt héberge plusieurs projets, et donc plusieurs `package-lock.json`.
   * La détection automatique remonte alors au dossier parent et choisit celui
   * de la racine : le socle serait surveillé et tracé depuis un arbre qui n'est
   * pas le sien.
   */
  turbopack: { root: __dirname },

  /*
   * En-têtes de sécurité, posés ici plutôt que laissés à la configuration de
   * l'hébergeur — elle varie d'un client à l'autre, et ce qui n'est pas dans le
   * dépôt s'oublie à la mise en ligne suivante : le navigateur ne doit pas
   * deviner le type d'un fichier téléversé, le référent complet ne doit pas
   * fuiter vers les domaines tiers, et l'espace privé ne doit pas pouvoir être
   * chargé dans le cadre d'un autre site.
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
