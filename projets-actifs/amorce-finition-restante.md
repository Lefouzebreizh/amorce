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

**Rien, en fait — les trois ont été repris à la mesure le 03/09/2026, et aucun
ne survit tel quel.** Deux étaient déjà réparés, le troisième est faux. Le
détail est conservé sous chaque point plutôt que supprimé : c'est ce qui empêche
la prochaine session de rouvrir le chantier.

La leçon de cette fiche n'est donc pas ce qu'elle listait, c'est **ce qu'une
liste de défauts devient en vingt-quatre heures dans un dépôt à plusieurs
sessions**. Trois constats relevés à l'œil le 02/09, aucun encore vrai le
lendemain. Un relevé qui n'est pas daté et remesuré fait refaire du travail
déjà fait — ou pire, casser ce qui a été réparé entre-temps.

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

**L'état de chargement à l'ouverture du studio : le constat est juste, le
chiffre non — et l'écart change la conclusion.** Mesuré le 03/09/2026 dans un
vrai Chromium à 393 × 873, studio déjà compilé : la page d'accueil reste
affichée **220 ms**, puis le studio apparaît entier. Pas « une seconde ou
deux », et surtout **pas un écran vide** : la capture montre la page d'accueil
intacte pendant l'attente, ce que Next.js fait exprès.

Ce que ça change : **un indicateur de chargement pour 220 ms serait un défaut
de plus**, pas une correction — un voile qui apparaît et disparaît plus vite
que l'œil ne le suit. Rien n'est donc à faire ici tant que la mesure n'a pas
été refaite **sur le terrain de référence**, un Redmi Note 12 en production et
sur réseau mobile, où c'est le téléchargement du paquet JavaScript qui
domine — et pas ce conteneur, où tout est chaud et local.

~~**Le bandeau collant recouvre la dernière ligne du premier écran.**~~
**Faux, mesuré le 03/09/2026.** Le même Chromium à 393 × 873 rend : bas de la
ligne « Rien à installer » à **785 px**, haut du bandeau à **800 px**. Il y a
**15 pixels de dégagement**, et la capture le confirme à l'œil — la ligne se
lit en entier.

Les huit pixels relevés le 02/09 l'avaient sans doute été sur un état
différent ; ce qui compte est qu'aucun `pb` n'est à retoucher, et qu'en
retoucher un aurait éloigné le bouton du pouce sans rien réparer.

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
