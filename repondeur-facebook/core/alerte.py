#!/usr/bin/env python3
"""Prévenir sur le téléphone quand le travail est fini, par ntfy.

Cinq décisions tiennent ce fichier :

1. **ntfy, et pas un courriel ni un SMS.** L'application est gratuite, sans
   compte et sans forfait : il n'y a rien à administrer, et la notification
   arrive sur l'écran de verrouillage — là où on la voit.
2. **Le message part en JSON, pas en en-têtes HTTP.** ntfy accepte un titre
   dans un en-tête `Title`, mais un en-tête HTTP ne transporte pas d'accents :
   « 3 commentaires t'attendent » y arriverait mutilé, ou ferait échouer la
   requête. Le corps JSON est en UTF-8 et règle la question.
3. **Le nom du sujet est le mot de passe.** N'importe qui connaissant le sujet
   reçoit les notifications. D'où un nom tiré au hasard, rangé avec les jetons
   dans `config.env`, et jamais dans le dépôt.
4. **Rien de sensible dans la notification.** Elle s'affiche sur un écran
   verrouillé, dans le métro, à côté de quelqu'un. Elle donne des prénoms et
   des nombres ; le texte des commentaires et les raisons restent à l'écran du
   script et dans le journal.
5. **Une alerte qui échoue ne fait pas échouer l'exécution.** Les réponses sont
   publiées : c'est le travail. Ne pas réussir à en informer est ennuyeux, pas
   grave — donc signalé, jamais fatal.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import requests

SERVEUR_PAR_DEFAUT = 'https://ntfy.sh'
DELAI_S = 15


@dataclass(frozen=True)
class Sonnette:
    """De quoi faire vibrer le téléphone. Le sujet n'est pas dans le dépôt."""
    sujet: str
    serveur: str = SERVEUR_PAR_DEFAUT

    @classmethod
    def depuis_environnement(cls) -> 'Sonnette | None':
        """La sonnette, ou None si l'alerte n'est pas configurée — ce qui est un choix valable."""
        sujet = os.getenv('NTFY_SUJET')
        if not sujet:
            return None
        return cls(sujet=sujet, serveur=os.getenv('NTFY_SERVEUR') or SERVEUR_PAR_DEFAUT)

    def envoyer(self, titre: str, corps: str, prioritaire: bool = False) -> None:
        requests.post(
            self.serveur,
            json={
                'topic': self.sujet,
                'title': titre,
                'message': corps,
                # 4 = haute : la notification perce le mode silencieux. Réservée
                # à ce qui t'attend vraiment, sinon elle ne veut plus rien dire.
                'priority': 4 if prioritaire else 3,
                'tags': ['raised_hand'] if prioritaire else ['white_check_mark'],
            },
            timeout=DELAI_S,
        ).raise_for_status()


def rediger_bilan(publiees: list[tuple[str, str]], reactions: list[str],
                  laissees: list[tuple[str, str]], echecs: list[tuple[str, str]],
                  publie: bool) -> tuple[str, str, bool]:
    """Le titre, le corps et l'urgence de la notification. Pur, pour être vérifiable.

    Le titre porte le seul chiffre qui décide si on ouvre : combien de
    commentaires attendent une réponse écrite à la main. Les raisons, elles,
    n'y sont pas — voir la décision 4 en tête de fichier.

    Les réactions sont comptées, pas listées : elles sont le cas courant, et
    une notification qui déroule vingt prénoms ne se lit plus.
    """
    mode = '' if publie else ' (simulation)'

    if laissees:
        pluriel = 's' if len(laissees) > 1 else ''
        titre = f'{len(laissees)} commentaire{pluriel} t’attend{pluriel}{mode}'
    else:
        titre = f'Rien pour toi{mode}'

    lignes = []
    if laissees:
        lignes.append('À toi : ' + ', '.join(auteur for auteur, _ in laissees))

    faits = []
    if reactions:
        faits.append(f'{len(reactions)} réaction' + ('s' if len(reactions) > 1 else ''))
    if publiees:
        pluriel = 's' if len(publiees) > 1 else ''
        faits.append(f'{len(publiees)} réponse{pluriel}')
    if faits:
        lignes.append(', '.join(faits) + ('' if publie else ' (rien n’a été envoyé)'))

    if echecs:
        pluriel = 's' if len(echecs) > 1 else ''
        lignes.append(f'{len(echecs)} échec{pluriel} — à regarder dans le journal')

    return titre, '\n'.join(lignes), bool(laissees)
