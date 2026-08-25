#!/usr/bin/env python3
"""Accès à l'API Graph : lire les commentaires, aimer, répondre.

Quatre décisions tiennent ce fichier :

1. **L'adresse est celle de l'API, pas celle du site.** `facebook.com` sert des
   pages HTML ; un appel qui vise cette adresse ne renvoie jamais de JSON, et
   l'erreur qui s'ensuit ressemble à s'y méprendre à un problème de jeton. Tout
   passe par `graph.facebook.com`, et par un numéro de version **explicite** :
   Facebook retire une version après environ deux ans, et une requête sans
   numéro se fait servir la plus ancienne encore vivante — donc un jour, une
   autre que la veille, sans prévenir.
2. **La lecture demande les réponses déjà présentes.** Sans elles, la toute
   première exécution répondrait à un historique entier déjà traité à la main :
   le compteur local des commentaires traités est vide, mais Facebook, lui, se
   souvient.
3. **Le « j'aime » peut échouer seul.** Il demande une permission de plus que la
   réponse, et il est accessoire : son échec se signale, il n'annule rien.
4. **Rien n'est envoyé en JSON.** L'API Graph attend un formulaire ; un corps
   JSON passe parfois, et se fait ignorer silencieusement le reste du temps —
   la requête répond 200 et le commentaire n'est jamais publié.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests

VERSION_PAR_DEFAUT = 'v23.0'   # encore servie ; à relever quand Facebook l'annonce éteinte
DELAI_S = 20


class ErreurGraph(RuntimeError):
    """L'API a répondu autre chose que ce qui était demandé."""


@dataclass(frozen=True)
class Commentaire:
    """Un commentaire de membre, tel qu'on a besoin de le connaître pour décider."""
    id: str
    auteur: str
    texte: str
    publie_le: str = ''
    de_nous: bool = False          # écrit par le compte qui fait tourner le script
    deja_repondu: bool = False     # une réponse de ce même compte existe déjà dessous


def extraire_commentaires(charge: dict, notre_id: str | None) -> list[Commentaire]:
    """Aplatit la réponse de `/{id}/feed` en une liste de commentaires.

    Fonction pure, et c'est volontaire : c'est la forme de la charge utile qui
    change d'une version d'API à l'autre, donc c'est elle qu'il faut pouvoir
    vérifier sans réseau.
    """
    commentaires: list[Commentaire] = []

    for publication in charge.get('data', []):
        for brut in publication.get('comments', {}).get('data', []):
            texte = brut.get('message', '')
            if not texte:
                continue  # une photo ou un autocollant seuls : rien à quoi répondre

            auteur = brut.get('from', {}) or {}
            reponses = brut.get('comments', {}).get('data', [])

            commentaires.append(Commentaire(
                id=brut['id'],
                auteur=auteur.get('name', 'Anonyme'),
                texte=texte,
                publie_le=brut.get('created_time', ''),
                de_nous=bool(notre_id) and auteur.get('id') == notre_id,
                deja_repondu=any(
                    (r.get('from', {}) or {}).get('id') == notre_id
                    for r in reponses
                ) if notre_id else False,
            ))

    return commentaires


class Graph:
    """Le strict nécessaire de l'API Graph : lire, aimer, répondre."""

    def __init__(self, jeton: str, id_source: str, version: str = VERSION_PAR_DEFAUT):
        self.jeton = jeton
        self.id_source = id_source
        self.base = f'https://graph.facebook.com/{version}'
        self.session = requests.Session()

    def _lire(self, chemin: str, **params) -> dict:
        reponse = self.session.get(
            f'{self.base}/{chemin}',
            params={'access_token': self.jeton, **params},
            timeout=DELAI_S,
        )
        return self._depouiller(reponse)

    def _ecrire(self, chemin: str, **champs) -> dict:
        reponse = self.session.post(
            f'{self.base}/{chemin}',
            data={'access_token': self.jeton, **champs},
            timeout=DELAI_S,
        )
        return self._depouiller(reponse)

    @staticmethod
    def _depouiller(reponse: requests.Response) -> dict:
        try:
            charge = reponse.json()
        except ValueError:
            # Une page HTML en guise de réponse : presque toujours une mauvaise
            # adresse de base. Le dire franchement évite une heure de recherche
            # du côté du jeton.
            raise ErreurGraph(
                f'réponse illisible ({reponse.status_code}) — '
                f"l'adresse interrogée sert-elle bien l'API Graph ?"
            ) from None

        if 'error' in charge:
            erreur = charge['error']
            raise ErreurGraph(
                f"{erreur.get('message', 'erreur inconnue')} "
                f"(type {erreur.get('type', '?')}, code {erreur.get('code', '?')})"
            )
        if not reponse.ok:
            raise ErreurGraph(f'code HTTP {reponse.status_code}')

        return charge

    def identite(self) -> str | None:
        """L'identifiant du compte qui parle, ou None s'il reste hors de portée.

        Il sert à ne pas se répondre à soi-même. Sans lui le script fonctionne,
        mais aveugle sur ce point : l'appelant est prévenu et décide.
        """
        try:
            return self._lire('me', fields='id').get('id')
        except (ErreurGraph, requests.RequestException):
            return None

    def commentaires(self, notre_id: str | None, publications: int = 5,
                     par_publication: int = 25) -> list[Commentaire]:
        charge = self._lire(
            f'{self.id_source}/feed',
            fields=(
                f'comments.limit({par_publication})'
                '{id,message,created_time,from,comments.limit(25){from}}'
            ),
            limit=publications,
        )
        return extraire_commentaires(charge, notre_id)

    def repondre(self, id_commentaire: str, message: str) -> str:
        return self._ecrire(f'{id_commentaire}/comments', message=message).get('id', '')

    def aimer(self, id_commentaire: str) -> None:
        self._ecrire(f'{id_commentaire}/likes')
