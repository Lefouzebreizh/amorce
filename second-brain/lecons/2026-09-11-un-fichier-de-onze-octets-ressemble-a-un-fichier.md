# Un fichier de onze octets ressemble à un fichier

**11/09/2026 — mesuré sur le dépôt `amorce`, audit de processus.**

Pour savoir quels projets portaient leur propre `CLAUDE.md`, le premier geste
a été le bon geste :

```bash
find . -name CLAUDE.md -not -path "*/node_modules/*"
```

Huit résultats : la racine, `agence`, `iptv`, `kdp`, `le-coffre`,
`look_and_find`, `psy-ia`, `titan-builder`. Conclusion apparente : sept
projets sur vingt-trois sont documentés, il en manque seize.

**Quatre de ces sept fichiers pèsent onze octets et ne contiennent qu'une
ligne : `@AGENTS.md`.** Une directive d'import, posée par `next dev`, qui ne
porte aucune règle. Le compte réel n'était pas 7 mais **3**, et deux des trois
ne portaient aucune des règles cherchées.

## Ce que ça change

**Un `find` mesure la présence, jamais le contenu.** Le même défaut que le
§8 bis nomme déjà pour les liens d'`annuaire-ia` — « 0 lien mort » et « 0
lien » rendent le même vert — et pour le contraste mesuré contre le jeton
déclaré au lieu du fond réellement peint. La forme est identique à chaque
fois : *une mesure juste sur le mauvais objet laisse un défaut intact et donne
l'impression du contraire.*

La parade coûte une colonne :

```bash
for f in $(find . -name CLAUDE.md -not -path "*/node_modules/*"); do
  printf "%8s  %s\n" "$(wc -c < "$f")" "$f"
done
```

**Et la règle générale, qui vaut hors de ce cas** : quand on compte des
fichiers pour savoir si un travail est fait, compter ce qu'ils **contiennent**
— une taille, un motif cherché, une ligne attendue. Un inventaire par nom de
fichier ne prouve jamais qu'un fichier fait son travail ; il prouve seulement
que quelqu'un l'a créé.
