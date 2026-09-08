"""Moteur administratif — quatre briques indépendantes, sans logique produit.

- `lecture` : un document photographié devient du texte, puis des champs.
- `regles_delais` : un type de document et une table de règles donnent une
  échéance et une démarche.
- `redaction` : des champs et un gabarit donnent un écrit prêt à signer.
- `rappels` : une liste de rappels devient un fichier `.ics`.

Aucun module ne connaît le vocabulaire d'un produit particulier (« résiliation »,
« recours », « coffre »…) : chaque brique reçoit sa configuration — table de
règles, gabarits, mots-clés — de l'appelant. Voir le README pour le détail des
décisions et l'origine de ce qui a été porté depuis paper-manager et
life-organizer.
"""
