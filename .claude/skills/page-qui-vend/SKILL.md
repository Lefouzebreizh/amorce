---
name: page-qui-vend
description: Rendre une page de vente capable d'encaisser, en la mesurant plutôt qu'en la regardant — bouton d'achat mort, prix qui arrive après le bouton, premier écran sans action, poids qui tue la page sur une aire d'autoroute, et les quatre procédés que ce dépôt s'interdit. Outillé par `mesurer.mjs`, qui conduit un vrai Chromium sur le terrain de référence et rend six contrôles bloquants et six observations chiffrées. À utiliser dès qu'on touche à une page qui demande de l'argent ou une inscription — `/montage-titan` dans Amorce, `artisan-express/`, `titan-builder/` — et dès qu'une demande dit « rends la page exceptionnelle », « ça ne convertit pas », « personne n'achète », « personne ne clique », « refais ma landing », « ma page de vente », « améliore l'offre », « le bouton sert à rien », « ça fait pas sérieux », « pourquoi ils partent ». À utiliser aussi **avant de mettre une page de vente en ligne**, même quand elle paraît finie : les six défauts que ce script trouve passent tous les tests, se voient sur aucune capture, et coûtent des clients déjà convaincus. Ici on mesure si la page **vend** ; pour savoir si elle **s'utilise** — débordement, cibles de 44 px, contrastes, distance en gestes — c'est `epreuve-du-pouce`, et les deux se lancent l'une après l'autre.
---

# Une page peut être irréprochable et ne rien rapporter

C'est le cas qui a fait naître cette compétence. La page `/montage-titan` avait
passé l'épreuve du pouce à cinq largeurs : zéro débordement, zéro cible sous
44 px, zéro texte sous 18 px, zéro erreur JavaScript. Elle avait été regardée
sur capture, corrigée cinq fois à l'œil.

Le premier passage de `mesurer.mjs` a rendu **deux défauts bloquants** :

- Les six boutons d'achat pointaient sur `#`. Quelqu'un décidait d'acheter,
  appuyait, et il ne se passait rien. C'est le seul défaut d'une page de vente
  qui coûte de l'argent **comptant**, sur un client déjà convaincu.
- Le premier écran ne portait aucune action. Le bouton tombait à **886 px** sur
  un écran de 873 — treize pixels sous le pli, donc jamais vu par qui n'a pas
  encore décidé de faire défiler.

Aucun des deux ne se voit à l'œil : on a écrit la page, on connaît le prix, on
sait où est le bouton. Le visiteur, lui, arrive sur 393 px avec deux barres de
réseau et six secondes d'attention.

## La commande

```bash
npm run build && npx next start -p 3120 &     # la version compilée, voir plus bas
node .claude/skills/page-qui-vend/scripts/mesurer.mjs --url http://127.0.0.1:3120/montage-titan
```

Elle rend 0 si la page peut encaisser, 1 sinon. Le motif qui reconnaît un bouton
d'achat se change avec `--achat "Commander|Réserver|Je m'inscris"` quand la page
appelle l'action autrement.

**Mesurer contre `next start`, jamais contre `next dev`.** En développement,
Next compile la route au premier appel : le même chargement passe de **6 592 ms
à 152 ms** une fois construit. Prendre le chiffre du mode développement pour un
temps de chargement, c'est partir optimiser une lenteur qui n'existe pas.

## Les six bloquants, et ce qu'ils cassent

| Contrôle | Ce qui se passe quand il tombe |
| --- | --- |
| Un bouton d'achat existe | La page informe, elle ne demande rien. |
| Chaque bouton mène quelque part | Le client convaincu appuie dans le vide. |
| Le prix est dit avant le bouton | On demande un clic avant d'avoir dit le montant : c'est là qu'on part. |
| Le premier écran porte promesse, prix, preuve et bouton | Il faut décider de faire défiler avant d'avoir une raison de le faire. |
| Un bouton est toujours à moins d'un écran | Quelqu'un décide d'acheter au milieu de la page et ne trouve pas où. |
| Aucun procédé qui manipule | Voir plus bas — c'est la seule règle qui coûte plus cher que de l'argent. |

