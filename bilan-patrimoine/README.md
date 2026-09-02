# Bilan Patrimoine — le diagnostic, avant le site

Le cœur du produit destiné aux particuliers : **quelqu'un dépose sa situation en
deux minutes, et lit un bilan clair de ce qu'il possède et de ce qui lui coûte.**
Sans jargon, sans tableau de bord à décoder, sans nom de contrat à vendre.

Ce dossier est le **lot 1** : le calcul, les taux de référence et le texte. Pas
encore de site — délibérément. Si le bilan n'est pas bon à lire, une belle
interface ne le sauvera pas ; et il se juge plus vite dans un terminal que dans
un navigateur.

```bash
cd bilan-patrimoine
npm install
npm test        # 55 tests, aucun réseau, aucune horloge
npm run exemple # trois bilans à lire, sur trois situations qui diffèrent
```

---

## 1. Ce qui tourne

```
bilan-patrimoine/
├── src/
│   ├── modeles.ts        ✅ ce qui circule — `null` n'est jamais zéro
│   ├── baremes.ts        ✅ les taux de référence, datés et sourcés
│   ├── valorisation.ts   ✅ valeur nette, réserve de précaution
│   ├── constats.ts       ✅ les onze règles, chacune chiffrée ou muette
│   ├── redaction.ts      ✅ le texte — c'est le produit
│   └── exemple.ts        ✅ trois profils à regarder
└── tests/                ✅ 55 tests
```

Zéro dépendance d'exécution. Le calcul entier tourne en TypeScript nu sous Node,
sans compilation : `node --experimental-strip-types` suffit, comme pour le cœur
d'IPTV. C'est ce qui le rendra transposable tel quel dans le site du lot 2.

---

## 2. Les taux de référence — la pièce neuve

C'est ce qui manquait au conseiller local, et c'est ce qui permet de dire
« votre argent dort » au lieu de « votre argent est à 1,7 % ».

**Huit nombres publics, révisés une à deux fois par an.** Livret A, LDDS, LEP,
PEL, moyenne des fonds euros, inflation, plus les plafonds réglementaires. Ce ne
sont pas des cours de bourse : une table versionnée fait mieux qu'une API.

| Pourquoi une table | Détail |
| --- | --- |
| Ça bouge deux fois par an | Le Livret A est revu au 1ᵉʳ février et au 1ᵉʳ août |
| Aucun hôte financier n'est joignable ici | Mesuré : les neuf hôtes de marché refusent le tunnel |
| Une table se relit en revue | Un taux faux venu d'une API se propage sans que personne le voie |

### ⚠️ Les valeurs livrées sont à confirmer

Elles datent d'**août 2025** et servent à faire tourner le calcul. Deux
révisions ont eu lieu depuis, donc `baremesPerimes()` les signale toutes — et
c'est le comportement voulu : le mécanisme marche, il attend ses vrais nombres.

**Tant qu'un barème est périmé, aucun montant en euros ne s'affiche.** Le constat
sort quand même — le fait qualitatif reste vrai — mais sans son chiffre, et le
rapport dit pourquoi en tête. Un taux de l'an dernier donnerait un manque à
gagner faux avec l'aplomb d'un chiffre juste.

Pour les mettre à jour, dix minutes, deux fois par an :

1. Livret A, LDDS, LEP → Banque de France, taux réglementés ;
2. PEL → arrêté annuel, taux des nouveaux plans ;
3. Fonds euros → France Assureurs, rendement moyen servi ;
4. Inflation → INSEE, glissement annuel.

Puis **mettre `VERIFIE_LE` à la date du jour** — c'est la seule date qui dit
qu'un humain a regardé. Un test échoue si elle date de plus de deux cents jours.

---

## 3. Les décisions qui font le résultat

