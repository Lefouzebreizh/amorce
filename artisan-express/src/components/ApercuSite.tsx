/*
 * L'aperçu d'un site livré : la vraie page, dans un cadre de téléphone.
 *
 * POURQUOI CE N'EST PAS UNE CAPTURE D'ÉCRAN.
 *
 * Deux raisons, et la seconde vaut plus que la première.
 *
 * 1. L'invariant du dépôt interdit tout binaire versionné. Six captures de
 *    téléphone pèseraient plus lourd que cette page entière, et il faudrait
 *    les refaire à chaque retouche de la charte.
 * 2. Une capture **se périme sans prévenir**. Le jour où `titan-builder`
 *    change la teinte d'un métier ou la place du bouton d'appel, la page de
 *    vente continue de montrer l'ancien site, et personne ne le voit. Un
 *    prospect à qui on a montré une image découvre alors autre chose à la
 *    livraison — c'est exactement le genre de détail qui coûte la confiance
 *    que toute cette page cherche à gagner.
 *
 * Ici, l'aperçu **est** le livrable : `/modeles/<metier>.html`, le fichier que
 * la galerie ouvre en grand quand on clique. Il ne peut pas mentir sur ce qui
 * est livré, puisqu'il est ce qui est livré. C'est la règle du dépôt sur les
 * maquettes falsifiables, appliquée à la lettre.
 *
 * POURQUOI AUCUNE MISE À L'ÉCHELLE.
 *
 * Le premier jet posait la page à 430 px de large et la réduisait par
 * `transform: scale()` pour l'ajuster à la carte. C'est le réflexe habituel,
 * et il est inutile ici : une carte de cette grille fait 340 à 380 px sur un
 * téléphone comme sur un écran large, et le terrain de référence du §2 en fait
 * 393. L'aperçu est donc déjà **à l'échelle d'un vrai téléphone** sans qu'on y
 * touche. Un facteur d'échelle aurait ajouté du texte flou, une hauteur à
 * recalculer à la main, et une promesse fausse : « voilà à quoi ça ressemble »
 * alors qu'on montrerait une réduction.
 *
 * CE QUI REND CE CADRE INERTE, ET POURQUOI ÇA COMPTE.
 *
 * `sandbox=""` sans aucune permission : ni script, ni formulaire, ni
 * navigation, ni fenêtre. Ces pages n'ont de toute façon aucun JavaScript —
 * leur seul `<script>` est le JSON-LD de la fiche d'établissement, et tout le
 * style est en ligne dans le fichier — donc le bac à sable ne leur retire
 * rien à l'affichage et retire tout le reste.
 *
 * `pointer-events-none` sur l'enveloppe : c'est la **carte** qui est le lien,
 * et un cadre qui intercepte le doigt ferait un trou au milieu de la cible.
 * `tabIndex={-1}` et `aria-hidden` pour la même raison au clavier et au
 * lecteur d'écran : ce que l'aperçu montre est déjà écrit à côté, en toutes
 * lettres, et un document imbriqué dans l'ordre de tabulation piège la
 * navigation sans rien apporter.
 *
 * `loading="lazy"` : six documents de vingt kilo-octets ne se chargent pas au
 * premier écran. La galerie est au tiers de la page ; ils arrivent quand on y
 * arrive.
 */

type Props = {
  /** Le fichier servi depuis `public/`, par exemple `/modeles/couvreur.html`. */
  readonly fichier: string;
  /** Ce que l'aperçu montre, pour l'attribut `title` du cadre. */
  readonly titre: string;
  /**
   * La hauteur visible, en classes Tailwind. Le reste de la page est coupé.
   *
   * Le défaut vaut 19 rem parce que c'est ce qu'il faut pour laisser entiers
   * l'entête **et les deux boutons d'appel** du site livré. Il valait 15 rem au
   * premier jet, et le fondu tombait au milieu du bouton « Appeler » — coupé en
   * deux, il se lisait comme un défaut d'affichage, et surtout il escamotait
   * l'argument : ce que la page de vente promet trois écrans plus haut, c'est
   * « ton téléphone en gros, du haut de l'écran jusqu'en bas ».
   */
  readonly hauteur?: string;
  /** La teinte du métier, posée en filet au-dessus du cadre. Décorative. */
  readonly teinte?: string;
  /**
   * `lazy` par défaut. `eager` pour le seul aperçu du premier écran : différer
   * ce qui est déjà visible fait apparaître un trou blanc à l'ouverture.
   */
  readonly chargement?: 'lazy' | 'eager';
  /**
   * Le contour du cadre. Il vaut son propre bord dans une carte de galerie, et
   * rien du tout à l'intérieur d'une coque de téléphone, qui porte déjà le
   * sien — deux bordures concentriques à deux pixels d'écart se lisent comme
   * un défaut d'affichage.
   */
  readonly contour?: string;
};

export function ApercuSite({
  fichier,
  titre,
  hauteur = 'h-[19rem] sm:h-[20rem]',
  teinte,
  chargement = 'lazy',
  contour = 'rounded-xl border border-edge',
}: Props) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none relative overflow-hidden bg-ink ${contour} ${hauteur}`}
    >
      {/*
        Le filet du métier, posé sur le bord haut du cadre. Il reprend la teinte
        que `titan-builder` donne à ce corps de métier — donc celle de la page
        qui s'ouvre juste derrière. Décoratif au sens strict : il ne porte aucun
        texte, et sa mesure de contraste ne s'applique pas.
      */}
      {teinte === undefined ? null : (
        <span
          className="absolute inset-x-0 top-0 z-10 block h-1"
          style={{ backgroundColor: teinte }}
        />
      )}

      <iframe
        className="block h-full w-full border-0"
        loading={chargement}
        sandbox=""
        src={fichier}
        tabIndex={-1}
        title={titre}
      />

      {/*
        Le fondu du bas dit « ça continue » sans mentir sur ce qui est coupé.
        Une coupe nette laisserait croire que la page s'arrête là ; un fondu se
        lit comme un aperçu. Il est en `ink`, la couleur du fond de cette
        page-ci — pas celle du site montré : c'est notre cadre qui s'éteint, pas
        le site qui pâlit.
      */}
      <span
        className="absolute inset-x-0 bottom-0 block h-10"
        style={{ background: 'linear-gradient(to top, var(--color-ink), transparent)' }}
      />
    </div>
  );
}
