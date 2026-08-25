#!/usr/bin/env python3
"""Le tout premier essai, à lancer sur le téléphone avant tout le reste.

Il ne touche ni à Facebook, ni à l'IA : il fait vibrer le téléphone, et c'est
tout. C'est volontaire — tant que la notification n'arrive pas, le reste est de
la théorie, et une panne se cherche dans un fichier de vingt lignes, pas dans
un projet entier.

Ce fichier ne dépend de rien d'autre que `requests` : il se copie tout seul sur
le téléphone, sans le reste du dossier.

    1. Tirer un nom de sujet au hasard :
       python3 -c "import secrets;print('amorce-'+secrets.token_hex(7))"
    2. Installer l'application ntfy, s'abonner à ce nom.
    3. Le recopier dans SUJET ci-dessous, sur le téléphone.
    4. Lancer. La notification doit arriver dans la seconde.
"""

import requests

# Le nom du sujet est le mot de passe : qui le connaît reçoit tes
# notifications — et peut t'en envoyer. Il se remplit sur l'appareil et **ne se
# committe jamais** : ce dépôt est public, et l'historique de git n'oublie
# rien. Un nom écrit ici une fois est un nom à changer.
SUJET = 'a-remplacer-par-le-tien'

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
