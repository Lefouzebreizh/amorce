#!/usr/bin/env python3
"""Mise en forme des messages.

Séparée des canaux exprès : le contenu d'une alerte se teste sans réseau, et
c'est le contenu qui compte. Un message d'alerte qui dit « achat BTC » sans dire
*pourquoi* oblige à ouvrir les journaux depuis un téléphone, ce qui n'arrive
jamais — donc l'alerte n'est pas lue, donc elle ne sert à rien.

Règle de rédaction : **le motif avant le chiffre**. « Peur extrême, RSI 24 →
achat de 340 $ » se lit d'un coup d'œil ; « Achat 340 $ BTC (score 78) »
demande de reconstituer. Les nombres sont arrondis à ce qui se décide dessus,
pas à ce que le flottant contient.
"""

from __future__ import annotations

from datetime import datetime

from ..core.modeles import Decision, Execution, Portefeuille, Sens
from ..risk_management.coupe_circuit import Declenchement
from ..strategy.pepites import Pepite


def signal(decision: Decision) -> str:
    raisons = " · ".join(decision.raisons[:4]) if decision.raisons else "aucun motif consigné"
    entete = f"📊 {decision.actif} — {decision.action.value.upper()}"
    corps = [
        f"indice de confiance {decision.score.total:.0f}/100 "
        f"(technique {decision.score.technique:.0f}, "
        f"sentiment {decision.score.sentiment:.0f}, "
        f"on-chain {decision.score.onchain:.0f})",
        f"prix de référence {decision.prix_reference:.6g}",
        raisons,
    ]
    if decision.montant_usd > 0:
        corps.insert(0, f"montant proposé {decision.montant_usd:.2f} $")
    return entete + "\n" + "\n".join(f"• {ligne}" for ligne in corps)


def ordre_execute(execution: Execution, *, simule: bool) -> str:
    ordre = execution.ordre
    marque = "🧪 SIMULÉ" if simule else "💸 RÉEL"
    sens = "Achat" if ordre.sens is Sens.ACHAT else "Vente"
    return (
        f"{marque} — {sens} {ordre.actif}\n"
        f"• {execution.quantite_executee:.6g} @ {execution.prix_execute:.6g} "
        f"= {execution.montant_usd:.2f} $\n"
        f"• frais {execution.frais_usd:.2f} $ · glissement {execution.glissement:+.2%}\n"
        f"• motif : {ordre.motif or 'non consigné'}"
    )


def coupe_circuit(declenchement: Declenchement) -> str:
    return (
        f"🛑 COUPE-CIRCUIT — {declenchement.motif.value.replace('_', ' ')}\n"
        f"• {declenchement.message}\n"
        f"• survenu à {declenchement.survenu_le:%Y-%m-%d %H:%M UTC}\n"
        "• aucune entrée ne sera passée tant qu'il n'est pas réarmé "
        "(les sorties de protection restent actives)"
    )


def pepite_detectee(pepite: Pepite) -> str:
    candidat = pepite.candidat
    return (
        f"💎 Pépite repérée — {candidat.symbole} ({candidat.chaine})\n"
        f"• note {pepite.score:.0f}/100 · liquidité {candidat.liquidite_usd:,.0f} $ "
        f"· volume 24 h {candidat.volume_24h_usd:,.0f} $\n"
        f"• {' · '.join(pepite.raisons) if pepite.raisons else 'anomalie de volume'}\n"
        "• candidat à examiner, pas un achat : le contrat n'a pas été vérifié"
    )


def recapitulatif(
    portefeuille: Portefeuille,
    prix: dict[str, float],
    *,
    capital_initial: float,
    executions_du_jour: list[Execution],
    date: datetime,
    simule: bool,
) -> str:
    """Le récapitulatif quotidien. C'est le seul message que quelqu'un lit tous
    les jours : il doit tenir sur un écran de téléphone."""

    valeur = portefeuille.valeur_totale(prix)
    pnl = valeur - capital_initial
    relatif = pnl / capital_initial if capital_initial else 0.0
    frais = sum(e.frais_usd for e in executions_du_jour)

    lignes = [
        f"📅 Récapitulatif {date:%d/%m/%Y}" + (" (simulation)" if simule else ""),
        f"• valeur {valeur:,.2f} $ · PnL {pnl:+,.2f} $ ({relatif:+.2%})",
        f"• trésorerie {portefeuille.liquidites_usd:,.2f} $ "
        f"· {len(portefeuille.positions)} ligne(s)",
        f"• {len(executions_du_jour)} ordre(s) · {frais:.2f} $ de frais",
    ]
    for actif, position in sorted(portefeuille.positions.items()):
        courant = prix.get(actif, position.prix_moyen)
        lignes.append(
            f"   {actif} : {position.quantite:.6g} @ {position.prix_moyen:.6g} "
            f"→ {position.pnl_relatif(courant):+.1%}"
        )
    return "\n".join(lignes)
