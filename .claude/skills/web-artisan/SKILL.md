---
name: web-artisan
description: Fabriquer le site vitrine d'un artisan — une page, thème sombre, teinte du métier, livré en 48 h pour 300 € — et le vérifier avant de l'envoyer. Couvre la structure de la page unique, la mise en page au pouce, la palette fermée par corps de métier, les emplacements photo en base64, la section avis avec sa mention, le téléphone cliquable et la signature de pied. À utiliser dès qu'un site d'artisan, une démonstration nominative ou une page de prospection est en jeu : « fais-moi une démo pour tel couvreur », « une page pour un plombier », « le site du client X », « quelle couleur pour un électricien », « ajoute ses vraies photos », « il a des avis Google », « la page fait cheap », « le bouton d'appel ne marche pas ». Ne pas attendre le mot « charte » : elle ne se choisit pas, elle se déduit du métier. Cette compétence **fabrique et vérifie** la page ; `page-qui-vend` traite la page de vente d'Artisan Express elle-même, qui est un autre objet.
---

# Le site d'un artisan a un seul but : que son téléphone sonne

Tout ce qui suit en découle. Ce n'est pas une page qui présente une entreprise,
c'est une page qui transforme un visiteur en appel — sur un chantier, au soleil,
sur un téléphone tenu à bout de bras par quelqu'un qui a peut-être agrandi la
police de son système.

**On ne l'écrit pas à la main.** `titan-builder` la génère depuis un dossier de
commande, et c'est ce qui garantit que trois sites livrés dans la semaine se
ressemblent. Écrire une page à part, « juste pour ce client-là », est la
première façon de perdre la charte.

```bash
cd titan-builder
npm run demo-prospect -- --entreprise "GARVAL FRÈRES" --metier carreleur \
  --ville Rennes --telephone "07 85 53 34 13" --en-ligne
```

Ce qui existe réellement comme référence : **Couverture Tanguy**, dans
`titan-builder/demo/` et servi en `artisan-express/public/exemple.html`. C'est la
seule démonstration versionnée. Les autres — Garval Frères, SARL Coconnier, Val
Elec, Barbot, Le Serrurier Rennais, Le Chauffagiste à Vélo, Entreprise
Carpentier, Hochard Élagage, Barbier Anthony — vivent hors dépôt, dans
`artisan-express/public/demo/`, **ignorées par Git parce qu'elles portent le nom
et le numéro d'entreprises tierces.**

## Une seule page, et l'ordre des blocs n'est pas décoratif

L'ordre est celui des questions que se pose le visiteur, pas celui d'un plan
d'agence :

| bloc | ce qu'il répond |
| --- | --- |
| entête + accroche | qui c'est, où, en une seconde |
| **actions** | comment on l'appelle — *avant* tout le reste |
| Qui je suis | est-ce qu'on peut lui faire confiance |
| Ce que je fais | est-ce qu'il fait mon problème |
| Mes réalisations | est-ce qu'il sait faire |
| Ce qu'en disent mes clients | est-ce que d'autres l'ont fait |
| Où j'interviens | est-ce qu'il vient chez moi |
| pied de page | le numéro, une dernière fois |

**Les boutons sont en deuxième position, pas en dernière.** Un client qui a une
fuite ne lit pas la présentation. Un client qui hésite descend, et retrouve le
numéro en pied.

**Un client vitrine ne lit pas six onglets.** La page unique n'est pas une
économie de moyens : un artisan qui a trois pages a trois pages à tenir à jour,
et il n'en tiendra aucune.

## Le pouce d'abord, et ça se mesure

Terrain de référence : **Redmi Note 12 Plus, 393 × 873**. Tout se vérifie là.

```bash
CHROMIUM=$(find /opt/pw-browsers -name headless_shell | head -1) \
  npm run regarder -- demos/garval-freres-2026-09-03
```

Ce contrôle rend un verdict sur le contraste, la taille de texte, les cibles et
la largeur. **Il a trouvé deux défauts que soixante-dix tests verts laissaient
passer** — voir les pièges plus bas. Le lancer avant chaque envoi.

Les valeurs qui ne se négocient pas :

- **18 px de plancher**, et `rem` vaut 16 px — donc `1rem` est déjà trop petit ;
- **56 px** de haut pour les boutons du haut : des mains de chantier, souvent
  gantées ;
- **44 px** pour le numéro en pied — c'est un numéro dans une phrase, pas une
  action principale ;
- `100dvh` et jamais `100vh`, aucun autoplay, `prefers-reduced-motion` respecté.

## La teinte vient du métier, jamais du client

**Le client ne choisit pas un hexadécimal.** Il nomme son métier, et
`titan-builder/src/lib/charte.ts` en déduit la teinte. C'est ce qui fait qu'un
couvreur de Rennes et un plombier de Vannes se reconnaissent comme du même
atelier sans être la même page.

