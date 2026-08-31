"""Module 1 — lire les documents administratifs et les renommer.

**À lire avant d'écrire une ligne ici : `paper-manager/` fait déjà ce travail.**

`paper-manager/core/extraction.py` tire d'un PDF la nature, l'émetteur, le
montant, la date d'émission, la date limite et la référence client — par motifs
d'abord, par modèle de vision seulement si une clé existe. `core/nommage.py` en
compose `AAAA-MM-JJ_Emetteur_nature_montant.pdf` et le range. C'est exactement
ce que la fiche de ce module-ci décrivait.

Écrire `scan_ocr` par-dessus fabriquerait un second extracteur de champs dans le
même dépôt, qui divergerait du premier au premier motif ajouté. La frontière
utile entre les deux projets est donc celle-ci :

- **`paper-manager`** répond « que dit ce document, et quand faut-il payer » —
  échéances, abonnements, résiliations, formulaires.
- **Life-Organizer** répond « où ce fichier doit-il vivre » — et pour cela, il
  n'a pas besoin des champs, seulement d'assez de texte pour reconnaître un
  thème. C'est ce que fait `modules/classement/traitement.texte_du_document`,
  qui lit les premières pages sans rien extraire.

Ce module ne reste donc à écrire que le jour où Life-Organizer aura besoin de
**renommer** un document, et il devra alors appeler `paper-manager` plutôt que
de le refaire. Un module n'appelant jamais un autre module, cela demandera
d'abord de décider où vit la frontière — ce qui est une décision, pas une tâche.
"""
