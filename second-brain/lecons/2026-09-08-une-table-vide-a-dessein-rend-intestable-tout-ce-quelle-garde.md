# Une table vide à dessein rend intestable tout ce qu'elle garde

*08/09/2026 — trouvé en écrivant `generation-serveur/`, la passerelle de
génération d'Amorce, ouverte en PR #815 et qui attend un accord parce qu'elle
touche des zones sensibles. La leçon, elle, vaut pour tout garde-fou adossé à
un barème et ne dépend pas de cette fusion.*

## Ce qui a été mesuré

`generation-serveur/src/tarifs.ts` porte deux refus dans un ordre voulu :
**prix inconnu** d'abord, **plafond dépassé** ensuite. La grille `TARIFS` est
`readonly Tarif[] = []` — vide à dessein, parce que les cinq hôtes de MiniMax
rendent `000` d'ici et qu'un prix écrit de mémoire donnerait un plafond qui a
l'air de tenir.

Conséquence que la suite verte ne disait pas : **avec une grille vide, la
branche « plafond » est inatteignable.** `cout()` rend `null` avant elle, donc
tout appel sort sur `prix-inconnu`, quel que soit le montant déjà dépensé. Le
garde-fou qui protège vingt dollars par mois était couvert par **zéro test**,
dans un fichier qui se lisait comme entièrement testé.

## Pourquoi ce n'est pas « il manquait un test »

Aucun test n'aurait pu l'atteindre. Ce n'était pas un oubli de couverture,
c'était une **impossibilité** posée par la constante elle-même. Ajouter des cas
n'y change rien tant que la grille lue est celle du module.

La parade est de rendre la grille **injectable** — `autorise(prestation,
dejaDepense, grille = TARIFS)` — et ce n'est pas une invention : le service
voisin le fait déjà. `comptes-serveur/src/worker.ts` lit `env.PACKS` et passe
`packs` à `traiter()`, si bien que ses paliers, eux aussi vides
(`PACKS = {}`), n'empêchent pas d'éprouver ce qu'ils gardent. Sept tests
mordent désormais la branche du plafond : au sou près, à l'égalité, sur une
durée nulle, sur un modèle voisin.

## Ce qu'il faut en retenir ailleurs

**Un provisoire ne retarde pas seulement une fonctionnalité : il masque les
tests de tout ce qui vient après lui.** La forme se reconnaît à une constante
vide accompagnée d'un commentaire qui dit « tant que ce n'est pas décidé, on
refuse tout » — c'est aussi celle des barèmes périmés de `bilan-patrimoine/`,
qui taisent leurs montants tant que `VERIFIE_LE` est trop ancien.

Le geste, à chaque fois qu'on écrit un tel provisoire : se demander **quelles
branches deviennent inatteignables derrière lui**, et rendre la table injectable
avant d'écrire le premier test. Une garde d'argent qu'aucun test n'éprouve ne
garde rien, et sa suite verte affirme le contraire.
