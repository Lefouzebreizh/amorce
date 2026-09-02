#!/usr/bin/env python3
"""Combien vaut chaque ligne, et combien vaut chaque poche.

Trois décisions portées ici, toutes reprises de l'assistant d'allocation que ce
module remplace. Elles avaient été payées une fois ; les réécrire de mémoire les
aurait perdues.

**1. L'immobilier compte en valeur nette.** Un bien à 148 000 € financé par
76 500 € de crédit restant pèse 71 500 € de patrimoine. Le compter brut écrase
mécaniquement les autres poches et rend le rééquilibrage illisible tant que le
crédit court. Le capital restant dû reste affiché à côté de l'estimation, pour
ne pas perdre l'effet de levier de vue.

**2. Le rendement locatif se rapporte à la valeur du bien, pas à l'apport.**
Rapporté à la seule part non financée, un bien acheté presque entièrement à
crédit afficherait des rendements à trois chiffres qui ne veulent plus rien
dire.

**3. Un prix manquant ne s'invente pas.** Une ligne sans cours vaut `None`, pas
zéro, et elle ne rentre pas dans le total — que le rapport annonce alors
partiel. Compter zéro donnerait un patrimoine faux avec l'aplomb d'un patrimoine
juste, et c'est ce qui le rendrait dangereux.

**Et une quatrième, propre à ce module-ci : un prix vieux ne se présente pas
comme frais.** Les cours sont saisis à la main — voir le README pour la raison —
donc ils vieillissent. Au-delà de la fraîcheur admise, la ligne garde sa valeur
(elle est vraie, simplement datée) mais le bilan bascule en partiel et le
conseil se tait. C'est le pendant exact de la décision 3 : là on refusait
d'inventer un prix, ici on refuse de faire passer celui de l'été dernier pour
celui de ce matin.
"""

from __future__ import annotations

from datetime import date

from core.modeles import Classe, Ligne
from core.reglages import Reglages


def rendement_net(bien: dict) -> float | None:
    """Loyers annuels moins charges, rapportés à la valeur estimée du bien.

    `None` quand le bien n'a pas de valeur : diviser par zéro n'arrive pas en
    pratique, et c'est exactement pour ça que ça passerait inaperçu.
    """
    valeur = float(bien.get("valeur_estimee_eur") or 0.0)
    if valeur <= 0:
        return None
    loyers = float(bien.get("loyer_mensuel_brut_eur") or 0.0) * 12
    charges = float(bien.get("charges_annuelles_eur") or 0.0)
    return (loyers - charges) / valeur * 100


def _ligne_cotee(classe: Classe, actif: dict, detail: str) -> Ligne:
    """Une ligne dont la valeur est un cours multiplié par une quantité.

    Bourse et crypto ne diffèrent que par leur libellé : les factoriser évite
    que la plus-value latente soit calculée d'un côté et oubliée de l'autre —
    ce qui est arrivé assez souvent ailleurs pour valoir cette fonction.
    """
    quantite = float(actif["quantite"])
    prix = actif.get("prix_eur")
    prix = None if prix is None else float(prix)
    pru = actif.get("pru_eur")
    return Ligne(
        classe=classe,
        nom=str(actif["nom"]),
        detail=detail,
        source="saisie",
        quantite=quantite,
        prix_eur=prix,
        valeur_eur=None if prix is None else prix * quantite,
        plus_value_eur=(
            None if prix is None or pru is None else (prix - float(pru)) * quantite
        ),
        releve_le=actif.get("releve_le"),
    )


def valoriser(reglages: Reglages) -> tuple[Ligne, ...]:
    """Une ligne par position, valorisée en euros.

    Aucun appel réseau, aucun accès disque : tout vient du fichier déjà validé.
    C'est ce qui rend cette fonction — donc le cœur du conseiller — rejouable à
    l'identique demain.
    """
    lignes: list[Ligne] = []

    for actif in reglages.actifs[Classe.BOURSE]:
        enveloppe = actif.get("enveloppe") or "sans enveloppe"
        lignes.append(
            _ligne_cotee(Classe.BOURSE, actif, f"{actif['ticker']} · {enveloppe}")
        )

    for actif in reglages.actifs[Classe.CRYPTO]:
        garde = actif.get("conservation") or "conservation non précisée"
        lignes.append(
            _ligne_cotee(Classe.CRYPTO, actif, f"{actif['symbole']} · {garde}")
        )

    for bien in reglages.actifs[Classe.IMMOBILIER]:
        estimee = float(bien["valeur_estimee_eur"])
        credit = float(bien.get("capital_restant_du_eur") or 0.0)
        detail = f"estimé {estimee:,.0f} €".replace(",", " ")
        if credit > 0:
            detail += f" − {credit:,.0f} € de crédit".replace(",", " ")
        lignes.append(Ligne(
            classe=Classe.IMMOBILIER,
            nom=str(bien["nom"]),
            detail=detail,
            source="saisie",
            # La valeur nette, décision 1. Un bien plus endetté qu'estimé pèse
            # négativement, et c'est juste : c'est ce qu'il coûterait de sortir.
            valeur_eur=estimee - credit,
            rendement_pct=rendement_net(bien),
        ))

    for poche in reglages.actifs[Classe.LIQUIDITES]:
        taux = poche.get("taux_annuel_pct")
        lignes.append(Ligne(
            classe=Classe.LIQUIDITES,
            nom=str(poche["nom"]),
            detail="disponible",
            source="saisie",
            valeur_eur=float(poche["montant_eur"]),
            rendement_pct=None if taux is None else float(taux),
        ))

    return tuple(lignes)


def totaux_par_classe(lignes: tuple[Ligne, ...]) -> dict[Classe, float]:
    """Le total de chaque poche. Une ligne sans valeur en est simplement
    absente — voir la décision 3 de l'en-tête."""
    totaux = {classe: 0.0 for classe in Classe}
    for ligne in lignes:
        if ligne.valeur_eur is not None:
            totaux[ligne.classe] += ligne.valeur_eur
    return totaux


def lignes_sans_prix(lignes: tuple[Ligne, ...]) -> tuple[Ligne, ...]:
    """Celles qu'on n'a pas su valoriser. Leur seule présence rend le total
    partiel, quel que soit leur poids supposé."""
    return tuple(ligne for ligne in lignes if ligne.valeur_eur is None)


def lignes_perimees(
    lignes: tuple[Ligne, ...], aujourdhui: date, fraicheur_max_jours: int
) -> tuple[tuple[Ligne, int], ...]:
    """Celles dont le cours a dépassé la fraîcheur admise, avec leur âge.

    Rendues avec l'âge plutôt que seules : « Bitcoin daté » ne dit pas s'il faut
    ressaisir maintenant ou si c'était hier soir, et c'est l'écart qui décide.
    """
    vieilles: list[tuple[Ligne, int]] = []
    for ligne in lignes:
        age = ligne.age_jours(aujourdhui)
        if age is not None and age > fraicheur_max_jours:
            vieilles.append((ligne, age))
    return tuple(vieilles)
