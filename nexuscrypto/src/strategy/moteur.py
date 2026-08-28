#!/usr/bin/env python3
"""Le moteur de décision : d'un contexte à une décision, et rien d'autre.

Ce module **ne passe aucun ordre, ne touche à aucun portefeuille et n'appelle
aucun réseau**. Il lit un `Contexte` et rend une `Decision`. C'est ce qui permet
de le rejouer sur six mois d'archives en quelques secondes, et de vérifier
l'effet d'un réglage sans rien exécuter.

La séquence, pour chaque actif :

1. lire la série (indicateurs) ;
2. calculer l'indice de confiance ;
3. demander au DCA quelle enveloppe il propose, calendrier compris ;
4. si une position existe, regarder si un stop ou une prise de bénéfice
   suiveuse est franchi — et **cette branche prime sur tout le reste**.

L'ordre du point 4 compte : une sortie de protection ne doit jamais être
annulée par un signal d'achat sur le même actif à la même passe. Le cas se
produit exactement au pire moment — un actif qui s'effondre a un RSI en
survente, donc un excellent score d'achat, alors même que le stop vient d'être
touché.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..core.config import Config
from ..core.modeles import Action, Contexte, Decision, Portefeuille, Zone
from ..risk_management import stops
from . import dca, scoring
from .indicateurs import Lecture, lire


@dataclass(frozen=True, slots=True)
class Analyse:
    """Le détail d'une passe sur un actif. Conservé pour la notification et
    pour le rejeu : une décision sans son analyse ne s'explique plus."""

    contexte: Contexte
    lecture: Lecture
    decision: Decision
    sortie: stops.NiveauxSortie | None


class Moteur:
    def __init__(self, config: Config) -> None:
        self.config = config
        # Date du dernier passage DCA, par actif. Vit dans le moteur et non
        # dans la configuration : c'est un état d'exécution, pas un réglage.
        self.dernier_dca: dict[str, datetime] = {}

    def analyser(
        self,
        contexte: Contexte,
        portefeuille: Portefeuille,
        maintenant: datetime,
    ) -> Analyse:
        technique = self.config.strategie.technique
        lecture = lire(
            contexte.serie,
            rsi_periode=technique.rsi_periode,
            courte=technique.ema_courte,
            moyenne=technique.ema_moyenne,
            longue=technique.ema_longue,
            volume_periode=technique.volume_periode,
            atr_periode=self.config.risque.atr_periode,
        )
        score = scoring.calculer(contexte, lecture, self.config.strategie)
        prix = contexte.prix

        # 1. Sortie de protection — examinée avant tout signal d'entrée.
        position = portefeuille.positions.get(contexte.actif)
        ligne = self.config.portefeuille.allocation.get(contexte.actif)
        sortie: stops.NiveauxSortie | None = None
        if position is not None:
            sortie = stops.evaluer(position, prix, lecture.atr, self.config.risque)
            # Le socle ne se vend pas sur signal : c'est la réserve du
            # portefeuille, et la vendre au premier stop revient à faire du
            # trading avec ce qui devait ne pas bouger.
            if sortie.doit_sortir and (ligne is None or ligne.vente_sur_signal):
                return Analyse(
                    contexte=contexte,
                    lecture=lecture,
                    decision=Decision(
                        actif=contexte.actif,
                        action=Action.SORTIR,
                        montant_usd=position.valeur(prix),
                        score=score,
                        prix_reference=prix,
                        raisons=(sortie.raison,),
                    ),
                    sortie=sortie,
                )

        # 2. DCA dynamique.
        zone = contexte.sentiment.zone if contexte.sentiment else Zone.NEUTRE
        echeance = dca.echeance_atteinte(
            self.config.portefeuille.cadence_dca,
            self.dernier_dca.get(contexte.actif),
            maintenant,
        )
        enveloppe = dca.planifier(
            enveloppe_usd=self.config.portefeuille.enveloppe_dca_usd,
            poids_actif=ligne.fraction if ligne else 0.0,
            zone=zone,
            lecture=lecture,
            score=score,
            config=self.config.strategie.dca,
            echeance=echeance,
        )

        action = enveloppe.action
        if action is Action.ACHETER and position is not None:
            action = Action.RENFORCER

        return Analyse(
            contexte=contexte,
            lecture=lecture,
            decision=Decision(
                actif=contexte.actif,
                action=action,
                montant_usd=enveloppe.montant_usd,
                score=score,
                prix_reference=prix,
                raisons=enveloppe.raisons + score.raisons,
            ),
            sortie=sortie,
        )

    def marquer_dca(self, actif: str, quand: datetime) -> None:
        """Appelé par l'orchestrateur **après** une exécution réussie.

        Marquer avant l'exécution ferait sauter une échéance à chaque ordre
        refusé — un refus pour trésorerie insuffisante annulerait le DCA de la
        semaine, en silence.
        """

        self.dernier_dca[actif] = quand
