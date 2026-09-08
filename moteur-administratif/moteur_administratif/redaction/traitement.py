"""Gabarit sur disque + contexte → `Ecrit`, et mise en PDF. Impur.

`composer` couvre le cas texte (une lettre, un courrier) — voir plus bas pour
la mise en page. Le remplissage d'un PDF à champs (AcroForm) ou plat (par
coordonnées) est porté depuis `paper-manager/core/formulaires.py::remplir` ;
la mise en page d'une lettre A4 depuis `paper-manager/core/
resiliation.py::rendre_pdf`. Six décisions, reprises telles quelles de la
source :

1. **Le plan est versionné, le PDF vierge ne l'est pas.** Repérer les champs
   d'un Cerfa est un travail de dix minutes ; le refaire chaque année est la
   corvée qui fait abandonner l'outil.
2. **Deux chemins, selon ce que le PDF contient.** Un formulaire à champs
   (AcroForm) se remplit par ses champs. Un PDF plat — un scan, un formulaire
   fabriqué à partir d'un traitement de texte — n'a rien à remplir : on pose
   du texte aux coordonnées données par `positions`.
3. **Un champ du plan absent du PDF arrête tout.** Un Cerfa change de
   millésime et renomme ses champs sans prévenir. Remplir silencieusement neuf
   champs sur douze produit un document qui a l'air complet, et qui revient
   trois semaines plus tard.
4. **La valeur « cochée » n'est jamais écrite en dur dans le plan.** Elle vaut
   `/Yes` sur un formulaire, `/1` ou `/Oui` sur le suivant. Le plan dit `true`,
   le module va chercher l'état déclaré par la case elle-même.
5. **Le résultat est aplati par défaut.** Un formulaire dont les champs
   restent vivants se rouvre modifiable par n'importe quel lecteur, et
   beaucoup d'imprimantes et de guichets ne régénèrent pas l'apparence des
   champs : la feuille sort vierge.
6. **Le PDF d'origine n'est jamais touché.** Il resservira l'an prochain.

Rien de ce qui est écrit ici ne part jamais sur le réseau : composer ou mettre
en page un écrit ne l'envoie pas, et cette brique ne contient aucun chemin
d'envoi.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import date
from pathlib import Path
from typing import Any

import pymupdf

from . import regles
from .modele import Champ, Ecrit, Plan

TAILLE_DEFAUT = 10.0
MARGE = 60.0
LARGEUR_UTILE = 475.0
INTERLIGNE = 1.45
TAILLE_LETTRE = 10.5


class ErreurFormulaire(Exception):
    """Plan invalide, champ introuvable, ou valeur refusée par le PDF."""


# --- l'écrit texte (lettre, courrier) ------------------------------------------


def composer(chemin_gabarit: str | Path, contexte: dict[str, Any],
             mentions_obligatoires: Iterable[str] = (),
             aujourdhui: date | None = None) -> Ecrit:
    """Lit le gabarit, le résout, contrôle ses mentions obligatoires.

    Ne lève pas si une mention manque : `Ecrit.mentions_manquantes` porte
    l'information, et c'est au produit appelant de décider ce qu'il en fait
    (refuser de produire un fichier, l'écrire quand même en le marquant
    incomplet…) — voir le préambule de `modele.Ecrit`.
    """
    chemin = Path(chemin_gabarit)
    brut = chemin.read_text(encoding="utf-8")
    contenu = regles.resoudre_texte(brut, contexte, aujourdhui)
    manquantes = regles.controler_mentions(contenu, mentions_obligatoires)
    return Ecrit(gabarit=chemin.stem, contenu=contenu, mentions_manquantes=manquantes)


def rendre_lettre_pdf(ecrit: Ecrit, expediteur: list[str], destinataire: list[str],
                       lieu_et_date: str, chemin: str | Path,
                       recommande: bool = False) -> Path:
    """Met un écrit en page sur du A4, prêt à imprimer et à signer.

    La première ligne de `ecrit.contenu` est l'objet du courrier (un gabarit
    commence par `Objet : ...`), le reste en est le corps — c'est la
    convention déjà suivie par les gabarits de `paper-manager/modeles/`.
    `expediteur` et `destinataire` sont des blocs de lignes déjà composés par
    l'appelant : ce module met en page, il ne connaît aucune structure
    d'identité ou d'abonnement.
    """
    objet, _, corps = ecrit.contenu.partition("\n")
    objet = objet.removeprefix("Objet :").strip()

    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    curseur = _Curseur(document, page)

    curseur.bloc(MARGE, 70, LARGEUR_UTILE / 2, expediteur)
    curseur.bloc(320, 170, 235, destinataire)
    curseur.bloc(320, 260, 235, [lieu_et_date])

    curseur.y = 320
    if recommande:
        curseur.paragraphe("Lettre recommandée avec accusé de réception", gras=True)
    curseur.paragraphe(f"Objet : {objet}", gras=True)
    curseur.y += 12
    for paragraphe in corps.strip().split("\n\n"):
        curseur.paragraphe(paragraphe.replace("\n", " ").strip())
    curseur.y += 30
    curseur.paragraphe("Signature :")

    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    document.save(chemin)
    document.close()
    return chemin


class _Curseur:
    """Pose des blocs de texte de haut en bas, et tourne la page quand il faut."""

    def __init__(self, document: pymupdf.Document, page: pymupdf.Page) -> None:
        self.document = document
        self.page = page
        self.y = MARGE

    def bloc(self, x: float, y: float, largeur: float, lignes: list[str]) -> None:
        for ligne in [l for l in lignes if l.strip()]:
            self.page.insert_text((x, y), regles.texte_lisible_en_pdf(ligne),
                                  fontname="helv", fontsize=TAILLE_LETTRE)
            y += TAILLE_LETTRE * 1.3

    def paragraphe(self, texte: str, gras: bool = False) -> None:
        police = "hebo" if gras else "helv"
        restant = 842 - MARGE - self.y
        # `insert_textbox` rend la hauteur inutilisée : c'est ce qui permet
        # d'enchaîner les paragraphes sans calculer soi-même les retours à la
        # ligne.
        cadre = pymupdf.Rect(MARGE, self.y, MARGE + LARGEUR_UTILE, self.y + restant)
        reste = self.page.insert_textbox(cadre, regles.texte_lisible_en_pdf(texte),
                                         fontname=police, fontsize=TAILLE_LETTRE,
                                         lineheight=INTERLIGNE)
        if reste < 0:
            self.page = self.document.new_page(width=595, height=842)
            self.y = MARGE
            cadre = pymupdf.Rect(MARGE, self.y, MARGE + LARGEUR_UTILE, 842 - MARGE)
            reste = self.page.insert_textbox(cadre, regles.texte_lisible_en_pdf(texte),
                                             fontname=police, fontsize=TAILLE_LETTRE,
                                             lineheight=INTERLIGNE)
        self.y += cadre.height - reste + TAILLE_LETTRE * 0.6


# --- le formulaire à champs (Cerfa, mandat) -------------------------------------


def charger_plan(chemin: str | Path) -> Plan:
    """Relit un plan de formulaire versionné (JSON)."""
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


def remplir_formulaire(pdf: str | Path, valeurs: dict[str, Any], sortie: str | Path,
                        positions: dict[str, dict[str, Any]] | None = None,
                        aplatir: bool = True) -> list[str]:
    """Écrit `valeurs` dans `pdf` et enregistre le résultat dans `sortie`.

    Rend les noms des champs effectivement écrits. Lève si un champ ne trouve
    sa place ni parmi les champs du PDF ni dans `positions` : mieux vaut un
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
        widget.field_value = regles.formater(valeur)
    widget.update()


def _surcouche(document: pymupdf.Document, nom: str, position: dict[str, Any],
               valeur: Any) -> None:
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
        # une case de formulaire fait quatorze points de côté, soit moins que
        # la hauteur de ligne d'un texte de dix points.
        marque = position.get("coche", "X")
        taille = float(position.get("taille", min(TAILLE_DEFAUT, hauteur * 0.8)))
        largeur = pymupdf.get_text_length(marque, fontname=police, fontsize=taille)
        page.insert_text(
            (gauche + max(0.0, (droite - gauche - largeur) / 2),
             haut + hauteur / 2 + taille * 0.35),  # 0,35 : demi-hauteur de capitale
            regles.texte_lisible_en_pdf(marque), fontname=police, fontsize=taille,
        )
        return

    texte = regles.formater(valeur)
    if not texte:
        return

    taille = float(position.get("taille", TAILLE_DEFAUT))
    reste = page.insert_textbox(
        pymupdf.Rect(gauche, haut, droite, bas),
        regles.texte_lisible_en_pdf(texte),
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
