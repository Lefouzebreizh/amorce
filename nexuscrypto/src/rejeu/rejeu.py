#!/usr/bin/env python3
"""La boucle de rejeu.

**Aucun regard vers l'avenir.** C'est le seul défaut qui compte dans un
harnais de rejeu, parce qu'il ne se voit pas : un backtest qui triche rend une
courbe magnifique et un compte vide. Deux règles le tiennent ici, et elles sont
gardées par des tests.

1. Le contexte de la bougie *i* ne contient que les bougies 0 à *i*. La
   stratégie ne voit jamais une bougie qui n'a pas encore fermé.
2. **La décision prise à la clôture de *i* s'exécute à l'ouverture de *i+1*.**
   La clôture de *i* n'est connue qu'à l'instant où elle a lieu ; exécuter à ce
   prix-là revient à passer un ordre dans le passé. La dernière bougie de la
   série n'est donc jamais exécutable, et la boucle s'arrête avant elle.

**La fenêtre de rejeu est celle du direct.** Le moteur en production reçoit
`general.profondeur_bougies` bougies, pas l'historique entier ; lui en donner
plus ici mesurerait un moteur que personne ne fera tourner. Une EMA 200 calculée
sur 600 bougies n'a pas la même valeur que sur 300.

**Ce que le rejeu ne simule pas**, et il faut le savoir avant de lire un
résultat : il n'y a pas de carnet d'ordres historique. Le courtier papier
retombe donc sur son glissement forfaitaire au lieu de parcourir un carnet. Sur
Bitcoin l'écart est négligeable ; sur une pépite peu liquide, le rejeu est
optimiste et il l'est en silence.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime

from ..core.config import Config, LigneAllocation
from ..core.modeles import (
    Action, Contexte, Execution, MetriqueOnchain, Portefeuille, SerieOHLCV,
    SignalSentiment, Sens,
)
from ..execution.courtier import CourtierPapier, OrdreRefuse
from ..risk_management import coupe_circuit as cc
from ..risk_management import portefeuille as pf
from ..risk_management import stops
from ..strategy.moteur import Moteur
from .donnees import Scenario


def config_mono_actif(config: Config, symbole: str, *, role: str = "croissance") -> Config:
    """Une configuration dont l'allocation ne contient que cet actif, à 100 %.

    Sans cela, rejouer « TEST/USDT » sur la configuration livrée donne un poids
    de zéro, donc un montant de zéro, donc un rejeu parfaitement vide dont rien
    ne signale la cause.
    """

    portefeuille_config = replace(
        config.portefeuille,
        allocation={
            symbole: LigneAllocation(
                symbole=symbole, poids=100.0, role=role, vente_sur_signal=True
            )
        },
        reserve_decouverte_poids=0.0,
    )
    return replace(config, portefeuille=portefeuille_config)


@dataclass
class Resultat:
    """Ce qu'un rejeu rend. Tout est dérivé de ces trois listes."""

    nom: str
    symbole: str
    capital_initial: float
    portefeuille: Portefeuille
    executions: list[Execution] = field(default_factory=list)
    courbe: list[tuple[datetime, float]] = field(default_factory=list)
    # La valeur de ce qui est **réellement exposé au marché**, liquidités
    # exclues. Sans elle, tout recul mesuré ici flatte : le portefeuille de la
    # stratégie dort en grande partie en liquide, et du liquide ne recule pas.
    courbe_exposee: list[tuple[datetime, float]] = field(default_factory=list)
    declenchements: list[cc.Declenchement] = field(default_factory=list)
    temporisations: int = 0

    @property
    def valeur_finale(self) -> float:
        return self.courbe[-1][1] if self.courbe else self.capital_initial

    @property
    def pnl(self) -> float:
        return self.valeur_finale - self.capital_initial

    @property
    def pnl_relatif(self) -> float:
        return self.pnl / self.capital_initial if self.capital_initial else 0.0

    @property
    def frais(self) -> float:
        return sum(e.frais_usd for e in self.executions)

    @property
    def achats(self) -> list[Execution]:
        return [e for e in self.executions if e.ordre.sens is Sens.ACHAT]

    @property
    def prix_moyen_achat(self) -> float | None:
        """Le prix moyen pondéré payé. C'est **la** mesure d'un DCA.

        Comparé au prix moyen de la période, il dit en un nombre si la
        modulation des montants a servi : acheter sous la moyenne, c'est faire
        mieux qu'un ordre permanent ; au-dessus, c'est faire pire, et toute la
        complexité du moteur est alors à jeter.
        """

        achats = self.achats
        quantite = sum(e.quantite_executee for e in achats)
        if quantite <= 0:
            return None
        return sum(e.prix_execute * e.quantite_executee for e in achats) / quantite

    @property
    def capital_engage(self) -> float:
        return sum(e.montant_usd + e.frais_usd for e in self.achats)

    # ----------------------------------------------------------------------
    # Ce que la stratégie protège
    #
    # Elle perd contre un DCA aveugle sur le rendement, sur les cinq fenêtres
    # de BTC réel mesurées. Si sa valeur est ailleurs — dormir pendant un
    # krach — elle doit se mesurer sur ce terrain-là, sinon on continue de
    # l'optimiser contre un étalon qu'elle ne peut pas battre.
    #
    # **Et le piège de cette famille est énorme : une stratégie qui n'investit
    # rien a un recul nul.** Comparer des reculs bruts entre deux stratégies
    # qui n'engagent pas le même capital ne mesure que la différence de
    # capital. D'où `rendement_par_douleur`, qui est le seul chiffre de cette
    # section à pouvoir se comparer directement.
    # ----------------------------------------------------------------------

    @property
    def temps_sous_eau(self) -> float | None:
        """Fraction du temps passée sous un sommet précédent.

        Le recul maximum dit à quel point ça a fait mal une fois ; celui-ci dit
        combien de temps ça a duré. Ce sont deux douleurs différentes, et c'est
        la seconde qui fait abandonner une stratégie.

        Rend `None` sur une courbe vide, et pas `0.0` : sur rien du tout, zéro
        se lirait « jamais sous l'eau », c'est-à-dire la meilleure nouvelle
        possible tirée d'une absence de mesure.
        """

        if not self.courbe:
            return None
        sommet = self.courbe[0][1]
        sous_eau = 0
        for _, valeur in self.courbe:
            if valeur >= sommet:
                sommet = valeur
            else:
                sous_eau += 1
        return sous_eau / len(self.courbe)

    @property
    def pire_mois(self) -> float | None:
        """La pire variation d'un mois calendaire à l'autre.

        Calendaire et non glissant : c'est le relevé qu'on regarde, et c'est
        celui qui décide si on coupe tout un dimanche soir.

        Rend `None` en deçà de deux mois, et pas `0.0` : « aucun mauvais mois »
        est la plus rassurante des conclusions, et la tirer du vide est le
        défaut consigné dans `second-brain/lecons.md`.
        """

        par_mois: dict[tuple[int, int], list[float]] = {}
        for instant, valeur in self.courbe:
            par_mois.setdefault((instant.year, instant.month), []).append(valeur)
        mois = sorted(par_mois)
        if len(mois) < 2:
            return None
        pire = 0.0
        for cle in mois:
            valeurs = par_mois[cle]
            depart, fin = valeurs[0], valeurs[-1]
            if depart > 0:
                pire = min(pire, fin / depart - 1.0)
        return pire

    @property
    def rendement_par_douleur(self) -> float | None:
        """Le gain rapporté au pire recul — un ratio de Calmar simplifié.

        **C'est le seul chiffre de cette section qui se compare honnêtement.**
        Deux stratégies qui n'engagent pas le même capital ont des reculs
        incomparables ; rapporter le gain à la douleur remet les deux sur la
        même échelle. Un recul nul rend `None` plutôt qu'un infini : n'avoir
        rien risqué n'est pas une performance infinie.
        """

        # Rapporté au recul **exposé** : le seul dénominateur qui soit
        # réellement la chose qui risque quelque chose.
        recul = self.drawdown_expose
        if not recul:
            return None
        return self.pnl_relatif / recul

    @property
    def drawdown_expose(self) -> float | None:
        """Le pire recul de **ce qui est exposé au marché**, liquidités exclues.

        C'est le seul recul qui décrive ce que le marché fait subir. Le recul du
        portefeuille entier mélange deux choses — la baisse des positions, et le
        fait qu'une grande part dorme en liquide — et flatte donc toute
        stratégie qui investit peu. Le piège est consigné dans
        `second-brain/lecons.md` : « une mesure qui inclut ce qui n'est pas
        exposé flatte ». Il avait déjà coûté un aller-retour sur la mesure du
        levier ; il était encore ici, dans la mesure de la protection.

        `None` quand rien n'a jamais été exposé : n'avoir rien risqué n'est pas
        un recul de zéro, c'est une absence de mesure.
        """

        exposees = [v for _, v in self.courbe_exposee if v > 0]
        if not exposees:
            return None
        pire = 0.0
        sommet = exposees[0]
        for valeur in exposees:
            sommet = max(sommet, valeur)
            if sommet > 0:
                pire = max(pire, (sommet - valeur) / sommet)
        return pire

    @property
    def drawdown_max(self) -> float:
        """Le pire recul du portefeuille entier, liquidités comprises.

        Conservé parce que c'est ce que vit le propriétaire du compte — mais il
        ne se compare **pas** entre deux stratégies qui n'engagent pas le même
        capital. Pour cela, `drawdown_expose`.
        """

        pire = 0.0
        sommet = self.capital_initial
        for _, valeur in self.courbe:
            sommet = max(sommet, valeur)
            if sommet > 0:
                pire = max(pire, (sommet - valeur) / sommet)
        return pire


