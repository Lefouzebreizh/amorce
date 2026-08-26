#!/usr/bin/env python3
"""Remplir un PDF — un Cerfa, un mandat, un bulletin d'adhésion.

Un formulaire administratif se remplit une fois par an, à l'identique, avec les
mêmes vingt informations. Ce module fait de ce travail un fichier de **plan**,
écrit une fois et rejoué toujours : `modeles/formulaires/<nom>.json` associe
chaque champ du PDF à l'endroit où sa valeur se trouve déjà.

Six décisions, toutes payées par un essai raté :

1. **Le plan est versionné, le PDF vierge ne l'est pas.** Repérer les champs
   d'un Cerfa est un travail de dix minutes ; le refaire chaque année est la
   corvée qui fait abandonner l'outil. Le plan est du JSON, il se relit et se
   corrige ; le PDF vierge est un binaire et vit dans `coffre/formulaires/`.
2. **Deux chemins, selon ce que le PDF contient.** Un formulaire à champs
   (AcroForm) se remplit par ses champs. Un PDF plat — un scan, un formulaire
   fabriqué à partir d'un traitement de texte — n'a rien à remplir : on pose du
   texte aux coordonnées données par `positions`. `paper.py champs` dit dans
   quel cas on est.
3. **Un champ du plan absent du PDF arrête tout.** Un Cerfa change de millésime
   et renomme ses champs sans prévenir. Remplir silencieusement neuf champs sur
   douze produit un document qui a l'air complet, et qui revient trois semaines
   plus tard.
4. **La valeur « cochée » n'est jamais écrite en dur dans le plan.** Elle vaut
   `/Yes` sur un formulaire, `/1` ou `/Oui` sur le suivant. Le plan dit `true`,
   le module va chercher l'état déclaré par la case elle-même. C'est le détail
   qui casse un plan recopié d'un autre Cerfa.
5. **Le résultat est aplati par défaut.** Un formulaire dont les champs restent
   vivants se rouvre modifiable par n'importe quel lecteur, et surtout beaucoup
   d'imprimantes et de guichets ne régénèrent pas l'apparence des champs : la
   feuille sort vierge. `bake()` grave les valeurs dans la page.
6. **Le PDF d'origine n'est jamais touché.** Il resservira l'an prochain.

Un piège mesuré : sur le chemin « surcouche », les polices de base d'un PDF
(Helvetica et consorts) sont limitées au latin-1. `œ`, `€` et le tiret cadratin
y sont **silencieusement** remplacés par `?` — vérifié : « Cœur 78,42 € » ressort
« C?ur 78,42 ? ». D'où la table de transposition ci-dessous, appliquée au seul
chemin surcouche : le chemin par champs, lui, passe l'Unicode sans broncher.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pymupdf

# Ce que les polices de base ne savent pas tracer, et par quoi le remplacer.
TRANSPOSITION = str.maketrans({
    "œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE",
    "€": "EUR", "—": "-", "–": "-", "…": "...",
    "’": "'", "‘": "'", "“": '"', "”": '"',
})

JETON = re.compile(r"\{([^{}]+)\}")
FORMAT_DATE = "%d/%m/%Y"          # ce qu'attend un formulaire français
TAILLE_DEFAUT = 10.0


class ErreurFormulaire(Exception):
    """Plan invalide, champ introuvable ou valeur refusée par le PDF."""


@dataclass(frozen=True)
class Champ:
    """Un champ tel que le PDF le déclare."""

    nom: str
    page: int
    type: str                       # texte, case, radio, liste
    rect: tuple[float, float, float, float]
    valeurs: list[str] = field(default_factory=list)
    valeur_actuelle: str = ""


@dataclass(frozen=True)
class Plan:
    """Le lien, fait une fois, entre un formulaire et mes données."""

    nom: str
    titre: str
    source: Path
    champs: dict[str, Any]
    positions: dict[str, dict[str, Any]] = field(default_factory=dict)


def charger_plan(chemin: str | Path) -> Plan:
    chemin = Path(chemin)
    if not chemin.exists():
        raise ErreurFormulaire(f"{chemin} est introuvable")
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ErreurFormulaire(f"{chemin} ligne {erreur.lineno} : {erreur.msg}") from None
    if not isinstance(brut.get("champs"), dict) or not brut["champs"]:
        raise ErreurFormulaire(f"{chemin} : la section « champs » est vide")
    return Plan(
        nom=brut.get("nom") or chemin.stem,
        titre=brut.get("titre", ""),
        source=Path(brut.get("source", "")),
        champs=brut["champs"],
        positions=brut.get("positions") or {},
    )


def lire_champs(pdf: str | Path) -> list[Champ]:
    """Ce que le PDF déclare. Liste vide : le PDF est plat, il faut des `positions`."""
    document = pymupdf.open(pdf)
    try:
        releve: list[Champ] = []
        for numero, page in enumerate(document, start=1):
            for widget in page.widgets():
                etats = widget.button_states() or {}
                releve.append(Champ(
                    nom=widget.field_name,
                    page=numero,
                    type=_genre(widget),
                    rect=tuple(widget.rect),
                    valeurs=[v for v in (etats.get("normal") or []) if v != "Off"],
                    valeur_actuelle=str(widget.field_value or ""),
                ))
        return releve
    finally:
        document.close()


def _genre(widget: pymupdf.Widget) -> str:
    return {
        pymupdf.PDF_WIDGET_TYPE_TEXT: "texte",
        pymupdf.PDF_WIDGET_TYPE_CHECKBOX: "case",
        pymupdf.PDF_WIDGET_TYPE_RADIOBUTTON: "radio",
        pymupdf.PDF_WIDGET_TYPE_COMBOBOX: "liste",
        pymupdf.PDF_WIDGET_TYPE_LISTBOX: "liste",
    }.get(widget.field_type, "texte")


def formater(valeur: Any) -> str:
    """Une valeur telle qu'elle s'écrit sur un formulaire français.

    Les dates en 14/03/2026 et les montants à la virgule : un formulaire rempli
    en 2026-03-14 se fait retourner par le guichet.
    """
    if valeur is None:
        return ""
    if isinstance(valeur, date):
        return valeur.strftime(FORMAT_DATE)
    if isinstance(valeur, Decimal):
        return f"{valeur:.2f}".replace(".", ",")
    if isinstance(valeur, bool):
        return "Oui" if valeur else "Non"
    return str(valeur)


def _suivre(chemin: str, contexte: dict[str, Any], aujourdhui: date) -> Any:
    """Résout `identite.nom`, `abonnement.engagement.fin` ou `@aujourdhui:%Y`."""
    if chemin.startswith("@"):
        jeton, _, motif = chemin[1:].partition(":")
        if jeton != "aujourdhui":
            raise ErreurFormulaire(f"« @{jeton} » inconnu (seul « @aujourdhui » existe)")
        return aujourdhui.strftime(motif) if motif else aujourdhui
    valeur: Any = contexte
    for rang, morceau in enumerate(chemin.split(".")):
        if isinstance(valeur, dict):
            if morceau not in valeur:
                if rang == 0:
                    # Le cas courant : un plan qui parle du contrat sans qu'aucun
                    # contrat n'ait été désigné. Dire ce qui est disponible évite
                    # de faire chercher la faute dans le plan.
                    raise ErreurFormulaire(
                        f"« {chemin} » : rien nommé « {morceau} » "
                        f"(disponible : {', '.join(valeur) or 'rien'})"
                    )
                raise ErreurFormulaire(f"« {chemin} » : « {morceau} » inconnu")
            valeur = valeur[morceau]
        else:
            if not hasattr(valeur, morceau):
                raise ErreurFormulaire(f"« {chemin} » : « {morceau} » inconnu")
            valeur = getattr(valeur, morceau)
    return valeur


def resoudre(
    champs: dict[str, Any], contexte: dict[str, Any], aujourdhui: date | None = None
) -> dict[str, Any]:
    """Le plan devient des valeurs. Pur : ni disque, ni PDF, donc vérifiable seul.

    Un gabarit compose (`"{identite.prenom} {identite.nom}"`) ; un booléen coche.
    Un chemin inconnu lève plutôt que de laisser un blanc : sur un formulaire,
    un champ vide et un champ oublié se ressemblent trop.
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
        except ErreurFormulaire as erreur:
            raise ErreurFormulaire(f"champ « {nom} » : {erreur}") from None
    return valeurs


