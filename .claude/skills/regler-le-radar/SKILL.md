---
name: regler-le-radar
description: Régler le détecteur de pépites crypto et diagnostiquer un scan décevant — lire l'entonnoir de `pepites_radar.md` pour savoir quel seuil bouger, comprendre la grammaire d'un trapèze, et mesurer l'effet du changement sur six profils de marché connus avec `pepites/profils.py`. À utiliser dès qu'une demande dit « le radar ne trouve rien », « trop de faux positifs », « ça alerte trop », « ça n'alerte jamais », « resserre les seuils », « il rate les vraies pépites », « le bouclier bloque tout », ou parle de trapèzes, de pondérations, de note de convergence, de seuil d'alerte, de liquidité minimale ou de capitalisation.
---

# Régler le radar sans casser ce qui marchait

Un détecteur se règle en bougeant un nombre et en se demandant ce qu'on vient de
casser ailleurs. Le piège est de régler sur le scan du soir : il dépend du marché
du moment, il met une minute, et deux tours ne sont jamais comparables.

## L'outil

```bash
cd pepites && python3 profils.py
```

Six profils de côté — celui qu'on cherche, et les cinq façons dont le radar peut
se tromper — passés par les vrais filtres et la vraie note, avec le
`reglages.yaml` du moment. On bouge un seuil, on relance, on lit la colonne qui
a bougé. Instantané, reproductible, et **c'est là qu'on voit les dégâts
collatéraux** : un réglage qui rattrape un faux négatif détruit souvent la
discrimination d'un autre profil.

Ce que le tableau doit continuer de montrer, quoi qu'on règle :

| Profil | Ce qu'on attend |
| --- | --- |
| accumulation | la meilleure note, largement au-dessus du seuil d'alerte |
| sommet en cours | franchement sous le seuil d'analyse |
| endormi | franchement sous le seuil d'analyse |
| robot de volume, lavage, ventes bloquées | un **drapeau**, quelle que soit la note |
| pool de deux heures, déjà grand public | écartés avant notation |

Si « sommet en cours » remonte au-dessus de « accumulation », le réglage est à
jeter : l'outil alerterait sur les hausses déjà publiques, ce qui est
exactement le contraire de son objet.

## Diagnostiquer depuis le rapport

`pepites_radar.md` porte trois tableaux dont l'ordre correspond aux trois
endroits où l'on peut se tromper. Lire l'entonnoir en tête d'abord.

| Symptôme dans le rapport | Ce qui se passe vraiment | Où regarder |
| --- | --- | --- |
| « Écartés avant notation » dominé par **capitalisation trop élevée** | la découverte remonte surtout de grosses paires — la recherche par jeton de cotation fait ça | `radar.jetons_en_vitrine_max`, et non les filtres |
| Beaucoup de **liquidité sous le plancher** | le filet est trop large pour la chaîne visée | `liquidite_min_usd` de la chaîne dans `chaines.yaml` |
| Beaucoup de **trop peu de transactions** | on regarde des chaînes où il ne se passe rien à cette heure | normal ; ne rien toucher |
| « Notés mais non retenus » plein de **premier relevé** | l'outil n'a pas encore de mémoire | faire tourner le scan plus souvent, ne rien régler |
| « Notés mais non retenus » plein de **signal isolé** | des pics sans lendemain, la persistance fait son travail | ne rien toucher — c'est le succès, pas l'échec |
| « Arrêtées par le bouclier » avale tout | seuils de sécurité trop stricts pour le marché visé | `lp_verrouillee_min_pct`, puis `top10_detenteurs_max_pct` |
| « Arrêtées par le bouclier » **toujours vide** sur des dizaines de scans | les seuils de sécurité ne mordent pas | mêmes deux réglages, dans l'autre sens |
| Des pépites retenues en **inconnu** systématiquement | GoPlus ne répond pas, ou pas pour ces chaînes | vérifier le journal, pas les seuils |
| Zéro alerte alors que des pépites sont retenues | le silence par jeton, ou le seuil d'alerte | `alertes.note_minimale`, `alertes.silence_heures` |

