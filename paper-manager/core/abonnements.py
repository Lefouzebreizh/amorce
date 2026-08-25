"""Module 3 — l'état des contrats, et le calcul des alertes.

Le tableau de bord répond à trois questions : combien je paie par mois, ce qui
se renouvelle bientôt, et ce qui est encore sous engagement.

La règle qui justifie ce module : **on alerte sur le préavis, pas sur
l'échéance.** Un contrat à reconduction tacite qui arrive à terme le 1er
novembre avec deux mois de préavis n'est plus résiliable après le 1er
septembre. Alerter au 1er novembre, c'est alerter une fois l'année suivante
déjà payée. La date calculée est donc `echeance - preavis_jours`, et l'alerte
se déclenche `alerte_avant_jours` avant cette date-là.

Les cas particuliers que le calcul doit connaître, parce que chacun a déjà
coûté une année de reconduction à quelqu'un :

- **Résiliation à tout moment passé la première année** (assurances,
  complémentaires santé) : le préavis contractuel ne vaut plus que pour la date
  anniversaire, et une résiliation partie n'importe quand prend effet un mois
  plus tard.
- **Avis d'échéance reçu tard** : un assureur qui prévient moins de quinze
  jours avant la fin du préavis rouvre un droit de résiliation. D'où
  `date_avis_echeance` dans la configuration — c'est une date à noter en
  ouvrant le courrier, elle ne se retrouve pas après.
- **Engagement en cours** : partir avant la fin fait payer les mois restants.
  L'alerte doit dire le coût, pas seulement la date.
- **Document attendu qui n'arrive pas** (`documents_attendus`) : un abonnement
  mensuel dont aucune facture n'est entrée depuis six semaines mérite une
  alerte. C'est souvent le signe d'un changement de tarif envoyé par courriel.
"""
