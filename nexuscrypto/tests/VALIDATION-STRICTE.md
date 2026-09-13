# Validation stricte avant le mode réel

Le 13 septembre 2026, la reprise sur b281805 a révélé deux conversions
permissives dans `src/core/validation.py` : `bool("false")` valait vrai et
une durée NaN échappait à la comparaison avec le minimum de simulation.
Une signature numérique ou composée d'espaces était aussi acceptée.

La lecture exige désormais de vrais booléens YAML, une durée finie positive
ou nulle et une signature textuelle non vide après retrait des espaces.
Un fichier illisible ou mal formé retourne l'état non validé.
Le contrôle direct de l'état refuse également les durées NaN et infinies.

La suite compte 365 tests réussis depuis le dossier du projet. Les nouveaux
cas couvrent les faux accords, durées invalides, signatures invalides,
fichiers mal formés et le refus de la commande `production --je-confirme`
avant chargement de la configuration et lancement du courtier.
Une relecture indépendante vérifie les six invariants de garde-du-bot.

Aucun seuil de stratégie, capital, plateforme ou attestation n'a été modifié.
Le fichier livré déclare toujours zéro jour de paper trading. Cette correction
ne démontre ni un fonctionnement continu ni une rentabilité. Le changement
concerne le verrou de production et reste à relire avant intégration.
