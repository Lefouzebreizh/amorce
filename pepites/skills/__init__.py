"""Les cinq skills, dans l'ordre où le pipeline les traverse.

Chacun a un contrat volontairement étroit — il reçoit un type, il en rend un
autre — parce que c'est ce qui permet de remplacer une source de données sans
toucher au reste, et de tester les trois skills de calcul sans réseau.

| Module          | Reçoit                | Rend                  | Réseau |
| --------------- | --------------------- | --------------------- | ------ |
| `radar`         | la liste des chaînes  | `list[Candidat]`      | oui    |
| `convergence`   | `Candidat`            | `Metriques`, `Note`   | non    |
| `bouclier`      | `Candidat`            | `Securite`            | oui    |
| `smart_money`   | `Candidat`            | `SmartMoney`          | oui    |
| `telegram`      | `list[Pepite]`        | rien                  | oui    |

L'ordre n'est pas un détail : `convergence` ne coûte rien et élimine 90 % des
candidats, `bouclier` et `smart_money` coûtent des quotas d'API. Inverser les
deux, c'est passer d'un scan par minute à un scan par heure.
"""
