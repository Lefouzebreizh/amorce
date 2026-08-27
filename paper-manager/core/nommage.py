"""Module 1 — les champs deviennent un nom de fichier et un dossier.

`AAAA-MM-JJ_Emetteur_nature_montant.pdf`, par exemple
`2026-03-14_EDF_facture_78-42EUR.pdf`, rangé dans `classes/2026/energie/`.

Pourquoi ce nom-là :

- **La date en premier**, parce qu'un dossier d'administratif se parcourt dans
  l'ordre du temps, et que le tri alphabétique d'un gestionnaire de fichiers
  devient alors le tri chronologique, partout, sans outil.
- **Le montant dans le nom**, parce que « combien ai-je payé » se répond alors
  sans rien ouvrir.
- **La virgule décimale devient un tiret** : elle casse les exports CSV et
  certains outils de synchronisation.
- **Ni accent ni espace** : ces fichiers finissent sur une clé USB, dans une
  pièce jointe ou sur un disque réseau, et chacun a sa façon de les abîmer.

Ce module est **pur** : il calcule un nom et un chemin, il n'écrit rien. Le
déplacement effectif appartient à `paper.py classer --appliquer`, qui le montre
d'abord. C'est aussi ce qui le rend testable sans disque.

Un nom déjà pris reçoit un suffixe `-2` plutôt qu'un écrasement, et un document
dont l'empreinte est déjà au journal n'est pas reclassé une seconde fois.
"""

from __future__ import annotations

import unicodedata
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Callable

from core.modele import Document

# Un émetteur peut s'appeler « Direction générale des Finances publiques ». Au
# delà, le nom de fichier devient illisible et certains systèmes le tronquent
# eux-mêmes, au milieu d'un mot et sans prévenir.
LONGUEUR_MAX = 40


class ErreurNommage(Exception):
    """Il manque au document ce sans quoi son nom n'aurait pas de sens."""


def assainir(texte: str, maximum: int = LONGUEUR_MAX) -> str:
    """Ramène un libellé à ce qui survit à une clé USB, un courriel, un partage.

    Les accents sont dépliés puis leurs signes retirés — « Électricité » devient
    « Electricite » — et tout le reste devient un tiret. Ces fichiers voyagent :
    chaque système a sa façon d'abîmer un accent ou une espace.
    """
    deplie = unicodedata.normalize("NFKD", texte)
    sans_accent = "".join(c for c in deplie if not unicodedata.combining(c))
    propre = "".join(c if c.isalnum() else "-" for c in sans_accent)
    while "--" in propre:
        propre = propre.replace("--", "-")
    return propre.strip("-")[:maximum].strip("-")


def montant_en_nom(montant: Decimal, devise: str = "EUR") -> str:
    """78,42 € devient 78-42EUR.

    La virgule décimale casse les exports CSV et certains outils de
    synchronisation ; le tiret passe partout.
    """
    return f"{montant:.2f}".replace(".", "-") + assainir(devise)


def nom_de(document: Document, modele: str, extension: str = ".pdf") -> str:
    """Le nom de fichier, sans son dossier.

    La date est obligatoire : c'est elle qui met le dossier dans l'ordre du
    temps, et un document daté « inconnu » se perd au milieu des autres. Un
    montant absent, en revanche, disparaît simplement du nom — beaucoup de
    documents n'en portent pas, et « None » n'apprend rien à personne.
    """
    if document.date_emission is None:
        raise ErreurNommage(
            f"{document.chemin} : sans date d'émission, le nom perdrait son ordre. "
            "Le document part à relire plutôt qu'au coffre."
        )
    valeurs = {
        "date": f"{document.date_emission:%Y-%m-%d}",
        "annee": f"{document.date_emission:%Y}",
        "mois": f"{document.date_emission:%m}",
        "emetteur": assainir(document.emetteur),
        "nature": assainir(document.nature.value),
        "categorie": assainir(document.categorie),
        "reference": assainir(document.reference),
        "montant": "" if document.montant is None else montant_en_nom(document.montant),
    }
    morceaux = [
        valeurs.get(champ.strip("{}"), "")
        for champ in modele.replace("}_{", "}\x00{").split("\x00")
    ]
    return "_".join(m for m in morceaux if m) + extension


def dossier_de(document: Document, modele: str) -> Path:
    """Le sous-dossier de rangement, relatif à la racine des documents classés."""
    if document.date_emission is None:
        raise ErreurNommage("sans date d'émission, l'année de rangement est inconnue")
    return Path(modele.format(
        annee=f"{document.date_emission:%Y}",
        mois=f"{document.date_emission:%m}",
        categorie=assainir(document.categorie),
        emetteur=assainir(document.emetteur),
    ))


def destination(document: Document, classes: Path, modele_dossier: str,
                modele_nom: str, extension: str = ".pdf") -> Path:
    """Où le document devrait aller. Ne vérifie rien, n'écrit rien."""
    return Path(classes) / dossier_de(document, modele_dossier) / nom_de(
        document, modele_nom, extension)


def libre(chemin: Path, existe: Callable[[Path], bool] | None = None) -> Path:
    """Décale le nom tant qu'il est pris : `-2`, `-3`…

    Jamais d'écrasement : deux factures du même émetteur, du même jour et du
    même montant existent — un abonnement double, un avoir — et la seconde qui
    remplacerait la première disparaîtrait sans que rien ne le dise.
    """
    existe = existe or (lambda p: p.exists())
    if not existe(chemin):
        return chemin
    for numero in range(2, 1000):
        candidat = chemin.with_name(f"{chemin.stem}-{numero}{chemin.suffix}")
        if not existe(candidat):
            return candidat
    raise ErreurNommage(f"{chemin} : mille homonymes, il y a autre chose à regarder")


def aujourdhui_est_plausible(jour: date, le: date) -> bool:
    """Une date d'émission dans le futur, ou d'avant l'informatique, est une erreur
    de lecture — pas un document. Le contrôle est ici parce que c'est le nommage
    qui la grave dans le nom, et qu'elle y devient très difficile à corriger."""
    return date(1990, 1, 1) <= jour <= le
