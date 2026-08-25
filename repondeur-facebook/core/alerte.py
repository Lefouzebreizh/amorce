#!/usr/bin/env python3
"""Prévenir par courriel une fois le travail terminé.

Trois décisions tiennent ce fichier :

1. **La bibliothèque standard suffit.** `smtplib` envoie ce message ; une
   dépendance de plus pour dix lignes se paierait à chaque installation.
2. **Le port choisit le chiffrement.** 465 ouvre une session déjà chiffrée,
   587 démarre en clair et bascule par STARTTLS. Se tromper des deux côtés
   donne la même erreur illisible ; la déduire du port évite un réglage de plus
   à comprendre.
3. **Une alerte qui échoue ne fait pas échouer l'exécution.** Les réponses sont
   publiées : c'est le travail. Ne pas réussir à en informer est ennuyeux, pas
   grave — donc signalé, jamais fatal.
"""

from __future__ import annotations

import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage


@dataclass(frozen=True)
class Facteur:
    """De quoi joindre l'auteur. Rien de tout cela n'est écrit dans le dépôt."""
    hote: str
    port: int
    utilisateur: str
    mot_de_passe: str
    destinataire: str

    @classmethod
    def depuis_environnement(cls) -> 'Facteur | None':
        """Le facteur, ou None si l'alerte n'est pas configurée — ce qui est un choix valable."""
        hote = os.getenv('ALERTE_SMTP_HOTE')
        destinataire = os.getenv('ALERTE_DESTINATAIRE')
        if not hote or not destinataire:
            return None
        utilisateur = os.getenv('ALERTE_SMTP_UTILISATEUR', '')
        return cls(
            hote=hote,
            port=int(os.getenv('ALERTE_SMTP_PORT', '465')),
            utilisateur=utilisateur,
            mot_de_passe=os.getenv('ALERTE_SMTP_MOTDEPASSE', ''),
            destinataire=destinataire,
        )

    def envoyer(self, sujet: str, corps: str) -> None:
        message = EmailMessage()
        message['Subject'] = sujet
        message['From'] = self.utilisateur or self.destinataire
        message['To'] = self.destinataire
        message.set_content(corps)

        if self.port == 465:
            with smtplib.SMTP_SSL(self.hote, self.port, timeout=30) as serveur:
                self._authentifier(serveur)
                serveur.send_message(message)
        else:
            with smtplib.SMTP(self.hote, self.port, timeout=30) as serveur:
                serveur.starttls()
                self._authentifier(serveur)
                serveur.send_message(message)

    def _authentifier(self, serveur: smtplib.SMTP) -> None:
        if self.utilisateur and self.mot_de_passe:
            serveur.login(self.utilisateur, self.mot_de_passe)


def rediger_bilan(publiees: list[tuple[str, str]], laissees: list[tuple[str, str]],
                  echecs: list[tuple[str, str]], publie: bool) -> tuple[str, str]:
    """Le sujet et le corps du courriel de fin. Pur, pour être vérifiable.

    Le sujet porte le chiffre qui décide s'il faut ouvrir le message : le nombre
    de commentaires qui attendent une réponse écrite à la main.
    """
    mode = '' if publie else ' [simulation]'
    repondus = len(publiees)
    sujet = (
        f'Commentaires Facebook{mode} — {repondus} répondu{"s" if repondus > 1 else ""}, '
        f'{len(laissees)} pour toi'
    )

    lignes = []
    if laissees:
        lignes.append('À TOI DE RÉPONDRE')
        lignes += [f'  · {auteur} — {raison}' for auteur, raison in laissees]
        lignes.append('')
    if publiees:
        lignes.append('RÉPONDUS' + ('' if publie else ' (simulation, rien n’a été envoyé)'))
        lignes += [f'  · {auteur} : {reponse}' for auteur, reponse in publiees]
        lignes.append('')
    if echecs:
        lignes.append('ÉCHECS')
        lignes += [f'  · {auteur} — {motif}' for auteur, motif in echecs]
        lignes.append('')
    if not lignes:
        lignes.append('Aucun nouveau commentaire à traiter.')

    return sujet, '\n'.join(lignes).rstrip() + '\n'
