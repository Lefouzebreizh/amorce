#!/usr/bin/env python3
"""Le tout premier essai, à lancer sur le téléphone avant tout le reste.

Il ne touche ni à Facebook, ni à l'IA : il fait vibrer le téléphone, et c'est
tout. C'est volontaire — tant que la notification n'arrive pas, le reste est de
la théorie, et une panne se cherche dans un fichier de vingt lignes, pas dans
un projet entier.

Ce fichier ne dépend de rien d'autre que `requests` : il se copie tout seul sur
le téléphone, sans le reste du dossier.

    1. Installer l'application ntfy, s'abonner au sujet ci-dessous.
    2. Remplacer SUJET par le même nom.
    3. Lancer. Le téléphone doit sonner dans la seconde.
"""

import requests

# Le nom du sujet est le mot de passe : qui le connaît reçoit tes
# notifications. Celui-ci a été tiré au hasard — le garder tel quel, ou en
# tirer un autre, mais surtout ne pas prendre « amorce-erwann ».
SUJET = 'amorce-6zpx1g89it9ryl'

reponse = requests.post(
    'https://ntfy.sh',
    # En JSON, et pas dans des en-têtes HTTP : un en-tête ne transporte pas
    # d'accents, et « t’attend » y arriverait mutilé.
    json={
        'topic': SUJET,
        'title': 'Ça marche 🎉',
        'message': 'Ton téléphone et ton script se parlent. On peut continuer.',
        'priority': 4,
        'tags': ['tada'],
    },
    timeout=15,
)

if reponse.ok:
    print('✅ Notification envoyée. Regarde ton téléphone.')
else:
    print(f'❌ Refusé ({reponse.status_code}) : {reponse.text[:200]}')
