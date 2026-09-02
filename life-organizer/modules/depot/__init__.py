"""Le dépôt — recevoir un fichier déposé, le comprendre, proposer où il va.

Trois fichiers, même découpe que les autres modules :

- `regles.py` — quel dossier correspond à quelle catégorie, et si la lecture
  est assez sûre pour l'appliquer sans relecture. Pur : aucun appel réseau,
  aucune lecture de fichier, testable sans clé d'API.
- `traitement.py` — la préparation du contenu (texte d'un document, image
  telle quelle pour une photo, une image extraite par ffmpeg pour une vidéo),
  l'appel au modèle de vision, et le dépôt réel via `noyau.fichiers.deplacer`.
- `commande.py` — arguments, affichage, code de sortie.

Classe n'importe quel fichier déposé (photo, vidéo, document) en une des
trois catégories `depot.categories`, puis propose un dossier de destination
construit à partir de `depot.projets.<nom>.regles`. Ce module n'existe que
par `interface_web/` — il n'y a pas de source de dépôt en ligne de commande
au-delà de `organizer.py deposer`, pensé pour l'interface web.

**La destination est configurable, jamais codée en dur.** Un projet est une
entrée dans `depot.projets` : une racine (un dossier Google Drive monté, pas
un identifiant d'API) et des règles catégorie → sous-dossier. Brancher un
nouveau projet n'ajoute aucune ligne de code, seulement une entrée de
configuration.

**Aucun classement n'est appliqué à l'aveugle.** Comme les autres commandes,
`deposer` dit ce qu'elle ferait avant de le faire : la proposition
(catégorie, confiance, dossier visé) s'affiche toujours, et `--appliquer` (ou
son équivalent dans l'interface web) est un geste séparé. En dessous du seuil
de confiance, la proposition est la même mais visiblement marquée comme
incertaine — jamais un classement silencieux qui se tromperait.

**La clé d'API n'est jamais dans la configuration**, seulement le nom de la
variable d'environnement qui la porte (`depot.api_vision.cle_variable_env`),
comme `upscale.api`. Sans elle, le module le dit et se désactive proprement
— jamais une classification devinée.

Réglages dans `organizer_config.json`, section « depot ».
"""
