# La démonstration à montrer

« Montre-moi un exemple » est la première question de tout prospect, et sans
réponse la conversation s'arrête là.

```bash
npm run generer demo
```

Le dossier devient un site complet. On le dépose sur `app.netlify.com/drop` —
sans compte, sans quota — et on a un lien à envoyer.

## Pourquoi une entreprise inventée, et pas un vrai client

Tant qu'il n'y a pas de premier client, il n'y a rien de réel à montrer, et
**fabriquer un faux témoignage est interdit ici** : le dépôt s'y refuse, et un
artisan qui découvre que l'avis est inventé ne rappelle pas.

Une démonstration assumée comme telle ne trompe personne. Le numéro est un
02 97 00 00 00 — un numéro de réservation qui ne sonne nulle part — précisément
pour qu'elle ne puisse pas se faire passer pour une vraie entreprise.

**Le jour où le premier client est livré, on montre le sien.** Une vraie page
avec un vrai nom vaut dix démonstrations, et c'est le seul argument qu'un
concurrent ne peut pas recopier.

## Ce qu'elle montre, et qu'un discours ne montre pas

- que ça se lit sur un téléphone, au soleil, d'une main ;
- que le bouton d'appel fait sonner, tout de suite ;
- qu'il n'y a ni bandeau de cookies, ni pop-up, ni compte à créer ;
- que la page charge en une seconde sur un chantier en 4G.

## Pas de photos, mais des cadres

Le dépôt ne versionne aucun binaire : la démonstration sort donc sans photo de
chantier. Mais un artisan décide **sur des photos**, et une galerie absente ne
lui montre pas où les siennes viendront — c'est pourtant ce qu'il achète.

`--demonstration` dessine donc trois cadres à sa place, en SVG embarqué dans la
page. Des cadres, pas des photos : **rien n'est fabriqué qui puisse passer pour
un vrai chantier**, parce qu'une image de synthèse présentée comme une
réalisation serait exactement le faux témoignage que ce dépôt s'interdit. Ils
portent leur couleur d'accent et disent « Votre photo 1 ».

Embarqués plutôt que déposés à côté : la page reste **un seul fichier**, qui
s'ouvre depuis le disque comme depuis un hébergement.

Pour une démonstration avec de vraies images, déposer deux photos dans ce
dossier avant de lancer `generer` — elles remplacent les cadres et ne sont pas
commitées.
