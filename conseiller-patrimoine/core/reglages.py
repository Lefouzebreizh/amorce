#!/usr/bin/env python3
"""Chargement et validation du fichier de patrimoine.

Le principe est celui de NexusCrypto et du radar : **refuser de démarrer**
plutôt que rendre un tableau silencieusement faux. Un conseiller qui affiche un
patrimoine est cru sur parole — c'est bien pour ça qu'on le construit — donc la
seule protection contre une erreur de saisie est de ne rien afficher du tout.

Trois refus valent d'être expliqués, parce qu'ils ont l'air sévères :

**Les cibles doivent totaliser exactement 100.** C'est la règle héritée de
NexusCrypto et de l'assistant d'allocation, et elle a la même raison ici : à
97 %, chaque écart affiché est décalé de trois points sans que rien ne le
signale, et on arbitre sur du faux. À 103 %, une poche est comptée deux fois.

**Un prix saisi doit porter sa date.** Sans elle on ne peut pas dire si le
patrimoine affiché est celui d'aujourd'hui ou celui de l'été dernier, et un
total périmé présenté comme frais est exactement le genre de chiffre sur lequel
on prend une décision qu'on regrette. La date n'est pas une métadonnée, c'est
la moitié de l'information.

**Les montants ne peuvent pas être négatifs.** Un crédit immobilier se saisit
dans `capital_restant_du_eur`, pas en mettant un moins devant la valeur du bien :
les deux donnent le même total et un seul permet d'afficher l'effet de levier.

PyYAML est importé **tardivement**, dans la fonction qui en a besoin. Tout le
reste du paquet — modèles, valorisation, écarts, conseil — s'importe et
s'éprouve sans lui.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from core.modeles import Classe

RACINE = Path(__file__).resolve().parents[1]
CHEMIN_PAR_DEFAUT = RACINE / "config" / "patrimoine.yaml"
CHEMIN_EXEMPLE = RACINE / "config" / "patrimoine.exemple.yaml"

# Au-delà, un cours saisi à la main ne décrit plus le marché d'aujourd'hui. Ce
# n'est pas un refus : le bilan s'affiche, mais il se déclare partiel et le
# conseil se tait. Trente jours est le rythme réaliste d'une saisie manuelle.
FRAICHEUR_MAX_JOURS = 30


class ReglagesInvalides(Exception):
    """Le fichier est inutilisable en l'état. Le message dit toujours quel champ
    et pourquoi — un refus qu'on ne sait pas corriger fait abandonner l'outil."""


@dataclass(frozen=True)
class Profil:
    appetence: str
    horizon_annees: int
    apport_mensuel_eur: float
    cibles_pct: dict[Classe, float]
    bande_pct: float
    fraicheur_max_jours: int


@dataclass(frozen=True)
class Sources:
    """Où vivent les deux modules qu'on lit. Des chemins, jamais des imports.

    Le conseiller n'importe ni NexusCrypto ni le radar : il lit leurs fichiers.
    Importer NexusCrypto ferait entrer son chemin d'ordre dans ce processus-ci,
    et la seule chose qui garantit aujourd'hui qu'aucun ordre ne peut partir
    d'ici, c'est que le code qui sait en passer n'y est pas chargé.
    """

    nexuscrypto: Path | None
    pepites: Path | None


@dataclass(frozen=True)
class Reglages:
    profil: Profil
    sources: Sources
    actifs: dict[Classe, tuple[dict, ...]]


# --------------------------------------------------------------------------
# Petits vérificateurs — ils portent tous le contexte dans leur message
# --------------------------------------------------------------------------

def _exiger(source: dict, cle: str, contexte: str):
    if cle not in source or source[cle] is None:
        raise ReglagesInvalides(f"{contexte} : champ « {cle} » manquant.")
    return source[cle]


def _nombre(source: dict, cle: str, contexte: str, defaut: float | None = None) -> float:
    if cle not in source or source[cle] is None:
        if defaut is not None:
            return defaut
        raise ReglagesInvalides(f"{contexte} : champ « {cle} » manquant.")
    valeur = source[cle]
    # `bool` est un `int` en Python : sans ce test, `quantite: true` passerait
    # pour la quantité 1 et personne ne verrait rien.
    if isinstance(valeur, bool) or not isinstance(valeur, (int, float)):
        raise ReglagesInvalides(f"{contexte} : « {cle} » doit être un nombre.")
    if valeur < 0:
        raise ReglagesInvalides(
            f"{contexte} : « {cle} » ne peut pas être négatif. Un crédit se saisit "
            "dans « capital_restant_du_eur », pas en montant négatif."
        )
    return float(valeur)


def _date(source: dict, cle: str, contexte: str) -> date:
    """Accepte ce que YAML rend nativement (`date`) comme une chaîne ISO.

    Les deux arrivent : `2026-08-30` non quoté devient un objet date, la même
    valeur entre guillemets reste une chaîne. Refuser l'une des deux formes
    ferait échouer un fichier correct pour une paire de guillemets.
    """
    valeur = _exiger(source, cle, contexte)
    if isinstance(valeur, datetime):
        return valeur.date()
    if isinstance(valeur, date):
        return valeur
    if isinstance(valeur, str):
        try:
            return date.fromisoformat(valeur.strip())
        except ValueError as erreur:
            raise ReglagesInvalides(
                f"{contexte} : « {cle} » doit être une date ISO (2026-08-30), "
                f"reçu « {valeur} »."
            ) from erreur
    raise ReglagesInvalides(f"{contexte} : « {cle} » doit être une date ISO.")


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

# Les champs que chaque classe doit porter, et ceux qui vont par paire. Écrits
# en table plutôt qu'en cascade de `if` : ajouter une classe ne doit pas
# demander de relire la logique de validation.
CHAMPS_OBLIGATOIRES: dict[Classe, tuple[str, ...]] = {
    Classe.BOURSE: ("nom", "ticker", "quantite"),
    Classe.CRYPTO: ("nom", "symbole", "quantite"),
    Classe.IMMOBILIER: ("nom", "valeur_estimee_eur"),
    Classe.LIQUIDITES: ("nom", "montant_eur"),
}


def _valider_profil(brut: dict) -> Profil:
    profil_brut = _exiger(brut, "profil", "configuration")
    if not isinstance(profil_brut, dict):
        raise ReglagesInvalides("configuration : « profil » doit être un bloc.")

    cibles_brutes = _exiger(profil_brut, "cibles_pct", "profil")
    if not isinstance(cibles_brutes, dict):
        raise ReglagesInvalides("profil : « cibles_pct » doit être un bloc.")

    connues = {classe.value for classe in Classe}
    inconnues = set(map(str, cibles_brutes)) - connues
    if inconnues:
        raise ReglagesInvalides(
            "profil : classe(s) inconnue(s) dans « cibles_pct » : "
            + ", ".join(sorted(inconnues))
            + ". Classes attendues : " + ", ".join(sorted(connues)) + "."
        )

    # Une classe absente vaut zéro plutôt que d'être refusée : un patrimoine
    # sans immobilier est un cas normal, et l'écrire « immobilier: 0 » serait
    # une cérémonie. La somme, elle, reste vérifiée.
    cibles = {
        classe: _nombre(cibles_brutes, classe.value, "cibles_pct", 0.0)
        for classe in Classe
    }
    somme = sum(cibles.values())
    if abs(somme - 100.0) > 0.01:
        raise ReglagesInvalides(
            f"profil : les cibles totalisent {somme:g} % au lieu de 100 %. "
            "Une somme différente décale chaque écart affiché sans le signaler."
        )

    return Profil(
        appetence=str(profil_brut.get("appetence_risque", "non précisé")),
        horizon_annees=int(_nombre(profil_brut, "horizon_annees", "profil", 0.0)),
        apport_mensuel_eur=_nombre(profil_brut, "apport_mensuel_eur", "profil", 0.0),
        cibles_pct=cibles,
        bande_pct=_nombre(profil_brut, "bande_tolerance_pct", "profil", 5.0),
        fraicheur_max_jours=int(
            _nombre(profil_brut, "fraicheur_max_jours", "profil", float(FRAICHEUR_MAX_JOURS))
        ),
    )


def _valider_sources(brut: dict, base: Path) -> Sources:
    """Les chemins des deux modules lus. Absents = sources non consultées.

    Résolus relativement au dossier du fichier de configuration et non au
    répertoire courant : le conseiller se lance aussi bien depuis la racine du
    dépôt que depuis son propre dossier, et un chemin relatif au courant
    donnerait deux résultats différents pour la même configuration.
    """
    sources_brutes = brut.get("sources") or {}
    if not isinstance(sources_brutes, dict):
        raise ReglagesInvalides("configuration : « sources » doit être un bloc.")

    inconnues = set(map(str, sources_brutes)) - {"nexuscrypto", "pepites"}
    if inconnues:
        raise ReglagesInvalides(
            "sources : entrée(s) inconnue(s) : " + ", ".join(sorted(inconnues))
            + ". Seules « nexuscrypto » et « pepites » se lisent aujourd'hui."
        )

    def chemin(cle: str) -> Path | None:
        valeur = sources_brutes.get(cle)
        if valeur is None:
            return None
        return (base / str(valeur)).resolve()

    return Sources(nexuscrypto=chemin("nexuscrypto"), pepites=chemin("pepites"))


def _valider_actifs(brut: dict) -> dict[Classe, tuple[dict, ...]]:
    actifs_bruts = brut.get("actifs") or {}
    if not isinstance(actifs_bruts, dict):
        raise ReglagesInvalides("configuration : « actifs » doit être un bloc.")

    inconnues = set(map(str, actifs_bruts)) - {classe.value for classe in Classe}
    if inconnues:
        raise ReglagesInvalides(
            "actifs : classe(s) inconnue(s) : " + ", ".join(sorted(inconnues)) + "."
        )

    actifs: dict[Classe, tuple[dict, ...]] = {}
    for classe in Classe:
        lignes = actifs_bruts.get(classe.value) or []
        if not isinstance(lignes, list):
            raise ReglagesInvalides(f"actifs : « {classe.value} » doit être une liste.")
        for ligne in lignes:
            if not isinstance(ligne, dict):
                raise ReglagesInvalides(
                    f"actifs.{classe.value} : chaque entrée doit être un bloc."
                )
            contexte = f"actifs.{classe.value}[{ligne.get('nom', '?')}]"
            for champ in CHAMPS_OBLIGATOIRES[classe]:
                if champ in ("quantite", "valeur_estimee_eur", "montant_eur"):
                    _nombre(ligne, champ, contexte)
                else:
                    _exiger(ligne, champ, contexte)
            if classe is Classe.IMMOBILIER:
                _nombre(ligne, "capital_restant_du_eur", contexte, 0.0)
            # Un prix sans sa date est refusé — et l'inverse est toléré : dater
            # une ligne sans cours ne trompe personne, afficher un cours sans
            # savoir de quand il date, si.
            if ligne.get("prix_eur") is not None:
                _nombre(ligne, "prix_eur", contexte)
                _date(ligne, "releve_le", contexte)
            if ligne.get("pru_eur") is not None:
                _nombre(ligne, "pru_eur", contexte)
        actifs[classe] = tuple(lignes)
    return actifs


def valider(brut: dict, *, base: Path = RACINE) -> Reglages:
    """Valide un dictionnaire déjà chargé. Séparé de `charger` pour que les
    tests éprouvent la validation sans écrire de fichier sur le disque."""
    if not isinstance(brut, dict):
        raise ReglagesInvalides("configuration : la racine doit être un bloc.")
    return Reglages(
        profil=_valider_profil(brut),
        sources=_valider_sources(brut, base),
        actifs=_valider_actifs(brut),
    )


def charger(chemin: Path | None = None) -> Reglages:
    """Lit le fichier YAML et le valide. PyYAML est importé ici et pas plus haut."""
    chemin = Path(chemin) if chemin else CHEMIN_PAR_DEFAUT
    if not chemin.exists():
        raise ReglagesInvalides(
            f"{chemin} est introuvable. Copiez « {CHEMIN_EXEMPLE.name} » sous le "
            "nom « patrimoine.yaml » et remplacez les montants d'exemple par les "
            "vôtres — le fichier réel n'est pas versionné."
        )
    try:
        import yaml  # noqa: PLC0415 — import tardif, voir l'en-tête du module
    except ImportError as erreur:  # pragma: no cover — dépend de l'installation
        raise ReglagesInvalides(
            "PyYAML est nécessaire pour lire la configuration : "
            "pip install -r requirements.txt"
        ) from erreur

    try:
        brut = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    except yaml.YAMLError as erreur:
        raise ReglagesInvalides(f"{chemin} n'est pas un YAML valide : {erreur}") from erreur
    return valider(brut or {}, base=chemin.resolve().parent)
