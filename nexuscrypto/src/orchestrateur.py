#!/usr/bin/env python3
"""L'assemblage : ingestion → décision → risque → exécution → alerte.

Ce fichier est le seul qui connaisse tous les modules à la fois, et c'est
voulu : partout ailleurs, un module ne connaît que la couche du dessous. C'est
ce qui permet de remplacer le courtier réel par le courtier papier, ou les
sources en direct par des données rejouées, sans toucher à une ligne de
stratégie.

Une **passe** est le cycle complet sur tous les actifs. La boucle en enchaîne
une par `periode_boucle_secondes`. Une passe qui échoue n'arrête pas la boucle —
elle incrémente le compteur d'échecs réseau du coupe-circuit, qui finira par
couper si le problème dure. C'est la seule façon d'obtenir un processus qui
tient des semaines sans surveillance.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime

from .core.config import Config
from .core.journal import obtenir
from .core.modeles import (
    Action, Contexte, Execution, Mode, Portefeuille, maintenant as instant,
)
from .core.reseau import ClientHTTP, ErreurReseau
from .data_engine.agregateur import Agregateur
from .data_engine.macro import IngestionMacro
from .data_engine.marche import MarcheCCXT, MarcheHyperliquid
from .data_engine.onchain import IngestionOnchain, SourceDeFiLlama, SourceDexScreener
from .data_engine.sentiment import IngestionSentiment, SourceFearGreed, SourceReddit
from .execution.courtier import Courtier, CourtierCCXT, CourtierPapier
from .execution.gestionnaire import Gestionnaire
from .notifications import canaux as canaux_module, messages
from .risk_management import coupe_circuit as cc
from .risk_management import portefeuille as pf
from .risk_management import stops
from .strategy.moteur import Analyse, Moteur

_journal = obtenir("orchestrateur")


@dataclass
class Etat:
    """Ce que l'orchestrateur porte d'une passe à l'autre."""

    portefeuille: Portefeuille
    executions_du_jour: list[Execution] = field(default_factory=list)
    jour_courant: int = -1
    dernier_recapitulatif: int = -1