def remplir(
    pdf: str | Path,
    valeurs: dict[str, Any],
    sortie: str | Path,
    positions: dict[str, dict[str, Any]] | None = None,
    aplatir: bool = True,
) -> list[str]:
    """Écrit `valeurs` dans `pdf` et enregistre le résultat dans `sortie`.

    Renvoie les noms des champs effectivement écrits. Lève si un champ du plan
    n'existe ni parmi les champs du PDF ni dans `positions` : mieux vaut un
    programme qui s'arrête qu'un formulaire à trous envoyé de bonne foi.
    """
    pdf, sortie = Path(pdf), Path(sortie)
    if pdf.resolve() == sortie.resolve():
        raise ErreurFormulaire("le formulaire vierge ne doit pas être écrasé : donner une autre sortie")
    positions = positions or {}

    document = pymupdf.open(pdf)
    try:
        restants = dict(valeurs)
        ecrits: list[str] = []
        for page in document:
            for widget in page.widgets():
                if widget.field_name not in restants:
                    continue
                _poser(widget, restants.pop(widget.field_name))
                ecrits.append(widget.field_name)

        for nom, valeur in list(restants.items()):
            if nom not in positions:
                continue
            _surcouche(document, nom, positions[nom], valeur)
            ecrits.append(nom)
            del restants[nom]

        if restants:
            connus = ", ".join(sorted(c.nom for c in lire_champs(pdf))) or "aucun"
            raise ErreurFormulaire(
                f"champs introuvables dans le formulaire : {', '.join(sorted(restants))}. "
                f"Champs du PDF : {connus}. "
                "Un Cerfa qui change de millésime renomme ses champs : reprendre le plan."
            )

        if aplatir:
            # Grave les valeurs dans la page : sans cela, un lecteur qui ne
            # régénère pas les apparences imprime un formulaire vide.
            document.bake(annots=False, widgets=True)
        sortie.parent.mkdir(parents=True, exist_ok=True)
        document.save(sortie)
        return ecrits
    finally:
        document.close()


