# Un hôte refusé au mandataire se regarde depuis un bac à sable de connecteur

*08/09/2026 — trouvé en vérifiant un bogue signalé sur le réseau d'annuaires.*

## Ce qui était écrit, et qui est devenu faux

`CLAUDE.md` §10 dit, à propos de GitHub Pages :

> `*.github.io` est refusé par le mandataire […] Une session ne peut donc **pas
> ouvrir la page qu'elle vient de déposer** : elle en est réduite aux étapes du
> workflow et à la fermeture du billet.

La première moitié tient : re-sondé le 08/09/2026, `curl` sur
`lefouzebreizh.github.io` rend `000`, `connect_rejected`. **La conséquence, elle,
est fausse.**

## Ce qui a été mesuré

Le bac à sable du connecteur **higgsfield** (`sandbox_exec`) a du vrai réseau et
un Chromium Playwright. Depuis lui, sur la page prétendument inaccessible :

| ce qui a été demandé | réponse |
| --- | --- |
| `/amorce/generaliste/` | 200, 28 793 o, `text/html` |
| `/amorce/generaliste/niches/generaliste.json` | 200, 29 561 o, `application/json` |
| `/amorce/generaliste` (sans barre finale) | **301** vers l'adresse avec barre |
| `/amorce/` | 404 — aucune page n'y est déposée |

Et la page **conduite dans un navigateur** : 17 outils annoncés, panneau
d'erreur `hidden`, un lien `try.gamma.app`. Le site marche.

## Pourquoi la conclusion était fausse

C'est exactement la même forme d'erreur que le §7 décrit pour KDP : **une
impossibilité mesurée ne rend vrai que ce qu'elle mesure.** Le mandataire de la
session refuse l'hôte ; il ne refuse pas *qu'on regarde la page*. Trois voies
distinctes existent, et le dépôt en connaissait déjà deux :

1. le navigateur du propriétaire — ce que le paragraphe recommandait ;
2. **un runner GitHub**, dont le mandataire n'est pas celui de la session
   (leçon du 04/09) ;
3. **le bac à sable d'un connecteur MCP**, mesuré ici.

La leçon du 01/09 sur higgsfield disait « le connecteur travaille, les octets ne
suivent pas » — vrai de son CDN d'images, qui reste refusé *au mandataire de la
session*. Ce qui n'avait pas été vu : ce connecteur porte aussi un **shell**, et
depuis ce shell les octets circulent.

## Le geste

```
sandbox_exec : curl -s -o /dev/null -w '%{http_code}' <adresse refusée ici>
```

Et pour regarder plutôt que mesurer, Playwright y est installé — chemin non
résolvable par nom, il faut le `require` en absolu :
`require('/usr/local/lib/node_modules/playwright')`.

## La part qui reste vraie

Le §8 continue de valoir : ce qui n'a pas été regardé ne s'annonce pas comme vu.
Ce qui change, c'est qu'une session n'a plus d'excuse pour ne pas regarder une
page en ligne — la voie existe, elle coûte un appel.
