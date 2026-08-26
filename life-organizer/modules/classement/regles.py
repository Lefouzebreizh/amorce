"""Décider où va un fichier : sa catégorie, sa date, son thème, son dossier.

Cinq décisions tiennent ce fichier :

1. **Le thème l'emporte sur la date.** Un avis d'imposition se retrouve par son
   sujet, jamais par son mois : personne n'a jamais cherché « le document
   administratif de mars 2024 ». Les photos, elles, se retrouvent par leur date
   — c'est la seule chose dont on se souvienne d'un souvenir.

2. **Une date de modification est une date, mais elle se dit.** L'ordre de
   `classement.source_de_la_date` fait foi, et `traitement.py` annonce d'où
   vient l'horodatage qu'il transmet. Un fichier rangé sous 2026 alors que la
   photo date de 2014 n'a l'air de rien : c'est dix ans de souvenirs empilés
   sous le mois courant, et rien ne le signale — sauf le motif, qui dit
   « d'après la date de modification, faute de mieux ».

3. **Sans date fiable, on range à part plutôt que de deviner.**
   `classement.sans_date_vers` (« À dater ») rassemble ce qu'il faudra reprendre
   à la main. Un dossier « À dater » de trente photos se traite en dix minutes ;
   trente photos noyées dans la mauvaise année ne se retrouvent jamais.

4. **Une extension inconnue reste où elle est.** Déplacer vers un fourre-tout
   ce que la configuration ne sait pas nommer, c'est éparpiller des fichiers que
   personne n'a demandé de bouger, et rendre le rangement plus dur qu'avant. Le
   compte rendu les signale : c'est à l'utilisateur d'ajouter l'extension à
   `classement.categories`.

5. **Un fichier déjà à sa place ne produit rien.** C'est ce qui rend la commande
   relançable. Un rangement qui repropose éternellement le même travail est un
   rangement qu'on ne lance qu'une fois — et qui ne range donc rien.

Rien n'est ouvert ici : ce fichier ne juge que ce que `traitement.py` a mesuré.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from noyau.modele import Fiche

# Index 1 à 12 ; la case 0 n'existe pas, d'où la sentinelle.
MOIS = ("", "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre")

# La source la moins fiable de `classement.source_de_la_date`. Elle est
# acceptée — il faut bien ranger — mais elle apparaît dans le motif, parce
# qu'elle ment dès qu'un fichier a été copié, restauré ou transféré.
SOURCE_PAR_DEFAUT = "modification"

# Ce qui, dans le nom d'un fichier, ressemble à une date d'appareil photo.
# Assez large pour attraper `IMG_20240315`, `2024-03-15 19h12`, `20240315_191203`.
MOTIF_DATE_DANS_LE_NOM = r"(?<!\d)(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)"


@dataclass(frozen=True)
class Rangement:
    """Où va un fichier, et pourquoi. `destination` relative à la bibliothèque.

    `destination` à `None` veut dire « ne pas y toucher » : déjà rangé, ou
    extension que la configuration ne connaît pas. Le motif dit lequel des deux,
    parce que les deux appellent des suites différentes — rien à faire dans un
    cas, une ligne à ajouter à la configuration dans l'autre.
    """

    fiche: Fiche
    destination: Path | None
    motif: str

    @property
    def a_deplacer(self) -> bool:
        return self.destination is not None


def categorie(chemin: Path, categories: dict[str, list[str]]) -> str | None:
    """La catégorie déclarée pour cette extension, ou `None` si aucune."""
    extension = chemin.suffix.lower().lstrip(".")
    for nom, extensions in categories.items():
        if extension in {str(e).lower().lstrip(".") for e in extensions}:
            return nom
    return None


def theme(texte: str, themes: list[dict]) -> dict | None:
    """Le premier thème dont un mot-clé apparaît dans le texte donné.

    Le premier et non le meilleur : l'ordre de la liste est un ordre de
    priorité que l'utilisateur maîtrise, alors qu'un score le laisserait
    deviner pourquoi sa facture d'électricité est partie chez « Banque ».

    Le texte est ce que l'appelant sait : le nom du fichier aujourd'hui, le
    texte extrait par le module de scan quand il existera. La règle ne change
    pas, seule sa matière s'enrichit.
    """
    minuscules = texte.lower()
    for candidat in themes:
        for mot in candidat.get("mots_cles", []):
            if str(mot).lower() in minuscules:
                return candidat
    return None


def dossier_date(schema: str, nom_categorie: str, annee: int, mois: int) -> Path:
    """Applique `classement.schema` — « {categorie}/{annee}/{mois} - {mois_nom} »."""
    try:
        rendu = schema.format(
            categorie=nom_categorie,
            annee=annee,
            mois=f"{mois:02d}",
            mois_nom=MOIS[mois],
        )
    except (KeyError, IndexError) as erreur:
        raise ValueError(
            f"classement.schema : champ inconnu {erreur}. "
            "Champs disponibles : categorie, annee, mois, mois_nom."
        ) from erreur
    return Path(rendu)


def decider(fiche: Fiche, config: dict, source_date: str | None,
            texte: str = "", bibliotheque: Path | None = None) -> Rangement:
    """Le rangement d'un fichier. Pure : ni disque, ni décodage.

    `source_date` est le nom de la source qui a donné `fiche.date_horodatage`,
    ou `None` quand aucune n'a répondu. `texte` est ce sur quoi chercher un
    thème — le nom du fichier, et plus tard le texte extrait par le scan.
    """
    reglages = config.get("classement", {})
    nom_categorie = categorie(fiche.chemin, reglages.get("categories", {}))
    if nom_categorie is None:
        return Rangement(fiche, None, f"extension « {fiche.chemin.suffix.lstrip('.')} » "
                                      "absente de classement.categories")

    dossier, motif = _dossier_cible(fiche, reglages, nom_categorie, source_date, texte)
    destination = dossier / fiche.chemin.name

    if bibliotheque is not None and _deja_en_place(fiche.chemin, bibliotheque, dossier):
        return Rangement(fiche, None, "déjà rangé")
    return Rangement(fiche, destination, motif)


def _dossier_cible(fiche: Fiche, reglages: dict, nom_categorie: str,
                   source_date: str | None, texte: str) -> tuple[Path, str]:
    if nom_categorie == "Documents":
        trouve = theme(texte, reglages.get("themes", []))
        if trouve:
            return Path(trouve["dossier"]), f"thème « {trouve['nom']} »"
        # Sans thème reconnu, le document garde sa date : c'est ce qui reste
        # pour le retrouver. Il attend dans le fourre-tout qu'on apprenne à
        # l'assistant à le reconnaître.
        nom_categorie = f"{nom_categorie}/{reglages.get('sans_theme_vers', 'Divers')}"

    if source_date is None:
        return (Path(nom_categorie) / reglages.get("sans_date_vers", "À dater"),
                "aucune date fiable")

    quand = datetime.fromtimestamp(fiche.date_horodatage)
    dossier = dossier_date(reglages.get("schema", "{categorie}/{annee}/{mois} - {mois_nom}"),
                           nom_categorie, quand.year, quand.month)
    # `%B` rendrait « March » : la locale du conteneur n'est pas française, et
    # ce motif est lu par l'utilisateur.
    mois_dit = f"{MOIS[quand.month]} {quand.year}"
    if source_date == SOURCE_PAR_DEFAUT:
        return dossier, f"{mois_dit}, d'après la date de modification, faute de mieux"
    return dossier, f"{mois_dit}, d'après {source_date}"


def _deja_en_place(chemin: Path, bibliotheque: Path, dossier: Path) -> bool:
    """Le fichier est-il déjà dans le dossier où on voudrait l'envoyer ?

    Comparaison sur les chemins et non sur les fichiers : un fichier rangé porte
    le même nom au même endroit, et rien d'autre n'a à être vérifié pour dire
    qu'il n'y a rien à faire.
    """
    try:
        return chemin.parent.resolve() == (bibliotheque / dossier).resolve()
    except OSError:
        return False


def dossiers_a_parcourir(demandes: list[Path], entrees: list[Path],
                         bibliotheque: Path) -> list[Path]:
    """Les dossiers à examiner : ceux demandés, ou ceux de la configuration.

    La bibliothèque est écartée du parcours automatique, même si elle se trouve
    sous un dossier d'entrée. Un fichier déjà rangé n'a pas de raison d'être
    rejugé : sa date d'origine peut avoir disparu depuis (une sauvegarde
    restaurée réécrit la date de modification), et il repartirait alors dans le
    mois courant — le rangement défferait lui-même son propre travail.

    Un dossier demandé explicitement, lui, est toujours parcouru : « range ma
    bibliothèque » est une demande légitime, et elle doit rester possible.
    """
    if demandes:
        return demandes
    try:
        racine = bibliotheque.resolve()
    except OSError:
        racine = bibliotheque
    gardes = []
    for entree in entrees:
        try:
            chemin = entree.expanduser().resolve()
        except OSError:
            chemin = entree
        if chemin == racine or racine in chemin.parents or chemin in racine.parents:
            continue
        gardes.append(entree)
    return gardes


def compter(rangements: list[Rangement]) -> dict[str, int]:
    """Combien de fichiers par dossier de destination, pour le compte rendu."""
    compte: dict[str, int] = {}
    for rangement in rangements:
        if rangement.destination is None:
            continue
        cle = str(rangement.destination.parent)
        compte[cle] = compte.get(cle, 0) + 1
    return compte
