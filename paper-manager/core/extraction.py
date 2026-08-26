"""Module 1 — le document devient des champs.

Nature, émetteur, montant, date d'émission, date limite de paiement, référence
client. C'est le seul module qui sort sur le réseau.

Les décisions :

1. **Un modèle de vision plutôt qu'une reconnaissance optique classique.** Un
   OCR rend un texte que personne ne sait ensuite structurer — l'ordre des
   colonnes d'un tableau de facture ne survit pas à la mise à plat. Un modèle
   de vision rend directement les champs demandés.
2. **Rien de ce qui revient n'est cru sur parole.** Le montant doit être un
   nombre, la date doit être plausible (ni dans dix ans, ni avant l'existence
   du contrat), la nature doit appartenir à la liste connue. Ce qui ne passe
   pas la validation part dans la pile « à relire », jamais dans le coffre.
3. **Les émetteurs déjà rencontrés se reconnaissent sans appel réseau.** Une
   facture EDF ressemble à la précédente : les motifs d'`extraction.
   emetteurs_connus` la rattachent à sa catégorie sans rien envoyer. Le modèle
   ne sert qu'à ce qui est nouveau, ou qu'à ce dont la reconnaissance doute.
4. **Un indice de confiance accompagne chaque champ.** Sous
   `confiance_minimale`, le document est signalé plutôt que rangé. Un document
   mal classé est un document perdu : le coffre est grand et la mémoire courte.
"""
