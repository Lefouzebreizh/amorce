# Une suite qui reste verte sur une mutation ment sur ce qu'elle garde

**04/09/2026.** Onze mutations passées sur six lots du socle client. Neuf sont
tombées du premier coup. **Deux ne sont pas tombées**, et ce sont les seules qui
ont appris quelque chose.

## Ce qui a été mesuré

Les deux tests fautifs venaient d'être écrits, dans le même fichier, par la
même personne, pour garder un défaut qu'elle venait de trouver. Ils étaient
verts. Ils ne gardaient rien.

**Premier : le test regardait la fonction pure, jamais l'appel.**
`assemblerFiches` était testée sous toutes les coutures. Le vrai correctif était
ailleurs — `select('*', { count: 'exact' })` dans `lireVueAdministration`.
Retirer l'option **compile sans erreur** et laisse la suite entière au vert,
parce qu'aucun test ne regardait la requête. Le défaut d'origine — un total faux
au-delà de mille lignes — revenait intact.

**Second : le cas de test ne pouvait pas discriminer.** Le test s'appelait « ne
fabrique pas d'écart négatif » et posait deux écarts négatifs. Leur **somme**
restait sous zéro, donc le code passait le même verdict avec ou sans la borne à
zéro. Le cas qui compte était mixte — un compteur coupé, l'autre en avance — et
c'est celui-là seul qui fait apparaître « -1 compte manque à l'appel ».

## Les deux formes, et comment les reconnaître sans mutation

Elles se ressemblent de loin et se traitent différemment :

| Forme | Signe avant-coureur |
| --- | --- |
| le test vise la fonction pure, le correctif est dans l'appelant | le correctif et le test ne sont pas dans le même fichier |
| le cas ne discrimine pas | le test passe avant même d'écrire le correctif |

Le second signe est le plus utile et le moins cher : **écrire le test avant le
correctif et le voir échouer**. Un test qui naît vert n'a jamais rien prouvé.
C'est du rouge-vert ordinaire, et c'est précisément ce qu'on saute quand on
corrige d'abord parce qu'on a compris le défaut.

## Portée générale

**Une mutation qui ne fait rien tomber est un résultat, pas un échec de la
mutation.** C'est le seul moment où une suite dit la vérité sur son propre
périmètre. Le réflexe qui coûte cher est d'en conclure « la mutation était mal
choisie » et de passer à la suivante ; la lecture juste est « ce chemin n'est
gardé par rien ».

Le protocole tient en trois gestes, et le troisième est celui qu'on saute :

1. écrire le correctif et son test ;
2. remettre le défaut — le vrai, celui d'avant, pas une approximation ;
3. **quand rien ne tombe, chercher le trou et non une autre mutation.**

Corollaire sur le choix des mutations : muter le correctif est facile et
insuffisant. Il faut aussi muter **ce qui l'entoure et qu'on croit couvert** —
l'appel, l'option passée à la bibliothèque, la borne, l'ordre. Les deux trous du
jour étaient exactement là.

Vaut au-delà des tests unitaires : la même question se pose à un contrôle de
sauvegarde qui ne détruit pas, à un banc d'essai sans témoin, à un audit qui
relit sans exécuter. Un garde qu'on n'a jamais vu refuser n'a jamais prouvé
qu'il savait refuser.