def rejouer(
    config: Config,
    serie: SerieOHLCV,
    *,
    fear_greed: dict[str, int] | None = None,
    onchain: dict[str, MetriqueOnchain] | None = None,
    nom: str = "dynamique",
    plat: bool = False,
) -> Resultat:
    """Rejoue la stratégie sur une série.

    `plat=True` désactive toute la modulation et achète l'enveloppe pleine à
    chaque échéance : c'est le **témoin**. Sans lui, un beau résultat ne dit
    pas si la modulation a servi ou si c'est le marché qui montait — et c'est
    la seule question qui vaille.
    """

    config = config_mono_actif(config, serie.symbole)
    fear_greed = fear_greed or {}
    onchain = onchain or {}
    profondeur = config.general.profondeur_bougies

    moteur = Moteur(config)
    courtier = CourtierPapier(config.execution)
    disjoncteur = cc.depuis_config(
        config.risque.coupe_circuit,
        config.portefeuille.capital_initial_usd,
        serie.bougies[0].horodatage,
    )
    portefeuille = Portefeuille(
        liquidites_usd=config.portefeuille.capital_initial_usd,
        devise=config.general.devise,
    )
    resultat = Resultat(
        nom=nom, symbole=serie.symbole,
        capital_initial=config.portefeuille.capital_initial_usd,
        portefeuille=portefeuille,
    )

    bougies = serie.bougies
    # On commence quand l'EMA la plus longue est calculable : avant, la
    # stratégie déciderait sur des indicateurs absents et le rejeu mesurerait
    # une période que le direct ne connaîtra jamais.
    depart = min(config.strategie.technique.ema_longue + 1, len(bougies) - 1)

    for i in range(depart, len(bougies) - 1):
        instant = bougies[i].horodatage
        jour = instant.date().isoformat()
        # La fenêtre du direct, pas l'historique entier.
        fenetre = bougies[max(0, i + 1 - profondeur) : i + 1]
        contexte = Contexte(
            actif=serie.symbole,
            releve_le=instant,
            serie=SerieOHLCV(serie.symbole, serie.intervalle, fenetre),
            sentiment=(
                SignalSentiment(fear_greed=fear_greed[jour]) if jour in fear_greed else None
            ),
            # Les métriques du jour, quand la source en a. Les autres jours, le
            # scoring redistribue le poids de la famille absente — c'est le
            # comportement du direct, pas une facilité du rejeu.
            onchain=onchain.get(jour),
        )

        prix_courant = {serie.symbole: bougies[i].cloture}
        valeur = portefeuille.valeur_totale(prix_courant)
        resultat.courbe.append((instant, valeur))
        resultat.courbe_exposee.append((instant, valeur - portefeuille.liquidites_usd))

        if not plat:
            declenchement = disjoncteur.observer(
                maintenant=instant,
                valeur_portefeuille=valeur,
                variations_1h={
                    serie.symbole: bougies[i].cloture / bougies[i - 1].cloture - 1.0
                },
            )
            if declenchement is not None:
                resultat.declenchements.append(declenchement)

        analyse = moteur.analyser(contexte, portefeuille, instant)
        decision = analyse.decision
        if decision.action is Action.TEMPORISER:
            resultat.temporisations += 1

        # L'exécution se fait à l'ouverture de la bougie suivante. C'est le
        # premier prix réellement atteignable après la clôture qui a décidé.
        prix_execution = bougies[i + 1].ouverture
        if prix_execution <= 0:
            continue

        if plat:
            portefeuille = _achat_plat(
                config, courtier, portefeuille, serie.symbole, prix_execution,
                instant, moteur, resultat,
            )
            continue

        portefeuille = _appliquer(
            config, courtier, disjoncteur, portefeuille, analyse,
            prix_execution, instant, moteur, resultat,
        )

    dernier = bougies[-1]
    finale = portefeuille.valeur_totale({serie.symbole: dernier.cloture})
    resultat.courbe.append((dernier.horodatage, finale))
    resultat.courbe_exposee.append(
        (dernier.horodatage, finale - portefeuille.liquidites_usd)
    )
    resultat.portefeuille = portefeuille
    return resultat