def _poser(widget: pymupdf.Widget, valeur: Any) -> None:
    genre = _genre(widget)
    if genre in ("case", "radio"):
        etats = [v for v in ((widget.button_states() or {}).get("normal") or []) if v != "Off"]
        if isinstance(valeur, bool):
            # L'état « coché » appartient au formulaire : /Yes ici, /1 ailleurs.
            widget.field_value = etats[0] if (valeur and etats) else valeur
        else:
            texte = str(valeur)
            if etats and texte not in etats:
                raise ErreurFormulaire(
                    f"champ « {widget.field_name} » : « {texte} » refusé "
                    f"(valeurs possibles : {', '.join(etats)})"
                )
            widget.field_value = texte
    else:
        widget.field_value = formater(valeur)
    widget.update()


def _surcouche(
    document: pymupdf.Document, nom: str, position: dict[str, Any], valeur: Any
) -> None:
    """Pose du texte aux coordonnées données, pour un PDF sans champs."""
    try:
        page = document[int(position["page"]) - 1]
        gauche, haut, droite, bas = (float(v) for v in position["rect"])
    except (KeyError, ValueError, TypeError, IndexError):
        raise ErreurFormulaire(
            f"position de « {nom} » : « page » (à partir de 1) et « rect » "
            "[gauche, haut, droite, bas] sont attendus"
        ) from None

    police = position.get("police", "helv")
    hauteur = bas - haut

    if valeur is False:
        return
    if valeur is True:
        # Une croix se centre dans sa case, elle ne s'y « fait pas couler » :
        # une case de formulaire fait quatorze points de côté, soit moins que la
        # hauteur de ligne d'un texte de dix points.
        marque = position.get("coche", "X")
        taille = float(position.get("taille", min(TAILLE_DEFAUT, hauteur * 0.8)))
        largeur = pymupdf.get_text_length(marque, fontname=police, fontsize=taille)
        page.insert_text(
            (gauche + max(0.0, (droite - gauche - largeur) / 2),
             haut + hauteur / 2 + taille * 0.35),   # 0,35 : demi-hauteur de capitale
            marque.translate(TRANSPOSITION), fontname=police, fontsize=taille,
        )
        return

    texte = formater(valeur)
    if not texte:
        return

    taille = float(position.get("taille", TAILLE_DEFAUT))
    reste = page.insert_textbox(
        pymupdf.Rect(gauche, haut, droite, bas),
        texte.translate(TRANSPOSITION),
        fontname=police,
        fontsize=taille,
        align=pymupdf.TEXT_ALIGN_LEFT,
    )
    if reste < 0:
        # `insert_textbox` ne dessine rien plutôt que de déborder : sans ce
        # contrôle, le champ sortirait vide sans le moindre message.
        raise ErreurFormulaire(
            f"« {nom} » : « {texte} » ne tient pas dans le cadre à la taille {taille:g}. "
            "Agrandir « rect » ou baisser « taille »."
        )
