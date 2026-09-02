"""Le coffre — stockage chiffré de bout en bout.

Un fichier, une fois entré dans le coffre, est illisible sans la phrase
secrète choisie dans le navigateur — y compris pour ce projet, y compris pour
qui a accès au disque, au dossier Google Drive synchronisé, ou au compte
Google lui-même. Le chiffrement (AES-256-GCM) et le déchiffrement se font
entièrement côté client, avec une clé dérivée de la phrase secrète (PBKDF2) :
ni la phrase, ni la clé, ni le contenu en clair d'un document déposé ici ne
sont censés atteindre ce serveur, sauf l'exception ponctuelle et documentée
du classement automatique (voir SECURITY.md, section « ce que l'IA voit »).

Deux fichiers :

- `stockage.py` — ce que le serveur voit et fait réellement : écrire et lire
  des blobs opaques (des octets sous un nom qui ne dit rien du contenu),
  supprimer un blob pour de vrai, copier l'état du coffre vers un dossier de
  sauvegarde séparé. Aucune notion de « fichier », de « catégorie » ou de
  « nom d'origine » ici : ces informations vivent uniquement dans l'index
  chiffré que le navigateur écrit et relit.
- Le chiffrement lui-même (dérivation de clé, AES-GCM, l'index et sa
  structure) n'a pas de code Python : il est entièrement dans
  `interface_web/index.html`, module `LOCoffre`. Un serveur qui ne
  possède jamais la clé n'a rien à faire d'une bibliothèque de chiffrement.

Réglages dans `organizer_config.json`, section « coffre ». Tout est expliqué
en détail, sans jargon, dans `SECURITY.md` à la racine du projet.
"""
