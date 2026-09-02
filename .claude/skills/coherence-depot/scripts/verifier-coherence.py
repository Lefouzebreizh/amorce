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
    "treize": 13, "quatorze": 14, "quinze": 15, "seize": 16,
    "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19, "vingt": 20,
    "vingt et un": 21, "vingt-deux": 22, "vingt-trois": 23, "vingt-quatre": 24,
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


def controler_terrain_de_index(releve: Releve) -> None:
    """Le tableau « Terrain existant » d'INDEX.md, confronté aux dossiers.

    Ce script ne lisait que `CLAUDE.md`. Or le tableau de bord des chantiers
    vit dans `INDEX.md`, et c'est LUI qu'une session lit pour noter
    l'« Alignement » d'une idée neuve. Deux dérives sont passées à travers le
    même jour : `motion/` absent du tableau alors que `CLAUDE.md` le
    documentait, puis un décompte resté à « dix-sept » quand deux chantiers de
    plus avaient atterri. Aucune n'était détectable ici, faute d'y regarder.

    Deux comparaisons, toutes deux démontrables : la phrase contre les lignes,
    et les dossiers cités contre le disque.
    """
    fichier = RACINE / "INDEX.md"
    if not fichier.is_file():
        return
    index_md = fichier.read_text(encoding="utf-8")

    lignes_actives = re.findall(r"^\|.*\| actif \|\s*$", index_md, re.MULTILINE)
    lignes_sommeil = re.findall(r"^\|.*\| en sommeil \|\s*$", index_md, re.MULTILINE)

    annonce = re.search(
        r"héberge ([\w-]+(?: et [\w-]+)?) chantiers? actifs?[^.]*?"
        r"plus ([\w-]+) en sommeil", index_md)
    if annonce and lignes_actives:
        attendu = NOMBRES.get(annonce.group(1).lower())
        releve.faux_si(
            attendu is not None and attendu != len(lignes_actives),
            f"INDEX.md annonce « {annonce.group(1)} chantiers actifs » "
            f"({attendu}) pour {len(lignes_actives)} ligne(s) « actif » "
            "dans son tableau Terrain.",
        )
        dormants = NOMBRES.get(annonce.group(2).lower())
        releve.faux_si(
            dormants is not None and dormants != len(lignes_sommeil),
            f"INDEX.md annonce « {annonce.group(2)} en sommeil » ({dormants}) "
            f"pour {len(lignes_sommeil)} ligne(s) « en sommeil ».",
        )

    # Un dossier cité par le tableau et absent du disque : le tableau envoie
    # une session sur un chemin mort. C'est arrivé quand `patrimoine/` a été
    # absorbé par `conseiller-patrimoine/` sans que sa ligne bouge.
    cites = set(re.findall(r"^\|[^|]*\(`([\w./-]+)/`\)", index_md, re.MULTILINE))
    fantomes = sorted(c for c in cites if not (RACINE / c).is_dir())
    releve.faux_si(
        bool(fantomes),
        "dossier(s) cité(s) par le tableau Terrain d'INDEX.md et absent(s) du "
        f"disque : {', '.join(fantomes)}.",
    )

    # L'inverse : un chantier livré, jamais inscrit au tableau. Signalé et non
    # démontré — un dossier neuf peut être une ressource transverse, que le
    # tableau ne liste pas, et le script ne sait pas trancher.
    racine_seule = {c for c in cites if "/" not in c}
    manquants = sorted(
        n for n in projets_reels()
        if "/" not in n and n not in racine_seule and n not in index_md
    )
    releve.regarder_si(
        bool(manquants),
        f"chantier(s) hors du tableau Terrain d'INDEX.md : {', '.join(manquants)}. "
        "Chantier oublié, ou ressource transverse ?",
    )


