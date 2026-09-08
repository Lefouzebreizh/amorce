# Le compte Vercel n'est plus gratuit, et le plafond de cent est parti avec

08/09/2026 — mesuré en refaisant le relevé des projets, un jour après le
précédent, parce que `CLAUDE.md §10` dit qu'un décompte de projets Vercel se
périme en une journée. Le décompte, lui, n'avait pas bougé. Le **plan**, si.

## Ce qui est mesuré

```
list_teams → { "slug": "erwannchevallier-6916s-projects", "plan": "pro" }
```

Un seul champ, et il rend faux tout un raisonnement qui tenait depuis huit
jours. `CLAUDE.md §10` compte les fusions quotidiennes à partir d'une phrase
unique — « le palier **gratuit** plafonne à cent déploiements par jour » — puis
divise par le nombre de projets liés : une vingtaine à deux projets, une
quinzaine à trois, une dizaine à cinq. Toute la chaîne part de ce cent-là.

## Ce qui n'est pas mesuré, et qu'il ne faut pas déduire

- **Le plafond réel du plan Pro.** Il n'a pas été sondé, et rien ici ne le
  donne. Ce qui est établi est que le nombre qui servait de base au calcul
  n'est plus celui du compte, pas qu'il n'y a plus de plafond.
- **La date du changement.** Elle n'est pas lisible d'ici. Le seul repère est
  l'erreur du 01/09, qui nomme le palier en toutes lettres —
  `code: api-deployments-free-per-day` — donc le compte était gratuit ce
  jour-là. Entre le 01/09 et aujourd'hui, on ne sait pas.
- **Que le sujet soit clos.** Un plan payant se facture ; le §5 du dépôt classe
  la dépense en zone de confirmation. Ce qui disparaît est un blocage
  technique, pas un coût.

## La forme du défaut, qui est ce qui se transporte

Le relevé des projets était **refait** consciencieusement, à la bonne cadence,
par la bonne commande, et il regardait la mauvaise colonne. Neuf projets,
cinq liés : exactement ce qu'attendait la question posée. Le champ qui avait
bougé n'était pas dans le tableau qu'on venait vérifier — il était dans l'appel
d'à côté, celui qu'on fait pour obtenir l'identifiant d'équipe et dont on jette
la réponse.

C'est le même défaut que le violet d'Annuaria (`CLAUDE.md §2 bis`) et que la
palette d'Artisan Express : **une mesure juste sur le mauvais objet laisse un
défaut intact et donne l'impression du contraire.** Ici l'objet juste n'était
pas plus loin, il était sur le chemin.

D'où le geste, qui coûte zéro appel de plus : quand une valeur sert de base à
un calcul écrit dans le dépôt — un plafond, un tarif, un quota —, elle se
relit avec ce qu'elle mesure, pas seulement ce qu'on en dérive. Le nombre de
projets se périme en un jour ; **le plan aussi**, et personne ne le regardait.

## Et un projet lié à un autre dépôt partage quand même le compteur

`ensemble-mdph` (créé le 07/09) est lié au dépôt `ensemble-mdph`, pas à
`amorce` : aucun commit d'ici ne le déclenche. Il consomme pourtant le même
quota, qui est celui du **compte**, jamais celui d'un dépôt. Un décompte tenu
« par dépôt » sous-estime donc toujours la consommation réelle, et l'écart
grandit à chaque projet posé ailleurs.
