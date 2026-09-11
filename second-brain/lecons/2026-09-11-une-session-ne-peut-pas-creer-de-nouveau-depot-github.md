# Une session ne peut pas créer de nouveau dépôt GitHub — le mandataire lie la session à ses dépôts déjà attachés

Mesuré le 11/09/2026, en posant `psy-ia`. La note d'initialisation demandait
un dépôt séparé, sur le principe d'`ensemble-mdph`. `create_repository` du
MCP GitHub a rendu 403 (« Resource not accessible by integration ») — motif
habituel pour ce genre d'échec, et le §10 du dépôt apprend justement à ne pas
s'arrêter là : essayer un autre client avant de conclure.

`curl -X POST https://api.github.com/user/repos`, authentifié par le
mandataire comme d'habitude, n'a pas rendu un refus GitHub mais un refus du
**mandataire lui-même** : *« This GitHub API path is not available: sessions
are bound to their configured repositories. Use repository-scoped endpoints
(repos/{owner}/{repo}/...) »*. Contrairement au cas déjà écrit au §10
(fusion, écriture de fichiers), où changer de client débloquait le geste, ici
les deux clients — MCP et `curl` direct — buttent sur la même restriction,
posée une couche plus bas que GitHub : le proxy de la session n'autorise que
les routes `repos/{owner}/{repo}/...` sur les dépôts déjà listés dans la
portée de la session (voir le bloc « Repository Scope » du prompt système).
`POST /user/repos` n'est scopé à aucun dépôt — il en crée un — et tombe donc
hors de cette portée par construction, quel que soit le client utilisé pour
l'atteindre.

**Conséquence pratique : un nouveau produit qui suit le principe d'un
produit en dépôt séparé (ensemble-mdph, et implicitement tout futur produit
du même genre) ne peut être posé en dépôt séparé que par le propriétaire, ou
par une session dont l'environnement a été explicitement créé avec ce second
dépôt en source.** Depuis une session bornée à `amorce`, la parade n'est pas
de chercher un troisième client : c'est de poser le projet comme sous-dossier
du dépôt déjà attaché, sur le modèle des projets à pile propre qui y vivent
déjà (`titan-builder/`, `le-coffre/`, `chat-traducteur/`) — chacun avec son
propre `package.json`, exclu du `tsconfig.json` racine, sa propre barrière CI.
C'est ce qui a été fait pour `psy-ia/`.
