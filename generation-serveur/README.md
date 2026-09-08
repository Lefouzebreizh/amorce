# generation-serveur — la passerelle de génération

Phase 2 de la génération intégrée. Elle vit entre la **détection**
(`src/lib/manques.ts`, dans le studio, qui dit ce qui manque à un montage) et un
plan qui existe pour de bon.

## Pourquoi un troisième service, et pas un module dans le studio

Le moteur de montage d'Amorce **ne connaît pas le réseau** — c'est ce qui rend
sa promesse vérifiable plutôt que déclarée (`CLAUDE.md` §4). Un invariant de
cette forme ne tient que s'il n'y a rien à importer qui le casse : un module de
génération posé dans `src/` serait à un `import` de distance du moteur, et
personne ne verrait passer la ligne qui l'y branche.

D'où un service à côté de `licence-serveur/` et `comptes-serveur/`, sur la même
mesure qu'eux : **zéro dépendance d'exécution**, tout ce qui décide derrière une
interface, et la suite entière éprouvable **sans réseau ni clé**.

## Ce qu'il ne fait pas, et chaque ligne évite un glissement

- **Il ne reçoit aucun média de l'appareil.** L'API de MiniMax accepte une image
  de départ (`first_frame_image`) et elle n'est pas branchée : ce serait le rush
  de quelqu'un qui partirait chez un tiers. Un test relit le corps réel de la
  requête et refuse tout champ qui n'est pas `model`, `prompt`, `duration` ou
  `aspect_ratio` ; un second relit le source et refuse le retour du champ.
  Le jour où une image de départ se justifie, ça se décide — ça ne se glisse pas
  dans un paramètre optionnel.
- **Il ne stocke rien.** Le compteur de dépense est derrière une interface,
  comme `Base` chez ses deux voisins.
- **Il ne connaît pas le solde d'un client.** Le grand livre de
  `comptes-serveur` compte ce que **les clients** détiennent ; le compteur d'ici
  compte ce que **nous** devons au fournisseur. Deux nombres qui se ressemblent
  et qui ne sont pas le même : les confondre ferait payer un plafond par un
  crédit.

## Le plafond est un veto, pas une note

Vingt dollars par mois, tranchés par le propriétaire le 08/09/2026. Le contrôle
passe **avant** tout appel, et il refuse deux fois plutôt qu'une :

1. **prix inconnu** — la prestation n'est pas dans `TARIFS` ;
2. **plafond** — le mois serait dépassé.

Le premier compte plus que le second, et c'est l'ordre qui le dit : *une dépense
dont on ignore le montant ne peut pas être plafonnée*. C'est la forme du
bouclier anti-rugpull de NexusCrypto — le silence n'est pas un quitus.

**Et `TARIFS` est vide aujourd'hui, à dessein.** Les cinq hôtes de MiniMax
rendent `000` depuis une session distante : la grille n'a pas pu être lue à sa
source, et la remplir de mémoire donnerait un plafond qui a l'air de tenir. Tant
qu'elle est vide, **rien ne part**, et le refus dit où aller chercher. Même
décision que les barèmes de `bilan-patrimoine/`, pour la même raison.

## La dépense se compte avant l'appel, jamais après

L'ordre des trois gestes de `lancer` n'est pas négociable : veto, inscription,
appel. Compter après serait plus simple et faux — une réponse perdue entre les
deux laisserait une génération payée que le compteur ignore, et le plafond
dériverait vers le haut à chaque incident. Compter d'abord fait l'erreur dans
l'autre sens, celle qui se voit et qui ne coûte rien.

`inscrire` est **idempotent sur l'identifiant**, comme `crediter` chez
`comptes-serveur` : un appel rejoué ne doit pas fermer le plafond tout seul.

## La surface de MiniMax n'a pas été écrite de mémoire

Elle est relevée dans `minimax-mcp`, le serveur MCP que MiniMax publie sur PyPI
— parce que sa documentation est illisible d'ici et que `/api-tierce-verifiee`
interdit d'écrire contre une API qu'on n'a pas lue. Détail, et ce que le brief
V3 en disait de faux, dans
`second-brain/lecons/2026-09-08-la-surface-de-minimax-se-lit-sans-joindre-minimax.md`.

Trois étapes, pas deux :

| | |
| --- | --- |
| lancer | `POST /v1/video_generation` → `task_id` |
| suivre | `GET /v1/query/video_generation?task_id=…` |
| récupérer | `GET /v1/files/retrieve?file_id=…` → `file.download_url` |

**Seuls `Success` et `Fail` sont finaux.** Tout le reste veut dire « encore en
cours », et aucune énumération fermée des états intermédiaires n'est écrite :
le fournisseur peut en ajouter un demain, et un code qui les liste tomberait sur
celui qu'il ne connaît pas. Un test le vérifie sur un état inventé.

## Ce qui n'existe pas encore

- **Aucune route HTTP.** Le cœur décide ; le `worker.ts` qui l'exposera viendra
  quand une interface aura quelque chose à appeler.
- **Aucune clé.** `MINIMAX_API_KEY` et `MINIMAX_API_HOST` viennent de
  l'environnement, jamais du dépôt.
- **Aucun essai réel.** Rien de ce code n'a joint MiniMax : les cinq hôtes sont
  refusés au tunnel depuis une session distante. Ce qui le fera tourner est la
  machine du propriétaire, ou le runner du dépôt — qui a du vrai réseau, mesuré
  le 04/09 sur le radar de pépites, **et non vérifié sur cet hôte-ci**.

## Se vérifier

```bash
cd generation-serveur && npm run typecheck && npm test
```

Vingt-cinq tests, aucun réseau, aucune clé.
