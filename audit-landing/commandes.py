"""Registre local durable : à héberger sur disque persistant, jamais un runner éphémère.

Une commande est identifiée par sa session Stripe. Les transitions atomiques
empêchent deux processus de prendre le même travail. Un travail interrompu reste
visible dans son état courant ; aucune relance automatique d'un envoi incertain.
Ce module ne vérifie pas Stripe et n'envoie pas de courriel.
"""
import hashlib
import sqlite3
from pathlib import Path


class Commandes:
    def __init__(self, fichier):
        self.db = sqlite3.connect(fichier, timeout=10, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('''CREATE TABLE IF NOT EXISTS commandes (
            session TEXT PRIMARY KEY, url TEXT NOT NULL, email TEXT NOT NULL,
            etat TEXT NOT NULL DEFAULT 'attente', rapport TEXT, empreinte TEXT,
            relecteur TEXT, message_id TEXT,
            modifie TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )''')

    def fermer(self):
        self.db.close()

    def lire(self, session):
        row = self.db.execute('SELECT * FROM commandes WHERE session=?', (session,)).fetchone()
        return dict(row) if row else None

    def enregistrer(self, session, url, email):
        if not all(isinstance(x, str) and x.strip() for x in (session, url, email)):
            raise ValueError('Session, URL et destinataire requis')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            ancien = self.lire(session)
            if ancien and (ancien['url'] != url or ancien['email'] != email):
                raise ValueError('La même session désigne une autre commande')
            if not ancien:
                self.db.execute('INSERT INTO commandes(session,url,email) VALUES(?,?,?)', (session, url, email))
            self.db.execute('COMMIT')
            return ancien is None
        except Exception:
            self.db.execute('ROLLBACK')
            raise

    def _transition(self, session, depart, arrivee, **champs):
        # Noms de colonnes définis par ce module, jamais reçus d'une requête.
        autorises = {'rapport', 'empreinte', 'relecteur', 'message_id'}
        if not set(champs) <= autorises:
            raise ValueError('Colonne inconnue')
        affectations = ''.join(', ' + cle + '=?' for cle in champs)
        resultat = self.db.execute(
            'UPDATE commandes SET etat=?, modifie=CURRENT_TIMESTAMP' + affectations +
            ' WHERE session=? AND etat=?',
            (arrivee, *champs.values(), session, depart))
        return resultat.rowcount == 1

    def prendre(self, session):
        return self._transition(session, 'attente', 'analyse')

    def deposer(self, session, rapport):
        chemin = Path(rapport).resolve()
        contenu = chemin.read_bytes()
        if not contenu:
            raise ValueError('Rapport vide')
        return self._transition(session, 'analyse', 'relecture',
                                rapport=str(chemin), empreinte=hashlib.sha256(contenu).hexdigest())

    def approuver(self, session, relecteur):
        if not isinstance(relecteur, str) or not relecteur.strip():
            raise ValueError('Relecteur requis')
        commande = self.lire(session)
        if not commande or commande['etat'] != 'relecture':
            return False
        contenu = Path(commande['rapport']).read_bytes()
        if hashlib.sha256(contenu).hexdigest() != commande['empreinte']:
            raise ValueError('Rapport modifié : déposer une nouvelle version avant relecture')
        return self._transition(session, 'relecture', 'approuve', relecteur=relecteur)

    def preparer_envoi(self, session):
        commande = self.lire(session)
        if not commande or commande['etat'] != 'approuve':
            return None
        # Retourner ces octets précis, pas relire le fichier après le contrôle.
        contenu = Path(commande['rapport']).read_bytes()
        if hashlib.sha256(contenu).hexdigest() != commande['empreinte']:
            raise ValueError('Rapport modifié depuis la relecture')
        if not self._transition(session, 'approuve', 'envoi'):
            return None
        return {'destinataire': commande['email'], 'contenu': contenu,
                'cle_envoi': 'audit-' + hashlib.sha256(session.encode()).hexdigest()}

    def confirmer_envoi(self, session, message_id):
        if not isinstance(message_id, str) or not message_id.strip():
            raise ValueError('Identifiant du fournisseur requis')
        return self._transition(session, 'envoi', 'envoye', message_id=message_id)

    def a_traiter(self):
        return [dict(row) for row in self.db.execute(
            "SELECT session,etat,modifie FROM commandes WHERE etat != 'envoye' ORDER BY modifie,session")]