**Un constat qui ne se chiffre pas ne fait rien bouger.** « Votre livret est mal
rémunéré » se lit, s'approuve et s'oublie ; « ces 15 000 € vous coûtent 285 € par
an » fait ouvrir un LEP le samedi suivant. Chaque règle rend donc un montant
annuel, ou dit franchement pourquoi elle ne peut pas.

**L'urgence passe avant le montant.** Une réserve de précaution trop mince est un
*risque*, et un risque devance une optimisation quel que soit son montant. Ce
n'est pas venu d'une intuition : le tri par euros seul plaçait « droit au LEP,
60 €/an » devant « moins de deux mois de matelas », et le rapport se contredisait
tout seul deux paragraphes plus bas.

**On ouvre sur ce qui va bien.** Un bilan qui commence par les problèmes fait
fermer l'onglet : la personne est venue inquiète et repart inquiète, sans avoir
rien lu.

**Trois recommandations au plus, et un seul geste.** Sept constats vrais valent
moins qu'un seul suivi d'effet. Et le geste proposé est le plus *facile*, pas le
plus cher — un premier pas réussi vaut mieux qu'un chantier reporté.

**Une donnée absente éteint sa règle, elle ne la fait pas conclure à zéro.** Une
assurance vie dont on ignore le rendement ne performe ni bien ni mal : on ne
sait pas, et ne pas savoir se dit. C'est aussi ce qui donne sa valeur au suivi
payant — le bilan gratuit montre ce qu'il ne peut pas voir.

**Aucun produit commercial n'est jamais nommé.** On informe, on chiffre, on
renvoie vers des dispositifs publics. Recommander un contrat par son nom relève
du conseil réglementé (statut CIF, registre ORIAS) ; un test relit tous les
textes produits et échoue s'il y trouve un nom d'assureur ou de courtier.

---

## 4. Ce que le formulaire demande, et pourquoi si peu

**Huit questions, trois écrans, deux minutes.** La règle : aucun champ n'entre
s'il ne change pas une phrase du bilan.

| Écran | Questions |
| --- | --- |
| Vous | tranche d'âge · composition du foyer · revenu mensuel net |
| Ce que vous avez | livrets · assurance vie · bourse · logement (valeur **et** capital restant dû) |
| Pour quoi faire | dans 3 ans · dans 10 ans · pour la retraite · je ne sais pas |

La dernière est la seule qui relève vraiment du conseil, et elle change
réellement le résultat : elle décide si vingt mille euros disponibles sont une
sagesse ou un décalage.

**Ce qu'on ne demande pas :** aucun nom de banque, aucun numéro de contrat,
aucune date d'ouverture, aucun IBAN. Ce qu'on ne collecte pas ne fuite pas — et
rien de tout cela ne change un constat.

**Les taux sont facultatifs.** Personne ne connaît le rendement de son assurance
vie de tête, et l'exiger viderait le formulaire de ses répondants. Leur absence
n'éteint que les règles qui en dépendent, et le bilan dit lesquelles.

---

## 5. Vérifier

```bash
npm test          # 55 tests
npx tsc --noEmit  # typage strict
npm run exemple   # et surtout : lire
```

Aucun test ne touche au réseau ni à l'horloge — les dates sont injectées, seule
façon d'obtenir demain le même verdict qu'aujourd'hui.

**Ce que les tests ne voient pas, et qu'il faut lire.** Les deux défauts les plus
sérieux trouvés jusqu'ici sont passés à travers cinquante-trois tests verts : un
rapport qui ouvrait sur des reproches faute de constat positif, et un ordre de
conseil qui contredisait son propre texte. `npm run exemple` est là pour ça.

---

## 6. Ce que ce lot ne fait pas

Pas de site, pas de compte, pas de base de données, **rien n'est enregistré**.
Le lot 2 posera l'interface sur le socle `agence/` ; le lot 3 les comptes et le
chiffrement ; le lot 4 le suivi dans le temps, dont le moteur d'alertes existe
déjà dans `paper-manager/core/abonnements.py` et sera extrait plutôt que réécrit.