| teinte | accent | métiers |
| --- | --- | --- |
| `vert` | `#67C1A0` | couvreur, charpentier, zingueur |
| `sauge` | `#7BC269` | maçon, terrassier, paysagiste |
| `petrole` | `#69BCD3` | plombier, chauffagiste, carreleur |
| `ardoise` | `#A4B1D6` | électricien, serrurier, plaquiste |
| `lavande` | `#BCA6E3` | peintre, menuisier |

Les surfaces sont communes : `ink #16151a`, `slab #1f1e25`, `panel #26242d`,
`edge #2e2c34`, encres `#f1efea` et `#b7b3a9`. Ce sont les noms du dépôt
(`CLAUDE.md` §2 bis) — pas un vocabulaire propre à ce gabarit, pour qu'une brique
se déplace d'un projet à l'autre.

### Deux mesures ont décidé cette palette, et aucune n'est un goût

**L'orange est interdit.** `#c74e00` rend **4,6:1** sur blanc : il passe le
minimum WCAG et échoue au plancher de 7:1 que le dépôt impose à un accent. Le
retirer corrige un défaut.

**Et la barre se mesure sur `panel`, pas sur `ink`.** La première palette rendait
7,0 à 9,3 — sur le fond de page, donc le plus sombre, donc le meilleur cas. Sur
`panel`, la surface la plus claire, elle tombait entre **5,91 et 6,02**. La règle
dit « sur la surface la plus claire du projet, c'est le pire cas, celui qui
décide » : c'est la moitié de la phrase qui s'était perdue entre la règle et le
test.

**La correction n'a pas été d'éclaircir les cinq.** Deux d'entre elles n'étaient
séparées que par la clarté — `menthe` était littéralement le `vif` du `vert` — et
les remonter ensemble vers le blanc les rendait indiscernables. Les **angles** ont
été réécartés : 108°, 158°, 193°, 224°, 262°, puis chacun monté jusqu'à franchir
la barre. Un test compare désormais les angles deux à deux et refuse moins de
28° d'écart. Sans lui, la garde de contraste se satisfait de cinq nuances
identiques : elle mesure la lisibilité, jamais la distinction.

### Ce qui fait la patte n'est pas la couleur

Un client doit reconnaître un site Artisan Express **avant** d'avoir vu sa
teinte. Ce qui ne varie jamais :

- le **filet vertical de 3 px** sous chaque titre, `border-left: 3px solid var(--accent)` ;
- l'**entête en halo** — `radial-gradient` du voile vers le fond — jamais un aplat
  de couleur. Ça règle aussi la lisibilité à la racine : un titre écrit sur un
  aplat dépend de la teinte, un titre écrit sur le fond n'en dépend plus ;
- les prestations en **liste fléchée** (`content: "→"`), jamais en puces rondes.
  La flèche porte l'accent et rien d'autre ne le porte dans ce bloc : elle
  indique, elle ne décore pas ;
- **un seul bouton plein** par écran, le reste en contour.

## Les photos en base64, et pourquoi

Le site est **un seul fichier HTML**. Pas de dossier d'images, pas de CDN : il
s'ouvre depuis une clé USB pour le montrer au client, se transfère dans une
conversation, se dépose sur n'importe quel hébergement. Une image externe casse
les trois.

Les emplacements sont donc des SVG encodés :

```js
`data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
```

Trois cadres, ~1,4 Ko chacun, pour une page totale de 14 Ko. Les vraies photos
du client les remplacent au même endroit, en JPEG encodé de la même façon —
**recadrées et allégées avant**, parce que la page est lue sur une 4G de
chantier.

### L'emplacement dit qu'il est vide, et c'est un argument

Un appareil photo dessiné au trait, sur un dégradé qui va du voile de la teinte
vers `slab`, dans un **cadre en pointillé**. Le pointillé n'est pas décoratif :
c'est lui qui dit « il manquera quelque chose ici ». Un cadre plein donnerait une
image finie, et l'artisan croirait que c'est ce qu'il reçoit.

**Ne jamais y mettre une photo générée ni une photo de banque.** Sur une page au
nom d'une vraie entreprise, ce serait une fausse réalisation présentée comme la
sienne. La page dit « les photos sont des emplacements, pas des chantiers » — et
c'est ce qui la rend crédible, pas ce qui lui manque.

**Le dessin compte, et il a été raté une fois.** La première version était un
cercle surmonté d'une barre. Elle voulait dire « image », elle disait
« pictogramme de toilettes » — signalé en une seconde. Sur une page qu'on envoie
pour montrer du soin, un dessin qui fait bon marché coûte plus cher que pas de
dessin.

## La section avis, et la seule façon honnête de la remplir

Elle manque rarement à l'œil du visiteur : c'est le bloc que l'artisan cherche,
et son absence donne une page qui a l'air inachevée.

**Le générateur n'invente aucun témoignage.** Un avis fabriqué sur le site d'un
artisan est le seul défaut de cette page qui puisse lui coûter sa réputation.

En démonstration, la sortie est donc la même que pour les photos — des
emplacements **qui disent qu'ils sont vides** :

```html
<section class="bloc">
  <h2>Ce qu’en disent mes clients</h2>
  <p class="mention">Avis d’exemple. Comme le reste de cette page, ils montrent
     la mise en page — ce sont vos vrais avis qui prendront leur place.</p>
  <div class="avis">
    <blockquote>
      <p>Votre premier avis prendra cette place, avec les mots exacts de votre client.</p>
      <cite>Prénom, commune</cite>
    </blockquote>
  </div>