class Orchestrateur:
    def __init__(
        self,
        config: Config,
        *,
        agregateur: Agregateur,
        courtier: Courtier,
        notificateur: canaux_module.Notificateur,
        client: ClientHTTP | None = None,
    ) -> None:
        self.config = config
        self.agregateur = agregateur
        self.notificateur = notificateur
        self.client = client
        self.moteur = Moteur(config)
        depart = instant()
        self.coupe_circuit = cc.depuis_config(
            config.risque.coupe_circuit, config.portefeuille.capital_initial_usd, depart
        )
        self.gestionnaire = Gestionnaire(config, courtier, self.coupe_circuit)
        self.etat = Etat(
            portefeuille=Portefeuille(
                liquidites_usd=config.portefeuille.capital_initial_usd,
                devise=config.general.devise,
            ),
            jour_courant=depart.toordinal(),
        )

    # ----------------------------------------------------------------------
    # Une passe
    # ----------------------------------------------------------------------

    async def une_passe(self, maintenant: datetime | None = None) -> list[Analyse]:
        maintenant = maintenant or instant()
        self._changer_de_jour(maintenant)

        plateformes = {
            symbole: ligne.plateforme
            for symbole, ligne in self.config.portefeuille.allocation.items()
        }
        try:
            contextes = await self.agregateur.tous(
                self.config.portefeuille.symboles,
                intervalle=self.config.general.intervalle_bougies,
                profondeur=self.config.general.profondeur_bougies,
                maintenant=maintenant,
                plateformes=plateformes,
            )
            self.coupe_circuit.signaler_succes_reseau()
        except ErreurReseau as erreur:
            self.coupe_circuit.signaler_echec_reseau()
            _journal.warning("Passe sans données : %s", erreur)
            contextes = {}

        if not contextes:
            self.coupe_circuit.signaler_echec_reseau()
            await self._verifier_coupe_circuit(maintenant, {}, {})
            return []

        prix = {symbole: contexte.prix for symbole, contexte in contextes.items()}
        variations = {
            symbole: contexte.serie.clotures[-1] / contexte.serie.clotures[-2] - 1.0
            for symbole, contexte in contextes.items()
            if len(contexte.serie) >= 2
        }
        await self._verifier_coupe_circuit(maintenant, prix, variations, contextes)

        analyses: list[Analyse] = []
        for symbole in self._ordre_de_service(prix):
            contexte = contextes.get(symbole)
            if contexte is None:
                continue
            analyse = self.moteur.analyser(contexte, self.etat.portefeuille, maintenant)
            analyses.append(analyse)
            await self._appliquer(analyse, prix, maintenant)

        await self._recapitulatif_si_lheure(maintenant, prix)
        return analyses

    def _ordre_de_service(self, prix: dict[str, float]) -> list[str]:
        """Sert d'abord la ligne la plus sous-pondérée.

        Quand la trésorerie ne suffit pas pour tout, cet ordre décide qui est
        servi. L'ordre du fichier de configuration servirait Bitcoin en premier
        tous les mois et laisserait la ligne la plus en retard toujours en
        retard.
        """

        derives = pf.derives(self.etat.portefeuille, prix, self.config.portefeuille)
        return [d.actif for d in derives]

    async def _appliquer(
        self, analyse: Analyse, prix: dict[str, float], maintenant: datetime
    ) -> None:
        decision = analyse.decision
        contexte = analyse.contexte

        if decision.action is Action.SORTIR:
            position = self.etat.portefeuille.positions.get(decision.actif)
            if position is None:
                return
            resultat = await self.gestionnaire.vendre(
                decision.actif,
                position.quantite,
                self.etat.portefeuille,
                prix_reference=decision.prix_reference,
                motif=" ; ".join(decision.raisons),
                carnet=contexte.carnet,
            )
            if resultat.accepte and resultat.execution:
                self.etat.portefeuille = resultat.portefeuille
                self.etat.executions_du_jour.append(resultat.execution)
                await self.notificateur.diffuser(
                    messages.ordre_execute(resultat.execution, simule=self.config.simule),
                    categorie="ordre",
                )
            return

        if decision.action not in (Action.ACHETER, Action.RENFORCER):
            if decision.action is Action.TEMPORISER:
                await self.notificateur.diffuser(messages.signal(decision), categorie="signal")
            return

        ligne = self.config.portefeuille.allocation.get(decision.actif)
        plafond = (
            self.config.portefeuille.plafond_par_jeton_usd
            if ligne and ligne.role == "pepite"
            else None
        )
        stop = stops.stop_initial(decision.prix_reference, analyse.lecture.atr, self.config.risque)

        resultat = await self.gestionnaire.acheter(
            decision,
            self.etat.portefeuille,
            prix=prix,
            stop=stop,
            carnet=contexte.carnet,
            plafond_specifique_usd=plafond,
        )
        if resultat.accepte and resultat.execution:
            self.etat.portefeuille = resultat.portefeuille
            self.etat.executions_du_jour.append(resultat.execution)
            # Le calendrier n'avance qu'après une exécution réussie : un refus
            # pour trésorerie insuffisante ne doit pas consommer l'échéance.
            self.moteur.marquer_dca(decision.actif, maintenant)
            await self.notificateur.diffuser(
                messages.ordre_execute(resultat.execution, simule=self.config.simule),
                categorie="ordre",
            )
        else:
            _journal.info("%s : achat non passé — %s", decision.actif, resultat.motif)
            await self.notificateur.diffuser(messages.signal(decision), categorie="signal")

    async def _verifier_coupe_circuit(
        self,
        maintenant: datetime,
        prix: dict[str, float],
        variations: dict[str, float],
        contextes: dict[str, Contexte] | None = None,
    ) -> None:
        gravite = max(
            (c.gravite_macro for c in (contextes or {}).values()),
            default=None,
        )
        declenchement = self.coupe_circuit.observer(
            maintenant=maintenant,
            valeur_portefeuille=self.etat.portefeuille.valeur_totale(prix),
            variations_1h=variations,
            **({"gravite_macro": gravite} if gravite is not None else {}),
        )
        if declenchement is not None:
            _journal.error("Coupe-circuit : %s", declenchement.message)
            await self.notificateur.diffuser(
                messages.coupe_circuit(declenchement), categorie="coupe_circuit"
            )

    def _changer_de_jour(self, maintenant: datetime) -> None:
        if maintenant.toordinal() != self.etat.jour_courant:
            self.etat.jour_courant = maintenant.toordinal()
            self.etat.executions_du_jour = []

    async def _recapitulatif_si_lheure(
        self, maintenant: datetime, prix: dict[str, float]
    ) -> None:
        heure = self.config.notifications.heure_recapitulatif
        if maintenant.hour < heure or self.etat.dernier_recapitulatif == maintenant.toordinal():
            return
        self.etat.dernier_recapitulatif = maintenant.toordinal()
        await self.notificateur.diffuser(
            messages.recapitulatif(
                self.etat.portefeuille,
                prix,
                capital_initial=self.config.portefeuille.capital_initial_usd,
                executions_du_jour=self.etat.executions_du_jour,
                date=maintenant,
                simule=self.config.simule,
            ),
            categorie="recapitulatif",
        )

    # ----------------------------------------------------------------------
    # Fermeture
    # ----------------------------------------------------------------------

    async def fermer(self) -> None:
        """Referme tout ce qui tient une connexion.

        Trois familles, et chacune se plaint différemment quand on l'oublie :
        CCXT écrit un paragraphe entier sur la sortie d'erreur, `aiohttp` un
        « Unclosed client session » qui arrive *après* la trace utile, et un
        processus qui redémarre en boucle finit par épuiser ses descripteurs.
        Une seule méthode, appelée dans un `finally`, plutôt que trois
        fermetures dispersées dont l'une sera oubliée.
        """

        for source in self.agregateur.marches.values():
            fermeture = getattr(source, "fermer", None)
            if callable(fermeture):
                try:
                    await fermeture()
                except Exception as erreur:  # une fermeture ratée n'en empêche pas d'autres
                    _journal.debug("Fermeture de %s : %s", getattr(source, "nom", source), erreur)

        fermeture = getattr(self.gestionnaire.courtier, "fermer", None)
        if callable(fermeture):
            try:
                await fermeture()
            except Exception as erreur:
                _journal.debug("Fermeture du courtier : %s", erreur)

        if self.client is not None:
            await self.client.fermer()

    # ----------------------------------------------------------------------
    # La boucle
    # ----------------------------------------------------------------------

    async def boucler(self, passes_max: int | None = None) -> None:
        """Tourne jusqu'à interruption. `passes_max` sert aux tests et au mode
        `--une-passe` ; en production il vaut `None`."""

        passe = 0
        while passes_max is None or passe < passes_max:
            passe += 1
            debut = instant()
            try:
                await self.une_passe(debut)
            except asyncio.CancelledError:
                raise
            except Exception as erreur:  # une passe ratée n'arrête pas la boucle
                _journal.exception("Passe %d en échec : %s", passe, erreur)
                self.coupe_circuit.signaler_echec_reseau()
            if passes_max is not None and passe >= passes_max:
                break
            ecoule = (instant() - debut).total_seconds()
            await asyncio.sleep(max(self.config.general.periode_boucle_secondes - ecoule, 1.0))


