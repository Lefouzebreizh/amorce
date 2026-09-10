# NexusCrypto : retirer le DCA calendaire a cassé un témoin qu'on croyait trivial

**Ce qu'on a mesuré et que personne n'avait mesuré.** Un témoin « achat unique »
qui vise 100 % de la trésorerie disponible (`liquidites_usd`) au lieu d'une
petite enveloppe nominale échoue **systématiquement**, en silence : le
courtier papier applique un glissement et des frais par-dessus le montant
visé, le coût final dépasse alors ce qui est réellement disponible,
`risk_management.portefeuille.appliquer` lève `FondsInsuffisants`, et
l'appelant l'attrape sans un mot. Zéro exécution, zéro erreur visible — un
rejeu qui a l'air fini et qui ne mesure rien. Ça ne s'était jamais vu tant que
le témoin achetait une petite enveloppe fixe (quelques pour cent de la
trésorerie), très en deçà de toute marge de sécurité nécessaire. Viser 99 % de
la trésorerie plutôt que 100 % absorbe cette marge sans changer le sens de la
mesure. La même prudence vaut pour tout code qui vise « tout ce qu'il reste » :
un montant cible calculé sur l'état courant doit toujours laisser la place aux
coûts que l'exécution ajoutera après coup.

**Ce qui a coûté un aller-retour.** Le témoin multi-actifs qui répartit le
capital à parts égales entre plusieurs lignes traite les lignes **en
séquence**, sur une trésorerie **partagée** : la première ligne servie
consomme sa part plus les frais et le glissement, ce qui réduit ce qui reste
pour la seconde. Le résultat n'est donc jamais parfaitement égal — l'écart
mesuré est de l'ordre de 1 à 1,3 % sur deux lignes — et un test qui exige
l'égalité à 1 % près échoue pour une raison qui n'est pas un bug. La règle
générale : un partage « à parts égales » calculé une fois puis exécuté
séquentiellement sur un pool commun n'est égal qu'à l'ordre des frais et du
glissement près, jamais exactement.

**Ce qui rend une phrase de ce dépôt fausse.** Toute la description de
NexusCrypto comme « moteur à DCA dynamique » l'était devenue le 10/09/2026,
dans `CLAUDE.md`, `nexuscrypto/README.md` et les docstrings de
`core/modeles.py` (`Action.TEMPORISER`, `Zone`), `strategy/__init__.py` et
`src/__init__.py`. Le retrait du calendrier n'est pas qu'un changement de
code : c'est un changement de **philosophie de test**. L'ancien harnais
(`test_la_configuration_livree_achete_sur_les_six_marches`, le plancher de
discipline mesuré à 15 %) partait du principe qu'une abstention totale est
toujours un échec — vrai pour un DCA, dont la promesse est de continuer
d'acheter. Pour un chasseur d'opportunités pur, une abstention prolongée face
à un marché sans occasion réelle est le comportement voulu, pas une panne.
Un test hérité tel quel après un changement de philosophie ne détecte plus un
défaut, il détecte le changement de philosophie lui-même et le fait échouer à
tort — c'est ce qui a fait retirer `TestAucuneAbstention` plutôt que
l'adapter.
