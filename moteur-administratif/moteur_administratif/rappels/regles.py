"""Une liste de `Rappel` → le contenu d'un fichier `.ics`. Pur : pas de disque ici.

Porté depuis `paper-manager/core/calendrier.py`, le plus abouti des deux
versions trouvées dans le dépôt (testé jusqu'au pliage de ligne). Dépouillé de
tout ce qui appartenait à paper-manager — `Configuration`, `Alerte`, les
intitulés par type d'alerte — pour ne garder que la mécanique du format, déjà
générique : heure flottante, pliage RFC 5545 en octets, UID stable.

Aucune dépendance : ni `icalendar` ni aucune bibliothèque de calendrier. Une
alerte n'a qu'une date et une heure flottante (« 8 h là où se trouve
l'appareil ») ; il ne restait qu'une trentaine de lignes de format texte à
écrire à la main — moins que le coût d'une dépendance à installer sur chaque
machine qui régénère le fichier.
"""

from __future__ import annotations

from datetime import date, datetime, time

from .modele import Rappel

PRODUIT_PAR_DEFAUT = "-//Moteur administratif//FR"
OCTETS_PAR_LIGNE = 75  # RFC 5545 : 75 octets, continuation par une espace
DUREE = "PT30M"


def echapper(texte: str) -> str:
    """Protège les caractères que la norme réserve à sa propre grammaire.

    L'ordre compte : l'antislash d'abord, sinon on échappe les échappements
    qu'on vient de poser. Une virgule non protégée coupe la valeur en deux, et
    l'agenda affiche la moitié d'une consigne — ce qui est pire que rien.
    """
    return (texte.replace("\\", "\\\\")
                 .replace(";", "\\;")
                 .replace(",", "\\,")
                 .replace("\n", "\\n"))


def plier(ligne: str) -> str:
    """Coupe une ligne trop longue en respectant la limite de 75 **octets**.

    Compter en caractères couperait au mauvais endroit dès le premier accent,
    et couper au milieu d'un caractère UTF-8 produit un fichier que l'agenda
    refuse d'ouvrir, sans dire pourquoi.
    """
    morceaux: list[str] = []
    courant = b""
    for caractere in ligne:
        octets = caractere.encode("utf-8")
        # Un octet de moins pour les lignes de continuation : elles commencent
        # par une espace, qui compte dans la limite.
        limite = OCTETS_PAR_LIGNE if not morceaux else OCTETS_PAR_LIGNE - 1
        if len(courant) + len(octets) > limite:
            morceaux.append(courant.decode("utf-8"))
            courant = b""
        courant += octets
    morceaux.append(courant.decode("utf-8"))
    return "\r\n ".join(morceaux)


def _propriete(nom: str, valeur: str, brut: bool = False) -> str:
    return plier(f"{nom}:{valeur if brut else echapper(valeur)}")


def _uid(rappel: Rappel) -> str:
    """Stable d'une écriture à l'autre : même rappel, même identifiant.

    Calculé sur le libellé et la date plutôt que reçu en argument — ce module
    ne demande pas au produit appelant de gérer des identifiants, seulement de
    fournir des `Rappel`. Réimporter le fichier après avoir corrigé un détail
    remplace donc l'événement ; changer le libellé ou la date, en revanche, en
    crée un nouveau — c'est le prix de ne pas porter d'identifiant propre.
    """
    from hashlib import sha256

    graine = f"{rappel.libelle}|{rappel.quand.isoformat()}"
    return sha256(graine.encode("utf-8")).hexdigest()[:24] + "@moteur-administratif"


def composer_ics(rappels: list[Rappel], le: date, heure: time = time(8, 0),
                  rappels_jours_avant: tuple[int, ...] = (30, 7, 1),
                  produit: str = PRODUIT_PAR_DEFAUT) -> str:
    """Le fichier `.ics` complet, terminaisons de ligne CRLF comprises.

    Un événement par rappel, plusieurs sonneries dedans (`rappels_jours_avant`)
    plutôt qu'un événement par sonnerie — l'agenda montre la date une fois, et
    prévient à chaque échéance choisie. `le` sert à l'horodatage `DTSTAMP` :
    tiré du jour demandé et non de l'heure d'exécution, pour que la sortie soit
    déterministe — même entrée, même fichier à l'octet près.
    """
    horodatage = f"{le:%Y%m%d}T000000Z"
    lignes = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        _propriete("PRODID", produit, brut=True),
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for rappel in rappels:
        debut = datetime.combine(rappel.quand, heure)
        lignes += [
            "BEGIN:VEVENT",
            _propriete("UID", _uid(rappel), brut=True),
            f"DTSTAMP:{horodatage}",
            f"DTSTART:{debut:%Y%m%dT%H%M%S}",  # sans Z ni TZID : heure flottante
            f"DURATION:{DUREE}",
            _propriete("SUMMARY", rappel.libelle),
            _propriete("DESCRIPTION", rappel.detail),
        ]
        for jours in rappels_jours_avant:
            lignes += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                f"TRIGGER:{f'-P{jours}D' if jours else 'PT0S'}",
                _propriete("DESCRIPTION", rappel.libelle),
                "END:VALARM",
            ]
        lignes.append("END:VEVENT")
    lignes.append("END:VCALENDAR")
    return "\r\n".join(lignes) + "\r\n"
