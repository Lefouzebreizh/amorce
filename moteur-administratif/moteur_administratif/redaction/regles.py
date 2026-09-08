"""Gabarit + contexte → texte résolu, et contrôle des mentions obligatoires. Pur.

`resoudre_texte` porte la résolution de jetons de `paper-manager/core/
formulaires.py::resoudre` — déjà générique dans sa version d'origine (elle ne
connaît aucun champ par son nom, seulement des chemins pointés dans un
dictionnaire de contexte) : rien à dépouiller pour la reprendre telle quelle.
`resoudre_champs` en est la variante pour un plan de formulaire PDF (un
dictionnaire nom de champ → gabarit, plutôt qu'un texte unique).

`TRANSPOSITION` et `texte_lisible_en_pdf` viennent du même dépôt : les polices
de base d'un PDF (Helvetica et consorts) sont limitées au latin-1, et « œ »,
« € » ou le tiret cadratin y deviennent silencieusement « ? ». Mesuré sur
`paper-manager` : « Cœur 78,42 € » en ressortait « C?ur 78,42 ? ».

Ce qui reste spécifique à un produit — et n'a rien à faire ici — c'est le
contenu des gabarits et la liste des mentions qu'un écrit donné doit porter :
les deux sont fournis par l'appelant.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from typing import Any

JETON = re.compile(r"\{([^{}]+)\}")

# Ce que les polices de base d'un PDF ne savent pas tracer, et par quoi le
# remplacer — sans cette table, silencieusement remplacé par « ? ».
TRANSPOSITION = str.maketrans({
    "œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE",
    "€": "EUR", "—": "-", "–": "-", "…": "...",
    "‘": "'", "’": "'", "“": '"', "”": '"',
})

MOIS_FRANCAIS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet",
                 "août", "septembre", "octobre", "novembre", "décembre")


class ErreurGabarit(Exception):
    """Un jeton du gabarit ne correspond à rien dans le contexte fourni."""


def formater(valeur: Any) -> str:
    """Une valeur telle qu'elle s'écrit dans un texte administratif français.

    Dates en JJ/MM/AAAA, montants à la virgule : un écrit qui affiche
    « 2026-03-14 » ou « 84.20 » se voit immédiatement comme rédigé par une
    machine, sur un document qui doit être pris au sérieux.
    """
    if valeur is None:
        return ""
    if isinstance(valeur, date):
        return valeur.strftime("%d/%m/%Y")
    if isinstance(valeur, Decimal):
        return f"{valeur:.2f}".replace(".", ",")
    if isinstance(valeur, bool):
        return "Oui" if valeur else "Non"
    return str(valeur)


def _suivre(chemin: str, contexte: dict[str, Any], aujourdhui: date) -> Any:
    """Résout `identite.nom`, `document.montant` ou `@aujourdhui:%Y`."""
    if chemin.startswith("@"):
        jeton, _, motif = chemin[1:].partition(":")
        if jeton != "aujourdhui":
            raise ErreurGabarit(f"« @{jeton} » inconnu (seul « @aujourdhui » existe)")
        return aujourdhui.strftime(motif) if motif else aujourdhui

    valeur: Any = contexte
    for rang, morceau in enumerate(chemin.split(".")):
        if isinstance(valeur, dict):
            if morceau not in valeur:
                if rang == 0:
                    raise ErreurGabarit(
                        f"« {chemin} » : rien nommé « {morceau} » "
                        f"(disponible : {', '.join(valeur) or 'rien'})"
                    )
                raise ErreurGabarit(f"« {chemin} » : « {morceau} » inconnu")
            valeur = valeur[morceau]
        else:
            if not hasattr(valeur, morceau):
                raise ErreurGabarit(f"« {chemin} » : « {morceau} » inconnu")
            valeur = getattr(valeur, morceau)
    return valeur


def resoudre_texte(gabarit: str, contexte: dict[str, Any], aujourdhui: date | None = None) -> str:
    """Le gabarit avec chaque `{jeton}` remplacé par sa valeur du contexte.

    Un chemin inconnu lève plutôt que de laisser un blanc : dans un écrit
    administratif, un champ vide et un champ oublié se ressemblent trop pour
    laisser la différence au hasard.
    """
    aujourdhui = aujourdhui or date.today()
    return JETON.sub(
        lambda trouve: formater(_suivre(trouve.group(1).strip(), contexte, aujourdhui)),
        gabarit,
    )


def resoudre_champs(champs: dict[str, Any], contexte: dict[str, Any],
                     aujourdhui: date | None = None) -> dict[str, Any]:
    """Un plan de formulaire (nom de champ → gabarit) devient des valeurs.

    Un booléen coche, un gabarit composé (`"{identite.prenom} {identite.nom}"`)
    se résout comme du texte, toute autre valeur est simplement formatée. Un
    chemin inconnu lève plutôt que de laisser un blanc — sur un formulaire, un
    champ vide et un champ oublié se ressemblent trop.
    """
    aujourdhui = aujourdhui or date.today()
    valeurs: dict[str, Any] = {}
    for nom, brut in champs.items():
        if isinstance(brut, bool):
            valeurs[nom] = brut
            continue
        if not isinstance(brut, str):
            valeurs[nom] = formater(brut)
            continue
        try:
            valeurs[nom] = JETON.sub(
                lambda trouve: formater(_suivre(trouve.group(1).strip(), contexte, aujourdhui)),
                brut,
            )
        except ErreurGabarit as erreur:
            raise ErreurGabarit(f"champ « {nom} » : {erreur}") from None
    return valeurs


def texte_lisible_en_pdf(texte: str) -> str:
    """`texte`, avec ce que les polices de base d'un PDF ne savent pas tracer
    remplacé par un équivalent latin-1. Voir le préambule de ce fichier."""
    return texte.translate(TRANSPOSITION)


def date_en_toutes_lettres(jour: date | None) -> str:
    """« 1er septembre 2026 », « 12 mars 2024 ».

    Le premier du mois prend « er » et lui seul — les autres quantièmes
    s'écrivent en chiffres nus. C'est la faute qui signale immédiatement une
    lettre écrite par une machine, sur un document qui doit être pris au
    sérieux.
    """
    if jour is None:
        return "[date]"
    quantieme = "1er" if jour.day == 1 else str(jour.day)
    return f"{quantieme} {MOIS_FRANCAIS[jour.month - 1]} {jour.year}"


def controler_mentions(contenu: str, mentions_obligatoires: Iterable[str]) -> tuple[str, ...]:
    """Les mentions attendues qui n'apparaissent pas dans `contenu`.

    `mentions_obligatoires` est une liste de sous-chaînes à trouver telles
    quelles — le produit appelant décide de leur forme exacte (une référence
    client, une date au format attendu, le mot « confirmation »…) ; ce fichier
    ne fait que vérifier leur présence, comme `paper-manager/core/
    resiliation.py::controler`.
    """
    return tuple(m for m in mentions_obligatoires if m not in contenu)
