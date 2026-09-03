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

Reste à écrire : rien. `empreinte`, `purger_quarantaine` et `deplacer` sont là.
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

# Ce que ces dossiers contiennent, d'après la configuration livrée elle-même :
# relevés de compte, RIB, avis d'imposition, décomptes de mutuelle, ordonnances,
# baux, cartes grises. Sur un poste familial ou une machine d'entreprise, le
# mode par défaut (0o755 sous un umask 0o022) les rend lisibles par n'importe
# quel autre compte local, sans privilège particulier.
#
# Le manifeste aggrave le cas : il consigne le **chemin d'origine complet** de
# chaque fichier écarté, ce qui cartographie l'arborescence personnelle même
# pour qui ne lirait pas les documents eux-mêmes.
MODE_DOSSIER_PRIVE = 0o700
MODE_FICHIER_PRIVE = 0o600


def creer_dossier_prive(dossier: Path) -> Path:
    """Crée un dossier lisible par son seul propriétaire, parents compris.

    Trois pièges de `Path.mkdir` justifient cette fonction plutôt qu'un
    paramètre `mode=` posé aux quatre appels :

    1. **`mode` ne s'applique pas aux parents.** Avec `parents=True`, les
       dossiers intermédiaires sont créés au mode par défaut — donc la
       bibliothèque serait privée mais son parent ouvert.
    2. **`mode` est masqué par l'umask**, qui est un réglage global qu'aucun
       outil ne maîtrise. Le `chmod` explicite, lui, pose la valeur voulue.
    3. **`exist_ok=True` ne touche pas un dossier déjà là.** Un dossier créé
       avant cette version garderait ses droits ouverts pour toujours.

    Le **dossier demandé** est resserré même s'il existait déjà : c'est celui de
    l'outil, et une bibliothèque créée avant cette version garderait sinon ses
    droits ouverts pour toujours — le cas exact que le constat I-2 décrit.

    Ses **parents existants**, eux, ne sont jamais touchés : le dossier
    personnel, un point de montage, un disque partagé ne nous appartiennent pas,
    et resserrer leurs droits parce qu'on range dedans serait une surprise
    désagréable — voire une casse ailleurs.

    Sur Windows, le mode POSIX est ignoré par la plateforme. Le `README` le dit
    plutôt que de laisser croire à une protection uniforme.
    """
    dossier = Path(dossier).expanduser()
    a_resserrer = [parent for parent in dossier.parents if not parent.exists()]
    dossier.mkdir(parents=True, exist_ok=True)
    for cree in [dossier, *a_resserrer]:
        try:
            cree.chmod(MODE_DOSSIER_PRIVE)
        except OSError:
            # Windows, un système de fichiers sans droits POSIX, un montage en
            # lecture seule : le rangement reste plus utile que la permission.
            pass
    return dossier


def ouvrir_prive(fichier: Path, mode: str = "a", **options):
    """Ouvre un fichier en le créant, s'il le faut, lisible par son seul propriétaire.

    Le `chmod` vient **avant** l'ouverture pour qu'il n'existe aucun instant où
    le fichier est lisible par d'autres — une fenêtre de quelques microsecondes
    suffit à un autre processus qui attend.
    """
    fichier = Path(fichier)
    if not fichier.exists():
        fichier.touch(mode=MODE_FICHIER_PRIVE)
        try:
            fichier.chmod(MODE_FICHIER_PRIVE)
        except OSError:
            pass
    return fichier.open(mode, **options)


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
    dossier_du_jour = creer_dossier_prive(
        Path(dossier_quarantaine).expanduser() / date.today().isoformat())
    destination = nom_disponible(dossier_du_jour / chemin.name)

    # `shutil.move` traverse les systèmes de fichiers, `Path.rename` non : la
    # quarantaine est souvent sur un autre disque que les photos.
    shutil.move(str(chemin), str(destination))

    with ouvrir_prive(dossier_du_jour / NOM_DU_MANIFESTE, encoding="utf-8") as manifeste:
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


def empreinte(chemin: Path, taille_bloc: int = 1 << 20) -> str:
    """SHA-256 d'un fichier, lu par blocs d'un mégaoctet.

    Par blocs et non d'un coup : une vidéo de quatre gigaoctets chargée en
    mémoire fait tomber la machine, et c'est précisément sur les gros fichiers
    qu'un déplacement entre deux disques mérite d'être vérifié.
    """
    from hashlib import sha256

    resume = sha256()
    with chemin.open("rb") as flux:
        while bloc := flux.read(taille_bloc):
            resume.update(bloc)
    return resume.hexdigest()


def deplacer(source: Path, destination: Path, verifier: bool = False) -> Path:
    """Range un fichier à sa destination (ou au premier nom libre) et rend le chemin écrit.

    Quand `verifier` est demandé
    (`securite.verifier_empreinte_apres_deplacement`), la copie est relue et
    comparée à l'original **avant** que celui-ci ne soit retiré. C'est le seul
    ordre qui protège : `shutil.move` entre deux disques copie puis supprime, et
    une copie tronquée par un disque plein ou un câble USB qui lâche laisserait
    un fichier abîmé et plus aucun original pour le remplacer.
    """
    destination = nom_disponible(destination)
    creer_dossier_prive(destination.parent)

    if not verifier:
        shutil.move(str(source), str(destination))
        return destination

    attendue = empreinte(source)
    shutil.copy2(str(source), str(destination))
    if empreinte(destination) != attendue:
        destination.unlink(missing_ok=True)
        raise OSError(f"copie abîmée de {source} : l'original n'a pas été touché")
    source.unlink()
    return destination