Le réflexe à avoir : **un rapport vide n'est presque jamais un problème de
notation**. C'est la découverte ou la persistance, dans cet ordre.

## La grammaire d'un trapèze

```yaml
trapeze: [entree, plateau_bas, plateau_haut, sortie]
```

```
1 ┤      ╱▔▔▔▔▔▔▔▔▔╲          hors de [entree, sortie] → 0
  │     ╱           ╲         sur le plateau           → 1
0 ┼────╱             ╲────    entre les deux           → rampe linéaire
      e   pb     ph   s
```

Quatre bornes croissantes, sinon le chargement refuse de démarrer — un trapèze
décroissant noterait zéro partout, en silence, et le critère disparaîtrait de
l'outil sans qu'aucune erreur ne le dise.

Pour **élargir** ce qu'un critère accepte, écarter `entree` et `sortie`. Pour
**durcir** ce qu'il valorise, resserrer le plateau. Les deux gestes ne font pas
la même chose : le premier laisse entrer plus de candidats avec une note
partielle, le second réserve les points pleins à une zone plus étroite.

Les poids doivent totaliser **100**. Le chargement refuse autre chose, parce
qu'une somme à 97 déplacerait en silence le sens du seuil d'alerte à 70. Pour
donner du poids à un critère, en retirer à un autre — ce sont des arbitrages,
pas des curseurs indépendants.

## Ce qu'on ne bouge pas

- **`age_min_heures` en dessous de 6.** Sous six heures, l'accélération explose
  par construction : le dénominateur sur 24 h n'existe pas encore. Mesuré — à
  `age_min_heures: 1`, le profil « pool de deux heures » passe de *écarté* à
  **93/100**, très au-dessus du seuil d'alerte. L'outil se mettrait à prévenir
  sur des pools de deux heures, c'est-à-dire précisément dans la fenêtre du
  retrait de liquidité. C'est le filtre le plus important du radar.
- **`releves_requis` à 1.** La persistance est le meilleur filtre
  anti-faux-signal du projet et elle ne coûte aucun appel réseau. La désactiver
  pour « voir plus de résultats » revient à alerter sur chaque hoquet
  d'indexation de DexScreener.
- **Un poids à zéro pour neutraliser un critère.** Le chargement le refuse : un
  zéro se lit comme un oubli. Pour retirer un critère, supprimer son entrée et
  redistribuer ses points.
- **`bouclier.note_minimale_pour_analyser` au-dessus de `alertes.note_minimale`.**
  Refusé au chargement aussi : des jetons seraient alertés sans avoir été
  contrôlés, ce qui est le contraire exact de ce que fait cet outil.
- **La pression `V1/MarketCap` remontée vers 50 %.** La règle qui circule sur les
  réseaux dit « volume 1 h > 50 % de la capitalisation ». À ce niveau la hausse
  n'est pas à venir, elle est en cours, et on arrive en dernier.
  Mesuré, avec `trapeze: [0.1, 0.5, 2.0, 5.0]` : « accumulation » tombe de
  **100 à 82** (elle perd la totalité des 18 points de pression, son volume à 6 %
  de la capitalisation passant sous la borne d'entrée) pendant que « sommet en
  cours » **monte de 40 à 46**. L'écart entre ce qu'on cherche et ce qu'on fuit
  se réduit de 60 points à 36 : la discrimination perd 40 % de sa force, et le
  réglage aveugle le détecteur sur la zone même qu'il devait viser. Le plateau à
  5–25 % est un choix argumenté, pas un oubli.

## Après un réglage

```bash
cd pepites
python3 profils.py                       # la discrimination tient-elle encore ?
python3 -m unittest discover -s tests    # plusieurs tests chargent le vrai reglages.yaml
```

Puis **deux scans réels espacés d'un quart d'heure** : un réglage ne se juge pas
sur un tour, puisque rien ne se confirme au premier. Comparer les entonnoirs des
deux rapports, pas leurs listes de pépites.
