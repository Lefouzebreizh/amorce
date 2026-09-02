"""Ce que le serveur voit du coffre : des octets opaques, jamais du contenu.

Deux décisions tiennent ce fichier :

1. **Les noms sont opaques.** Le vrai nom d'un fichier, sa catégorie, sa
   date : tout ça se lit à l'œil nu dans un dossier Google Drive synchronisé,
   même si le contenu du fichier lui-même est chiffré. `nom_opaque()` rend un
   identifiant sans aucun rapport avec ce qu'il désigne ; le seul endroit où
   nom d'origine et identifiant opaque se recoupent, c'est l'index chiffré
   qu'écrit le navigateur — jamais ici.

2. **La suppression est réelle.** Le reste du projet ne supprime jamais rien
   (`noyau.fichiers`, décision 1 du projet : tout passe par la quarantaine) —
   c'est le bon défaut contre une erreur de tri accidentelle. Un document
   sensible qu'on choisit consciemment de détruire dans le coffre n'est pas ce
   cas-là. `supprimer_definitivement` est la seule fonction de tout le projet,
   avec `noyau.fichiers.purger_quarantaine`, qui a le droit d'appeler
   `Path.unlink()` — et elle écrase le contenu avant. Sur un disque mécanique,
   l'ancien contenu ne se relit plus après l'écrasement. Sur un SSD,
   l'écrasement ne garantit rien à cause de l'usure répartie du contrôleur :
   c'est dit clairement dans SECURITY.md, pas caché ici.
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
from datetime import datetime
from pathlib import Path

NOM_INDEX = "_index.enc"
NOM_CLE = "_cle.json"


def dossier_coffre(config_coffre: dict) -> Path:
    brut = config_coffre.get("dossier")
    if not brut:
        raise ValueError("coffre.dossier n'est pas configuré.")
    return Path(brut).expanduser()


def dossier_sauvegarde(config_coffre: dict) -> Path:
    brut = config_coffre.get("dossier_sauvegarde")
    if not brut:
        raise ValueError("coffre.dossier_sauvegarde n'est pas configuré.")
    return Path(brut).expanduser()


def nom_opaque() -> str:
    """Un identifiant de 32 caractères hexadécimaux, sans extension ni sens."""
    return secrets.token_hex(16)


def _chemin_sur(dossier: Path, nom: str) -> Path:
    """Le chemin, seulement s'il reste bien sous `dossier`.

    `nom` vient d'une requête HTTP : un identifiant qui contiendrait `../..`
    ne doit jamais pouvoir désigner un fichier hors du coffre.
    """
    dossier_resolu = dossier.resolve()
    candidat = (dossier_resolu / nom).resolve()
    if candidat != dossier_resolu and dossier_resolu not in candidat.parents:
        raise ValueError(f"Nom de blob invalide : {nom!r}")
    return candidat


def ecrire_blob(dossier: Path, nom: str, octets: bytes) -> Path:
    """Écrit un blob opaque, par remplacement atomique.

    Un fichier temporaire puis un renommage : un navigateur fermé ou une
    coupure réseau en plein envoi ne doit jamais laisser un blob à moitié
    écrit sous son nom final, que ce soit l'index ou un document.
    """
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = _chemin_sur(dossier, nom)
    temporaire = chemin.with_name(f".{chemin.name}.tmp")
    temporaire.write_bytes(octets)
    os.replace(temporaire, chemin)
    return chemin


def lire_blob(dossier: Path, nom: str) -> bytes:
    chemin = _chemin_sur(dossier, nom)
    return chemin.read_bytes()


def lister_blobs(dossier: Path) -> list[dict]:
    """Les objets du coffre — nom opaque, taille, date de modification.

    Jamais de nom d'origine ni de catégorie ici : ce module ne les connaît
    pas. C'est à l'index chiffré, lu côté navigateur, de les retrouver.
    """
    if not dossier.is_dir():
        return []
    objets = []
    for chemin in sorted(dossier.iterdir()):
        if not chemin.is_file() or chemin.name in (NOM_INDEX, NOM_CLE) or chemin.name.startswith("."):
            continue
        infos = chemin.stat()
        objets.append({"nom": chemin.name, "taille": infos.st_size, "modifie": infos.st_mtime})
    return objets


def lire_cle_info(dossier: Path) -> dict | None:
    """Le sel et le vérificateur du coffre — pas la phrase, pas la clé.

    Comparable à un hachage de mot de passe classique : ces valeurs ne
    permettent de retrouver ni la phrase secrète ni la clé de chiffrement,
    seulement de vérifier côté navigateur qu'une phrase tapée est la bonne.
    """
    chemin = dossier / NOM_CLE
    if not chemin.is_file():
        return None
    return json.loads(chemin.read_text(encoding="utf-8"))


def ecrire_cle_info(dossier: Path, info: dict) -> None:
    """Enregistre le sel et le vérificateur — une seule fois.

    Refuse d'écraser un coffre déjà initialisé : changer la phrase secrète
    d'un coffre qui contient déjà des documents chiffrés avec l'ancienne
    clé rendrait ces documents illisibles si ce n'était qu'un remplacement
    silencieux. Ce cas (vraiment changer de phrase secrète) n'est pas traité
    cette session — l'échappatoire documentée dans SECURITY.md est manuelle.
    """
    dossier.mkdir(parents=True, exist_ok=True)
    chemin = dossier / NOM_CLE
    if chemin.exists():
        raise FileExistsError("Ce coffre a déjà une phrase secrète.")
    chemin.write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")


def supprimer_definitivement(dossier: Path, nom: str, taille_bloc: int = 1 << 20) -> bool:
    """Écrase puis efface un blob. Irréversible sur ce disque — voir SECURITY.md.

    Trois passes (aléatoire, aléatoire, zéros) par blocs d'un mégaoctet, pour
    ne jamais charger un gros fichier entier en mémoire. Rend `False` sans
    erreur si le blob n'existe déjà plus — supprimer deux fois de suite n'est
    pas un échec.
    """
    try:
        chemin = _chemin_sur(dossier, nom)
    except ValueError:
        return False
    if not chemin.is_file():
        return False

    taille = chemin.stat().st_size
    with chemin.open("r+b") as flux:
        for _passe in range(2):
            flux.seek(0)
            reste = taille
            while reste > 0:
                bloc = min(taille_bloc, reste)
                flux.write(secrets.token_bytes(bloc))
                reste -= bloc
            flux.flush()
            os.fsync(flux.fileno())
        flux.seek(0)
        reste = taille
        while reste > 0:
            bloc = min(taille_bloc, reste)
            flux.write(b"\x00" * bloc)
            reste -= bloc
        flux.flush()
        os.fsync(flux.fileno())

    chemin.unlink()
    return True


def sauvegarder(dossier: Path, cible_sauvegarde: Path) -> Path:
    """Copie l'état actuel du coffre (déjà chiffré) dans un dossier daté séparé.

    Ne chiffre rien de plus : chaque blob est déjà indéchiffrable sans la
    phrase secrète, une copie verbatim suffit. Ce que ça change, c'est
    l'endroit — un chemin distinct de `coffre.dossier`, à pointer vers un
    disque ou un compte réellement séparé pour protéger contre autre chose
    qu'un problème sur le dossier principal (voir SECURITY.md, la sauvegarde
    n'est réellement utile que si sa destination l'est).
    """
    if not dossier.is_dir():
        raise FileNotFoundError(f"Rien à sauvegarder : {dossier} n'existe pas.")

    horodatage = datetime.now().strftime("%Y%m%d_%H%M%S")
    cible = Path(cible_sauvegarde).expanduser() / horodatage
    cible.mkdir(parents=True, exist_ok=True)

    copies = 0
    for chemin in sorted(dossier.iterdir()):
        if chemin.is_file():
            shutil.copy2(chemin, cible / chemin.name)
            copies += 1
    return cible