# --------------------------------------------------------------------------
# Construction depuis la configuration
# --------------------------------------------------------------------------


async def construire(config: Config) -> Orchestrateur:
    """Assemble tout depuis la configuration. Le seul endroit où les
    dépendances lourdes — `aiohttp`, `ccxt` — sont réellement chargées."""

    client = ClientHTTP(config.reseau)
    await client.ouvrir()
    try:
        return await _assembler(config, client)
    except Exception:
        # Sans ce rattrapage, une dépendance manquante laisse la session
        # `aiohttp` ouverte et Python le signale par un « Unclosed client
        # session » qui arrive *après* la trace — donc sous les yeux de
        # quelqu'un qui cherche déjà la vraie cause plus haut.
        await client.fermer()
        raise


async def _assembler(config: Config, client: ClientHTTP) -> Orchestrateur:
    marche_config = config.sources.get("marche") or {}
    marches: dict[str, object] = {}
    for plateforme in marche_config.get("plateformes", ["binance"]):
        cle = config.secrets.get(f"{plateforme.upper()}_API_KEY")
        secret = config.secrets.get(f"{plateforme.upper()}_API_SECRET")
        marches[plateforme] = MarcheCCXT(plateforme, cle=cle, secret=secret)
    marches["hyperliquid"] = MarcheHyperliquid(
        fetcher=client,
        url=marche_config.get("hyperliquid_api", "https://api.hyperliquid.xyz/info"),
    )

    onchain_config = config.sources.get("onchain") or {}
    ingestion_onchain = IngestionOnchain(
        defillama=SourceDeFiLlama(
            client, base=onchain_config.get("defillama_api", "https://api.llama.fi")
        ),
        dexscreener=SourceDexScreener(
            client,
            base=onchain_config.get("dexscreener_api", "https://api.dexscreener.com/latest/dex"),
        ),
        protocoles=onchain_config.get("protocoles") or {},
    )

    sentiment_config = config.sources.get("sentiment") or {}
    ingestion_sentiment = IngestionSentiment(
        fear_greed=SourceFearGreed(
            client, url=sentiment_config.get("fear_greed_api", "https://api.alternative.me/fng/")
        ),
        reddit=SourceReddit(
            client,
            url=sentiment_config.get(
                "reddit_api", "https://www.reddit.com/r/CryptoCurrency/hot.json"
            ),
        ),
        mentions_minimum=int(sentiment_config.get("mentions_minimum", 15)),
    )

    macro_config = config.sources.get("macro") or {}
    ingestion_macro = IngestionMacro(
        fetcher=client,
        flux=macro_config.get("flux_rss") or (),
        fenetre_heures=float(macro_config.get("fenetre_heures", 24)),
    )

    agregateur = Agregateur(
        marches=marches,  # type: ignore[arg-type]
        marche_defaut=marche_config.get("plateforme_defaut", "binance"),
        onchain=ingestion_onchain,
        sentiment=ingestion_sentiment,
        ingestion_macro=ingestion_macro,
        profondeur_carnet=int(marche_config.get("profondeur_carnet", 20)),
    )

    if config.mode is Mode.REEL:
        plateforme = config.execution.plateforme
        courtier: Courtier = CourtierCCXT(
            plateforme,
            config.secrets.get(f"{plateforme.upper()}_API_KEY") or "",
            config.secrets.get(f"{plateforme.upper()}_API_SECRET") or "",
            config.execution,
        )
    else:
        courtier = CourtierPapier(config.execution)

    notificateur = canaux_module.construire(config, client)
    return Orchestrateur(
        config,
        agregateur=agregateur,
        courtier=courtier,
        notificateur=notificateur,
        client=client,
    )
