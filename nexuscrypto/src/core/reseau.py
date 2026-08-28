#!/usr/bin/env python3
"""Le seul endroit du système qui parle au réseau.

Trois raisons de le concentrer ici plutôt que de laisser chaque source appeler
`aiohttp` de son côté :

1. **Le débit est global, pas local.** Cinq sources qui respectent chacune sa
   limite en dépassent une sixième, celle de la machine vue de l'extérieur. Le
   limiteur est donc partagé, et c'est le client qui le porte.
2. **Une panne de source n'est pas une panne de système.** Toutes les erreurs
   sortent typées, et l'agrégateur décide seul de ce qu'il fait d'une source
   muette — il continue avec un score partiel plutôt que de s'arrêter.
3. **Les tests ne doivent rien installer.** Les sources ne dépendent pas de ce
   client mais du protocole `Fetcher` ci-dessous : un dictionnaire rejoué
   suffit à traverser toute la chaîne d'ingestion, sans `aiohttp` et sans
   réseau.

`aiohttp` est importé à la construction du client, pas au chargement du module.
C'est ce qui permet d'importer ce fichier dans une session où rien n'est
installé — pour lire la configuration, par exemple, ou pour faire tourner la
stratégie sur des données enregistrées.
"""

from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping, Protocol

from .config import ConfigReseau


class ErreurReseau(Exception):
    """Racine de tout ce qui peut mal tourner en sortant de la machine."""


class ErreurTemporaire(ErreurReseau):
    """Délai dépassé, coupure, 5xx : ça vaut la peine de réessayer."""


class ErreurPermanente(ErreurReseau):
    """4xx hors 429 : réessayer ne changera rien, et coûte du quota."""


class ErreurDebit(ErreurTemporaire):
    """429. Temporaire, mais avec une attente imposée par le serveur qu'il faut
    respecter plutôt que d'appliquer notre propre repli — un serveur qui dit
    « reviens dans 30 s » et qu'on rappelle à 2 s bannit l'adresse."""

    def __init__(self, message: str, attendre_secondes: float | None = None) -> None:
        super().__init__(message)
        self.attendre_secondes = attendre_secondes


class Fetcher(Protocol):
    """Ce dont une source a besoin, et rien de plus.

    Toutes les sources reçoivent un `Fetcher` en paramètre. En production c'est
    `ClientHTTP` ; dans les tests c'est un objet de dix lignes qui rend des
    réponses enregistrées. Aucune source n'importe `aiohttp`.
    """

    async def json(
        self, url: str, *, params: Mapping[str, Any] | None = None,
        entetes: Mapping[str, str] | None = None, corps: Any = None,
    ) -> Any: ...

    async def texte(
        self, url: str, *, params: Mapping[str, Any] | None = None,
        entetes: Mapping[str, str] | None = None,
    ) -> str: ...


@dataclass
class Limiteur:
    """Seau à jetons, partagé par toutes les sources.

    Volontairement simple : une fenêtre glissante d'une minute et une liste
    d'horodatages. Un algorithme plus fin n'apporterait rien à quarante-cinq
    requêtes par minute, et celui-ci se relit en dix secondes.
    """

    requetes_par_minute: int
    _horodatages: list[float] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self._horodatages = []
        self._verrou = asyncio.Lock()

    async def attendre_son_tour(self, dormir: Callable[[float], Awaitable[None]] | None = None) -> None:
        dormir = dormir or asyncio.sleep
        async with self._verrou:
            while True:
                maintenant = time.monotonic()
                self._horodatages = [h for h in self._horodatages if maintenant - h < 60.0]
                if len(self._horodatages) < self.requetes_par_minute:
                    self._horodatages.append(maintenant)
                    return
                repos = 60.0 - (maintenant - self._horodatages[0]) + 0.01
                await dormir(max(repos, 0.01))


