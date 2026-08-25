"""Module 2 — les échéances deviennent des rappels.

Sortie : un fichier `.ics` que l'agenda du téléphone reprend. Pas de
notification propre au programme, pas de service qui tourne en tâche de fond :
le rappel doit arriver là où on regarde déjà, et l'agenda du téléphone est le
seul endroit qui remplit cette condition.

Deux décisions :

1. **Un rappel porte l'action, pas le constat.** « Résilier la MAIF avant le
   02/09 » et non « échéance MAIF » : un rappel qui demande de rouvrir un
   dossier pour savoir quoi faire est un rappel qu'on repousse.
2. **Plusieurs rappels par échéance** (`rappels.avant_echeance_jours`, par
   défaut 30, 7 et 1 jours avant). Un seul rappel tombe forcément un jour où
   l'on ne peut rien faire.

Chaque événement porte un `UID` stable, dérivé de l'identifiant de l'alerte :
une regénération du fichier met à jour les événements existants au lieu d'en
créer des doubles à chaque exécution.
"""
