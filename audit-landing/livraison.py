"""Livraison d'un rapport approuvé. Aucun envoi à l'import du module.

API : https://resend.com/docs/api-reference/emails/send-email
L'identifiant fournisseur confirme l'acceptation, pas la remise au destinataire.
"""
import base64
import json
from urllib.request import Request, urlopen


def livrer(base, session, *, cle_resend, expediteur, transport=urlopen):
    if not cle_resend or not expediteur or '\n' in expediteur or '\r' in expediteur:
        raise ValueError('Configurer la clé Resend et un expéditeur vérifié')
    envoi = base.preparer_envoi(session)
    if envoi is None:
        return None
    corps = {
        'from': expediteur,
        'to': [envoi['destinataire']],
        'subject': 'Votre audit de page de vente est prêt',
        'text': ('Bonjour,\n\nVotre rapport relu est joint à ce courriel au format HTML. '
                 'Téléchargez-le puis ouvrez-le dans votre navigateur.\n\n'
                 'Vous y trouverez les observations et les corrections prioritaires. '
                 'Les recommandations sont des pistes à tester, sans garantie de conversion.\n\n'
                 'Bonne lecture.'),
        'attachments': [{'filename': 'rapport-audit.html',
                         'content': base64.b64encode(envoi['contenu']).decode('ascii')}],
    }
    requete = Request('https://api.resend.com/emails',
                      data=json.dumps(corps).encode('utf-8'), method='POST',
                      headers={'Authorization': 'Bearer ' + cle_resend,
                               'Content-Type': 'application/json',
                               'Idempotency-Key': envoi['cle_envoi']})
    try:
        with transport(requete, timeout=30) as reponse:
            if not 200 <= reponse.status < 300:
                raise ValueError('Réponse non acceptée')
            resultat = json.loads(reponse.read())
        message_id = resultat.get('id') if isinstance(resultat, dict) else None
        if not isinstance(message_id, str) or not message_id.strip():
            raise ValueError('Réponse sans identifiant')
    except Exception:
        # Ne jamais relancer aveuglément : Resend peut avoir accepté la requête.
        # Ne pas exposer sa réponse brute (destinataire, détails internes).
        raise RuntimeError('Envoi non confirmé : vérifier le journal Resend avant toute reprise') from None
    if not base.confirmer_envoi(session, message_id):
        raise RuntimeError('Acceptation Resend reçue, mais registre non confirmé')
    return message_id