</section>
```

Aucun prénom inventé, aucune phrase de client fabriquée. **Un avis plausible
resterait faux sous une mention, et une mention se rate à la lecture.**

`<p class="mention">` n'apparaît **que** si `--demonstration` est posé : sur un
vrai site elle disparaît, et l'y laisser jetterait un doute sur des avis
authentiques. Le filet à gauche de chaque `blockquote` plutôt qu'un cadre : l'œil
suit la colonne de texte, et deux avis ne se lisent pas comme deux boutons.

## Le téléphone cliquable, et le piège de WhatsApp

```html
<a class="action principale" href="tel:+33785533413">Appeler GARVAL FRÈRES</a>
```

Le format international est obligatoire. `06 12 34 56 78` devient
`+33612345678` — un `06` brut fonctionne en France et casse dès qu'un visiteur
appelle depuis l'étranger ou depuis un compte non français.

**Le piège qui ne se voit pas :** `wa.me` veut le numéro international **sans
le +**. Retirer simplement les non-chiffres d'un numéro français donne
`0621381115`, que WhatsApp lit comme un indicatif `06` inconnu. Le lien s'ouvre,
l'application affiche « numéro invalide », et rien dans le code ne l'annonçait.

```js
`https://wa.me/${lienTelephonique(numero).replace(/\D/g, '')}?text=…`
```

Un test refuse tout lien `wa.me/0`. C'est le genre de bouton mort qui a l'air de
marcher — le pire des trois cas.

**Et le numéro du pied s'appelle.** Il était lisible et pas cliquable : le
visiteur qui vient de faire défiler les photos et de lire « et les communes
autour » — l'instant exact où il décide — devait remonter **2,2 écrans** dans le
pire cas pour retrouver le bouton d'appel.

## Le pied de page et la signature

```html
<footer>GARVAL FRÈRES — Rennes<a href="tel:+33785533413">07 85 53 34 13</a>
<p class="signature">Site réalisé par Artisan Express</p></footer>
```

La signature n'est pas décorative : **c'est elle qui fait qu'un voisin de
chantier demande qui a fait le site.** Elle ne porte volontairement **aucune
adresse** — le dépôt s'interdit d'écrire une adresse qu'il n'a pas vérifiée
servie, et une adresse morte en pied de tous les sites livrés coûterait plus que
l'absence de lien.

**Ni taille réduite, ni encre éteinte.** Le premier jet portait `.95rem` et
`--encre-eteinte` : rendu à **15,2 px et 3,10:1**, sous les deux planchers. La
discrétion se fait par l'espace et le trait — `padding-top` et
`border-top: 1px solid var(--edge)` — jamais en rapetissant.

## Les pièges, chacun payé une fois

### `rem` vaut 16 px — trois fois le même défaut

Le corps déclare 18 px, `rem` se rapporte à la racine restée à 16. Donc `.95rem`
fait 15,2 px et **`1rem` fait 16 px** : les deux passent sous le plancher. Détail
complet dans `second-brain/lecons/2026-09-03-le-rem-vaut-16-px.md`.

Un test lit maintenant **toutes** les tailles de la feuille émise, pas une règle
nommée : les trois occurrences vivaient dans des règles que personne ne relisait.

### Une garde qui cherche un mot condamne le commentaire qui l'explique

Trois fois aussi. Un test refusait `prefers-color-scheme` et faisait tomber le
commentaire qui explique **pourquoi** il n'y a plus de second thème. Un autre
refusait `#c74e00` et condamnait le paragraphe qui explique le retrait de
l'orange. Le troisième se déclenchait sur sa propre explication du piège du rem.

**Une garde porte sur la forme employée, jamais sur la chaîne** : chercher
`@media (prefers-color-scheme`, pas le mot ; `--color-x: #c74e00`, pas
l'hexadécimal ; et retirer les commentaires avant de scanner du CSS.

### Le CSS du gabarit vit dans un littéral gabarit

