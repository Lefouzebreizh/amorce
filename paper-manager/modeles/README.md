# Gabarits de courriers

Un gabarit par situation, en texte, avec des trous au format Jinja. Le module
`core/resiliation.py` les remplit ; il n'en écrit jamais un de zéro.

Prévus :

| Fichier | Situation |
| --- | --- |
| `resiliation_simple.txt` | Contrat sans engagement, résiliable à tout moment. |
| `resiliation_echeance.txt` | Reconduction tacite, résiliation à la date anniversaire dans les délais de préavis. |
| `resiliation_avis_tardif.txt` | Avis d'échéance reçu trop tard : la résiliation reste possible hors délai. |
| `resiliation_infra_annuelle.txt` | Assurance ou complémentaire souscrite depuis plus d'un an. |
| `contestation_facture.txt` | Montant contesté, avec la demande de justificatif. |

Les mentions qui doivent figurer dans **tous** les courriers de résiliation, et
qui sont la raison d'être des gabarits : identité et adresse complètes,
référence client ou numéro de contrat, désignation du contrat visé, date d'effet
demandée, demande de confirmation écrite, date et lieu. Une lettre rédigée
librement en oublie une sur cinq — et c'est celle-là que le service client
retiendra pour ne pas traiter la demande.
