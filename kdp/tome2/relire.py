#!/usr/bin/env python3
"""Contrôle typographique du texte de bulle, avant qu'il ne soit pixellisé.

Le Tome 1 a coûté trois coquilles et sept virgules de vocatif, toutes
rattrapables uniquement en régénérant la planche. La leçon n'est pas « mieux
relire » : c'est que le texte doit exister, hors de l'image, sous une forme
qu'une machine puisse vérifier. C'est ce que fait ce script.

Il lit les répliques du dossier — les lignes de tableau qui portent un numéro de
panneau — et applique les règles énoncées en tête du dossier. Ce qu'il signale
en ERREUR est faux à coup sûr. Ce qu'il signale en DOUTE demande un œil : mieux
vaut trois fausses alertes qu'une négation manquante partie chez l'imprimeur.
"""

from __future__ import annotations

import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

INSECABLES = (" ", " ")      # espace insécable, espace fine insécable
DOUBLES = "!?:;"
MOTS_MAX = 22

# « pas » est aussi un nom commun : sans cette liste, « un pas de fourmi »
# déclencherait une alerte de négation à chaque fois.
PAS_NOM = re.compile(r"\b(un|le|ce|petit|premier|mon|son|deux|trois)\s+pas\b", re.I)


@dataclass
class Alerte:
    page: str
    panneau: str
    gravite: str          # 'ERREUR' | 'DOUTE'
    regle: str
    extrait: str


def _phrases(texte: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.!?…])\s+", texte) if p.strip()]


def controler_replique(page: str, panneau: str, texte: str) -> list[Alerte]:
    a: list[Alerte] = []
    def erreur(regle, extrait): a.append(Alerte(page, panneau, "ERREUR", regle, extrait))
    def doute(regle, extrait): a.append(Alerte(page, panneau, "DOUTE", regle, extrait))

    if "'" in texte:
        erreur("apostrophe droite", _autour(texte, texte.index("'")))
    if '"' in texte:
        erreur("guillemet droit", _autour(texte, texte.index('"')))
    if "«" in texte or "»" in texte:
        erreur("guillemets dans une bulle", texte[:50])
    if "..." in texte:
        erreur("points de suspension en trois caractères", _autour(texte, texte.index("...")))
    if re.search(r"…\s*\.", texte) or "...." in texte:
        erreur("points de suspension surnuméraires", texte[:50])

    for signe in DOUBLES:
        for m in re.finditer(re.escape(signe), texte):
            avant = texte[m.start() - 1] if m.start() else ""
            if avant == "":
                continue
            if avant not in INSECABLES:
                gravite = erreur if avant == " " or avant.isalnum() else doute
                gravite("espace insécable avant « %s »" % signe, _autour(texte, m.start()))

    if re.search(r"^\s*…", texte):
        erreur("points de suspension en tête de réplique", texte[:40])

    mots = len(re.findall(r"\S+", texte))
    if mots > MOTS_MAX:
        erreur(f"bulle de {mots} mots (maximum {MOTS_MAX})", texte[:60])

    for phrase in _phrases(texte):
        for nom in ("Roussy", "Zéphy"):
            for m in re.finditer(rf"(.{{0,2}})\b{nom}\b\s*[.!?…]*$", phrase):
                if m.group(1).strip() and not m.group(1).rstrip().endswith(","):
                    doute("virgule du vocatif", phrase[-40:])
        sans_nom = PAS_NOM.sub(" ", phrase)
        # Insensible à la casse : « Ne remercie pas » ouvre une phrase, et une
        # regex sensible à la casse le prenait pour une négation tronquée.
        if re.search(r"\bpas\b", sans_nom, re.I) and not re.search(r"\bne\b|\bn[’']", phrase, re.I):
            doute("négation sans « ne »", phrase[:60])

    return a


def _autour(texte: str, i: int, marge: int = 14) -> str:
    return texte[max(0, i - marge):i + marge].replace("\n", " ")


LIGNE = re.compile(r"^\|\s*\*\*(\d)\*\*\s*\|(.+?)\|\s*$")
TITRE = re.compile(r"^##\s+(Page\s+\d+\s+—\s+.+?)\s*$")
# Le parchemin est la phrase la plus reprise du livre : c'est elle qui devient
# la carte partagée sur les réseaux. Elle relève des mêmes règles que les bulles.
PARCHEMIN = re.compile(r"^>\s+\*(.+?)\*\s*$")


def _a_redresser(ligne: str) -> bool:
    return bool(LIGNE.match(ligne) or PARCHEMIN.match(ligne))


def lire(dossier: Path) -> list[tuple[str, str, str]]:
    """Répliques du dossier : (page, panneau, texte), balisage retiré."""
    repliques, page = [], "?"
    for ligne in dossier.read_text("utf-8").splitlines():
        if (t := TITRE.match(ligne)):
            page = t.group(1)
        elif (q := PARCHEMIN.match(ligne)):
            repliques.append((page, "parchemin", q.group(1)))
        elif (m := LIGNE.match(ligne)):
            brut = m.group(2)
            for morceau in re.split(r"\*\*(?:Roussy|Zéphy|Le korrigan|L’hermine)\s*:\*\*", brut):
                texte = re.sub(r"\*\*|\*", "", morceau).strip()
                if texte:
                    repliques.append((page, m.group(1), texte))
    return repliques


def main() -> int:
    import argparse
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("dossier")
    a.add_argument("--corriger", action="store_true",
                   help="pose les insécables et redresse les apostrophes des répliques")
    args = a.parse_args()
    chemin = Path(args.dossier)

    if args.corriger:
        # Uniquement dans les lignes de réplique. Le corps du dossier est de la
        # prose ordinaire et les prompts sont en anglais : ni l'un ni l'autre
        # n'a à porter des espaces insécables à la française.
        sorties, touchees = [], 0
        for ligne in chemin.read_text("utf-8").splitlines():
            if _a_redresser(ligne):
                avant = ligne
                ligne = re.sub(r"(?<=\w)'(?=\w)", "\u2019", ligne)
                ligne = re.sub(r" ([!?:;])", "\u202f\\1", ligne)
                touchees += avant != ligne
            sorties.append(ligne)
        chemin.write_text("\n".join(sorties) + "\n", "utf-8")
        print(f"{touchees} ligne(s) redressée(s) : "
              f"apostrophes courbes, espaces fines insécables")

    repliques = lire(chemin)
    alertes = [al for p, n, t in repliques for al in controler_replique(p, n, t)]
    erreurs = [a for a in alertes if a.gravite == "ERREUR"]

    print(f"{len(repliques)} répliques lues, {len(erreurs)} erreur(s), "
          f"{len(alertes) - len(erreurs)} point(s) à vérifier\n")
    page = None
    for al in alertes:
        if al.page != page:
            page = al.page
            print(f"  {page}")
        print(f"    {al.gravite:6s} panneau {al.panneau} · {al.regle}\n"
              f"           « {al.extrait.strip()} »")
    if not alertes:
        print("  Rien à signaler.")
    return 1 if erreurs else 0


if __name__ == "__main__":
    raise SystemExit(main())
