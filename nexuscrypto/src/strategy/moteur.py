#!/usr/bin/env python3
"""Le moteur de décision : d'un contexte à une décision, et rien d'autre.

Ce module **ne passe aucun ordre, ne touche à aucun portefeuille et n'appelle
aucun réseau**. Il lit un `Contexte` et rend une `Decision`. C'est ce qui permet
de le rejouer sur six mois d'archives en quelques secondes, et de vérifier
l'effet d'un réglage sans rien exécuter.

**Retiré le 10/09/2026 : tout calendrier.** Le moteur n'achète plus « parce que
c'est l'heure » — il achète quand le score de confiance dit qu'il y a une
occasion, jamais autrement. C'est la décision du 10/09/2026 : NexusCrypto
cesse d'être un DCA modulé pour devenir un chasseur d'opportunités pur. La
seule enveloppe restante est le risque : `montant_usd` porte un montant
*souhaité*, volontairement non borné — c'est
`risk_management.sizing.dimensionner` qui le ramène à ce que la distance au
stop, l'exposition maximale et la trésorerie acceptent réellement, jamais la
conviction du score elle-même.

La séquence, pour chaque actif :

1. lire la série (indicateurs) ;
2. calculer l'indice de confiance ;
3. si une position existe, regarder si un stop ou une prise de bénéfice
   suiveuse est franchi — et **cette branche prime sur tout le reste** ;
4. sinon, acheter ou renforcer si le score franchit `seuil_achat`, attendre
   sinon.

L'ordre du point 3 compte : une sortie de protection ne doit jamais être
annulée par un signal d'achat sur le même actif à la même passe. Le cas se
produit exactement au pire moment — un actif qui s'effondre a un RSI en
survente, donc un excellent score d'achat, alors même que le stop vient d'être
touché.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..core.config import Config
from ..core.modeles import Action, Contexte, Decision, Portefeuille
from ..risk_management import stops
from . import scoring
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
        ligne = self.config.portefeuille.watchlist.get(contexte.actif)
        sortie: stops.NiveauxSortie | None = None
        if position is not None:
            sortie = stops.evaluer(position, prix, lecture.atr, self.config.risque)
            # Une ligne peut être protégée contre la vente sur signal — la
            # réserve du portefeuille — et la seule chose qui la fait bouger
            # est un choix explicite, jamais le premier stop touché.
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
                        chaine=ligne.chaine if ligne is not None else None,
                        adresse=ligne.adresse if ligne is not None else None,
                    ),
                    sortie=sortie,
                )

        # 2. Opportunité pure : le score contre le seuil, rien d'autre.
        seuil = self.config.strategie.seuil_achat
        if score.total >= seuil:
            action = Action.RENFORCER if position is not None else Action.ACHETER
            # Montant demandé, volontairement non borné : le chemin de risque
            # (stop → dimensionnement) décide seul du montant réel.
            montant_souhaite = portefeuille.valeur_totale({contexte.actif: prix})
            raisons = (f"score {score.total:.0f} ≥ seuil {seuil:.0f}",) + score.raisons
        else:
            action = Action.ATTENDRE
            montant_souhaite = 0.0
            raisons = (f"score {score.total:.0f} sous le seuil {seuil:.0f}",) + score.raisons

        return Analyse(
            contexte=contexte,
            lecture=lecture,
            decision=Decision(
                actif=contexte.actif,
                action=action,
                montant_usd=montant_souhaite,
                score=score,
                prix_reference=prix,
                raisons=raisons,
                chaine=ligne.chaine if ligne is not None else None,
                adresse=ligne.adresse if ligne is not None else None,
            ),
            sortie=sortie,
        )
