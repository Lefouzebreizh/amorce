"""Trace des opérations, et mise en œuvre du mode simulation.

Le mode simulation (README, décision 2) n'est pas un `if` posé dans chaque
module : c'est le journal qui l'incarne. Un module déclare ce qu'il fait, le
journal l'écrit — et n'exécute que si l'on a demandé d'appliquer. Éparpiller la
condition dans les six modules garantirait qu'un jour l'un d'eux l'oublie, et
qu'il déplacerait deux mille fichiers pendant qu'on croyait regarder.

À écrire : `Journal` (ouvrir, `prevoir(action)`, `appliquer`, résumé chiffré de
fin de course), et l'écriture du fichier de trace dans `dossiers.journal`.
"""
