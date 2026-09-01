# Assistant d'allocation d'actifs — absorbé le 01/09/2026

> **Ce chantier n'est plus en sommeil : il a été repris.** Le code vit désormais
> dans **`conseiller-patrimoine/`**, et `archives-backlog/patrimoine/` a été
> retiré du dépôt. Cette fiche reste pour une seule raison : `INDEX.md` y renvoie,
> et un lien mort vaut moins qu'une page qui dit où c'est parti.

## Ce qu'il était

Un assistant d'allocation en Python : un fichier `assistant.py` de 688 lignes,
une configuration JSON, des cours relevés par `yfinance` et CoinGecko. **27
tests, tous verts** au moment de la mise de côté — un outil qui marchait, pas
une esquisse. Il dormait faute de quelqu'un pour le faire avancer.

## Pourquoi il a été absorbé plutôt que réveillé

Une session partait écrire un module `conseiller-patrimoine` neuf. La
cartographie préalable a trouvé celui-ci : il faisait déjà 60 % du travail
demandé — valorisation multi-classes, écarts contre une cible, plan d'apport.

Le §0 bis de `CLAUDE.md` est clair là-dessus : **un doublon arrête le geste.**
Deux outils qui font la même chose se déclenchent l'un à la place de l'autre, et
le moins bon gagne une fois sur deux. Trois issues étaient possibles — étendre,
remplacer, coexister — et le propriétaire a tranché pour l'absorption.

## Ce qui a été repris, et c'est le point

Pas le code : la structure a été refaite au modèle de NexusCrypto, en paquets
séparés. Ce qui valait le déplacement, ce sont les **cinq décisions** qui
avaient été payées une fois et qu'une réécriture de mémoire aurait perdues :

1. l'immobilier compte en **valeur nette** de crédit ;
2. le rendement locatif se rapporte à la valeur du bien, pas à l'apport ;
3. **l'apport passe avant l'arbitrage** — renforcer n'est pas imposé, vendre
   l'est ;
4. rien ne bouge dans la bande de tolérance, et « ne rien faire » se dit en
   toutes lettres ;
5. **un prix manquant ne s'invente pas** : la ligne est marquée, elle ne compte
   pas pour zéro, et le conseil est retenu tant que le total est incomplet.

Ses 27 tests ont été repris et étendus. La suite du module d'accueil en compte
91.

## Ce que l'absorption a ajouté

- La lecture de NexusCrypto et du radar — et la découverte, mesurée à cette
  occasion, que **NexusCrypto ne persiste aucune position** : son portefeuille
  naît en mémoire et meurt avec le processus.
- Une **lecture seule vérifiée** plutôt que promise : zéro dépendance réseau,
  SQLite en `mode=ro`, porte unique vers l'environnement, et un test qui relit
  le source du paquet.
- Une sixième décision, propre au nouveau module : **un prix vieux ne se
  présente pas comme frais.** Les cours étant saisis à la main, chacun porte sa
  date, et au-delà de trente jours le conseil se tait comme s'il manquait.

## Où c'est maintenant

```bash
cd conseiller-patrimoine
python3 -m unittest discover -s tests      # 91 tests
python3 main.py sources                    # qui répond, qui se tait
```

Le détail des décisions et les limites de chaque source sont dans
`conseiller-patrimoine/README.md`.
