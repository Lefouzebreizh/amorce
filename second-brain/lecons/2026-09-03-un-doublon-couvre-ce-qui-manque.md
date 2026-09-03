# Un doublon ne dédouble pas seulement : il couvre ce qui manque

**03/09/2026.** Retrait de `le-coffre-hosted`, une des deux productisations du
coffre de `life-organizer/`.

## Ce qui a été mesuré

Le dépôt portait deux dossiers pour le même produit, déclarés comme doublon
« à trancher » depuis la veille. Le propriétaire a tranché : garder le projet
Next.js. Le geste paraissait tenir en trois lignes — supprimer l'autre,
corriger `CLAUDE.md` et `INDEX.md`.

La cartographie avant écriture a rendu autre chose :

| | `le-coffre/` (gardé) | `le-coffre-hosted` (retiré) |
| --- | --- | --- |
| `schema.sql` | **aucun** | 88 lignes, 6 policies |
| tables interrogées par le code | `coffre_cles`, `coffre_index`, bucket `coffre-objets` | table unique `coffres` |

Le **seul fichier SQL du dépôt** vivait donc chez celui qu'on supprimait, et il
décrivait un modèle de données que le survivant **n'utilise pas**. L'entête de
`le-coffre/src/lib/coffre.ts` renvoyait pourtant, en toutes lettres, à une
migration `creer_le_coffre_multi_utilisateurs` — qui n'existait que dans le
projet Supabase, donc nulle part dans Git.

Autrement dit : un clone neuf portait le client, et pas la base qu'il
interroge. Personne ne l'avait vu, parce qu'un `schema.sql` traînait dans le
dépôt — le mauvais, à côté.

## Ce que ça coûte

Deux façons de se tromper, et la seconde est la pire :

- supprimer sans regarder → on emporte le seul SQL et on ne s'en aperçoit pas ;
- **recopier le schéma du supprimé dans le survivant** → on obtient un fichier
  qui a l'air juste, porte le bon nom, et décrit les mauvaises tables. Un
  fichier absent fait chercher ; un fichier faux fait conclure.

C'est la variante documentaire de ce que `CLAUDE.md` §8 répète sur les médias :
*une mesure disait vert et le fichier était faux*. Ici, un fichier existait et
décrivait autre chose.

## La règle

**Avant de retirer un doublon, comparer ce que chacun porte que l'autre n'a
pas** — pas seulement ce qu'ils font tous les deux. Le `grep` du §0 bis
cherche qui dépend du fichier ; celui-ci cherche ce qui n'existe qu'ici.

Et la conséquence générale, qui vaut au-delà de ce cas : **un doublon masque le
trou de celui qu'on garde.** Tant que les deux coexistent, l'un fournit
silencieusement ce qui manque à l'autre, et rien ne le signale — les deux sont
là, quelque chose répond. C'est en retirant l'un qu'on découvre ce que l'autre
n'avait jamais eu.

Ce n'est donc pas une raison de garder les doublons : c'est une raison de
**regarder au moment de trancher**, qui est le seul moment où le trou est
visible.

## Ce qui n'a pas été vérifié

Le schéma reconstruit (`le-coffre/supabase/schema.sql`) l'a été **depuis le
code**, colonne par colonne. Il n'a pas été rejoué contre un projet Supabase :
`execute_sql` et `apply_migration` ne sont pas accordés depuis une session
distante. Écrit dans son entête, pas seulement ici.

## Voisines

- `2026-09-03-une-absence-est-datee-a-la-minute.md` — comment on **fabrique**
  un doublon sans voir l'existant. Celle-ci dit ce qu'on trouve en en
  **retirant** un. Les deux moitiés du même geste.
