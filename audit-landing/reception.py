"""Point WSGI privé pour le serveur de paiement, derrière HTTPS.

Le serveur Stripe doit vérifier signature et paiement avant l'appel. Ne pas
exposer ce composant sans secret, TLS et disque persistant. Aucun job ni courriel
n'est lancé dans la requête : seul l'enregistrement durable est acquitté.
"""
import hmac
import json
from urllib.parse import urlsplit
from commandes import Commandes


def application(fichier_base, secret):
    if not isinstance(secret, str) or len(secret) < 32:
        raise ValueError('Secret de réception de 32 caractères minimum requis')

    def recevoir(env, start_response):
        def repondre(code, texte):
            start_response(code, [('Content-Type', 'text/plain; charset=utf-8')])
            return [texte.encode('utf-8')]
        if env.get('PATH_INFO') != '/commandes' or env.get('REQUEST_METHOD') != 'POST':
            return repondre('404 Not Found', 'introuvable')
        attendu = ('Bearer ' + secret).encode()
        recu = env.get('HTTP_AUTHORIZATION', '').encode()
        if not hmac.compare_digest(recu, attendu):
            return repondre('401 Unauthorized', 'non autorisé')
        try:
            longueur = int(env.get('CONTENT_LENGTH', '0'))
            if not 0 < longueur <= 16384:
                return repondre('413 Payload Too Large', 'taille refusée')
            corps = json.loads(env['wsgi.input'].read(longueur))
            if not isinstance(corps, dict):
                raise ValueError()
            session, url, email = (corps.get(k) for k in ('sessionId', 'url', 'email'))
            if not all(isinstance(v, str) and v.strip() for v in (session, url, email)):
                raise ValueError()
            adresse = urlsplit(url)
            if adresse.scheme not in ('https', 'http') or not adresse.hostname or adresse.username or adresse.password:
                raise ValueError()
            if '@' not in email or any(c in email for c in '\r\n,; '):
                raise ValueError()
            if not session.startswith('cs_'):
                raise ValueError()
        except (ValueError, TypeError, UnicodeError):
            return repondre('400 Bad Request', 'commande invalide')
        base = None
        try:
            base = Commandes(fichier_base)
            nouvelle = base.enregistrer(session, url, email)
        except ValueError:
            return repondre('409 Conflict', 'session incompatible')
        except Exception:
            return repondre('503 Service Unavailable', 'enregistrement non confirmé')
        finally:
            if base is not None:
                base.fermer()
        return repondre('201 Created' if nouvelle else '200 OK', 'enregistrée')
    return recevoir
