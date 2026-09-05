# Un rouge d'intégration continue est illisible depuis une session — 04/09/2026

## Ce qui a été mesuré

Le journal d'un job GitHub Actions ne s'obtient pas depuis une session
distante. L'API répond, puis redirige :

```
GET /repos/…/actions/jobs/<id>/logs
  → 302 https://productionresultssa7.blob.core.windows.net/…
  → CONNECT tunnel failed, 403
```

Ce qui reste accessible ne dit presque rien :

| ce qu'on obtient | ce qu'on y lit |
| --- | --- |
| `check-runs` | le nom du contrôle, `failure` |
| `actions/jobs/<id>` | **quelle étape** a échoué |
| `check-runs/<id>/annotations` | « Process completed with exit code 1 » |
| `check_run.output.text` | vide |

Donc : on sait *que* les tests sont tombés, et *dans quelle étape* — jamais
*lequel* ni *pourquoi*.

## La parade

Les **annotations** passent par l'API GitHub, qui répond. Une étape qui répète
sa sortie en `::error::` quand elle échoue se rend donc lisible d'ici :

```yaml
run: |
  set -o pipefail
  if ! npm test 2>&1 | tee /tmp/tests.log; then
    echo "::error title=Tests (Node $(node --version))::$(grep -E '^ *not ok|Error' /tmp/tests.log | head -8 | tr '\n' ' | ' | cut -c1-900)"
    exit 1
  fi
```

Deux détails qui décident de son utilité :

- **`set -o pipefail`**, sans quoi le `tee` renvoie zéro et l'étape passe au
  vert en cachant l'échec.
- **Tout ce qui compte va dans l'annotation, pas dans le journal.** Un
  `node --version` en début d'étape ne sert à rien : il atterrit exactement là
  où on ne peut pas lire. La première rédaction de cette parade faisait cette
  erreur.

## Ce qui n'est pas mesuré, et qu'il ne faut pas conclure

L'échec observé — les tests du coffre rouges sur le runner, verts ici y compris
dans un clone neuf avec `npm ci` — **ne s'est pas reproduit** au lancement
suivant, sur un commit qui ne touchait qu'au workflow. Trois lectures restent
ouvertes, et aucune n'est démontrée : un aléa du runner, un effet du `tee` sur
la sortie du lanceur de tests, ou une cause réelle qui reviendra.

Il ne faut donc pas écrire « c'était un aléa » : ce serait la même faute que
celle qui a coûté la journée d'avant — une conséquence plausible attachée à une
mesure juste, et relue plus tard comme si elle avait été mesurée elle aussi. Ce
qui est acquis est seulement ceci : **la prochaine fois, le rouge se lira.**
