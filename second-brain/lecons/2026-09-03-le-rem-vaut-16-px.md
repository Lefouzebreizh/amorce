# `rem` vaut 16 px, jamais les 18 px que le corps déclare

**Trois fois le même défaut**, sur la même page, en une journée — et les trois
fois c'est le contrôle visuel qui l'a vu, jamais les tests.

Le gabarit des sites artisan pose `font: 18px/1.6` sur le corps, parce que le
plancher du dépôt est 18 px. Mais `rem` se rapporte à la **racine**, restée à
16 px. Donc :

| écrit | rendu | verdict |
| --- | --- | --- |
| `font-size: .95rem` | **15,2 px** | sous le plancher |
| `font-size: 1rem` | **16 px** | sous le plancher aussi |
| `font-size: 1.125rem` | 18 px | le minimum acceptable |

**`1rem` est le piège dans le piège** : il a l'air d'être « la taille normale »,
et il ne l'est pas.

## Les trois occurrences

1. La signature de pied, en `.95rem` : sortie à 15,2 px **et** 3,10:1, parce que
   son encre n'avait été mesurée que sur le fond de page alors que le pied est
   un cran plus clair.
2. `.mention` des avis d'exemple, en `1rem`. La règle dormait depuis son
   écriture — aucune démonstration ne portait d'avis, donc elle ne s'appliquait
   à rien. Elle s'est réveillée le jour où les démos en ont reçu.
3. La même famille dans la page de vente, où l'erreur de départ était l'inverse :
   `--color-danger` à `#b4231d`, mesuré **2,52:1** une fois le thème passé au
   sombre.

## Ce qui garde maintenant

Un test lit **toutes** les tailles de la feuille émise, pas une règle nommée :
les trois occurrences vivaient dans des règles que personne ne relisait.

```js
for (const [regle, valeur, unite] of css.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)) {
  const px = unite === 'rem' ? Number(valeur) * 16 : Number(valeur);
  assert.ok(px >= 18, `« ${regle} » rend ${px} px`);
}
```

**Et il faut lui retirer les commentaires avant de lire.** Le premier jet se
déclenchait sur le commentaire qui *explique* le piège, parce qu'il en cite la
valeur fautive. Une garde qui lit la prose au lieu du code condamne
l'explication et pousse à l'effacer.