class ClientHTTP:
    """Client asynchrone : délai, reprise avec repli exponentiel, limiteur.

    Le repli est exponentiel *avec bruit* : sans le bruit, quatre sources qui
    échouent au même instant réessaient toutes exactement au même instant, et
    le serveur qui était surchargé le reste.
    """

    def __init__(
        self,
        config: ConfigReseau | None = None,
        *,
        limiteur: Limiteur | None = None,
        dormir: Callable[[float], Awaitable[None]] | None = None,
        alea: random.Random | None = None,
    ) -> None:
        self.config = config or ConfigReseau()
        self.limiteur = limiteur or Limiteur(self.config.requetes_par_minute)
        self._dormir = dormir or asyncio.sleep
        self._alea = alea or random.Random()
        self._session: Any = None
        self.echecs_consecutifs = 0

    async def __aenter__(self) -> "ClientHTTP":
        await self.ouvrir()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.fermer()

    async def ouvrir(self) -> None:
        if self._session is not None:
            return
        try:
            import aiohttp
        except ImportError as erreur:  # pragma: no cover - dépend de l'installation
            raise ErreurReseau(
                "aiohttp n'est pas installé : `pip install -r requirements.txt`. "
                "Le cœur du moteur tourne sans lui ; seule l'ingestion en direct en a besoin."
            ) from erreur
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.delai_secondes),
            headers={"User-Agent": self.config.agent_utilisateur},
        )

    async def fermer(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    async def json(
        self, url: str, *, params: Mapping[str, Any] | None = None,
        entetes: Mapping[str, str] | None = None, corps: Any = None,
    ) -> Any:
        return await self._appeler(url, params=params, entetes=entetes, corps=corps, format="json")

    async def texte(
        self, url: str, *, params: Mapping[str, Any] | None = None,
        entetes: Mapping[str, str] | None = None,
    ) -> str:
        return await self._appeler(url, params=params, entetes=entetes, corps=None, format="texte")

    async def _appeler(
        self, url: str, *, params: Mapping[str, Any] | None,
        entetes: Mapping[str, str] | None, corps: Any, format: str,
    ) -> Any:
        await self.ouvrir()
        attente = self.config.attente_initiale_secondes
        derniere: Exception | None = None

        for tentative in range(1, self.config.tentatives + 1):
            await self.limiteur.attendre_son_tour(self._dormir)
            try:
                resultat = await self._une_fois(url, params, entetes, corps, format)
                self.echecs_consecutifs = 0
                return resultat
            except ErreurPermanente:
                # Réessayer un 404 ou un 401 ne fait que brûler du quota et
                # retarder le moment où l'on saura que la source est perdue.
                self.echecs_consecutifs += 1
                raise
            except ErreurTemporaire as erreur:
                derniere = erreur
                if tentative == self.config.tentatives:
                    break
                impose = getattr(erreur, "attendre_secondes", None)
                repos = impose if impose is not None else attente * (1 + self._alea.random() * 0.3)
                await self._dormir(repos)
                attente *= 2

        self.echecs_consecutifs += 1
        raise ErreurTemporaire(
            f"{url} : {self.config.tentatives} tentatives, toujours en échec ({derniere})."
        ) from derniere

    async def _une_fois(
        self, url: str, params: Mapping[str, Any] | None,
        entetes: Mapping[str, str] | None, corps: Any, format: str,
    ) -> Any:
        import aiohttp

        methode = self._session.post if corps is not None else self._session.get
        arguments: dict[str, Any] = {"params": params, "headers": dict(entetes or {})}
        if corps is not None:
            arguments["json"] = corps
        try:
            async with methode(url, **arguments) as reponse:
                if reponse.status == 429:
                    entete = reponse.headers.get("Retry-After")
                    raise ErreurDebit(
                        f"{url} : débit dépassé.",
                        float(entete) if entete and entete.isdigit() else None,
                    )
                if 500 <= reponse.status < 600:
                    raise ErreurTemporaire(f"{url} : {reponse.status} côté serveur.")
                if 400 <= reponse.status < 500:
                    raise ErreurPermanente(f"{url} : {reponse.status}, requête refusée.")
                if format == "json":
                    # `content_type=None` parce que plusieurs API renvoient du
                    # JSON annoncé « text/plain » — DexScreener l'a fait, et
                    # aiohttp lève alors sur une réponse pourtant valide.
                    return await reponse.json(content_type=None)
                return await reponse.text()
        except asyncio.TimeoutError as erreur:
            raise ErreurTemporaire(f"{url} : délai de {self.config.delai_secondes} s dépassé.") from erreur
        except aiohttp.ClientError as erreur:
            raise ErreurTemporaire(f"{url} : {type(erreur).__name__} — {erreur}.") from erreur


async def rassembler(
    taches: Mapping[str, Awaitable[Any]],
) -> tuple[dict[str, Any], dict[str, Exception]]:
    """Lance tout de front et sépare ce qui a répondu de ce qui a échoué.

    C'est la brique qui rend le système tolérant : une source en panne remplit
    le second dictionnaire, les autres remplissent le premier, et personne ne
    s'arrête. `return_exceptions=True` est indispensable — sans lui, la
    première source morte annule les quatre autres, déjà à moitié téléchargées.
    """

    noms = list(taches)
    resultats = await asyncio.gather(*(taches[n] for n in noms), return_exceptions=True)
    reussites: dict[str, Any] = {}
    pannes: dict[str, Exception] = {}
    for nom, resultat in zip(noms, resultats):
        if isinstance(resultat, Exception):
            pannes[nom] = resultat
        else:
            reussites[nom] = resultat
    return reussites, pannes
