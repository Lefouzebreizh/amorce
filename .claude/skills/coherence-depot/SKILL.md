---
name: coherence-depot
description: "Vérifier que ce que le dépôt affirme de lui-même est encore vrai, en comptant des deux côtés plutôt qu'en relisant — projets réels contre projets cités dans `CLAUDE.md`, tableau « Terrain existant » d'`INDEX.md` contre les dossiers du disque, compétences sur disque contre leur propre table, agents, chemins morts, listes qui annoncent « trois » et portent quatre puces, projets installables oubliés du hook, suites de tests que le démarrage n'annonce à personne, projets qui savent se tester mais qu'aucun workflow ne surveille — leurs tests ne tournant jamais pendant que la CI reste verte, symptômes que deux compétences se disputent sans que l'une renvoie à l'autre. Outillé par `verifier-coherence.py`, en bibliothèque standard pure. À utiliser juste après avoir ajouté un projet, une compétence ou un agent — c'est le geste qui rend la documentation fausse — avant d'ouvrir une pull request qui touche à `CLAUDE.md`, à `INDEX.md`, au hook ou aux compétences, et dès qu'une demande dit « relis CLAUDE.md », « vérifie la doc », « c'est à jour ? », « la liste est bonne ? », « fais le ménage dans la doc ». À utiliser aussi avant d'écrire un compte rendu qui s'appuie sur ce que le dépôt raconte de lui-même : c'est là qu'on répète une phrase périmée avec assurance. Ici on compare le dépôt à **ce qu'il dit de lui-même** ; pour l'inventaire lui-même — « combien de projets », « où on en est » — c'est `etat-du-depot` qui mesure."
---

# La mémoire du dépôt vieillit en silence

`CLAUDE.md`, les compétences et le hook de démarrage sont ce qu'une session
neuve lit avant d'écrire une ligne. Ils ont un défaut unique, et il est grave :
**aucun test n'échoue sur une phrase.** Un projet ajouté par une session pendant
qu'une autre travaillait, et la liste des projets est fausse — pour tout le
monde, jusqu'à ce que quelqu'un relise quatre cents lignes.

Relevé sur une seule journée : « trois projets » quand il y en avait six, une
section annonçant deux règles et en listant trois, une ligne d'outillage qui
cachait cinq installations du hook, quatre compétences absentes de leur propre
table. Aucune n'était trouvable autrement qu'en relisant tout, et personne ne
relit tout.

```bash
python3 .claude/skills/coherence-depot/scripts/verifier-coherence.py
python3 … --strict       # échouer aussi sur les « à regarder »
```

## Ce qu'il compare

| Des deux côtés | Ce que ça attrape |
| --- | --- |
| Projets à la racine ↔ projets cités | Un chantier qu'une session neuve ne saura pas qu'il existe |
| Le nombre écrit en toutes lettres ↔ le compte réel | « dix projets » quand il y en a douze |
| `.claude/skills/*` ↔ la table de `CLAUDE.md` | Une compétence qui existe sans que personne ne le sache |
| `.claude/agents/*` ↔ les mentions | Le même défaut, sur les agents |
| Chemins entre accents graves ↔ le disque | Un dossier déplacé et cité au présent |
| Le tableau Terrain d'`INDEX.md` ↔ les dossiers | Un chantier livré que le tableau de bord ignore, un décompte resté en arrière, un dossier absorbé et cité au présent |
| « Trois règles : » ↔ le nombre de puces | Une section qui se contredit en dix lignes |
| Projets installables ↔ le hook | Une session distante qui réinstalle à la main |
| Dossiers de tests ↔ la portée du workflow | Des tests sortis du filet sans ligne rouge |
| Suites de tests ↔ la liste affichée au démarrage | Une suite qu'on ignore, donc qu'on ne lance pas |
| Projets qui savent se tester ↔ `verifier.sh` | Une suite écrite que la barrière locale ne lance jamais |
| Projets qui savent se tester ↔ les workflows | La même chose côté CI, qui reste verte en le disant |
| Projets TypeScript ↔ l'`exclude` de la racine | Le typage de la racine qui rougit sur le code d'un voisin |
| Symptômes cités ↔ les autres descriptions | Deux compétences qui se disputent le même déclencheur |

## Deux gravités, et c'est le cœur de l'outil

**faux** — démontrable : le chemin n'existe pas, le compte ne tombe pas.
**à regarder** — une piste qui demande un humain : un projet sans ligne dans le
hook n'a peut-être rien à installer, le script ne peut pas le savoir.

Seul le premier fait échouer. La distinction n'est pas de la politesse : un
outil qui crie faux est un outil qu'on cesse de lire, et le jour où il a raison
plus personne ne le croit. Si tu ajoutes un contrôle, place-le du bon côté —
dans le doute, « à regarder ».

### Le cas du déclencheur disputé

Une compétence se déclenche sur sa description, et rien ne signale qu'une autre
revendique le même symptôme : les deux paraissent saines, la mauvaise se charge
une fois sur deux, et personne ne relie jamais la lenteur à sa cause. Le contrôle
compte donc les citations entre guillemets — « command not found », « ça sonne
amateur » — et relève celles que deux fiches réclament.

Un chevauchement n'est pas toujours une faute : deux compétences voisines peuvent
légitimement répondre au même mot. Ce qui distingue le partage assumé de la
collision oubliée, c'est **le renvoi** — si l'une nomme l'autre dans sa
description, la frontière est tracée et la paire sort du relevé. D'où la
correction attendue : ne pas supprimer le symptôme des deux côtés, mais décider
laquelle gagne et l'écrire dans celle qui cède.

## Corriger, et non signaler

Un « faux » se répare en une ligne. Le laisser revient à décider que la mémoire
du dépôt peut mentir, et la prochaine session paiera la facture sans savoir
pourquoi.

Deux réserves, tirées du terrain :

- **`CLAUDE.md`, le hook et `/verifier` sont des aimants à conflits** : presque
  toutes les branches y ajoutent quelque chose. Corriger quand même, et
  s'attendre à fusionner — la résolution y est **additive**, jamais un
  arbitrage. Voir `/fusionner-main`.
- **Ne pas faire taire le contrôle** en supprimant ce qu'il juge faux.
  « Trois règles » suivi de quatre puces se corrige en écrivant « quatre », pas
  en retirant la quatrième.

## Ce qu'il ne voit pas, et qui n'est pas son travail

Il ne juge que ce qui se compte. Une phrase qui décrit un mécanisme disparu,
alors que les noms qu'elle cite existent toujours, passe au travers — c'est la
relecture humaine qui l'attrape, et c'est pour ça qu'elle garde sa place.

Il ne regarde pas non plus les autres sessions : savoir qui travaille sur quoi
et si une branche voisine touche les mêmes fichiers, c'est
`.claude/skills/steward/scripts/preflight.py`, à lancer avant de pousser. Les
deux se complètent et ne se recouvrent pas — l'un regarde le dépôt, l'autre les
gens qui l'écrivent en même temps que toi.
