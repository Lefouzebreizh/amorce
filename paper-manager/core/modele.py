"""Les objets partagés par les quatre modules.

Ils sont ici et pas dans le module qui les produit, parce que chacun traverse
le projet : un `Document` naît du scan, alimente le calendrier et sert de pièce
jointe à un courrier de contestation.

Deux décisions :

1. **Les dates sont des `date`, jamais des chaînes.** La conversion se fait une
   seule fois, à la lecture de la configuration. Comparer « 02/09/2026 » et
   « 2026-09-02 » est le genre de bogue qui ne se voit qu'un jour trop tard.
2. **Les montants sont des `Decimal`.** Un total d'abonnements en `float`
   affiche 149.99000000000001 au bout de cinq lignes.

Objets : `Document`, `Abonnement`, `Engagement`, `Echeance`, `Alerte`,
`Identite`, `Courrier`.
"""
