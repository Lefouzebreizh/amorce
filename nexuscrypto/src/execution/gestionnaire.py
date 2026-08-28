#!/usr/bin/env python3
"""Le gestionnaire d'ordres : le seul chemin entre une décision et le marché.

Il n'y a pas d'autre chemin, et c'est délibéré. Chaque ordre traverse la même
séquence, dans le même ordre, sans exception :

    coupe-circuit → dimensionnement → courtier → portefeuille → journal → alerte

Un raccourci « juste pour le rééquilibrage » ou « juste pour les sorties de
stop » serait exactement l'endroit par lequel un ordre passerait un jour sans
contrôle de risque. Les sorties de stop, elles, ont bien un traitement à part —
mais dans le sens qui protège : **un coupe-circuit déclenché n'empêche jamais
une vente de protection**. Bloquer les sorties pendant un krach transformerait
le coupe-circuit en piège.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from ..core.config import Config
from ..core.journal import obtenir
from ..core.modeles import (
    Action, CarnetOrdres, Decision, Execution, Ordre, Portefeuille, Sens, TypeOrdre,
)
from ..risk_management import portefeuille as pf
from ..risk_management.coupe_circuit import CoupeCircuit
from ..risk_management.sizing import dimensionner
from .courtier import Courtier, OrdreRefuse

_journal = obtenir("execution.gestionnaire")


@dataclass(frozen=True, slots=True)
class Resultat:
    """Ce qu'un passage rend, qu'il ait abouti ou non.

    Un refus n'est pas une exception : c'est le fonctionnement normal d'un
    système qui dit non plus souvent qu'il ne dit oui. Les faire remonter en
    exceptions obligerait chaque appelant à les rattraper pour continuer la
    boucle, et l'un d'eux finirait par ne pas le faire.
    """

    accepte: bool
    execution: Execution | None
    portefeuille: Portefeuille
    motif: str


class Gestionnaire:
    def __init__(
        self,
        config: Config,
        courtier: Courtier,
        coupe_circuit: CoupeCircuit,
    ) -> None:
        self.config = config
        self.courtier = courtier
        self.coupe_circuit = coupe_circuit
        self.executions: list[Execution] = []

    async def acheter(
        self,
        decision: Decision,
        portefeuille: Portefeuille,
        *,
        prix: dict[str, float],
        stop: float | None = None,
        carnet: CarnetOrdres | None = None,
        plafond_specifique_usd: float | None = None,
    ) -> Resultat:
        """Achat issu d'une décision de la stratégie."""

        if not self.coupe_circuit.passe:
            motif = "coupe-circuit déclenché"
            if self.coupe_circuit.declenchement:
                motif += f" : {self.coupe_circuit.declenchement.message}"
            _journal.warning("%s — achat refusé sur %s.", motif, decision.actif)
            return Resultat(False, None, portefeuille, motif)

        if decision.action not in (Action.ACHETER, Action.RENFORCER):
            return Resultat(False, None, portefeuille, f"action {decision.action.value}")

        valeur = portefeuille.valeur_totale(prix)
        dimension = dimensionner(
            montant_souhaite_usd=decision.montant_usd,
            prix=decision.prix_reference,
            stop=stop,
            portefeuille=portefeuille,
            valeur_totale_usd=valeur,
            actif=decision.actif,
            config_risque=self.config.risque,
            config_portefeuille=self.config.portefeuille,
            plafond_specifique_usd=plafond_specifique_usd,
        )
        if dimension.montant_usd < self.config.strategie.dca.montant_minimum_usd:
            motif = (
                f"montant ramené à {dimension.montant_usd:.2f} $ par « {dimension.plafond_actif} », "
                f"sous le minimum de {self.config.strategie.dca.montant_minimum_usd:g} $"
            )
            _journal.info("%s : %s", decision.actif, motif)
            return Resultat(False, None, portefeuille, motif)

        ordre = Ordre(
            identifiant=uuid.uuid4().hex[:12],
            actif=decision.actif,
            sens=Sens.ACHAT,
            type_ordre=TypeOrdre.MARCHE if self.config.execution.type_ordre == "marche" else TypeOrdre.LIMITE,
            quantite=dimension.quantite,
            prix_limite=decision.prix_reference if self.config.execution.type_ordre != "marche" else None,
            motif=" ; ".join(decision.raisons) or decision.action.value,
        )
        return await self._executer(ordre, portefeuille, decision.prix_reference, carnet)

    async def vendre(
        self,
        actif: str,
        quantite: float,
        portefeuille: Portefeuille,
        *,
        prix_reference: float,
        motif: str,
        carnet: CarnetOrdres | None = None,
    ) -> Resultat:
        """Vente. **Jamais bloquée par le coupe-circuit** : c'est la sortie de
        secours, et une sortie de secours verrouillée est un piège."""

        ordre = Ordre(
            identifiant=uuid.uuid4().hex[:12],
            actif=actif,
            sens=Sens.VENTE,
            type_ordre=TypeOrdre.MARCHE,
            quantite=quantite,
            motif=motif,
        )
        return await self._executer(ordre, portefeuille, prix_reference, carnet)

    async def _executer(
        self,
        ordre: Ordre,
        portefeuille: Portefeuille,
        prix_reference: float,
        carnet: CarnetOrdres | None,
    ) -> Resultat:
        try:
            execution = await self.courtier.passer(
                ordre, prix_reference=prix_reference, carnet=carnet
            )
        except OrdreRefuse as erreur:
            _journal.warning("Ordre refusé — %s", erreur)
            return Resultat(False, None, portefeuille, str(erreur))

        try:
            nouveau = pf.appliquer(portefeuille, execution)
        except (pf.FondsInsuffisants, pf.PositionIntrouvable) as erreur:
            # L'ordre est passé mais le portefeuille le refuse : en simulation
            # c'est un défaut de dimensionnement à corriger, en réel c'est une
            # désynchronisation avec la plateforme. Dans les deux cas on le dit
            # fort plutôt que de laisser un état incohérent s'installer.
            _journal.error("Exécution non applicable au portefeuille — %s", erreur)
            return Resultat(False, execution, portefeuille, str(erreur))

        self.executions.append(execution)
        _journal.info(
            "%s %s %.6g @ %.6g (%s%.2f %% de glissement, %.2f $ de frais) — %s",
            "SIMULÉ" if execution.simule else "RÉEL",
            f"{ordre.sens.value} {ordre.actif}",
            execution.quantite_executee,
            execution.prix_execute,
            "+" if execution.glissement >= 0 else "",
            execution.glissement * 100,
            execution.frais_usd,
            ordre.motif,
        )
        return Resultat(True, execution, nouveau, "exécuté")
