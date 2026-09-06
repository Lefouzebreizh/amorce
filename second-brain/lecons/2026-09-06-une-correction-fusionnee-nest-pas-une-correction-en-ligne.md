# Une correction fusionnée n'est pas une correction en ligne

Mesuré le 06/09/2026 sur `artisan-express`.

## Ce qui s'est passé

Le propriétaire demande de corriger une ligne du site en ligne : le bloc
comparatif prêtait « 49 € par mois » à l'annuaire du voisin comme un fait
universel. La correction est écrite, la PR #748 est ouverte, verte, fusionnée
sur `main`.

**Et la page publique n'a pas bougé.** Trois jours durant, elle servait toujours
la version du 3 septembre — la ligne fautive comprise, pendant qu'on s'apprêtait
à envoyer douze SMS de prospection vers cette adresse-là.

La cause n'est pas une erreur de manipulation : le projet Vercel
`artisan-express` est né d'un **dépôt de fichiers** (`deploy_to_vercel`), sans
lien Git. Aucun commit ne le déclenche, par construction. `CLAUDE.md` le dit
déjà en propres termes — ce qui manquait n'était pas l'information, c'était le
réflexe de la relier à un geste quotidien.

## La règle

**Avant d'annoncer une correction faite, vérifier qu'elle est là où elle doit
agir.** Une correction demandée « sur le site en ligne » n'est pas terminée
quand la PR est fusionnée : elle est terminée quand une requête sur l'adresse
publique rend le texte neuf.

Le contrôle tient en une commande, et il ne se remplace par aucun raisonnement :

```bash
curl -sS https://<adresse>/ | grep -o "<le texte attendu>"
```

C'est le même principe que la phrase déjà écrite dans `CLAUDE.md` à propos des
alias Vercel — **la seule mesure d'une adresse est une requête dessus** — mais
appliqué à l'autre bout de la chaîne : là-bas on doutait qu'une adresse serve
encore, ici on croyait qu'elle servait déjà le neuf.

## Ce qui a été mesuré ce jour-là, et qui ne l'était pas

**Le tableau de bord Vercel est injoignable depuis une session distante, par
n'importe quel client.** Ce n'est pas un problème de navigateur ni
d'identifiants.

| cible | résultat |
| --- | --- |
| `vercel.com` (curl) | **000** — connexion refusée |
| `vercel.com` (Chromium via le mandataire) | `ERR_TUNNEL_CONNECTION_FAILED` |
| `api.vercel.com` | **403** — refusé par le mandataire |
| `artisan-express-ashy.vercel.app` (curl) | **200** |

La dernière ligne est celle qui trompe : **le site déployé répond, son
administration non**. Une session qui vérifie « l'adresse répond » en conclut
qu'elle a la main sur le projet, et elle ne l'a pas.

**Et `create_git_project` ne sait pas rebrancher un projet existant.** Appelé
avec `projectName: artisan-express`, `rootDirectory: artisan-express`, sur un
projet qui existe sans lien Git :

```
Vercel API error 409: {"error":{"code":"conflict",
  "message":"Project \"artisan-express\" already exists."}}
```

Sa propre documentation le dit — *« it does not reconnect an existing unlinked
project with the same name »*. Le connecteur n'expose aucune autre fonction de
modification de projet. **Le rebranchement est donc une action de tableau de
bord, et seul le propriétaire peut la faire.**

## Ce qu'il ne faut pas faire à la place

Créer un projet lié sous un autre nom paraît être le contournement évident. Il
coûte deux choses, mesurées le même jour :

- **L'adresse change.** `artisan-express-ashy.vercel.app` est écrite dans cinq
  documents (`prospects.md`, `PROSPECTION.md`, `README.md`, `RECOMMANDATION.md`,
  `AVANT-LE-PREMIER-EURO.md`) et verrouillée par un test
  (`tests/prospection.test.ts`, `HOTE_VIVANT`). Le suffixe `ashy` est engendré
  au hasard à la création du projet : il ne se récupère pas.
- **Les variables d'environnement restent sur l'ancien projet.** Elles
  appartiennent au projet, pas au déploiement. `NEXT_PUBLIC_TELEPHONE` et
  `NEXT_PUBLIC_WHATSAPP` y sont posées — et le code est écrit pour que **ce qui
  manque disparaisse de l'écran** plutôt que d'afficher une valeur inventée. Un
  projet neuf servirait donc une page de vente **sans bouton d'appel**, sans
  qu'aucun contrôle ne rougisse.

## Ce qui se vérifie avant, et qui a marché

Avant d'annoncer que le rebranchement est sans risque, trois choses se
mesurent, et toutes les trois se font depuis une session :

1. **La construction passe-t-elle depuis Git seul ?** Un arbre de travail propre
   tiré de `origin/main`, `npm ci`, `npm run build`. Un projet servi jusque-là
   par dépôt de fichiers peut dépendre de fichiers présents sur le disque et
   ignorés par Git — ici `public/demo/`, dix-sept pages nominatives. Elles ne
   manquaient pas au build, mais rien ne le garantissait d'avance.
2. **Le filtre de chemins existe-t-il ?** `artisan-express/vercel.json` portait
   déjà son `ignoreCommand`. Sans lui, un projet fraîchement lié consomme le
   quota de tous les autres.
3. **La protection de déploiement est-elle levée ?**
   `get_project_deployment_protection` — et non « j'ouvre le lien », qui
   conclut toujours au vert depuis un navigateur connecté.
