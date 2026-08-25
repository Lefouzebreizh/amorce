#!/usr/bin/env python3
"""Skill 2 — le bouclier anti-rugpull : croiser les sources, puis juger.

Deux règles tiennent ce fichier, et elles se répondent.

**« Ne sait pas » n'est pas « rien à signaler ».** Chaque source rend des champs
facultatifs, et `None` veut dire qu'elle ignore la réponse. Un jeton sur lequel
aucune source n'a rien su dire n'est pas un jeton sûr : c'est un jeton non
vérifié, et son facteur de sécurité descend en conséquence. Sans cette
distinction, une panne de GoPlus délivrerait un quitus à tout le marché.

**Entre deux sources qui se contredisent, on retient la plus pessimiste.** Si
GoPlus lit un contrat propre et que honeypot.is n'arrive pas à revendre, c'est
qu'on ne peut pas revendre. L'analyse statique ne voit pas tout, l'exécution ne
ment pas.

Ce que le bouclier **ne** fait **pas** : promettre. Un contrat peut être
irréprochable et l'équipe malhonnête. Il écarte les pièges mécaniques — revente
bloquée, émission ouverte, liquidité retirable —, pas la décision de vendre.
"""

from __future__ import annotations

import logging

from core.modeles import Candidat, Constat, Securite, Verdict
from core.reglages import Bouclier as ReglagesBouclier
from core.reseau import ClientHttp
from sources import goplus, honeypot_is, rugcheck

JOURNAL = logging.getLogger("pepites.bouclier")

DEBITS = {**goplus.DEBITS, **honeypot_is.DEBITS, **rugcheck.DEBITS}


def _alarmant(constats: list[Constat], champ: str) -> bool | None:
    """Vrai dès qu'une source le dit ; `None` si aucune ne sait."""
    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    return max(valeurs) if valeurs else None


def _rassurant(constats: list[Constat], champ: str) -> bool | None:
    """Faux dès qu'une source le dit — pour les champs où c'est `False` qui inquiète."""
    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    return min(valeurs) if valeurs else None


def _maximum(constats: list[Constat], champ: str) -> float | None:
    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    return max(valeurs) if valeurs else None


def juger(constats: list[Constat], reglages: ReglagesBouclier, est_evm: bool) -> Securite:
    """Croise les constats et rend un verdict. Aucun appel réseau : testable."""
    constats = [c for c in constats if c is not None]
    rejets_regles = reglages.rejets
    penalites = reglages.penalites

    honeypot = _alarmant(constats, "honeypot")
    taxe_achat = _maximum(constats, "taxe_achat_pct")
    taxe_vente = _maximum(constats, "taxe_vente_pct")
    emission = _alarmant(constats, "emission_possible")
    gel = _alarmant(constats, "gel_possible")
    pausable = _alarmant(constats, "echange_pausable")
    metadonnees = _alarmant(constats, "metadonnees_modifiables")
    verifie = _rassurant(constats, "contrat_verifie")
    renonce = _rassurant(constats, "proprietaire_renonce")
    lp = _maximum(constats, "lp_verrouillee_pct")
    top10 = _maximum(constats, "top10_detenteurs_pct")

    rejets: list[str] = []
    if honeypot and rejets_regles.get("honeypot"):
        rejets.append("la revente échoue en simulation")
    if taxe_achat is not None and taxe_achat > rejets_regles["taxe_achat_max_pct"]:
        rejets.append(f"taxe à l'achat de {taxe_achat:.0f} %")
    if taxe_vente is not None and taxe_vente > rejets_regles["taxe_vente_max_pct"]:
        rejets.append(f"taxe à la vente de {taxe_vente:.0f} %")
    if not est_evm:
        # Sur Solana, ces deux autorités sont détenues par une clé unique, sans
        # gouvernance ni délai : les laisser ouvertes, c'est laisser la porte
        # ouverte. Sur EVM, `is_mintable` est trop courant pour éliminer — il y
        # devient une pénalité.
        if emission and rejets_regles.get("mint_actif"):
            rejets.append("l'autorité d'émission est encore ouverte")
        if gel and rejets_regles.get("gel_actif"):
            rejets.append("les comptes peuvent être gelés")
    if lp is not None and lp < rejets_regles["lp_verrouillee_min_pct"]:
        rejets.append(f"liquidité verrouillée à seulement {lp:.0f} %")
    if top10 is not None and top10 > rejets_regles["top10_detenteurs_max_pct"]:
        rejets.append(f"les dix premiers porteurs tiennent {top10:.0f} % de l'offre")

    if rejets:
        return Securite(
            verdict=Verdict.REJETE, facteur=0.0, rejets=tuple(rejets),
            avertissements=tuple(r for c in constats for r in c.remarques),
            taxe_achat_pct=taxe_achat, taxe_vente_pct=taxe_vente,
            lp_verrouillee_pct=lp, top10_detenteurs_pct=top10,
            sources=tuple(c.source for c in constats),
        )

    # Rien de décisif appris : ce n'est pas un jeton sûr, c'est un jeton dont on
    # ne sait rien. La nuance est toute la raison d'être de ce fichier.
    decisif = any(v is not None for v in (honeypot, emission, gel, lp, top10, verifie))
    if not constats or not decisif:
        return Securite(
            verdict=Verdict.INCONNU, facteur=reglages.facteur_si_inconnu,
            avertissements=("aucune source n'a su se prononcer",),
            sources=tuple(c.source for c in constats),
        )

    facteur = 1.0
    avertissements: list[str] = [r for c in constats for r in c.remarques]
    if renonce is False:
        facteur *= penalites["proprietaire_non_renonce"]
        avertissements.append("le propriétaire du contrat n'a pas renoncé")
    if verifie is False:
        facteur *= penalites["contrat_non_verifie"]
        avertissements.append("code source non publié")
    if emission and est_evm:
        facteur *= penalites["emission_possible"]
        avertissements.append("l'offre peut encore être augmentée")
    if metadonnees:
        facteur *= penalites["metadonnees_modifiables"]
        avertissements.append("nom et image du jeton restent modifiables")
    if pausable:
        facteur *= penalites["echange_en_pause_possible"]
        avertissements.append("les échanges peuvent être mis en pause")

    return Securite(
        verdict=Verdict.SUR if facteur >= 1.0 else Verdict.SUSPECT,
        facteur=facteur,
        avertissements=tuple(avertissements),
        taxe_achat_pct=taxe_achat, taxe_vente_pct=taxe_vente,
        lp_verrouillee_pct=lp, top10_detenteurs_pct=top10,
        sources=tuple(c.source for c in constats),
    )


def analyser(client: ClientHttp, candidat: Candidat,
             reglages: ReglagesBouclier) -> Securite:
    """Interroge les sources qui connaissent cette chaîne, puis juge.

    Trois appels au plus, et seulement sur les candidats que la note a déjà
    retenus : GoPlus répond trente fois par minute.
    """
    chaine = candidat.jeton.chaine
    adresse = candidat.jeton.adresse

    constats = [goplus.analyser(client, chaine, adresse)]
    if chaine.est_evm:
        constats.append(honeypot_is.analyser(client, chaine, adresse))
    else:
        constats.append(rugcheck.analyser(client, adresse))

    securite = juger([c for c in constats if c], reglages, chaine.est_evm)
    JOURNAL.debug(
        "%s : %s (×%.2f) via %s",
        candidat.jeton.symbole, securite.verdict.value, securite.facteur,
        ", ".join(securite.sources) or "aucune source",
    )
    return securite
