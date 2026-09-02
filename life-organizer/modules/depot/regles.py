"""Les décisions pures du dépôt : où va une catégorie, et si on s'y fie.

Rien ici ne lit un fichier, n'appelle un modèle ou ne touche au disque — ces
fonctions jugent une classification déjà obtenue, exactement comme
`nettoyage.regles` juge une empreinte déjà calculée. C'est ce qui les rend
testables sans clé d'API et sans image.
"""

from __future__ import annotations

from dataclasses import dataclass

# Trois catégories, pas plus : assez larges pour qu'un modèle de vision les
# distingue de façon fiable, assez précises pour désigner un dossier différent
# à chacune. Un quatrième cas ambigu se traite par la confiance, pas par une
# quatrième catégorie fourre-tout.
CATEGORIES = ("papier_administratif", "photo_personnelle", "video_projet_creatif")


@dataclass(frozen=True)
class Classification:
    """Ce que le modèle de vision a rendu, sans jugement sur la suite."""

    categorie: str
    confiance: float
    raison: str = ""


@dataclass(frozen=True)
class Proposition:
    """Ce qu'on propose à l'utilisateur : jamais appliqué avant confirmation."""

    categorie: str
    confiance: float
    raison: str
    projet: str
    dossier_relatif: str
    fiable: bool


def categorie_valide(categorie: str) -> bool:
    return categorie in CATEGORIES


def projet_connu(config_depot: dict, nom_projet: str) -> bool:
    return nom_projet in (config_depot.get("projets") or {})


def dossier_pour(categorie: str, regles_projet: list[dict], champs: dict) -> str | None:
    """Le sous-dossier associé à une catégorie, gabarit résolu.

    La première règle dont la catégorie correspond l'emporte — comme
    `classement.themes` : un ordre qu'on maîtrise plutôt qu'un score qui
    laisserait deviner pourquoi une photo de famille part chez « Créatif ».
    Un champ manquant dans `champs` (une date qu'on n'a pas su lire) laisse le
    gabarit tel quel plutôt que de faire échouer toute la proposition.
    """
    for regle in regles_projet:
        if regle.get("categorie") != categorie:
            continue
        gabarit = str(regle.get("dossier", "")).strip()
        try:
            return gabarit.format(**champs)
        except (KeyError, IndexError):
            return gabarit
    return None


def proposer(
    classification: Classification,
    config_depot: dict,
    nom_projet: str,
    champs: dict,
) -> Proposition | None:
    """La proposition complète, ou `None` si le projet ou la catégorie ne mène nulle part.

    `None` n'est pas une erreur silencieuse : `commande.py` et l'interface web
    le lisent comme « rien à proposer, configuration incomplète » et le disent.
    """
    if not categorie_valide(classification.categorie):
        return None
    projet = (config_depot.get("projets") or {}).get(nom_projet)
    if not projet:
        return None
    dossier = dossier_pour(classification.categorie, projet.get("regles") or [], champs)
    if dossier is None:
        return None
    seuil = float(config_depot.get("seuil_confiance_auto", 0.7))
    return Proposition(
        categorie=classification.categorie,
        confiance=classification.confiance,
        raison=classification.raison,
        projet=nom_projet,
        dossier_relatif=dossier,
        fiable=classification.confiance >= seuil,
    )
