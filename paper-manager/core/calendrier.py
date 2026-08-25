#!/usr/bin/env python3
"""Module 2 — les échéances deviennent des rappels.

Sortie : un fichier `.ics` que l'agenda du téléphone reprend. Pas de
notification propre au programme, pas de service qui tourne en tâche de fond :
le rappel doit arriver là où on regarde déjà, et l'agenda du téléphone est le
seul endroit qui remplit cette condition.

Cinq décisions :

1. **Le fichier est écrit à la main, sans bibliothèque.** L'ébauche de ce module
   prévoyait `icalendar` « pour les règles de récurrence et de fuseau ». Il n'y a
   ni l'une ni l'autre ici : chaque alerte a une date et une seule, et l'heure
   est flottante (voir plus bas). Restaient trente lignes de format texte —
   moins que le coût d'une dépendance à installer sur chaque machine qui doit
   régénérer le fichier.
2. **L'heure est flottante.** `DTSTART:20260902T080000`, sans `Z` et sans
   `TZID` : la norme dit alors « 8 h là où se trouve l'appareil ». C'est ce
   qu'on veut d'un rappel personnel, et cela évite d'embarquer un bloc
   `VTIMEZONE` — trente lignes de règles de changement d'heure qui vieillissent.
3. **Un événement par échéance, plusieurs sonneries dedans.** L'agenda montre la
   date une fois, et prévient 30, 7 et 1 jours avant (`avant_echeance_jours`).
   Un événement par rappel remplirait l'agenda de trois lignes pour une seule
   chose à faire.
4. **Un rappel porte l'action, pas le constat.** « Résilier — Assurance
   habitation » et non « échéance MAIF » : un rappel qui demande de rouvrir un
   dossier pour savoir quoi faire est un rappel qu'on repousse.
5. **La sortie est déterministe.** Même configuration, même jour, même fichier
   à l'octet près : on peut le comparer au précédent pour voir ce qui a changé.
   D'où l'horodatage `DTSTAMP` tiré du jour demandé et non de l'heure courante.

Les `UID` sont dérivés de l'identifiant d'alerte : réimporter le fichier met à
jour les événements existants au lieu d'en créer des doubles à chaque fois.

Ce que ce module laisse de côté : les échéances **déjà passées**. Un événement
daté d'hier ne prévient plus personne ; elles restent au tableau de bord, qui
les affiche en retard tant qu'on ne les a pas traitées.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from core.config import Configuration
from core.modele import Alerte, StatutAlerte, TypeAlerte

PRODUIT = "-//Paper-Manager//Assistant administratif//FR"
OCTETS_PAR_LIGNE = 75          # RFC 5545 : 75 octets, continuation par une espace
DUREE = "PT30M"

INTITULE = {
    TypeAlerte.PREAVIS: "Résilier",
    TypeAlerte.RENOUVELLEMENT: "Renouvellement",
    TypeAlerte.PAIEMENT: "Prélèvement",
    TypeAlerte.DOCUMENT_MANQUANT: "Document manquant",
    TypeAlerte.CONSERVATION: "À jeter",
}


@dataclass(frozen=True)
class Evenement:
    """Une échéance telle qu'elle entrera dans l'agenda."""

    uid: str
    debut: datetime
    titre: str
    details: str
    rappels_jours: tuple[int, ...]


def echapper(texte: str) -> str:
    """Protège les caractères que la norme réserve à sa propre grammaire.

    L'ordre compte : l'antislash d'abord, sinon on échappe les échappements.
    Une virgule non protégée coupe la valeur en deux, et l'agenda affiche la
    moitié d'une consigne — ce qui est pire que rien.
    """
    return (texte.replace("\\", "\\\\")
                 .replace(";", "\\;")
                 .replace(",", "\\,")
                 .replace("\n", "\\n"))


def plier(ligne: str) -> str:
    """Coupe une ligne trop longue en respectant la limite de 75 **octets**.

    Compter en caractères couperait au mauvais endroit dès le premier accent, et
    couper au milieu d'un caractère UTF-8 produit un fichier que l'agenda refuse
    d'ouvrir — sans dire pourquoi.
    """
    morceaux: list[str] = []
    courant = b""
    for caractere in ligne:
        octets = caractere.encode("utf-8")
        # Une octet de moins pour les lignes de continuation : elles commencent
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


def evenements(configuration: Configuration, alertes: list[Alerte], le: date) -> list[Evenement]:
    """Les alertes qui méritent une place dans l'agenda, dans l'ordre des dates."""
    libelles = {f"abonnement:{a.id}": a.libelle for a in configuration.abonnements}
    heure = configuration.rappels.heure
    rappels = tuple(configuration.rappels.avant_echeance_jours)

    retenus: list[Evenement] = []
    for alerte in alertes:
        if alerte.statut is StatutAlerte.TRAITEE or alerte.echeance < le:
            continue
        cible = libelles.get(alerte.source, "")
        titre = INTITULE.get(alerte.type, "À faire")
        retenus.append(Evenement(
            uid=f"{alerte.id}@paper-manager",
            debut=datetime.combine(alerte.echeance, heure),
            titre=f"{titre} — {cible}" if cible else titre,
            details=alerte.action,
            rappels_jours=rappels,
        ))
    return sorted(retenus, key=lambda evenement: (evenement.debut, evenement.uid))


def rendre(liste: list[Evenement], le: date) -> str:
    """Le fichier `.ics`, terminaisons de ligne comprises.

    Les fins de ligne sont des CRLF : la norme l'exige, et si la plupart des
    agendas tolèrent l'absence du retour chariot, ceux qui ne le tolèrent pas
    échouent sans message.
    """
    horodatage = f"{le:%Y%m%d}T000000Z"
    lignes = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        _propriete("PRODID", PRODUIT, brut=True),
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for evenement in liste:
        lignes += [
            "BEGIN:VEVENT",
            _propriete("UID", evenement.uid, brut=True),
            f"DTSTAMP:{horodatage}",
            f"DTSTART:{evenement.debut:%Y%m%dT%H%M%S}",   # sans Z ni TZID : heure flottante
            f"DURATION:{DUREE}",
            _propriete("SUMMARY", evenement.titre),
            _propriete("DESCRIPTION", evenement.details),
        ]
        for jours in evenement.rappels_jours:
            lignes += [
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                f"TRIGGER:{f'-P{jours}D' if jours else 'PT0S'}",
                _propriete("DESCRIPTION", evenement.titre),
                "END:VALARM",
            ]
        lignes.append("END:VEVENT")
    lignes.append("END:VCALENDAR")
    return "\r\n".join(lignes) + "\r\n"

