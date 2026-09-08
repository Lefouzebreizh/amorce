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
    const communs = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];

    return [
      /*
       * Les six modèles de métier, et la seule exception au `DENY`.
       *
       * CE QUE CE DÉFAUT A COÛTÉ, PARCE QU'IL EST INSTRUCTIF.
       *
       * La page de vente montre désormais un aperçu **vivant** de chaque site
       * livré : un cadre qui charge `/modeles/<metier>.html`, plutôt qu'une
       * capture d'écran qui se périme au premier changement de charte. Avec
       * `X-Frame-Options: DENY` sur tout le site, ces cadres étaient
       * silencieusement **vides** — et rien ne le disait. Les six documents se
       * chargeaient, leurs dimensions étaient justes, les tests passaient, le
       * build passait. Ce qui s'affichait était un rectangle blanc avec
       * l'icône de document cassé du navigateur, et seule une capture d'écran
       * regardée à l'œil l'a montré.
       *
       * POURQUOI `SAMEORIGIN` ET PAS UN TROU.
       *
       * `DENY` interdit le cadre à **tout le monde, y compris à soi-même** ;
       * `SAMEORIGIN` n'ouvre qu'à ce même site. Un tiers ne peut toujours pas
       * poser ces pages dans son propre cadre.
       *
       * Et le risque qu'un `X-Frame-Options` traite — le détournement de clic,
       * où l'on superpose une page réelle à un leurre pour faire cliquer
       * ailleurs — n'existe pas ici : ces six pages sont statiques, sans
       * formulaire, sans session, sans une ligne de JavaScript. Il n'y a rien à
       * détourner. Le `DENY` reste sur tout le reste, y compris sur la page de
       * vente elle-même et sur son formulaire de devis, qui sont les seuls
       * endroits où un clic a une conséquence.
       */
      {
        source: '/modeles/:path*',
        headers: [...communs, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      /*
       * Tout le reste, et le chemin des modèles en est **exclu par le motif**.
       *
       * Next.js n'arrête pas au premier bloc qui correspond : il applique tous
       * ceux qui correspondent, dans l'ordre, et le dernier gagne sur une clé
       * déjà posée. Un `/:path*` placé après la règle des modèles reprenait
       * donc `/modeles/macon.html` au passage et lui remettait `DENY` — le
       * cadre restait vide, et les en-têtes rendus disaient `DENY` pour les
       * deux chemins. C'est ce que la vérification a montré ; sans elle on
       * aurait cru la règle posée.
       */
      {
        source: '/((?!modeles/).*)',
        headers: [...communs, { key: 'X-Frame-Options', value: 'DENY' }],
      },
    ];
  },
};

export default nextConfig;
