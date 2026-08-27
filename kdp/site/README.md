# Page de lancement

`page.html.gabarit` est la page complète, images exclues. Les assets sont
injectés à la fabrication : quatre planches d'aperçu, les deux vignettes du jeu,
et les sept zones cliquables — toutes dérivées des mêmes coordonnées que
`kdp/pipeline/page17.py`, ce qui garantit que le jeu en ligne et le jeu imprimé
posent exactement les mêmes questions.

```bash
python3 kdp/site/fabriquer.py --planches .travail/normalisees --vers site/
```

## Deux choses à brancher avant de mettre en ligne

Elles sont signalées par un commentaire HTML dans le gabarit :

- **Le lien Amazon** du bouton principal (`data-amazon`), à renseigner une fois
  le livre publié.
- **L'`action` du formulaire d'inscription**, à faire pointer vers votre outil
  d'e-mailing. Tant qu'elle est vide, le formulaire affiche un remerciement en
  local sans rien envoyer : c'est voulu pour la démonstration, ce n'est pas un
  état publiable.

Les trois imprimables sont attendus sous `/imprimables/`, aux noms produits par
`kdp/lancement/imprimables.py`.

## Pourquoi la page est sombre

Le recueil se termine sur *Le murmure des étoiles*, une nuit bretonne. C'est
cette page-là qui donne son identité au site : le crème n'est plus le fond, il
redevient ce qu'il est dans le livre — du papier posé sur la nuit. L'or est
celui des ailes de Zéphy et ne sert qu'à une seule chose, l'action à faire.

## La page de l'hymne — `hymne/`

`hymne/index.html` répond à l'adresse **`roussyetzephy.fr/hymne`**, celle
qu'encode le QR de la page 28 du livre. C'est la seule page du site dont
l'adresse est gravée dans du papier : une fois le tome 1 imprimé, elle ne peut
plus changer. Elle se sert telle quelle, sans fabrication.

**Elle n'attend pas l'enregistrement pour être utile.** Le lecteur audio reste
caché tant que `hymne.mp3` n'est pas à côté du fichier ; la page affiche alors
les paroles et une phrase qui dit que l'enregistrement arrive. Le jour où le
fichier est déposé, le lecteur apparaît de lui-même et la phrase s'efface — rien
à modifier. C'est ce qui permet de faire imprimer le livre avant d'avoir
enregistré quoi que ce soit, sans jamais qu'un enfant tombe sur une page vide.

Les vers sont des blocs à retrait de continuation, pas des lignes séparées par
`<br>`. Centrés, ils se coupaient au milieu d'une proposition — « Zèbre dans
l'âme, le / Phénix prend son envol » — et on ne savait plus où reprendre en
chantant.

### Avant de faire imprimer

1. Mettre la page en ligne à cette adresse exacte, `/hymne`, sans barre oblique
   finale imposée ni redirection vers une autre forme.
2. **Scanner le QR de l'épreuve papier**, pas un rendu à l'écran, avec
   l'appareil photo natif d'un téléphone. L'adresse est encodée sans
   « https:// » : les caméras d'iPhone et d'Android la reconnaissent, quelques
   applications tierces anciennes l'affichent en texte.
3. Vérifier que la page s'ouvre en moins de deux secondes sur un réseau mobile.
   Elle ne charge qu'un fichier de polices ; s'il tarde, le texte reste lisible
   dans la police de secours.
