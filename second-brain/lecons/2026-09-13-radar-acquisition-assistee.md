# Un radar d’acquisition doit automatiser la préparation, pas la décision

## Constat

Pour l’offre de reprise d’applications générées par IA, la production était
déjà largement outillée (`scan_surface.py`, capture, analyse, rapport et
paiement). Le goulot n’était donc pas un nouveau scanner mais la constitution
d’une petite liste de prospects solvables et la préparation d’un premier
contact crédible.

## Décision

Le MVP `audit-radar/` s’arrête volontairement au brouillon approuvé :

- découverte via une API autorisée ;
- lecture passive d’une seule page publique, précédée de `robots.txt` ;
- score explicable sur des signaux professionnels ;
- cinq dossiers maximum dans la file quotidienne ;
- approbation ou rejet unitaire ;
- export séparé, sans envoi automatique.

Le scanner de surface existant n’est pas appelé depuis le VPS tant que son
worker n’a pas un filtrage réseau sortant. Valider uniquement l’URL initiale ne
suffit pas : une page ou une redirection peut pointer vers loopback, RFC1918,
link-local ou les métadonnées du fournisseur. La sécurité doit donc exister à
deux niveaux : validation applicative des hôtes et politique egress du service.

## Pourquoi

Un faux positif technique coûte davantage qu’un prospect manqué. De même, une
campagne intégralement automatisée enlève précisément le contrôle qui rend le
message défendable : constater le fait public, vérifier sa pertinence et
assumer le contact au nom d’une personne réelle. Les dix minutes quotidiennes
ne sont pas une imperfection du système ; elles constituent son garde-fou.

## Preuves du lot

- neuf tests unitaires : score, déduplication, formulation prudente, statuts,
  opposition et cibles/redirections privées ;
- compilation Python réussie ;
- unités systemd validées par `systemd-analyze verify` ;
- parcours HTTP local exercé : fiche visible, approbation 303, un export.

Le contrôle visuel par navigateur distant n’a pas pu joindre le serveur local
isolé. Cette vérification reste donc à refaire sur l’URL exacte du VPS avant
toute déclaration de mise en service.