**Le bouton mort a sa parade écrite dans le dépôt**, et elle vaut pour toutes
les pages de vente : *ce qui n'est pas réglé disparaît au lieu d'afficher une
valeur inventée*. Un lien Stripe absent ne donne pas un `href="#"` ; il donne
soit un repli qui marche vraiment, soit rien. Sur `/montage-titan`, le repli est
WhatsApp avec un message prérempli — une commande s'y prend pour de vrai. Mesuré :
**un seul numéro renseigné fait passer la page de deux bloquants à six contrôles
verts**, sans que Stripe existe.

**La distance à moins d'un écran est presque toujours réglée par un bandeau
collant en bas.** C'est à cela qu'il sert, et c'est pour cela qu'il vit dans la
zone du pouce. Le script le détecte et rend une distance nulle.

## Les quatre procédés interdits

Ils sont dans le script parce qu'ils sont dans la charte, et ils y sont pour une
raison qui n'est pas morale mais commerciale : le public de ce dépôt est
exactement celui que ces procédés blessent le plus. Une seule fois suffit à
perdre la confiance qui porte tout le reste.

- **Urgence fabriquée** — « offre valable jusqu'à », « dernières heures ».
- **Rareté inventée** — « plus que 3 places », quand rien ne les compte.
- **Culpabilisation** — « tu vas le regretter », « tu passes à côté ».
- **Faux témoignage** — le plus grave, et le seul qui ne se voie jamais.

Sur le dernier, la parade est structurelle plutôt que déclarative : les
témoignages vivent dans un tableau typé où **la source est obligatoire**, et un
test unitaire refuse toute entrée qui n'en porte pas. Une page qui n'a pas
encore de client affiche des emplacements vides assumés, pas trois avis
inventés. C'est aussi ce qui empêche qu'un avis soit ajouté six mois plus tard,
un soir de fatigue, sans qu'on sache d'où il sort.

## Les six observations, et comment les lire

Elles ne bloquent pas — elles se tranchent. Ce sont des ordres de grandeur
relevés sur des pages qui marchent, pas des lois.

- **Poids et chargement.** Sous 200 Ko et sous 500 ms, on ne se pose plus la
  question. Au-delà d'un mégaoctet, la page se juge sur une aire d'autoroute à
  deux barres, pas sur une fibre.
- **Densité de chiffres.** Le rapport entre valeurs concrètes (€, %, h, kg) et
  nombre de mots. Un chiffre ferme un débat qu'un adjectif relance : « 21,5 s,
  monté en cabine » tient mieux que « rapide et soigné ». Autour de 12 ‰ la page
  est adulte ; à 2 ‰ elle promet sans rien étayer.
- **Longueur du titre.** Au-delà de douze ou treize mots, il ne se lit plus d'un
  coup d'œil — et le titre est la seule phrase que tout le monde lit.
- **Actions distinctes proposées.** Trois ou quatre. Une page qui propose sept
  choses différentes n'en propose aucune.
- **Lignes de plus de 75 caractères.** Un paragraphe en pleine largeur d'écran
  de bureau se saute ; c'est le défaut qui n'apparaît jamais sur téléphone et
  toujours sur ordinateur.
- **Longueur de page en écrans.** Dix écrans se défendent si chacun porte une
  idée et une seule. Dix écrans qui répètent la même chose, non.

## Ce que le script ne mesurera jamais

L'ordre des blocs, le rythme, et si la voix sonne juste. Ça se décide, et la
charte éditoriale s'en charge — mais deux repères tiennent bien :

**Un écran, une idée, une raison d'avancer.** Le visiteur descend tant qu'il
obtient une réponse à la question du moment. Promesse → preuve → prix →
comment ça se passe → qui parle → dernière marche. Un bloc qui ne répond à
aucune question en attente est un bloc où l'on part.

**Montrer plutôt que dire.** Un avant/après qu'on bascule du doigt vaut dix
lignes d'adjectifs. Sur téléphone, éviter le côte à côte : deux formats
verticaux à 393 px font 180 px chacun, et on n'y voit plus la différence qu'on
est venu montrer. Une bascule au même endroit de l'écran, oui.

## Le voisinage

`epreuve-du-pouce` mesure si l'interface **s'utilise**, cette compétence si la
page **vend**. Les deux sont nécessaires et aucune ne remplace l'autre : la page
qui a fait naître celle-ci passait la première sans une faute.

L'ordre qui coûte le moins cher : `mesurer.mjs` d'abord — il dit si la page peut
encaisser, et c'est inutile de peaufiner une page qui ne le peut pas — puis
`eprouver.mjs`, puis les captures à regarder.