def _achat_plat(config, courtier, portefeuille, symbole, prix, instant, moteur, resultat):
    """Le témoin : l'enveloppe pleine à chaque échéance, sans rien regarder."""

    from ..strategy import dca

    if not dca.echeance_atteinte(
        config.portefeuille.cadence_dca, moteur.dernier_dca.get(symbole), instant
    ):
        return portefeuille
    montant = config.portefeuille.enveloppe_dca_usd
    if montant > portefeuille.liquidites_usd:
        return portefeuille
    return _passer(
        courtier, portefeuille, symbole, Sens.ACHAT, montant / prix, prix,
        "DCA plat", instant, moteur, resultat, config,
    )


def _appliquer(config, courtier, disjoncteur, portefeuille, analyse, prix, instant,
               moteur, resultat):
    decision = analyse.decision
    symbole = decision.actif

    if decision.action is Action.SORTIR:
        position = portefeuille.positions.get(symbole)
        if position is None:
            return portefeuille
        return _passer(
            courtier, portefeuille, symbole, Sens.VENTE, position.quantite, prix,
            " ; ".join(decision.raisons), instant, moteur, resultat, config,
            marquer=False,
        )

    if decision.action not in (Action.ACHETER, Action.RENFORCER):
        return portefeuille
    if not disjoncteur.passe:
        return portefeuille

    from ..risk_management.sizing import dimensionner

    stop = stops.stop_initial(prix, analyse.lecture.atr, config.risque)
    dimension = dimensionner(
        montant_souhaite_usd=decision.montant_usd,
        prix=prix,
        stop=stop,
        portefeuille=portefeuille,
        valeur_totale_usd=portefeuille.valeur_totale({symbole: prix}),
        actif=symbole,
        config_risque=config.risque,
        config_portefeuille=config.portefeuille,
    )
    if dimension.montant_usd < config.strategie.dca.montant_minimum_usd:
        return portefeuille
    return _passer(
        courtier, portefeuille, symbole, Sens.ACHAT, dimension.quantite, prix,
        " ; ".join(decision.raisons[:2]), instant, moteur, resultat, config,
    )


