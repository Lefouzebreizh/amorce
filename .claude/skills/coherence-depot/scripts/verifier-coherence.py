#!/usr/bin/env python3
"""Compare ce que le dépôt dit de lui-même à ce qu'il est.

Ce dépôt se décrit lui-même dans `CLAUDE.md`, dans ses compétences et dans son
hook de démarrage. Ces descriptions sont sa mémoire : c'est ce qu'une session
neuve lit avant d'écrire une ligne. Elles ont un défaut, et un seul, mais il est
grave — **elles vieillissent en silence**. Un projet ajouté par une session
pendant qu'une autre travaillait, et la liste des projets est fausse ; personne
ne le voit, parce qu'aucun test n'échoue sur une phrase.

Mesuré sur une seule journée de ce dépôt : « trois projets » quand il y en avait
six, une section annonçant deux règles et en listant trois, une ligne d'outillage
qui cachait cinq installations du hook, quatre compétences absentes de leur
propre table. Aucune de ces erreurs n'était détectable autrement qu'en relisant
tout — et personne ne relit tout.

D'où ce script, qui ne fait qu'une chose : **compter des deux côtés et
comparer**. Il ne juge pas le style, il ne réécrit rien.

Deux gravités, et la distinction est le cœur de l'outil :

- **faux** : démontrable. Un chemin cité qui n'existe pas, une compétence
  absente de sa table, un nombre écrit qui ne correspond pas au compte réel.
- **à regarder** : une piste, qui demande un humain. Un projet sans ligne dans
  le hook peut n'avoir aucune dépendance à installer — le script ne peut pas le
  savoir, il le signale et se tait.

Bibliothèque standard pure : il doit répondre sur un dépôt fraîchement cloné,
avant toute installation.

Usage :
    python3 .claude/skills/coherence-depot/scripts/verifier-coherence.py
    python3 … --strict     # sortir en erreur dès qu'un « à regarder » apparaît
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]

# Les nombres tels qu'on les écrit dans une phrase française. Le dépôt écrit
# « héberge **dix projets** » : c'est cette forme-là qui vieillit sans bruit.
NOMBRES = {
    "un": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6,
    "sept": 7, "huit": 8, "neuf": 9, "dix": 10, "onze": 11, "douze": 12,
    "treize": 13, "quatorze": 14, "quinze": 15, "seize": 16, "vingt": 20,
}

# Ce qui, à la racine, n'est pas un projet mais un dossier de service.
PAS_DES_PROJETS = {
    "node_modules", "public", "scripts", "src", "inbox", "projets-actifs",
    "archives-backlog", ".claude", ".github", ".git", ".fixtures", ".travail",
}

# Ce qui trahit un projet : un fichier que seul un projet possède.
MARQUEURS = ("README.md", "package.json", "requirements.txt", "pubspec.yaml", "CLAUDE.md")


class Releve:
    def __init__(self) -> None:
        self.faux: list[str] = []
        self.regarder: list[str] = []

    def faux_si(self, condition: bool, message: str) -> None:
        if condition:
            self.faux.append(message)

    def regarder_si(self, condition: bool, message: str) -> None:
        if condition:
            self.regarder.append(message)


def projets_reels() -> set[str]:
    trouves = set()
    for dossier in sorted(RACINE.iterdir()):
        if not dossier.is_dir() or dossier.name in PAS_DES_PROJETS or dossier.name.startswith("."):
            continue
        if any((dossier / marqueur).exists() for marqueur in MARQUEURS):
            trouves.add(dossier.name)
    # Les chantiers en sommeil comptent : leur condition de reprise est que
    # leurs tests restent verts, donc qu'on continue de les connaître.
    sommeil = RACINE / "archives-backlog"
    if sommeil.is_dir():
        for dossier in sorted(sommeil.iterdir()):
            if dossier.is_dir() and any((dossier / m).exists() for m in MARQUEURS):
                trouves.add(f"archives-backlog/{dossier.name}")
    return trouves


def controler_projets(claude_md: str, releve: Releve) -> None:
    reels = projets_reels()
    # Un projet en sommeil est cité par son nom court (« `mon-app-audio/` »),
    # pas par son chemin complet : chercher les deux, sinon le contrôle crie
    # pour rien — et un contrôle qui crie faux, on cesse de le lire.
    non_cites = sorted(
        nom for nom in reels
        if nom not in claude_md and nom.split("/")[-1] not in claude_md
    )
    releve.faux_si(
        bool(non_cites),
        f"projet(s) absent(s) de CLAUDE.md : {', '.join(non_cites)}. "
        "Une session neuve ne saura pas qu'ils existent.",
    )

    annonce = re.search(r"héberge \*\*(\w+) projets", claude_md)
    if annonce:
        compte_annonce = NOMBRES.get(annonce.group(1).lower())
        # Les projets en sommeil sont comptés à part dans la phrase du dépôt :
        # on compare donc au seul décompte de premier niveau. Et la racine
        # elle-même est un projet — le studio Amorce n'a pas de sous-dossier,
        # l'oublier fait crier le contrôle sur une phrase juste.
        premier_niveau = len([n for n in reels if "/" not in n]) + 1
        releve.faux_si(
            compte_annonce is not None and compte_annonce != premier_niveau,
            f"CLAUDE.md annonce « {annonce.group(1)} projets » ({compte_annonce}) "
            f"pour {premier_niveau} projet(s) à la racine.",
        )


def controler_competences(claude_md: str, releve: Releve) -> None:
    dossier = RACINE / ".claude" / "skills"
    if not dossier.is_dir():
        return
    sur_disque = {d.name for d in dossier.iterdir() if (d / "SKILL.md").is_file()}
    citees = set(re.findall(r"`/([a-z0-9-]+)`", claude_md))

    absentes = sorted(sur_disque - citees)
    releve.faux_si(
        bool(absentes),
        f"compétence(s) sur disque mais absente(s) de la table de CLAUDE.md : "
        f"{', '.join(absentes)}.",
    )
    fantomes = sorted(nom for nom in citees - sur_disque if not nom.startswith("verifier"))
    releve.regarder_si(
        bool(fantomes),
        f"nom(s) en `/…` cité(s) dans CLAUDE.md sans compétence correspondante : "
        f"{', '.join(fantomes)}. Commande intégrée, ou compétence disparue ?",
    )


def controler_agents(claude_md: str, releve: Releve) -> None:
    dossier = RACINE / ".claude" / "agents"
    if not dossier.is_dir():
        return
    sur_disque = {f.stem for f in dossier.glob("*.md")}
    cites = set(re.findall(r"[Aa]gent `([a-z0-9-]+)`", claude_md))
    absents = sorted(sur_disque - cites)
    releve.faux_si(
        bool(absents),
        f"agent(s) sur disque mais absent(s) de CLAUDE.md : {', '.join(absents)}.",
    )


def manifeste_avec_dependances(package: Path) -> bool:
    """Un `package.json` sans dépendance n'a rien à installer.

    Le réseau d'annuaires en porte un pour ses seuls scripts npm : le signaler
    comme absent du hook réclamerait une installation qui n'installerait rien,
    et cet avertissement-là reviendrait à chaque session sans rien à corriger.
    """
    if not package.is_file():
        return False
    try:
        manifeste = json.loads(package.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return True  # illisible : mieux vaut le signaler que le taire
    return bool(manifeste.get("dependencies") or manifeste.get("devDependencies"))


def controler_hook(releve: Releve) -> None:
    hook = RACINE / ".claude" / "hooks" / "session-start.sh"
    if not hook.is_file():
        return
    # En minuscules : le hook nomme les projets à l'humaine (« Paper-Manager »),
    # le disque les nomme en kebab-case. Comparer tel quel ferait signaler un
    # projet pourtant installé.
    texte = hook.read_text(encoding="utf-8").lower()
    for projet in sorted(projets_reels()):
        court = projet.split("/")[-1]
        installable = any(
            (RACINE / projet / f).exists() for f in ("requirements.txt", "pubspec.yaml")
        ) or manifeste_avec_dependances(RACINE / projet / "package.json")
        releve.regarder_si(
            installable and court.lower() not in texte and projet.lower() not in texte,
            f"« {projet} » a des dépendances à installer mais n'apparaît pas dans "
            "le hook de démarrage : chaque session distante les réinstallera à la main.",
        )


def controler_tests_python(releve: Releve) -> None:
    workflow = RACINE / ".github" / "workflows" / "tests-python.yml"
    if not workflow.is_file():
        return
    texte = workflow.read_text(encoding="utf-8")
    profondeur_max = 0
    for motif in re.findall(r"-maxdepth (\d+)", texte):
        profondeur_max = max(profondeur_max, int(motif))

    for dossier in sorted(RACINE.rglob("tests")):
        if "node_modules" in dossier.parts or not dossier.is_dir():
            continue
        # Les dossiers en point sont des caches ignorés par git — `.verif-ci/`
        # (le rejeu local de la CI) y copie le dépôt entier et y installe un
        # environnement Python, ce qui faisait remonter vingt-quatre suites
        # fantômes, dont celles de numpy. Aucun projet de ce dépôt n'a ses
        # tests sous un dossier en point.
        if any(part.startswith(".") for part in dossier.parts):
            continue
        if not any(dossier.glob("test_*.py")):
            continue
        relatif = dossier.relative_to(RACINE)
        releve.regarder_si(
            profondeur_max and len(relatif.parts) > profondeur_max,
            f"« {relatif} » est à {len(relatif.parts)} niveaux, au-delà du "
            f"-maxdepth {profondeur_max} du workflow : ces tests ne tournent pas en CI.",
        )


def controler_chemins_cites(claude_md: str, releve: Releve) -> None:
    """Les chemins entre accents graves qui ne désignent plus rien.

    C'est le contrôle qui attrape un dossier déplacé : `mon-app-audio/` cité au
    présent alors qu'il est passé sous `archives-backlog/`.
    """
    # Le dépôt cite ses chemins depuis plusieurs racines implicites : `src/`
    # pour l'application, `.claude/` pour l'outillage, `archives-backlog/` pour
    # ce qui dort. Les essayer toutes avant de déclarer un chemin mort.
    bases = [RACINE, RACINE / "src", RACINE / ".claude", RACINE / "archives-backlog"]
    manquants = []
    for chemin in sorted(set(re.findall(r"`([\w./-]+/[\w./-]*)`", claude_md))):
        if chemin.startswith(("http", "@", "~")) or " " in chemin:
            continue
        if "*" in chemin or chemin.startswith("."):
            continue
        propre = chemin.rstrip("/")
        if any((base / propre).exists() for base in bases):
            continue
        # `next/font`, `node:test` : des paquets, pas des chemins du dépôt.
        if (RACINE / "node_modules" / propre.split("/")[0]).exists():
            continue
        # Dernier recours : le fichier existe peut-être ailleurs dans l'arbre.
        feuille = propre.split("/")[-1]
        if feuille and any(RACINE.rglob(f"**/{feuille}")):
            continue
        manquants.append(chemin)
    releve.faux_si(
        bool(manquants),
        f"chemin(s) cité(s) dans CLAUDE.md qui n'existe(nt) pas : {', '.join(manquants)}.",
    )


def controler_listes_numerotees(claude_md: str, releve: Releve) -> None:
    """« Deux règles en découlent » suivi de trois puces.

    Le cas s'est produit tel quel. Il ne se voit pas à la relecture parce qu'on
    lit les puces, jamais la phrase qui les annonce.
    """
    lignes = claude_md.splitlines()
    for index, ligne in enumerate(lignes):
        annonce = re.search(
            r"\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+"
            r"(règles?|points?|décisions?|pièges?|invariants?|raisons?|parades?)\b",
            ligne, re.IGNORECASE)
        if not annonce or ":" not in ligne:
            continue
        attendu = NOMBRES.get(annonce.group(1).lower())
        puces = 0
        for suivante in lignes[index + 1: index + 40]:
            if re.match(r"^[-*] |^\d+\. ", suivante):
                puces += 1
            elif suivante.strip() and not suivante.startswith(" "):
                break
        releve.faux_si(
            attendu is not None and puces and attendu != puces,
            f"ligne {index + 1} : « {annonce.group(0)} » annoncé, {puces} puce(s) "
            "suivent. L'un des deux ment.",
        )


def main(argv: list[str]) -> int:
    claude_md = (RACINE / "CLAUDE.md").read_text(encoding="utf-8")
    releve = Releve()

    controler_projets(claude_md, releve)
    controler_competences(claude_md, releve)
    controler_agents(claude_md, releve)
    controler_chemins_cites(claude_md, releve)
    controler_listes_numerotees(claude_md, releve)
    controler_hook(releve)
    controler_tests_python(releve)

    for message in releve.faux:
        print(f"  ✗  {message}")
    for message in releve.regarder:
        print(f"  ⚠  {message}")

    if releve.faux:
        print(f"\n{len(releve.faux)} affirmation(s) fausse(s), "
              f"{len(releve.regarder)} point(s) à regarder.")
        return 1
    if releve.regarder and "--strict" in argv:
        print(f"\n{len(releve.regarder)} point(s) à regarder (--strict).")
        return 1
    print(f"Le dépôt dit vrai sur lui-même"
          f"{f' — {len(releve.regarder)} point(s) à regarder' if releve.regarder else ''}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
