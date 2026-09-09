# Le studio porte deux violets, et c'est la règle

*09/09/2026 — relevé sur `lefouzebreizh.github.io`, vaut pour tout produit qui
reprend l'identité du studio.*

## Ce qui a été mesuré

La page du studio ne porte qu'un jeton `--violet: #7c3aed`, mais **elle ne s'en
sert jamais comme couleur de texte**. Relevé sur ses petits textes réels :

| Élément | Couleur peinte | Fond | Trait |
| --- | --- | --- | --- |
| « Itération », « En prod », « Prototype » | **`#D4C6FB`** | transparent | `rgba(124,58,237,.5)` |
| « Copilote démarches admin » | `#40e0d0` | `rgba(64,224,208,.12)` | turquoise plein |
| Dégradé du titre | `linear-gradient(100deg, #40e0d0 0%, #40e0d0 35%, #7c3aed 100%)` | | |

`#7c3aed` n'apparaît donc qu'à trois endroits : la **queue** du dégradé de
titre, les **traits** à 50 % d'opacité, et le halo. Jamais une lettre.

Les contrastes disent pourquoi, sur la carte composite `#1b1e28` sous voile :

| | contraste |
| --- | --- |
| `#7C3AED` | **2,92:1** |
| `#D4C6FB` | **7,98:1** |

## La règle qui s'en dégage

**Un violet profond est une couleur de décor, pas une couleur de lecture.** Un
produit qui reprend l'identité du studio a besoin de **deux** jetons, pas d'un :
le profond pour les dégradés, les traits et les halos, un clair dérivé pour tout
ce qui se lit.

Réduire les deux à un seul oblige à choisir entre un violet délavé — la page
cesse de ressembler aux autres — et un texte sous le plancher. C'est exactement
l'arbitrage qui avait été fait sur `annuaire-ia` avec `#C2A2F6` : ni l'un ni
l'autre, 6,17:1 et une teinte qui ne ressemblait au studio sur aucune capture.

## Le piège de méthode

La palette d'un produit voisin **se relève sur la page peinte**, jamais sur ses
jetons déclarés. Lire `--violet: #7c3aed` et en conclure « le studio écrit en
#7c3aed » est faux : la valeur du jeton et son usage sont deux choses, et c'est
l'usage qui fait l'identité visuelle.