`site.ts` rend la page par un *template literal*. Donc **aucun accent grave dans
les commentaires du bloc `<style>`** — ils referment la chaîne — et **aucune
échappée octale** : `content: "\2192"` est refusé, la flèche s'écrit `"→"` en
clair. Le fichier est en UTF-8 et le déclare.

### Un drapeau seul ne fait rien

L'analyseur d'arguments de `demo-prospect.mjs` n'enregistrait une clé qu'avec une
valeur derrière. `--en-ligne` posé en fin de ligne ne laissait aucune trace, la
commande réussissait, et la page sortait avec la mention de l'autre canal. Pas
d'erreur, pas d'avertissement — juste une phrase fausse sur une page envoyée à un
artisan. Un drapeau seul vaut `true` depuis.

### La mention change selon le canal

La démo se transmet de deux façons, et **une seule mention mentirait** :

| canal | ce que la page dit |
| --- | --- |
| fichier envoyé | « elle n'est en ligne nulle part et personne d'autre que vous ne l'a reçue » |
| page hébergée (`--en-ligne`) | « à une adresse que je n'ai donnée qu'à vous, aucun moteur ne la référencera, **un mot de vous et je la retire** » |

La dernière promesse n'est pas de la politesse : mettre le nom et le numéro de
quelqu'un en ligne sans le lui avoir demandé oblige à pouvoir le défaire tout de
suite. Et `noindex, nofollow` doit être **présent dans la page** — une promesse
ne s'écrit pas sans son appui.

### Une adresse dans un Markdown n'est lue par personne

`PROSPECTION.md` a envoyé les prospects sur un projet Vercel supprimé pendant des
heures : **404**. Ni le typage, ni ESLint, ni le build ne lisent une adresse dans
un document. C'est la famille de défauts la plus silencieuse du dépôt — elle ne
casse rien, elle coûte juste le client. Un test refuse maintenant toute adresse
`vercel.app` autre que celle qui sert.

### Deux tables qui décrivent la même chose et qu'aucun code ne relie

La charte connaissait quatorze métiers, `demo-prospect.mjs` six. Le défaut s'est
vu le jour où une liste de prospects a désigné les carreleurs comme les premiers
à appeler et où la commande a répondu « --metier au choix : couvreur, macon,
plombier, electricien, menuisier, peintre ». Un test les compare **dans les deux
sens** : un métier sans démo, et une démo hors charte qui sortirait au vert par
défaut.

### Vercel : le mur par défaut, et le dossier oublié

Un projet Vercel neuf naît avec `ssoProtection: all_except_custom_domains` :
l'artisan qui clique tombe sur une page de connexion. **Vu trois fois.** Le
contrôle qui vaut n'est jamais « j'ouvre le lien » — depuis un navigateur
connecté au compte, la page s'affiche toujours. C'est la lecture du réglage
*Deployment Protection* qui tranche.

Et un dépôt de fichiers envoie **ce qu'on lui donne** : oublier `public/` met
« Voir un site fini, en vrai » en 404 pendant que le reste sert parfaitement.
Compter les fichiers avant d'envoyer.

## Les leçons se rangent en un fichier par leçon

`second-brain/lecons.md` est devenu le fichier le plus disputé du dépôt.
Plusieurs sessions écrivent en parallèle, toutes **à la fin du même fichier** —
et Git ne sait pas fusionner deux ajouts à la même ligne. Mesuré : **une seule
nuit de retard a produit trois conflits sur le même fichier**, chacun résolu à la
main.

Le coût n'est pas la résolution, c'est ce qu'elle fait perdre : une session
pressée garde sa version et écrase la leçon de l'autre sans la lire.

**La règle retenue :** une leçon nouvelle s'écrit dans
`second-brain/lecons/AAAA-MM-JJ-sujet.md`. Deux sessions du même jour créent deux
fichiers différents ; il n'y a plus rien à fusionner.

`lecons.md` n'est pas supprimé — il porte des mois de leçons et des renvois le
citent. Il devient l'archive ; le dossier reçoit la suite. Le détail est dans
`second-brain/lecons/LISEZ-MOI.md`.

## Avant d'envoyer, trois gestes

1. **`npm run regarder`** sur la page finale, au 393 × 873. Pas sur la
   précédente : la règle a été payée quatre fois ailleurs dans ce dépôt.
2. **Ouvrir la page et la regarder.** Les deux défauts les plus sérieux de cette
   compétence — la signature à 15,2 px et l'icône qui faisait cheap — sont passés
   à travers soixante-dix tests verts.
3. **Vérifier ce que le serveur rend**, pas ce qu'on a écrit, si la page est
   hébergée. Une feuille de style qui répond 500 donne une page en Times noir sur
   blanc qui ressemble à une décision de design.
