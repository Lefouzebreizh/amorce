# Un voile fait de la teinte abaisse le texte qu'il porte

*09/09/2026 — mesuré sur `annuaire-ia`, vaut pour toute pastille « texte teinté
sur voile léger ».*

## Ce qui a été mesuré

Un badge « texte teinté sur voile léger » pose la **même** teinte deux fois :
en couleur de texte, et en fond à faible opacité. Le fond s'éclaircit donc
dans la direction du texte, et le contraste entre les deux chute à mesure que
le voile s'épaissit.

Sur la carte composite `#1b1e28` (`--color-panneau` à 70 % sur `--color-nuit`) :

| voile | turquoise `#40E0D0` | violet `#C2A2F6` |
| --- | --- | --- |
| 0 % | 10,13:1 | 7,75:1 |
| 4 % | 9,35:1 | **7,25:1** — dernier palier où les deux tiennent 7:1 |
| 12 % (valeur livrée) | 7,83:1 | **6,17:1** |
| 24 % | — | 5,96:1 |

## Les deux conséquences

**Un état « choisi » ne se marque pas en épaississant le voile.** C'était le
réflexe : même teinte, voile plus dense pour dire « sélectionné ». Ça abaisse
le texte de l'élément qu'on veut justement mettre en avant. Il se marque au
**trait** — 2 px de teinte pleine — qui est du non-texte, donc à 3:1, et que
la teinte tient très largement.

**Le fond réel d'un badge n'est pas le jeton du fond.** Une carte à
`bg-panneau/70` n'est pas `--color-panneau` : elle est le composite de
`panneau` sur `nuit`. Mesurer contre le jeton donne un nombre juste sur un
objet qui n'existe pas.

## Ce qui reste ouvert, et pourquoi ce n'est pas corrigé ici

Le violet à 12 % rend **6,17:1** : au-dessus du minimum WCAG (4,5) et sous le
plancher de la maison (7:1, `CLAUDE.md` §2 bis). Le corriger demande soit de
descendre le voile à 4 % — il ne se verrait presque plus —, soit d'éclaircir
`#C2A2F6`, qui est un choix du propriétaire. C'est donc une décision de
produit, pas un correctif technique, et elle est **nommée** plutôt que prise —
même traitement que l'accent de `look_and_find` au §2 bis.
