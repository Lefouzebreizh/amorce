"""Module 2 — retiré du projet le 01/09/2026.

**Ce module ne sera pas écrit ici.** `paper-manager/` tient déjà les échéances
de paiement, le suivi des abonnements et les lettres de résiliation —
`core/calendrier.py`, `core/abonnements.py`, `core/resiliation.py` — avec leurs
tests et leur configuration.

La décision qui l'a retiré tient en une phrase : **Life-Organizer range, il ne
renomme pas et ne suit pas d'échéances.** Il répond « où ce fichier doit-il
vivre », et rien d'autre. Ce qu'un document *dit* — son montant, sa date limite,
son émetteur — appartient à l'assistant administratif, qui est fait pour ça.

Le dossier et ce fichier sont conservés plutôt que supprimés : c'est ici qu'on
vient chercher le module quand on se demande pourquoi il manque, et une absence
sans explication se comble par quelqu'un qui la prend pour un oubli.
"""
