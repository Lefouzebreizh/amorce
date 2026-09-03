# Ce qui reste à finir sur le site d'Amorce — 2 septembre 2026

Reste d'un audit de finition demandé le 2 septembre, dont les trois premières
priorités ont été livrées le jour même. Cette fiche existe parce que la
quatrième ne vivait que dans une conversation, et qu'un fil se ferme.

## Ce qui a été fait, pour ne pas le refaire

| Priorité | Livré |
| --- | --- |
| 1 — les papiers obligatoires | `/mentions-legales`, `/cgv`, pied de page, bloc « ce qui se passe quand tu paies » (#569) |
| 2 — montrer ce qu'on vend | `BandeSure`, la figure dessinée qui montre où le texte survit (#573) |
| 3 — la navigation | retour vers l'accueil depuis les deux coques du studio (#573) |

## Ce qui reste, et c'est du confort

Aucun de ces trois points ne bloque une vente. Ils ont été relevés à l'œil et à
la mesure, et ils sont écrits ici plutôt que corrigés parce que le fil s'est
arrêté avant.

~~**Le mouvement est plat.**~~ **Corrigé, et la phrase ci-dessus est fausse
depuis le 03/09/2026.** Mesuré sur le fichier : la page porte **sept** entrées
`.entree` avec sept décalages posés en ligne, et **dix-sept** révélations au
défilement. `globals.css` documente les deux mécanismes, borne l'animation à
l'opacité et au déplacement vertical — jamais une propriété qui recalcule la
mise en page — et protège `.revele` par `@supports`, si bien qu'un navigateur
sans `animation-timeline` garde le contenu visible au lieu de le cacher en
attendant un mécanisme absent.

La phrase est conservée barrée plutôt que supprimée : une autre session
lisant la fiche y chercherait sinon un défaut déjà réparé, et le réparerait une
seconde fois.

**Aucun état de chargement à l'ouverture du studio.** C'est pourtant le
chargement le plus lourd du site : quelqu'un appuie sur « Ouvrir le studio » et
ne voit rien bouger pendant une seconde ou deux. Un signe d'attente vaut mieux
qu'un écran figé, et c'est le seul des trois qui touche à la confiance.

**Le bandeau collant recouvre la dernière ligne du premier écran** — « Rien à
installer. Ça démarre dans cet onglet. » Huit pixels, vus sur une capture à
393 × 873. Un `pb` un peu plus grand sur l'en-tête suffit.

## Ce qui n'est pas un défaut

**`/montage-titan` n'a aucun lien entrant, et c'est voulu.** C'est un autre
produit — un service de montage à la commande, avec ses formules et son
WhatsApp. La relier depuis la page d'Amorce mélangerait deux offres. Une
prochaine session qui la trouve « orpheline » et la câble ferait une erreur de
produit, pas une correction.

**Le bouton d'achat n'apparaît pas non plus**, tant que
`NEXT_PUBLIC_LIEN_ACHAT` est vide. Même règle que le téléphone absent
d'`artisan-express` : ce qui n'est pas réglé disparaît au lieu d'afficher un
lien mort.

## Le manque légal qui reste, et le réglage qui l'accompagne

Écrits dans les pages plutôt que comblés, et **seul le propriétaire peut les
lever** :

- ~~le **SIRET**, en cours d'attribution~~ — **obtenu**. SIREN **109356972**,
  immatriculation confirmée le 31/08/2026. `src/app/mentions-legales/page.tsx`
  affiche « SIRET 109 356 972 00017 » depuis, vérifié le 03/09 ; il ne reste
  donc qu'un manque légal sur les deux, celui du dessous ;
- le **médiateur de la consommation**, obligatoire pour qui vend à des
  particuliers, à souscrire auprès d'un organisme agréé.

Et un second point, qui n'est pas une page mais un réglage : la **case de
renonciation au droit de rétractation** se pose dans la page de paiement Stripe,
avant l'encaissement. Sans elle, le délai de quatorze jours court malgré la
livraison immédiate et le remboursement est de droit (L221-28 13°).
