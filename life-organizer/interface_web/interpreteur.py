"""Traduit une phrase en langage naturel en commande organizer.py.

Volontairement simple : un routeur par mots-clés, pas un modèle de langage.
L'usage est strictement personnel et les commandes sont peu nombreuses ;
un faux positif se corrige en une phrase plus précise, jamais en silence.

Aucune commande n'est jamais rendue avec --appliquer : l'interface web
respecte la même règle que la CLI, la simulation d'abord, et ne bascule en
exécution réelle que sur une action explicite de l'utilisateur.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


MOTS_CLES = [
    ("ranger", ("range", "ranger", "classe", "classer", "trie", "trier", "organise", "organiser")),
    ("nettoyer", ("nettoi", "nettoy", "doublon", "flou", "floue", "floues", "abîmé", "abime")),
    ("convertir", ("convert", "heic", "mkv", "compress")),
    ("upscaler", ("agrand", "upscale", "haute définition", "haute definition", "résolution", "resolution")),
    ("verifier", ("vérifie", "verifie", "configuration")),
]

# Une commande par famille de mots-clés, dans l'ordre où organizer.py les déclare.
COMMANDES_AVEC_DOSSIERS = {"ranger", "nettoyer", "convertir", "upscaler"}


@dataclass
class Commande:
    sous_commande: str
    dossiers: list[str] = field(default_factory=list)
    options: list[str] = field(default_factory=list)
    reconnue: bool = True


def _extraire_dossier(texte: str) -> str | None:
    """Un chemin n'est repris que s'il est écrit sans ambiguïté.

    Entre guillemets, ou reconnaissable comme chemin (lettre de lecteur,
    antislash, slash, ou `~`). Une intention en langage libre comme « les
    photos de vacances de cet été » ne désigne aucun dossier réel : mieux
    vaut laisser organizer.py se rabattre sur dossiers.entree que deviner.
    """
    m = re.search(r'"([^"]+)"|\'([^\']+)\'', texte)
    if m:
        return m.group(1) or m.group(2)
    m = re.search(r'([A-Za-z]:[\\/][^\s]+|~[\\/][^\s]*|\.{1,2}/[^\s]+)', texte)
    if m:
        return m.group(1)
    return None


def interpreter(texte: str) -> Commande:
    t = texte.strip().lower()
    if not t:
        return Commande(sous_commande="", reconnue=False)

    sous_commande = None
    for nom, mots in MOTS_CLES:
        if any(mot in t for mot in mots):
            sous_commande = nom
            break

    if sous_commande is None:
        return Commande(sous_commande="", reconnue=False)

    options: list[str] = []
    dossiers: list[str] = []

    if sous_commande in COMMANDES_AVEC_DOSSIERS:
        dossier = _extraire_dossier(texte)
        if dossier:
            dossiers = [dossier]

    if sous_commande == "nettoyer":
        for niveau in ("identique", "stricte", "prudente", "large"):
            if niveau in t:
                options += ["--ressemblance", niveau]
                break

    if sous_commande == "convertir":
        if "photo" in t and "vidéo" not in t and "video" not in t:
            options += ["--seulement", "photos"]
        elif ("vidéo" in t or "video" in t) and "photo" not in t:
            options += ["--seulement", "videos"]

    return Commande(sous_commande=sous_commande, dossiers=dossiers, options=options)