def controler_competences(claude_md: str, releve: Releve) -> None:
    dossier = RACINE / ".claude" / "skills"
    if not dossier.is_dir():
        return
    sur_disque = {d.name for d in dossier.iterdir() if (d / "SKILL.md").is_file()}
    # La table détaillée vit dans une référence générée depuis le disque : la
    # tenir à la main dans CLAUDE.md la rendait fausse le lendemain de chaque
    # ajout. On cherche donc les citations dans les deux fichiers.
    table = RACINE / ".claude" / "references" / "competences.md"
    texte = claude_md + (table.read_text(encoding="utf-8") if table.is_file() else "")
    citees = set(re.findall(r"`/([a-z0-9-]+)`", texte))

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


def controler_annonce_verifications(releve: Releve) -> None:
    """Un projet dont on installe les dépendances mais qu'on n'annonce pas.

    Le hook fait deux choses : il installe, et il affiche la commande de
    vérification de chaque projet — c'est cette liste-là que la session
    suivante lit pour savoir comment éprouver ce qu'elle touche. Les deux se
    perdent de vue : `paper-manager` avait son bloc d'installation et ses 259
    tests, et n'apparaissait dans aucune ligne de la liste. Le contrôle voisin
    ne l'a pas vu parce qu'il cherche le nom dans *tout* le fichier, où le bloc
    d'installation suffit à le rendre présent.

    Un projet absent de la liste n'est pas cassé — il est invisible, ce qui est
    plus long à découvrir : on ne cherche pas la suite qu'on ignore.
    """
    hook = RACINE / ".claude" / "hooks" / "session-start.sh"
    if not hook.is_file():
        return
    texte = hook.read_text(encoding="utf-8")
    bloc = re.search(r"^commandes=\((.*?)^\)", texte, re.S | re.M)
    if not bloc:
        return
    annonce = bloc.group(1).lower()

    for dossier in sorted(RACINE.rglob("tests")):
        if not dossier.is_dir() or "node_modules" in dossier.parts:
            continue
        if any(part.startswith(".") for part in dossier.parts):
            continue
        if not any(dossier.glob("test_*.py")):
            continue
        projet = dossier.parent.relative_to(RACINE).as_posix()
        court = projet.split("/")[-1]
        releve.regarder_si(
            court.lower() not in annonce and projet.lower() not in annonce,
            f"« {projet} » a une suite de tests mais aucune ligne dans la liste "
            "des vérifications du hook : la session suivante ne saura pas la lancer.",
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
        if chemin.startswith(("http", "@", "~", "/")) or " " in chemin:
            # Un chemin absolu (`/api/devis`, `/root/.claude/`) ne désigne
            # jamais un fichier du dépôt : joint à une base, pathlib
            # l'ignorerait et rendrait le chemin absolu tel quel — au
            # mieux une vérification qui ne vérifie rien, au pire un
            # `PermissionError` sur un dossier hors de portée du CI, comme
            # `/root/.claude` alors inaccessible à l'utilisateur du runner.
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
            r"(règles?|points?|décisions?|pièges?|invariants?|raisons?|parades?|"
            r"garde-fous?|contrôles?|étapes?|conséquences?|gestes?|conditions?|"
            r"chantiers?|verrous?|filets?)\b",
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


def controler_declencheurs_partages(releve: Releve) -> None:
    """Deux fiches qui citent le même symptôme se disputent le déclenchement.

    Une compétence se déclenche sur sa description. Quand deux descriptions
    revendiquent « command not found » ou « ça sonne amateur », le modèle
    tranche au jugé — et il tranche mal, sans que rien ne le signale.

    Un renvoi explicite d'une fiche vers l'autre vaut frontière tracée : la
    paire est alors délibérée, et sort du relevé. C'est ce qui distingue un
    chevauchement assumé d'une collision oubliée.
    """
    descriptions: dict[str, str] = {}
    for fiche in sorted((RACINE / ".claude" / "skills").glob("*/SKILL.md")):
        entete = re.match(r"^---\n(.*?)\n---", fiche.read_text(encoding="utf-8"), re.S)
        if not entete:
            continue
        nom = re.search(r"^name:\s*(.+)$", entete.group(1), re.M)
        desc = re.search(r"^description:\s*(.+?)(?=\n\w+:|\Z)", entete.group(1), re.M | re.S)
        if nom and desc:
            descriptions[nom.group(1).strip()] = " ".join(desc.group(1).split())

    revendications: dict[str, set[str]] = {}
    for nom, description in descriptions.items():
        for brut in re.findall(r"«\s*(.+?)\s*»", description):
            symptome = brut.lower().strip(" .?!")
            if len(symptome) > 2:
                revendications.setdefault(symptome, set()).add(nom)

    tracees = {
        (nom, autre)
        for nom, description in descriptions.items()
        for autre in descriptions
        if autre != nom and re.search(rf"[`/]{re.escape(autre)}\b", description)
    }

    collisions: dict[tuple[str, str], list[str]] = {}
    for symptome, noms in revendications.items():
        for a in sorted(noms):
            for b in sorted(noms):
                if a < b and (a, b) not in tracees and (b, a) not in tracees:
                    collisions.setdefault((a, b), []).append(symptome)

    for (a, b), symptomes in sorted(collisions.items()):
        cites = ", ".join(f"« {s} »" for s in sorted(symptomes))
        releve.regarder_si(
            True,
            f"{a} et {b} revendiquent {cites} sans que l'une renvoie à l'autre — "
            f"tracer la frontière dans la description de celle qui doit céder",
        )


def controler_projets_typescript(releve: Releve) -> None:
    """
    Tout projet TypeScript autonome doit être écarté du `tsconfig` de la racine.

    Un projet qui porte son propre `tsconfig.json` porte ses propres alias
    `@/…`. Compilé depuis la racine, chacun de ses imports pointe alors vers le
    `src/` d'Amorce : des dizaines de `TS2307` dans un projet auquel personne
    n'a touché, et le typecheck rouge sur **toutes** les branches ouvertes.

    Le piège s'est refermé trois fois en une journée — `agence`,
    `artisan-express`, `titan-builder` — parce que rien ne le signale au moment
    où on ajoute le projet, et que le rouge tombe plus tard, sur la branche de
    quelqu'un d'autre. C'est exactement ce que ce contrôle-ci existe pour
    attraper : ajouter un projet est le geste qui rend la configuration fausse.
    """
    racine = json.loads(re.sub(r"//.*", "", (RACINE / "tsconfig.json").read_text(encoding="utf-8")))
    ecartes = set(racine.get("exclude", []))

    for dossier in sorted(RACINE.iterdir()):
        if not dossier.is_dir() or dossier.name in PAS_DES_PROJETS or dossier.name.startswith("."):
            continue
        if not (dossier / "tsconfig.json").exists():
            continue
        releve.faux_si(
            dossier.name not in ecartes,
            f"{dossier.name}/ a son propre tsconfig.json mais n'est pas écarté de "
            f"celui de la racine : le typecheck d'Amorce compilera ses sources "
            f"contre les mauvais alias.",
        )


def controler_projets_dans_la_barriere(releve: Releve) -> None:
    """
    Tout projet qui sait se tester doit être routé dans `verifier.sh`.

    La barrière **énumère** les projets JavaScript et TypeScript à la main ;
    seules les suites Python sont découvertes. Un projet neuf y manque donc par
    défaut, et ses tests ne s'exécutent jamais — ce qui est pire qu'un projet
    sans tests, parce qu'on croit le contraire.

    Mesuré sur `licence-serveur/` : neuf contrôles écrits, zéro exécuté, et
    rien pour le dire. Le projet qui garde l'argent était le seul que la
    barrière ne regardait pas.

    Ce contrôle-ci a une raison d'être particulière : les autres comparent le
    dépôt à **ce qu'il dit de lui-même**, et la barrière ne dit rien d'elle —
    aucune déclaration ne la contredit, donc rien ne la surveillait.
    """
    barriere = (RACINE / ".claude" / "skills" / "verifier" / "scripts" / "verifier.sh").read_text(
        encoding="utf-8"
    )
    for dossier in sorted(RACINE.iterdir()):
        if not dossier.is_dir() or dossier.name in PAS_DES_PROJETS or dossier.name.startswith("."):
            continue
        manifeste = dossier / "package.json"
        if not manifeste.exists():
            continue
        try:
            scripts = json.loads(manifeste.read_text(encoding="utf-8")).get("scripts", {})
        except json.JSONDecodeError:
            continue
        if "test" not in scripts:
            continue
        releve.faux_si(
            f"{dossier.name}/*)" not in barriere,
            f"{dossier.name}/ sait se tester mais n'est pas routé dans verifier.sh : "
            f"ses tests ne tourneront jamais, et rien ne le dira.",
        )


def controler_projets_dans_la_ci(releve: Releve) -> None:
    """
    Tout projet qui sait se tester doit être surveillé par un workflow.

    Jumeau de `controler_projets_dans_la_barriere`, et il a fallu les deux :
    la barrière locale et l'intégration continue sont deux listes écrites à la
    main, et **réparer l'une ne répare pas l'autre**. Chaque projet npm porte
    ici son propre fichier de workflow — la racine l'écarte de son typecheck, et
    rien ne le vérifierait sans lui.

    L'oubli est invisible par construction : les tests passent en local, la CI
    reste verte, et personne n'apprend qu'elle ne les a jamais lancés. C'est
    pire qu'un projet sans tests, parce qu'on croit le contraire.

    Mesuré le 02/09/2026, à l'écriture de ce contrôle : `licence-serveur/` —
    le projet qui garde l'argent — avait quatorze tests, dont ceux de la
    signature Stripe, et aucun workflow. Il était déjà tombé dans le trou
    jumeau côté `verifier.sh`, réparé là, jamais reporté ici.

    Le marqueur cherché est le filtre de chemins (`<projet>/**`) et non le nom
    du fichier : un workflow peut s'appeler autrement que son dossier — c'est
    le cas de `hypersensible.yml` — et c'est le filtre, lui, qui décide
    réellement si le projet déclenche quelque chose.
    """
    flux = RACINE / ".github" / "workflows"
    if not flux.is_dir():
        return
    textes = [chemin.read_text(encoding="utf-8") for chemin in flux.glob("*.yml")]

    for dossier in sorted(RACINE.iterdir()):
        if not dossier.is_dir() or dossier.name in PAS_DES_PROJETS or dossier.name.startswith("."):
            continue
        manifeste = dossier / "package.json"
        if not manifeste.exists():
            continue
        try:
            scripts = json.loads(manifeste.read_text(encoding="utf-8")).get("scripts", {})
        except json.JSONDecodeError:
            continue
        if "test" not in scripts:
            continue
        releve.faux_si(
            not any(f"{dossier.name}/**" in texte for texte in textes),
            f"{dossier.name}/ sait se tester mais aucun workflow ne le surveille : "
            f"ses tests ne tourneront jamais dans la CI, qui restera verte en le disant.",
        )


def main(argv: list[str]) -> int:
    claude_md = (RACINE / "CLAUDE.md").read_text(encoding="utf-8")
    releve = Releve()

    controler_projets(claude_md, releve)
    controler_terrain_de_index(releve)
    controler_competences(claude_md, releve)
    controler_agents(claude_md, releve)
    controler_chemins_cites(claude_md, releve)
    controler_listes_numerotees(claude_md, releve)
    controler_hook(releve)
    controler_tests_python(releve)
    controler_projets_dans_la_ci(releve)
    controler_annonce_verifications(releve)
    controler_projets_typescript(releve)
    controler_declencheurs_partages(releve)
    controler_projets_dans_la_barriere(releve)

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
