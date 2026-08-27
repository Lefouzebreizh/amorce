#!/usr/bin/env python3
"""honeypot.is : la simulation d'achat puis de revente.

C'est le complément indispensable de GoPlus, et non un doublon. GoPlus **lit**
le contrat ; honeypot.is **exécute** un achat et une revente sur un nœud, puis
regarde ce qui s'est passé. Un contrat parfaitement propre à la lecture dont la
revente échoue à l'exécution est exactement le cas que l'analyse statique rate —
et c'est le plus coûteux de tous.

Ne couvre qu'Ethereum, BNB Chain et Base. Ailleurs, on n'a que la lecture, et le
rapport le dit en nommant les sources qui ont répondu : mieux vaut afficher
qu'on en sait moins que fabriquer un chiffre pour faire comme si.
"""

from __future__ import annotations

import logging

from core.modeles import Chaine, Constat
from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.honeypot")

URL = "https://api.honeypot.is/v2/IsHoneypot"
DEBITS = {"honeypot": 60.0}


def _nombre(valeur) -> float | None:
    if valeur is None:
        return None
    try:
        return float(valeur)
    except (TypeError, ValueError):
        return None


def constat(brut: dict) -> Constat | None:
    """Traduit la réponse, ou rend `None` si la simulation n'a pas abouti.

    Une simulation qui échoue n'est pas un piège : le plus souvent, le pool est
    trop mince pour absorber l'achat d'essai. Le dire serait une fausse
    accusation ; on préfère ne rien dire.
    """
    if not isinstance(brut, dict):
        return None
    if brut.get("simulationSuccess") is False:
        JOURNAL.debug("simulation non aboutie : %s", brut.get("simulationError"))
        return None

    resultat = brut.get("honeypotResult") or {}
    simulation = brut.get("simulationResult") or {}
    piege = resultat.get("isHoneypot")

    remarques = []
    for drapeau in (brut.get("flags") or []):
        if isinstance(drapeau, dict) and drapeau.get("severity") in ("high", "critical"):
            remarques.append(str(drapeau.get("description") or drapeau.get("flag")))

    return Constat(
        source="honeypot.is",
        honeypot=bool(piege) if piege is not None else None,
        # Ici les taxes sont déjà en pourcentage, contrairement à GoPlus.
        taxe_achat_pct=_nombre(simulation.get("buyTax")),
        taxe_vente_pct=_nombre(simulation.get("sellTax")),
        remarques=tuple(remarques),
    )


def analyser(client: ClientHttp, chaine: Chaine, adresse: str) -> Constat | None:
    if chaine.honeypot_is is None:
        return None                    # chaîne non couverte, ce n'est pas un échec
    reponse = client.json(
        "honeypot", URL, params={"address": adresse, "chainID": chaine.honeypot_is}
    )
    return constat(reponse) if reponse else None
