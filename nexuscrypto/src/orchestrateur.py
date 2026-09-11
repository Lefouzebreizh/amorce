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
    Action, Contexte, Decision, Execution, Mode, Portefeuille, Score, maintenant as instant,
)
from .core.reseau import ClientHTTP, ErreurReseau
from .data_engine.agregateur import Agregateur
from .data_engine.macro import IngestionMacro
from .data_engine.marche import MarcheCCXT, MarcheHyperliquid
from .data_engine.onchain import (
    IngestionOnchain, SourceDeFiLlama, SourceDexScreener, candidat_depuis_paire,
)
from .data_engine.sentiment import IngestionSentiment, SourceFearGreed, SourceReddit
from .execution.courtier import Courtier, CourtierCCXT, CourtierPapier
from .execution.gestionnaire import Gestionnaire
from .notifications import canaux as canaux_module, messages
from .risk_management import coupe_circuit as cc
from .risk_management import portefeuille as pf
from .risk_management import stops
from .strategy import pepites as pepites_module
from .strategy.moteur import Analyse, Moteur

_journal = obtenir("orchestrateur")


@dataclass
class Etat:
    """Ce que l'orchestrateur porte d'une passe à l'autre."""

    portefeuille: Portefeuille
    executions_du_jour: list[Execution] = field(default_factory=list)
    jour_courant: int = -1
    dernier_recapitulatif: int = -1
    # Mémoire propre aux pépites du scanner : `actif -> (chaine, adresse)`.
    # Nécessaire parce que `Position` ne porte pas ces deux champs — les y
    # ajouter cascaderait jusqu'à `Ordre`/`Execution`/`execution/courtier.py`,
    # qu'aucune session ne touche (voir CLAUDE.md). Une ligne de watchlist n'a
    # pas besoin de cette mémoire : sa chaîne/adresse vit dans la configuration
    # et `strategy/moteur.py` la relit à chaque passe.
    pepites_suivies: dict[str, tuple[str, str]] = field(default_factory=dict)


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
            for symbole, ligne in self.config.portefeuille.watchlist.items()
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
        # Rafraîchir le prix des pépites détenues **avant** le coupe-circuit :
        # trouvé par `garde-du-bot` en relisant ce lot, `prix` ne portait sinon
        # jamais la valeur réelle d'une pépite tant qu'elle n'était pas vendue —
        # le garde-fou de portefeuille agrégé restait aveugle à sa perte
        # latente, exactement sur la classe d'actifs la plus volatile de la
        # boucle. Voir `_evaluer_sorties_pepites`.
        await self._evaluer_sorties_pepites(maintenant, prix)
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

        await self._decouvrir_pepites(maintenant, prix)
        await self._recapitulatif_si_lheure(maintenant, prix)
        return analyses

    def _ordre_de_service(self, prix: dict[str, float]) -> list[str]:
        """Sert d'abord la ligne la moins engagée — voir
        `risk_management.portefeuille.ordre_par_engagement`."""

        return pf.ordre_par_engagement(
            self.etat.portefeuille, prix, self.config.portefeuille.symboles
        )

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
            return

        ligne = self.config.portefeuille.watchlist.get(decision.actif)
        # Un actif de la watchlist qui porte son propre plafond l'utilise ;
        # un actif absent de la watchlist — donc découvert par le scanner de
        # pépites — utilise le plafond générique des jetons découverts.
        plafond = (
            ligne.plafond_usd if ligne is not None
            else self.config.strategie.pepites.plafond_par_jeton_usd
        )

        # Le bouclier passe **avant** le dimensionnement et avant le courtier :
        # un jeton dont on ne peut pas sortir ne doit pas même consommer un
        # calcul de taille. « Pas d'adresse, pas de bouclier » le rend
        # inoffensif sur un actif établi (BTC, ETH...) qui n'en désigne pas —
        # et la chaîne/adresse vivent désormais sur la décision elle-même,
        # jamais retrouvées après coup sur la seule ligne de watchlist.
        if not await self._bouclier_autorise(decision):
            return

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
            await self.notificateur.diffuser(
                messages.ordre_execute(resultat.execution, simule=self.config.simule),
                categorie="ordre",
            )
        else:
            _journal.info("%s : achat non passé — %s", decision.actif, resultat.motif)
            await self.notificateur.diffuser(messages.signal(decision), categorie="signal")

    async def _bouclier_autorise(self, decision) -> bool:
        """Le veto de sécurité. Rend faux quand l'achat est refusé.

        `decision.chaine`/`decision.adresse` arment le bouclier — qu'elles
        viennent d'une ligne de watchlist (`strategy/moteur.py`) ou d'une
        pépite du scanner (`_passe_pepites`), sans distinction d'origine.
        C'est la correction de la mine trouvée en relisant la PR #886 :
        avant, `orchestrateur` ne relisait ces deux champs que sur la ligne de
        watchlist, ce qui aurait désactivé silencieusement le bouclier sur
        exactement les jetons pour lesquels il existe le jour où le scanner
        aurait été branché sans cette correction.

        **Un refus est annoncé, jamais silencieux.** Une pépite qui disparaît du
        flux sans un mot se lit comme une pépite que la stratégie n'a pas
        retenue, et on cherche alors du côté des seuils de notation — au mauvais
        endroit, pendant des jours.
        """

        config = self.config.strategie.bouclier
        if not config.actif:
            return True

        from .data_engine import securite as sources
        from .strategy import bouclier

        chaine = decision.chaine or "ethereum"
        adresse = decision.adresse
        if not adresse:
            # **Pas d'adresse, pas de bouclier** — et non « pas d'adresse, donc
            # refus ». La première version refusait tout : les lignes du socle
            # n'ont pas de contrat, et LINK/USDT se serait vu interdire à chaque
            # passe au motif qu'aucune source ne répondait. Un jeton nommé à la
            # main dans la watchlist est un choix délibéré sur un actif établi ;
            # ce module garde les contrats qu'on peut désigner, pas ceux-là.
            _journal.debug("%s sans adresse de contrat : bouclier non applicable",
                           decision.actif)
            return True

        constats = await sources.constats(
            self.client, chaine, adresse, delai_s=config.delai_s
        )
        verdict = bouclier.juger(constats, config, est_evm=sources.est_evm(chaine))

        autorise, motif = bouclier.achat_autorise(verdict, config)
        if not autorise:
            _journal.warning("achat refusé sur %s — %s", decision.actif, motif)
            await self.notificateur.diffuser(
                f"\u26d4 {decision.actif} — achat refusé.\n{motif}", categorie="signal",
            )
        return autorise

    async def _passe_pepites(self, maintenant: datetime, prix: dict[str, float]) -> None:
        """Le scanner de pépites, en direct — décidé le 11/09/2026 (option 1
        de `nexuscrypto/README.md` § 16 bis) : le score du scanner devient
        directement la décision d'achat, sans passer par `strategy/moteur.py`,
        qui exige une série de bougies qu'aucune plateforme CCXT ne fournit
        pour un pool DexScreener. Stop en pourcentage fixe
        (`ConfigPepites.stop_pct`), faute d'ATR calculable — les deux autres
        options (série de bougies approchée, ou attendre une vraie source
        OHLCV de pools DEX) sont écartées et leur raison est écrite au même
        endroit.

        Enchaîne les deux étages ci-dessous dans l'ordre. `une_passe()` les
        appelle séparément — le premier avant le coupe-circuit, le second
        après la boucle watchlist — mais cette méthode reste l'entrée directe
        pour qui veut les deux (les tests, notamment).
        """

        if self.client is None:
            return
        await self._evaluer_sorties_pepites(maintenant, prix)
        await self._decouvrir_pepites(maintenant, prix)

    async def _evaluer_sorties_pepites(self, maintenant: datetime, prix: dict[str, float]) -> None:
        """Rafraîchit le prix des pépites détenues et vend celles dont le
        stop (pourcentage fixe) ou la prise de bénéfice suiveuse est touché.

        Mute `prix` en place : c'est ce qui permet à `une_passe()` d'appeler
        cette méthode **avant** `_verifier_coupe_circuit`, de sorte que le
        garde-fou de portefeuille voie la vraie valeur d'une pépite plutôt que
        son prix d'achat — trouvé par `garde-du-bot` en relisant ce lot.
        """

        config = self.config.strategie.pepites
        if self.client is None:
            return

        dexscreener = SourceDexScreener(self.client)

        # `Position` ne porte pas chaîne/adresse — voir `Etat.pepites_suivies`.
        for actif, (chaine, adresse) in list(self.etat.pepites_suivies.items()):
            position = self.etat.portefeuille.positions.get(actif)
            if position is None:
                self.etat.pepites_suivies.pop(actif, None)
                continue
            try:
                paires = await dexscreener.paires_du_jeton(chaine, adresse)
            except ErreurReseau as erreur:
                _journal.info("%s : prix indisponible cette passe — %s", actif, erreur)
                continue
            meilleure = SourceDexScreener.meilleure_paire(paires)
            prix_actif = float((meilleure or {}).get("priceUsd") or 0.0)
            if prix_actif <= 0:
                continue
            prix[actif] = prix_actif
            stop = stops.stop_initial_pct(position.prix_moyen, config.stop_pct)
            sortie = stops.evaluer(
                position, prix_actif, atr=None, config=self.config.risque, stop_force=stop
            )
            if not sortie.doit_sortir:
                continue
            resultat = await self.gestionnaire.vendre(
                actif, position.quantite, self.etat.portefeuille,
                prix_reference=prix_actif, motif=sortie.raison,
            )
            if resultat.accepte and resultat.execution:
                self.etat.portefeuille = resultat.portefeuille
                self.etat.executions_du_jour.append(resultat.execution)
                self.etat.pepites_suivies.pop(actif, None)
                await self.notificateur.diffuser(
                    messages.ordre_execute(resultat.execution, simule=self.config.simule),
                    categorie="ordre",
                )

    async def _decouvrir_pepites(self, maintenant: datetime, prix: dict[str, float]) -> None:
        """Cherche de nouvelles pépites et achète la première retenue,
        s'il reste de la place et si des termes de recherche sont configurés
        — vide par défaut, voir `ConfigPepites.termes_recherche`."""

        config = self.config.strategie.pepites
        if self.client is None:
            return
        if not config.termes_recherche or len(self.etat.pepites_suivies) >= config.candidats_max:
            return

        dexscreener = SourceDexScreener(self.client)
        candidats = []
        for terme in config.termes_recherche:
            try:
                paires_brutes = await dexscreener.rechercher(terme)
            except ErreurReseau as erreur:
                _journal.info("Recherche « %s » indisponible cette passe — %s", terme, erreur)
                continue
            for brute in paires_brutes:
                candidat = candidat_depuis_paire(brute)
                if candidat is not None:
                    candidats.append(candidat)
        if not candidats:
            return

        retenues, _rejets = pepites_module.scanner(candidats, config, maintenant)
        for pepite in retenues:
            actif = f"{pepite.candidat.symbole}/{pepite.candidat.chaine}"
            if actif in self.etat.portefeuille.positions or actif in self.etat.pepites_suivies:
                continue

            score = Score(
                total=pepite.score, technique=0.0, sentiment=0.0, onchain=0.0,
                raisons=pepite.raisons,
            )
            decision = Decision(
                actif=actif,
                action=Action.ACHETER,
                # Montant demandé, volontairement non borné — même logique que
                # `strategy/moteur.py` : le chemin de risque décide seul du
                # montant réel.
                montant_usd=self.etat.portefeuille.valeur_totale(
                    {**prix, actif: pepite.candidat.prix_usd}
                ),
                score=score,
                prix_reference=pepite.candidat.prix_usd,
                raisons=(
                    f"score pépite {pepite.score:.0f} ≥ seuil {config.score_minimum:g}",
                ) + pepite.raisons,
                chaine=pepite.candidat.chaine,
                adresse=pepite.candidat.adresse,
            )
            if not await self._bouclier_autorise(decision):
                continue

            stop = stops.stop_initial_pct(decision.prix_reference, config.stop_pct)
            resultat = await self.gestionnaire.acheter(
                decision, self.etat.portefeuille,
                prix={**prix, actif: pepite.candidat.prix_usd},
                stop=stop, carnet=None,
                plafond_specifique_usd=config.plafond_par_jeton_usd,
            )
            if resultat.accepte and resultat.execution:
                self.etat.portefeuille = resultat.portefeuille
                self.etat.executions_du_jour.append(resultat.execution)
                self.etat.pepites_suivies[actif] = (pepite.candidat.chaine, pepite.candidat.adresse)
                await self.notificateur.diffuser(
                    messages.ordre_execute(resultat.execution, simule=self.config.simule),
                    categorie="ordre",
                )
                break  # une seule pépite achetée par passe
            _journal.info("%s : achat non passé — %s", actif, resultat.motif)
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
