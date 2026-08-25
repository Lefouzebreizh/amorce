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
