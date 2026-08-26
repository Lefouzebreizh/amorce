"""Parcours, quarantaine et déplacements sûrs.

Deux décisions y sont tenues :

1. **Rien ne se supprime** (README, décision 3). `mettre_en_quarantaine` déplace
   dans un dossier daté et consigne d'où venait le fichier ; c'est ce qui rend
   un faux positif rattrapable. Aucun autre fichier du projet n'a le droit
   d'appeler `Path.unlink()` sur un fichier de l'utilisateur.
2. **Le parcours ne s'arrête jamais.** Un dossier réel contient un fichier de
   0 octet, un nom avec un saut de ligne, un lien symbolique qui boucle, un
   fichier verrouillé par une autre application. Chacun est consigné et enjambé :
   échouer au millième fichier sur deux mille est le meilleur moyen de perdre le
   travail des neuf cent quatre-vingt-dix-neuf premiers.

Reste à écrire : `empreinte` (SHA d'un fichier), `purger_quarantaine` (après
`securite.retention_quarantaine_jours`) et `deplacer` (rangement).
"""

from __future__ import annotations

import json
import os
import shutil
from collections.abc import Callable, Iterable, Iterator
from datetime import date, timedelta
from pathlib import Path

# Le fichier que dépose la quarantaine à côté des photos écartées. Sans lui, un
# dossier daté plein de JPG ne dit pas d'où ils viennent, et une remise en place
# devient une enquête.
NOM_DU_MANIFESTE = "origines.jsonl"


def parcourir(
    racines: Iterable[Path],
    extensions: Iterable[str] | None = None,
    exclusions: Iterable[str] = (),
    consigner: Callable[[Path, str], None] | None = None,
) -> Iterator[Path]:
    """Rend les fichiers des dossiers demandés, sans jamais s'interrompre.

    Les liens symboliques ne sont pas suivis : un lien qui pointe vers son
    propre parent fait tourner le parcours indéfiniment, et un dossier
    personnel en contient plus souvent qu'on ne croit (sauvegardes, montages
    réseau, dossiers synchronisés).
    """
    voulues = {extension.lower().lstrip(".") for extension in extensions} if extensions else None
    motifs = list(exclusions)
    vus: set[tuple[int, int]] = set()

    def signaler(erreur: OSError) -> None:
        if consigner:
            consigner(Path(erreur.filename or "?"), f"inaccessible ({erreur.strerror})")

    for racine in racines:
        racine = Path(racine).expanduser()
        if not racine.exists():
            if consigner:
                consigner(racine, "dossier introuvable")
            continue
        for dossier, sous_dossiers, fichiers in os.walk(racine, followlinks=False, onerror=signaler):
            dossier_chemin = Path(dossier)
            sous_dossiers[:] = [
                sous for sous in sous_dossiers
                if not _exclu(dossier_chemin / sous, motifs)
            ]
            for nom in fichiers:
                chemin = dossier_chemin / nom
                if _exclu(chemin, motifs):
                    continue
                if voulues is not None and chemin.suffix.lower().lstrip(".") not in voulues:
                    continue
                if chemin.is_symlink():
                    continue
                try:
                    infos = chemin.stat()
                except OSError as erreur:
                    if consigner:
                        consigner(chemin, f"illisible ({erreur.strerror})")
                    continue
                # Deux dossiers d'entrée qui se recouvrent (« ~/Bureau » et
                # « ~/Bureau/À trier ») rendraient deux fois le même fichier,
                # qui se retrouverait doublon de lui-même.
                identite = (infos.st_dev, infos.st_ino)
                if identite in vus:
                    continue
                vus.add(identite)
                yield chemin


def _exclu(chemin: Path, motifs: list[str]) -> bool:
    from fnmatch import fnmatch

    # `fnmatch` fait traverser les séparateurs à `*`, ce qui donne à
    # « **/node_modules/** » le sens attendu sans écrire un moteur de motifs.
    texte = str(chemin)
    return any(fnmatch(texte, motif) for motif in motifs)


def nom_disponible(cible: Path) -> Path:
    """Un chemin libre à partir de celui demandé : `photo.jpg`, `photo (2).jpg`…

    Deux photos écartées le même jour peuvent porter le même nom et venir de
    deux dossiers différents. Écraser la première annulerait la promesse de la
    quarantaine, qui est de pouvoir tout remettre en place.
    """
    if not cible.exists():
        return cible
    rang = 2
    while True:
        candidat = cible.with_name(f"{cible.stem} ({rang}){cible.suffix}")
        if not candidat.exists():
            return candidat
        rang += 1


def mettre_en_quarantaine(chemin: Path, dossier_quarantaine: Path, motif: str) -> Path:
    """Déplace un fichier dans la quarantaine du jour et note son origine.

    Le dossier est daté pour que la purge (après
    `securite.retention_quarantaine_jours`) sache ce qui a dépassé le délai, et
    pour qu'une reprise en main humaine porte sur « ce qu'a fait la commande de
    mardi » plutôt que sur un tas.
    """
    dossier_du_jour = Path(dossier_quarantaine).expanduser() / date.today().isoformat()
    dossier_du_jour.mkdir(parents=True, exist_ok=True)
    destination = nom_disponible(dossier_du_jour / chemin.name)

    # `shutil.move` traverse les systèmes de fichiers, `Path.rename` non : la
    # quarantaine est souvent sur un autre disque que les photos.
    shutil.move(str(chemin), str(destination))

    with (dossier_du_jour / NOM_DU_MANIFESTE).open("a", encoding="utf-8") as manifeste:
        manifeste.write(json.dumps(
            {"origine": str(chemin), "quarantaine": str(destination), "motif": motif},
            ensure_ascii=False,
        ) + "\n")
    return destination


def purger_quarantaine(dossier_quarantaine: Path, retention_jours: int, journal) -> int:
    """Efface les dépôts datés au-delà du délai de rétention. Rend leur nombre.

    C'est ici, et nulle part ailleurs, que de l'espace disque est réellement
    rendu — l'unique effacement du projet. Le délai est la seule chose qui
    sépare « écarté » de « perdu » : le ramener à zéro reviendrait à supprimer
    directement, ce que la validation de la configuration refuse par ailleurs.
    """
    racine = Path(dossier_quarantaine).expanduser()
    if not racine.is_dir():
        return 0

    limite = date.today() - timedelta(days=max(0, retention_jours))
    purges = 0
    for depot in sorted(racine.iterdir()):
        if not depot.is_dir():
            continue
        try:
            jour = date.fromisoformat(depot.name)
        except ValueError:
            # Un dossier au nom inattendu n'a pas été créé par la quarantaine :
            # il ne nous appartient pas, on n'y touche pas.
            continue
        if jour > limite:
            continue
        if journal.prevoir(f"purge : quarantaine du {depot.name} "
                           f"(plus de {retention_jours} jours)"):
            try:
                shutil.rmtree(depot)
            except OSError as erreur:
                journal.incident(depot, f"purge impossible ({erreur.strerror})")
                continue
        purges += 1
    return purges
