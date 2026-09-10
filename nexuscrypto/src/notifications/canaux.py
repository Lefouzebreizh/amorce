#!/usr/bin/env python3
"""Canaux d'alerte : console, Discord.

**Pas de bibliothèque Discord.** Ce qu'on fait ici tient en une requête POST
par message. La bibliothèque officielle apporte une boucle d'événements, un
gestionnaire de mises à jour et une vingtaine de dépendances transitives pour
un usage qui n'en emploie rien — le bot n'écoute personne, il annonce. C'est
la même décision que le radar `pepites/` du dépôt, et pour la même raison.

**Un canal qui tombe n'arrête pas le bot.** Une alerte perdue est regrettable ;
un moteur de trading qui s'interrompt parce qu'un canal a hoqueté est bien
pire. Toutes les erreurs d'envoi sont donc rattrapées et journalisées.

**Telegram a été retiré le 10/09/2026**, sur décision explicite du
propriétaire : ce que le bot a à dire doit se lire directement dans une
session Claude, pas dans une application tierce qu'il faut ouvrir à côté. Le
canal `console` — capturé par le journal — reste le canal par défaut et
suffit à cet usage.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from ..core.journal import obtenir
from ..core.reseau import ErreurReseau, Fetcher

_journal = obtenir("notifications")


class Canal(Protocol):
    nom: str

    async def envoyer(self, message: str) -> bool: ...


@dataclass
class CanalConsole:
    """Le canal par défaut, et le seul qui ne peut pas tomber."""

    nom: str = "console"

    async def envoyer(self, message: str) -> bool:
        print(f"\n{message}\n", flush=True)
        return True


@dataclass
class CanalDiscord:
    """Crochet entrant Discord. Limite de 2000 caractères, pas 4096."""

    url_crochet: str
    fetcher: Fetcher
    nom: str = "discord"

    async def envoyer(self, message: str) -> bool:
        try:
            await self.fetcher.json(self.url_crochet, corps={"content": message[:1900]})
            return True
        except ErreurReseau as erreur:
            _journal.warning("Discord injoignable, alerte perdue : %s", erreur)
            return False


@dataclass
class Notificateur:
    """Diffuse sur tous les canaux configurés, et filtre par catégorie.

    Le filtre est la partie utile : sans lui, un système qui alerte sur chaque
    signal envoie quarante messages par jour, ils cessent d'être lus au
    troisième, et le jour où le coupe-circuit se déclenche personne ne le voit.
    """

    canaux: Sequence[Canal]
    categories: frozenset[str] = frozenset(
        {"signal", "ordre", "coupe_circuit", "recapitulatif", "pepite"}
    )

    async def diffuser(self, message: str, *, categorie: str = "signal") -> int:
        if categorie not in self.categories:
            return 0
        envoyes = 0
        for canal in self.canaux:
            try:
                if await canal.envoyer(message):
                    envoyes += 1
            except Exception as erreur:  # un canal ne doit jamais faire tomber la boucle
                _journal.warning("Canal %s en échec : %s", canal.nom, erreur)
        return envoyes


def construire(config, fetcher: Fetcher | None) -> Notificateur:
    """Assemble les canaux depuis la configuration.

    Un canal demandé mais dont le secret manque est écarté avec un avertissement
    plutôt qu'une exception : le chargeur de configuration a déjà refusé ce cas
    au démarrage, et arriver ici veut dire qu'on tourne en mode dégradé voulu.
    """

    canaux: list[Canal] = []
    for nom in config.notifications.canaux:
        if nom == "console":
            canaux.append(CanalConsole())
        elif nom == "discord":
            url = config.secrets.get("DISCORD_WEBHOOK_URL")
            if url and fetcher is not None:
                canaux.append(CanalDiscord(url_crochet=url, fetcher=fetcher))
            else:
                _journal.warning("Canal Discord demandé mais indisponible : ignoré.")
    if not canaux:
        canaux.append(CanalConsole())
    return Notificateur(
        canaux=canaux,
        categories=frozenset(config.notifications.alerter_sur) | {"pepite"},
    )
