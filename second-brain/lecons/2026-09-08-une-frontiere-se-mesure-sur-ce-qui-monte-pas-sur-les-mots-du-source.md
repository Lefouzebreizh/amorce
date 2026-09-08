# Une frontière se mesure sur ce qui monte, pas sur les mots du source

*08/09/2026 — trouvé en écrivant le test qui garde la promesse d'Amorce dans
`generation-serveur/`, ouverte en PR #815 et pas encore fusionnée. La leçon vaut
pour toute garde de frontière, ici ou ailleurs.*

## Ce qui a été mesuré

La promesse tenue par la passerelle de génération est qu'**aucun média de
l'appareil ne monte chez le fournisseur** : l'API de MiniMax accepte une image
de départ (`first_frame_image`), elle n'est pas branchée, et un test doit
empêcher qu'on la branche par inadvertance.

Premier jet du test : relire le source de `minimax.ts` et refuser qu'il
contienne les mots `image`, `fichier`, `octets`. Il échouait — et il avait
raison de le faire pour la mauvaise raison. **`fichier` apparaît légitimement
dans l'étape qui *reçoit* le résultat** (`GET /v1/files/retrieve`, puis
`file.download_url`). Le mot est du côté de la descente, pas de la montée.

Un test écrit ainsi laisse deux issues, toutes deux fausses : on le fait passer
en renommant une variable — la frontière n'a pas bougé d'un pouce —, ou on le
retire en le croyant trop strict.

## Ce qui l'a remplacé

Le test relit le **corps réel de la requête** construite pour l'appel et
n'accepte que quatre clés : `model`, `prompt`, `duration`, `aspect_ratio`.
Toute clé de plus le fait tomber, quel que soit son nom.

## Ce qu'il faut en retenir ailleurs

Le dépôt a déjà plusieurs gardes de cette famille — `conseiller-patrimoine/`
refuse `requests`, `ccxt`, un accès à `os.environ` hors de sa porte unique ;
`bilan-patrimoine/` relit ses textes pour refuser tout nom de produit
commercial. Ceux-là portent sur ce qu'un module **importe** ou **écrit**, donc
sur des gestes, et ils tiennent.

La règle qui les sépare du mauvais test ci-dessus : **une frontière se mesure
sur ce qui la traverse, jamais sur le vocabulaire de celui qui la garde.** Un
`grep` sur des mots-clés mesure le style d'écriture du fichier ; le corps d'une
requête, la liste d'imports, le contenu d'un fichier écrit mesurent ce qui sort
pour de bon. Le second se contourne en changeant le comportement, le premier en
changeant un nom.
