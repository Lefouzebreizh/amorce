"""Module 2 — retiré du projet le 01/09/2026.

**Ce module ne sera pas écrit ici.** `paper-manager/` tient les échéances de
paiement, le suivi des abonnements et les lettres de résiliation —
`core/calendrier.py`, `core/abonnements.py`, `core/resiliation.py` — avec leurs
tests et leur configuration.

Précision du 05/09/2026, pour ne pas lire cette phrase comme une exclusivité :
`paper-manager/` n'est plus la seule brique à détecter une échéance. PR #685
(04/09/2026) a posé une détection d'échéance indépendante dans `le-coffre/`
(fonction Supabase `classer-document`), sans passer par `paper-manager/`. La
décision qui retire ce module-ci d'ici n'a pas changé — Life-Organizer range,
il ne suit pas d'échéances — mais elle ne dit plus « il n'existe qu'un seul
endroit qui le fait ».

La décision qui l'a retiré tient en une phrase : **Life-Organizer range, il ne
renomme pas et ne suit pas d'échéances.** Il répond « où ce fichier doit-il
vivre », et rien d'autre. Ce qu'un document *dit* — son montant, sa date limite,
son émetteur — appartient à l'assistant administratif, qui est fait pour ça.

Le dossier et ce fichier sont conservés plutôt que supprimés : c'est ici qu'on
vient chercher le module quand on se demande pourquoi il manque, et une absence
sans explication se comble par quelqu'un qui la prend pour un oubli.
"""
