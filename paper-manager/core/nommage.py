"""Module 1 — les champs deviennent un nom de fichier et un dossier.

`AAAA-MM-JJ_Emetteur_nature_montant.pdf`, par exemple
`2026-03-14_EDF_facture_78-42EUR.pdf`, rangé dans `classes/2026/energie/`.

Pourquoi ce nom-là :

- **La date en premier**, parce qu'un dossier d'administratif se parcourt dans
  l'ordre du temps, et que le tri alphabétique d'un gestionnaire de fichiers
  devient alors le tri chronologique, partout, sans outil.
- **Le montant dans le nom**, parce que « combien ai-je payé » se répond alors
  sans rien ouvrir.
- **La virgule décimale devient un tiret** : elle casse les exports CSV et
  certains outils de synchronisation.
- **Ni accent ni espace** : ces fichiers finissent sur une clé USB, dans une
  pièce jointe ou sur un disque réseau, et chacun a sa façon de les abîmer.

Ce module est **pur** : il calcule un nom et un chemin, il n'écrit rien. Le
déplacement effectif appartient à `paper.py classer --appliquer`, qui le montre
d'abord. C'est aussi ce qui le rend testable sans disque.

Un nom déjà pris reçoit un suffixe `-2` plutôt qu'un écrasement, et un document
dont l'empreinte est déjà au journal n'est pas reclassé une seconde fois.
"""
