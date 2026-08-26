# Remonter à la source d'une mauvaise valeur

L'endroit où une erreur éclate est rarement celui où elle naît. Une valeur
fausse traverse plusieurs fonctions avant de provoquer un dégât visible, et
corriger là où ça casse revient à mettre un pansement au bout de la chaîne :
le même défaut ressortira par un autre chemin.

## La question à répéter

Une seule, posée en boucle jusqu'à ce qu'elle n'ait plus de réponse :

> D'où vient cette valeur ?

À chaque étage, ne demande pas « comment réparer ici » mais « qui m'a donné
ça ». On s'arrête quand on atteint l'endroit où la valeur est **fabriquée** —
un calcul, une saisie, un fichier lu — et non simplement transmise.

## Pourquoi c'est particulièrement vrai ici

Le studio est une chaîne longue : un fichier importé devient un média, puis un
clip placé sur une timeline, puis une tranche à l'instant *t*, puis un tracé sur
un canvas, puis une image encodée. Un défaut visible à la dernière étape peut
naître à n'importe laquelle des précédentes.

**Écran noir à la lecture.** Le tracé n'est presque jamais en cause. Remonte :
`renderFrame` a-t-il reçu quelque chose à dessiner ? `sliceAt` renvoie-t-il un
clip à cet instant ? Le clip a-t-il un média ? Le média a-t-il un lien objet
valide ? Un projet restauré depuis IndexedDB dont les liens n'ont pas été
recréés s'affiche normalement et sort noir — sans la moindre erreur.

**Son absent ou trop bas.** Quatre bus se mélangent, et la voix off en abaisse
deux par ses propres nœuds. Remonte du haut-parleur vers la source : le nœud de
gain du bus, la baisse automatique, l'élément média, le fichier. Chercher le
défaut au niveau de la table de mixage alors qu'il est dans la baisse
automatique fait effacer un réglage utilisateur pour rien.

**Position ou corps de police faux.** La composition s'écrit en coordonnées
1080 × 1920, et seule une transformation d'échelle adapte au canvas réel.
Une valeur calculée depuis la taille effective du canvas paraît juste à une
qualité d'aperçu et fausse à toutes les autres — le symptôme n'apparaît donc
qu'en changeant de palier, très loin de la ligne fautive.

## Instrumenter les frontières

Quand la chaîne traverse plusieurs modules, ne devine pas lequel fâche : fais
parler chaque frontière une fois, puis lis.

```js
console.log('[timeline] sliceAt', t, '→', tranche?.clips?.length ?? 0, 'clip(s)')
console.log('[rendu] media', clip.mediaId, 'url', media?.url ?? 'ABSENTE')
console.log('[audio] gain bus', bus.gain.value, 'baisse', duck.gain.value)
```

Une seule exécution suffit à savoir **où** ça rompt. C'est seulement ensuite
qu'on ouvre le module fautif. Retirer ces traces fait partie du correctif :
elles ont servi à l'enquête, pas au produit.

## Où corriger, une fois la source trouvée

Au plus près de l'origine, tant que ça reste le bon endroit. Deux nuances :

- Si la valeur est fabriquée fausse, corrige le calcul. C'est le cas simple.
- Si elle est fabriquée juste et **abîmée en chemin**, corrige l'étape qui
  l'abîme, pas celle qui la produit.

Et si l'origine est une donnée extérieure qu'on ne contrôle pas — un fichier
absent, un format que le navigateur refuse — alors la correction consiste à
traiter ce cas explicitement là où il entre, plutôt qu'à le laisser se propager
en silence jusqu'à produire une image noire.
