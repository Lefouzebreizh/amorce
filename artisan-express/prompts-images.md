# Les photos de chantier, métier par métier

Trois images par métier, à faire fabriquer ailleurs et à déposer dans le dossier
de commande. **Aucune session ne peut les produire** : la génération d'image est
fermée ici, mesuré sur quatre chemins. Ce fichier existe pour que la demande
soit écrite une fois et se recopie sans réfléchir.

## Ce qui rend ces prompts utilisables, et pourquoi ils finissent tous pareil

**Aucun texte ni logo.** Une image qui porte un mot inventé — un nom
d'entreprise, une plaque, un camion marqué — devient inutilisable : elle
appartient à quelqu'un qui n'existe pas, et le premier client qui la voit sur
*sa* page comprend qu'elle n'est pas de lui.

**Image unique en plein cadre.** Une planche de quatre vignettes ne se recadre
pas : la galerie du gabarit pose une image par cadre, et une mosaïque y entre
illisible.

**Format paysage.** Les cadres de la galerie sont plus larges que hauts. Une
image verticale y arrive rognée en haut et en bas, et c'est le sujet qui part.

**Ce que ces prompts ne remplacent pas.** Les photos du client valent mieux que
n'importe quelle image fabriquée, toujours. Celles-ci servent à la
démonstration et aux premières pages, le temps qu'un artisan envoie les
siennes — `PROSPECTION.md` les demande dès qu'il dit oui.

---

## Plombier

1. Chauffe-eau électrique blanc fixé au mur d'un local technique, réseau de
   tuyaux en cuivre neuf autour, raccords et vannes visibles, lumière naturelle,
   photographie documentaire nette — aucun texte ni logo, image unique en plein
   cadre, format paysage.
2. Salle de bain terminée avec douche à l'italienne, paroi vitrée, meuble double
   vasque en bois clair, carrelage beige, lumière du jour par une fenêtre —
   aucun texte ni logo, image unique en plein cadre, format paysage.
3. Mains d'artisan en train de sertir un raccord sur un tuyau cuivre, pince à
   sertir visible, plan rapproché sur le geste, arrière-plan de chantier flou —
   aucun texte ni logo, image unique en plein cadre, format paysage.

## Couvreur

1. Pignon de longère bretonne en pierre, toiture en ardoise neuve, faîtage en
   zinc, ciel bleu — aucun texte ni logo, image unique en plein cadre, format
   paysage.
2. Fenêtre de toit posée dans une couverture en ardoise, solin en zinc net,
   souche de cheminée en pierre à côté — aucun texte ni logo, image unique en
   plein cadre, format paysage.
3. Gouttière en zinc et sa descente, en bas d'un rampant d'ardoises, fixations
   visibles, mur de pierre derrière — aucun texte ni logo, image unique en plein
   cadre, format paysage.

## Électricien

1. Tableau électrique ouvert, disjoncteurs alignés et repérés, câblage rangé
   peigne par peigne, sur un mur de local propre — aucun texte ni logo, image
   unique en plein cadre, format paysage.
2. Saignée dans un mur avec gaines annelées posées et fixées, chantier de
   rénovation, poussière et lumière de baladeuse — aucun texte ni logo, image
   unique en plein cadre, format paysage.
3. Mains gantées raccordant une prise murale, tournevis d'électricien, boîte
   d'encastrement visible, plan rapproché — aucun texte ni logo, image unique en
   plein cadre, format paysage.

## Maçon

1. Mur en pierre apparente fraîchement rejointoyé, joints à la chaux clairs,
   échafaudage en bord de cadre, lumière rasante — aucun texte ni logo, image
   unique en plein cadre, format paysage.
2. Dalle béton coulée et talochée dans une extension en construction, banches et
   ferraillage encore visibles au bord — aucun texte ni logo, image unique en
   plein cadre, format paysage.
3. Mains d'artisan posant un parpaing au cordeau, truelle et mortier frais, mur
   en cours d'élévation — aucun texte ni logo, image unique en plein cadre,
   format paysage.

---

## Où les déposer

Dans le dossier de commande, à côté de `commande.json`, **nommées par leur
ordre** — `1-…`, `2-…`, `3-…` : le générateur les trie par nom, et c'est ce
tri qui décide de l'ordre dans la galerie.

```bash
node scripts/generer.mjs dossiers/<le-dossier>
```

**Elles ne se versionnent pas.** `.gitignore` écarte déjà `*.jpg` et `*.png` du
dossier de démonstration, et l'invariant du dépôt interdit le binaire versionné.
Les photos vivent dans le dossier de commande, pas dans Git.
