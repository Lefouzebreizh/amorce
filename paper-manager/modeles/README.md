# Gabarits de courriers

Un gabarit par situation, en texte, avec des trous au format Jinja. Le module
`core/resiliation.py` les remplit ; il n'en écrit jamais un de zéro.

Écrits :

| Fichier | Situation | Date d'effet |
| --- | --- | --- |
| `resiliation_echeance.txt` | Le préavis peut encore être respecté. | au terme |
| `resiliation_avis_tardif.txt` | Avis d'échéance **reçu** moins de quinze jours avant la fin du préavis. | au terme |
| `resiliation_infra_annuelle.txt` | Assurance ou mutuelle en cours depuis plus d'un an, hors délai. | un mois |
| `resiliation_simple.txt` | Tout le reste. Texte neutre, sans affirmation sur l'engagement. | un mois |

`core.resiliation.choisir_gabarit` décide ; `--gabarit` force. Le texte invoqué
(`{fondement}`) dépend de la catégorie du contrat, parce qu'un assureur et un
opérateur télécom ne relèvent pas du même code.

Reste à écrire : `contestation_facture.txt`. Elle vise un **document** et non un
contrat — sans `journal.py`, elle ne saurait pas de quelle facture elle parle.

Les mentions qui doivent figurer dans **tous** les courriers de résiliation, et
qui sont la raison d'être des gabarits : identité et adresse complètes,
référence client ou numéro de contrat, désignation du contrat visé, date d'effet
demandée, demande de confirmation écrite, date et lieu. Une lettre rédigée
librement en oublie une sur cinq — et c'est celle-là que le service client
retiendra pour ne pas traiter la demande.