def _passer(courtier, portefeuille, symbole, sens, quantite, prix, motif, instant,
            moteur, resultat, config, *, marquer: bool = True):
    """Passe l'ordre par le **vrai** courtier papier : frais et glissement
    compris. Court-circuiter ici donnerait un rejeu flatteur, ce qui est
    exactement ce qu'un harnais ne doit pas faire."""

    import uuid

    from ..core.modeles import Ordre, TypeOrdre

    if quantite <= 0:
        return portefeuille
    ordre = Ordre(
        identifiant=uuid.uuid4().hex[:8], actif=symbole, sens=sens,
        type_ordre=TypeOrdre.MARCHE, quantite=quantite, motif=motif,
    )
    import asyncio

    try:
        execution = asyncio.run(courtier.passer(ordre, prix_reference=prix))
    except OrdreRefuse:
        return portefeuille
    # L'horodatage du courtier est l'heure réelle ; ici c'est celui de la
    # bougie qui fait foi, sinon la courbe et les ordres ne parlent pas du
    # même temps.
    execution = replace(execution, horodatage=instant)
    try:
        nouveau = pf.appliquer(portefeuille, execution)
    except (pf.FondsInsuffisants, pf.PositionIntrouvable):
        return portefeuille
    resultat.executions.append(execution)
    if marquer and sens is Sens.ACHAT:
        moteur.marquer_dca(symbole, instant)
    return nouveau


def rejouer_scenario(config: Config, scenario: Scenario) -> tuple[Resultat, Resultat]:
    """Rejoue un scénario en dynamique **et** en témoin. Toujours les deux :
    un résultat seul ne se juge pas."""

    dynamique = rejouer(
        config, scenario.serie, fear_greed=scenario.fear_greed, nom="DCA dynamique"
    )
    temoin = rejouer(
        config, scenario.serie, fear_greed=scenario.fear_greed,
        nom="DCA plat (témoin)", plat=True,
    )
    return dynamique, temoin
