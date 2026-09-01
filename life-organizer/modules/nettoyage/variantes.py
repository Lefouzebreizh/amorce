"""Décider quels fichiers sont redondants sans ouvrir une seule image.

Ce fichier complète `regles.py` là où l'empreinte perceptuelle ne va pas. Elle
ne décrit qu'une image : un `rapport (1).pdf`, un `notes copie.txt` ou une
planche réexportée lui échappent entièrement, alors que ce sont eux qui
encombrent un espace de travail.

Trois décisions le tiennent :

1. **Un nom qui se ressemble ne prouve rien ; un contenu identique, si.** « Copie
   de facture.pdf » peut être une version corrigée, pas un doublon. On ne
   propose donc d'écarter une variante que si son empreinte de contenu est
   exactement celle de l'original. Le nom sert à rapprocher, l'empreinte à
   trancher — l'inverse ferait perdre du travail.

2. **On garde ce qui ne se recalcule pas.** Un export PDF, une planche composée,
   une vignette se refabriquent depuis leur source en une commande ; le rush,
   lui, ne se reconstitue pas. Quand les deux sont là, c'est le dérivé qui part
   en quarantaine — jamais l'inverse, quel que soit son poids.

3. **Le volume se signale, il ne se juge pas.** Un fichier de deux gigaoctets
   n'est pas un défaut : c'est peut-être le seul master d'un tournage. On le
   relève pour que l'utilisateur décide, et on ne propose jamais de l'écarter
   sur ce seul critère.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from noyau.modele import Fiche

# Marques que les systèmes et les services ajoutent en dupliquant un fichier.
# Ancrées en fin de nom : « copie-de-sauvegarde.txt » n'est pas une copie de
# « .txt », et un dossier réel en contient toujours un pour se moquer de vous.
MARQUES_DE_COPIE = (
    r"\s*\(\d+\)",           # rapport (1).pdf, rapport (12).pdf
    r"\s*-\s*copie",         # rapport - copie.pdf
    r"\s*copie",             # rapport copie.pdf
    r"\s*-\s*copy",          # rapport - Copy.pdf
    r"\s*copy",              # rapport copy.pdf
    r"\s*-\s*\d+",           # rapport - 2.pdf
)

_MARQUES = re.compile("(?:" + "|".join(MARQUES_DE_COPIE) + ")+$", re.IGNORECASE)


def nom_de_base(chemin: Path) -> str:
    """Le nom débarrassé de ses marques de copie, extension comprise.

    Répété jusqu'à point fixe : les services empilent volontiers les marques,
    et « rapport copie (2).pdf » doit rejoindre « rapport.pdf ».
    """
    tige = chemin.stem
    while True:
        reduit = _MARQUES.sub("", tige).strip()
        if reduit == tige or not reduit:
            break
        tige = reduit
    return f"{tige}{chemin.suffix}".lower()


def est_une_variante(chemin: Path) -> bool:
    """Vrai quand le nom porte une marque de copie."""
    return nom_de_base(chemin) != f"{chemin.stem}{chemin.suffix}".lower()


@dataclass(frozen=True)
class Redondance:
    """Un original et ses variantes confirmées par le contenu."""

    original: Fiche
    variantes: list[Fiche] = field(default_factory=list)
    motif: str = ""

    @property
    def octets_recuperables(self) -> int:
        return sum(f.poids_octets for f in self.variantes)


def grouper_variantes_de_nom(
    fiches: list[Fiche],
    empreintes: dict[Path, str],
) -> list[Redondance]:
    """Rapproche par le nom, ne tranche que sur l'empreinte.

    Une variante dont l'empreinte diffère est laissée en place : elle porte un
    travail que son nom ne dit pas. C'est le cas le plus fréquent des « copie de
    contrat » qu'on a annotées puis oubliées.
    """
    par_base: dict[str, list[Fiche]] = {}
    for fiche in fiches:
        par_base.setdefault(nom_de_base(fiche.chemin), []).append(fiche)

    redondances: list[Redondance] = []
    for groupe in par_base.values():
        if len(groupe) < 2:
            continue
        # L'original est celui qui ne porte pas de marque ; à défaut, le plus
        # ancien, qui est celui dont les autres descendent.
        sans_marque = [f for f in groupe if not est_une_variante(f.chemin)]
        original = min(sans_marque or groupe, key=lambda f: (f.date_horodatage, str(f.chemin)))

        reference = empreintes.get(original.chemin)
        if not reference:
            continue

        variantes = [
            f for f in groupe
            if f.chemin != original.chemin and empreintes.get(f.chemin) == reference
        ]
        if variantes:
            redondances.append(Redondance(
                original=original,
                variantes=variantes,
                motif=f"même contenu que « {original.chemin.name} », nom dupliqué",
            ))
    return redondances


def derives_recalculables(
    fiches: list[Fiche],
    derives: dict[str, list[str]],
) -> list[Redondance]:
    """Les fichiers qu'une source encore présente permet de refabriquer.

    `derives` associe une extension dérivée aux extensions sources qui la
    produisent — un PDF se recalcule depuis un `.psd`, un `.md` ou un `.svg`.
    Sans source retrouvée sous le même nom, le dérivé reste : personne ne veut
    perdre un export dont l'original a disparu.
    """
    par_tige: dict[str, list[Fiche]] = {}
    for fiche in fiches:
        par_tige.setdefault(fiche.chemin.stem.lower(), []).append(fiche)

    redondances: list[Redondance] = []
    for groupe in par_tige.values():
        extensions = {f.chemin.suffix.lower().lstrip("."): f for f in groupe}
        for extension, fiche in extensions.items():
            sources = derives.get(extension)
            if not sources:
                continue
            trouvee = next((extensions[s] for s in sources if s in extensions), None)
            if trouvee is None:
                continue
            redondances.append(Redondance(
                original=trouvee,
                variantes=[fiche],
                motif=f"se recalcule depuis « {trouvee.chemin.name} »",
            ))
    return redondances


def volumineux(fiches: list[Fiche], seuil_mo: float) -> list[Fiche]:
    """Les fichiers au-dessus du seuil, du plus lourd au plus léger.

    Un relevé, pas un verdict : rien n'est proposé à l'écart sur ce seul motif.
    """
    if seuil_mo <= 0:
        return []
    seuil = seuil_mo * 1024 * 1024
    return sorted(
        (f for f in fiches if f.poids_octets >= seuil),
        key=lambda f: f.poids_octets,
        reverse=True,
    )
