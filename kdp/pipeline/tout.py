#!/usr/bin/env python3
"""Toute la chaîne, d'un dossier de rushes aux deux PDF de dépôt.

    python3 kdp/pipeline/tout.py --rushes DOSSIER --travail DOSSIER \\
            [--correspondance fichier.json]

Sept étapes, dans cet ordre et pas un autre. L'ordre n'est pas un détail :

- les coquilles se corrigent **avant** l'agrandissement, pour que le lettrage
  rapiécé subisse exactement le même traitement que le reste de la phrase ;
- la page 17 se refabrique **avant** l'agrandissement, pour la même raison ;
- la bordure se pose **avant** l'agrandissement, sinon la grappe d'angle
  prélevée sur une planche à 1600 px viendrait s'écraser sur une planche à
  2600 px ;
- l'agrandissement vient **avant** l'assemblage, évidemment ;
- la validation vient en dernier et décide seule.

Chaque étape écrit dans son propre dossier plutôt que de modifier le précédent :
quand une planche sort de travers, on veut pouvoir remonter la chaîne et voir à
quelle étape elle a basculé.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
import charte  # noqa: E402

# Planche du jeu des différences, et planche dont on emprunte la bordure.
PAGE_DU_JEU = 17
PAGE_BORDURE = 20
# La pose de bordure rentre déjà le contenu de la page du jeu : la normalisation
# ne doit pas rentrer une seconde fois, sinon cette page-là rétrécit deux fois.
RENTREE_BORDURE = 0.10


def _lancer(module: str, *arguments: str) -> None:
    commande = [sys.executable, str(RACINE / "pipeline" / f"{module}.py"), *arguments]
    resultat = subprocess.run(commande, capture_output=True, text=True)
    for ligne in resultat.stdout.splitlines():
        if "deprecated" not in ligne:
            print(f"    {ligne}")
    if resultat.returncode != 0 and module != "valider":
        print(resultat.stderr, file=sys.stderr)
        raise SystemExit(f"étape « {module} » interrompue")


def _nom(numero: int) -> str:
    page = next(p for p in charte.TOME_1 if p.numero == numero)
    return charte.nom_de_page(page.numero, page.slug, "")


def _fichier(dossier: Path, base: str) -> Path | None:
    for extension in (".png", ".webp", ".jpg", ".jpeg"):
        if (dossier / f"{base}{extension}").exists():
            return dossier / f"{base}{extension}"
    return None


def chaine(rushes: Path, travail: Path, correspondance: Path | None,
           annee: int) -> int:
    nommes, corrigees = travail / "1-nommes", travail / "2-corrigees"
    normalisees, complements = travail / "3-normalisees", travail / "4-complements"
    sortie = travail / "5-sortie"

    print("\n[1/7] Tri et renommage")
    arguments = ["--source", str(rushes), "--vers", str(nommes), "--appliquer"]
    if correspondance:
        arguments += ["--correspondance", str(correspondance)]
    _lancer("../kdp", *arguments) if False else _lancer_kdp(arguments)

    print("\n[2/7] Correction des coquilles")
    _lancer("coquilles", "--source", str(nommes), "--vers", str(corrigees))

    print("\n[3/7] Jeu des sept différences, page 17")
    jeu = _fichier(corrigees, _nom(PAGE_DU_JEU))
    if jeu:
        refait = corrigees / f"{_nom(PAGE_DU_JEU)}.png"
        _lancer("page17", "--source", str(jeu), "--vers", str(refait))
        if jeu != refait:
            jeu.unlink()
        _lancer("verifier_page17", str(refait))
        bordure = _fichier(corrigees, _nom(PAGE_BORDURE))
        _lancer("bordure", "--planche", str(refait), "--bordure", str(bordure),
                "--vers", str(refait), "--rentree", str(RENTREE_BORDURE))
    else:
        print("    page 17 absente : étape sautée")

    print("\n[4/7] Sommaire de la quatrième de couverture")
    dos = _fichier(corrigees, charte.COUVERTURE_DOS)
    if dos:
        refait = corrigees / f"{charte.COUVERTURE_DOS}.png"
        _lancer("quatrieme", "--source", str(dos), "--vers", str(refait))
        if dos != refait:
            dos.unlink()
    else:
        print("    couverture_dos absente : étape sautée")

    print("\n[5/7] Agrandissement et zone de sécurité")
    jeu_seul = travail / "2b-jeu"
    jeu_seul.mkdir(parents=True, exist_ok=True)
    refait = _fichier(corrigees, _nom(PAGE_DU_JEU))
    if refait:
        shutil.move(str(refait), jeu_seul / refait.name)
    _lancer("normaliser", "--source", str(corrigees), "--vers", str(normalisees))
    if refait:
        _lancer("normaliser", "--source", str(jeu_seul), "--vers", str(normalisees),
                "--rentree", "0.0")
        shutil.move(str(jeu_seul / refait.name), corrigees / refait.name)
    shutil.rmtree(jeu_seul, ignore_errors=True)

    print("\n[6/7] Pages de complément et assemblage")
    modele = _fichier(normalisees, _nom(PAGE_BORDURE))
    _lancer("pages_texte", "--bordure", str(modele), "--vers", str(complements),
            "--annee", str(annee), "--pages", str(charte.PAGES_MINIMUM_KDP))
    _lancer("assembler", "--planches", str(normalisees),
            "--complements", str(complements), "--vers", str(sortie))

    print("\n[7/7] Contrôle de conformité KDP")
    resultat = subprocess.run(
        [sys.executable, str(RACINE / "pipeline" / "valider.py"), "--dossier", str(sortie)],
        capture_output=True, text=True)
    for ligne in resultat.stdout.splitlines():
        if "deprecated" not in ligne:
            print(f"    {ligne}")
    return resultat.returncode


def _lancer_kdp(arguments: list[str]) -> None:
    commande = [sys.executable, str(RACINE / "kdp.py"), "renommer", *arguments]
    resultat = subprocess.run(commande, capture_output=True, text=True)
    for ligne in resultat.stdout.splitlines()[-3:]:
        if "deprecated" not in ligne:
            print(f"    {ligne}")
    if resultat.returncode != 0:
        print(resultat.stderr, file=sys.stderr)
        raise SystemExit("étape « renommer » interrompue")


if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--rushes", required=True)
    a.add_argument("--travail", required=True)
    a.add_argument("--correspondance")
    a.add_argument("--annee", type=int, default=2026)
    args = a.parse_args()
    code = chaine(Path(args.rushes), Path(args.travail),
                  Path(args.correspondance) if args.correspondance else None,
                  args.annee)
    print("\n" + ("Chaîne terminée : les deux PDF sont conformes."
                  if code == 0 else
                  "Chaîne terminée : des contrôles ont échoué, voir ci-dessus."))
    raise SystemExit(code)
