# Un correctif fusionné n'atteint pas la prod d'un service jamais déployé

Un `schema.sql` et un `wrangler.toml` commités décrivent une **intention**, pas
un service qui tourne. Avant d'annoncer un geste prod urgent ou bloquant sur un
service Cloudflare Worker, vérifier qu'il est réellement déployé — sinon on
prévient d'une panne qui ne peut pas exister.

## Ce qui a coûté un aller-retour

Le lien de connexion à usage unique de `comptes-serveur` a été fusionné (PR
#757). J'ai dit au propriétaire que la table `liens_consommes` devait être créée
en prod **avant que le worker ne serve du trafic, sinon toute connexion casse**
— en traitant `comptes-serveur` comme un service déployé.

Il ne l'était pas. Sa capture d'écran l'a montré :

- `npx wrangler d1 execute amorce-comptes …` a rendu
  `ERROR Couldn't find a D1 DB with name or binding 'amorce-comptes'`.
- `npx wrangler d1 list` ne connaissait qu'**une** base — `amorce-licence`
  (uuid `ed78b05f-…`) — et pas `amorce-comptes`.
- `comptes-serveur/wrangler.toml` portait toujours
  `database_id = "À REMPLIR — voir README.md"` : le gabarit n'avait jamais été
  rempli.

Donc aucune prod, aucun utilisateur, rien à casser. Le README le disait déjà
noir sur blanc — « ce serveur répond, personne ne l'appelle encore depuis le
navigateur ». Le correctif était juste et attendait simplement le premier
déploiement du service, pas un geste d'urgence.

## Les deux signaux qui tranchent, à une seconde chacun

- **`wrangler d1 list`** : si la base du service n'y est pas, le service n'a
  jamais été provisionné.
- **Le `database_id` de son `wrangler.toml`** : un placeholder
  (`"À REMPLIR …"`) au lieu d'un uuid = jamais déployé. Le voisin
  `licence-serveur/wrangler.toml` porte, lui, un vrai id — la comparaison suffit.

## Et créer la base ne déploie pas le code

Trois gestes distincts, à ne pas confondre (README « Déployer ») :

1. `wrangler d1 create` → crée la base, rend l'`id` à reporter dans le toml ;
2. `wrangler d1 execute … --file schema.sql --remote` → écrit les **tables** ;
3. `wrangler deploy` (+ les `wrangler secret put`) → met en ligne le **code**
   du worker.

Exécuter le schéma ne suffit donc pas à rendre un correctif « actif en prod » :
la logique de `verifier()` n'y arrive qu'au `deploy`.

## À vérifier séparément, non mesuré

Le même `wrangler d1 list` affichait `amorce-licence` avec **0 table**. Si le
serveur de licence est en service et vend, ça mérite un coup d'œil — mais ce
n'est pas confirmé ici, seulement observé sur une capture.
