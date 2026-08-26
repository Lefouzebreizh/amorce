#!/usr/bin/env python3
"""Lecture, validation et réécriture d'`admin_config.json`.

Ce fichier est écrit par deux mains — la mienne pour les contrats, le programme
pour les alertes — et c'est de là que viennent ses règles :

1. **Seule la section `alertes` est réécrite.** Le dictionnaire relu est réémis
   dans son ordre d'origine, clés inconnues comprises : rien de ce qui a été
   saisi n'est perdu ni déplacé. La **mise en forme**, elle, devient celle du
   programme — deux espaces d'indentation, un objet par ligne. C'est le prix
   d'un fichier réécrit sans analyseur qui conserve les blancs, et il se paie
   une fois : à la deuxième écriture, le fichier ne bouge plus.
2. **Copie avant écriture, puis remplacement atomique.** Une configuration
   tronquée par une coupure au milieu d'un `write`, c'est six mois de saisie de
   contrats perdus. `os.replace` est atomique sur le même système de fichiers,
   d'où le fichier temporaire posé à côté et non dans `/tmp`.
3. **La validation est stricte, et nomme le champ fautif.** Une date impossible
   ou une catégorie inconnue arrête le programme sur `abonnements[2].categorie`
   plutôt que sur une pile d'appels. Un assistant administratif qui se trompe en
   silence est pire que pas d'assistant du tout.
4. **La clé d'API n'est pas vérifiée au chargement.** Lister ses abonnements ne
   demande aucun réseau ; exiger la variable d'environnement dès l'ouverture du
   fichier rendrait tout le reste indisponible sur une machine qui ne l'a pas.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass, field
from datetime import date, time
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from core.modele import (
    Abonnement, Alerte, Categorie, Engagement, Identite, Periodicite,
    StatutAbonnement, StatutAlerte, TypeAlerte,
)

VERSION = 1


class ErreurConfiguration(Exception):
    """Configuration invalide. Le message porte toujours le chemin du champ."""


class _Bloc:
    """Un morceau du fichier qui sait dire où il se trouve quand il est fautif."""

    def __init__(self, brut: Any, chemin: str) -> None:
        if not isinstance(brut, dict):
            raise ErreurConfiguration(f"{chemin} : un objet est attendu")
        self.brut: dict[str, Any] = brut
        self.chemin = chemin

    def _ou(self, cle: str) -> str:
        return f"{self.chemin}.{cle}" if self.chemin else cle

    def sous_bloc(self, cle: str) -> _Bloc:
        return _Bloc(self.brut.get(cle, {}), self._ou(cle))

    def texte(self, cle: str, defaut: str = "") -> str:
        valeur = self.brut.get(cle, defaut)
        if valeur is None:
            return defaut
        if not isinstance(valeur, str):
            raise ErreurConfiguration(f"{self._ou(cle)} : du texte est attendu")
        return valeur

    def booleen(self, cle: str, defaut: bool = False) -> bool:
        valeur = self.brut.get(cle, defaut)
        if not isinstance(valeur, bool):
            raise ErreurConfiguration(f"{self._ou(cle)} : true ou false est attendu")
        return valeur

    def entier(self, cle: str, defaut: int | None = 0, minimum: int | None = None) -> int | None:
        valeur = self.brut.get(cle, defaut)
        if valeur is None:
            return None
        if isinstance(valeur, bool) or not isinstance(valeur, int):
            raise ErreurConfiguration(f"{self._ou(cle)} : un nombre entier est attendu")
        if minimum is not None and valeur < minimum:
            raise ErreurConfiguration(f"{self._ou(cle)} : au moins {minimum} est attendu")
        return valeur

    def montant(self, cle: str, defaut: Decimal | None = Decimal("0")) -> Decimal | None:
        valeur = self.brut.get(cle)
        if valeur is None:
            return defaut
        try:
            # Par la chaîne : Decimal(0.1) vaut 0.1000000000000000055511151231257827.
            return Decimal(str(valeur))
        except (InvalidOperation, ValueError):
            raise ErreurConfiguration(f"{self._ou(cle)} : un montant est attendu") from None

    def jour(self, cle: str, obligatoire: bool = False) -> date | None:
        valeur = self.brut.get(cle)
        if valeur in (None, ""):
            if obligatoire:
                raise ErreurConfiguration(f"{self._ou(cle)} : une date AAAA-MM-JJ est attendue")
            return None
        try:
            return date.fromisoformat(str(valeur))
        except ValueError:
            raise ErreurConfiguration(
                f"{self._ou(cle)} : « {valeur} » n'est pas une date AAAA-MM-JJ"
            ) from None

    def heure(self, cle: str, defaut: str) -> time:
        valeur = self.texte(cle, defaut) or defaut
        try:
            return time.fromisoformat(valeur)
        except ValueError:
            raise ErreurConfiguration(
                f"{self._ou(cle)} : « {valeur} » n'est pas une heure HH:MM"
            ) from None

    def choix(self, cle: str, enumeration: type, defaut: Any) -> Any:
        valeur = self.brut.get(cle)
        if valeur in (None, ""):
            return defaut
        try:
            return enumeration(valeur)
        except ValueError:
            attendus = ", ".join(m.value for m in enumeration)
            raise ErreurConfiguration(
                f"{self._ou(cle)} : « {valeur} » inconnu (attendu : {attendus})"
            ) from None

    def liste(self, cle: str) -> list[Any]:
        valeur = self.brut.get(cle, [])
        if not isinstance(valeur, list):
            raise ErreurConfiguration(f"{self._ou(cle)} : une liste est attendue")
        return valeur

    def obligatoire(self, cle: str) -> str:
        valeur = self.texte(cle)
        if not valeur:
            raise ErreurConfiguration(f"{self._ou(cle)} : champ obligatoire")
        return valeur


@dataclass(frozen=True)
class Classement:
    racine: Path
    entree: Path
    classes: Path
    courriers: Path
    modele_nom: str
    modele_dossier: str
    categories: dict[str, Categorie]


@dataclass(frozen=True)
class Extraction:
    active: bool
    fournisseur: str
    modele: str
    origine_cle: str
    confiance_minimale: float
    a_relire_si_doute: bool
    emetteurs_connus: dict[str, dict[str, str]]

    def cle_api(self) -> str | None:
        """Résout `env:NOM`. La configuration ne contient que le nom de la variable :
        ce fichier finit tôt ou tard dans une sauvegarde ou une pièce jointe."""
        if self.origine_cle.startswith("env:"):
            return os.environ.get(self.origine_cle[4:]) or None
        return self.origine_cle or None


@dataclass(frozen=True)
class Rappels:
    avant_echeance_jours: list[int]
    heure: time
    sortie_ics: Path
    preavis_defaut_jours: int
    alerte_avant_defaut_jours: int


@dataclass
class Configuration:
    chemin: Path
    version: int
    identite: Identite
    classement: Classement
    extraction: Extraction
    rappels: Rappels
    abonnements: list[Abonnement]
    alertes: list[Alerte]
    brut: dict[str, Any] = field(repr=False, default_factory=dict)

    def abonnement(self, identifiant: str) -> Abonnement:
        for abonnement in self.abonnements:
            if abonnement.id == identifiant:
                return abonnement
        connus = ", ".join(a.id for a in self.abonnements) or "aucun"
        raise ErreurConfiguration(f"abonnement « {identifiant} » inconnu (connus : {connus})")


def charger(chemin: str | Path) -> Configuration:
    """Relit et valide `admin_config.json`."""
    chemin = Path(chemin)
    if not chemin.exists():
        raise ErreurConfiguration(
            f"{chemin} est introuvable — copier admin_config.exemple.json pour démarrer"
        )
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ErreurConfiguration(f"{chemin} ligne {erreur.lineno} : {erreur.msg}") from None

    racine = _Bloc(brut, "")
    version = racine.entier("version", defaut=VERSION, minimum=1)
    if version is None or version > VERSION:
        raise ErreurConfiguration(
            f"version {version} : ce fichier vient d'une version plus récente de Paper-Manager"
        )

    classement = _lire_classement(racine.sous_bloc("classement"))
    abonnements = [
        _lire_abonnement(_Bloc(objet, f"abonnements[{index}]"), classement.categories)
        for index, objet in enumerate(racine.liste("abonnements"))
    ]
    _refuser_doublons(abonnements)
    alertes = [
        _lire_alerte(_Bloc(objet, f"alertes[{index}]"), {a.id for a in abonnements})
        for index, objet in enumerate(racine.liste("alertes"))
    ]

    return Configuration(
        chemin=chemin,
        version=version,
        identite=_lire_identite(racine.sous_bloc("identite")),
        classement=classement,
        extraction=_lire_extraction(racine.sous_bloc("extraction")),
        rappels=_lire_rappels(racine.sous_bloc("rappels")),
        abonnements=abonnements,
        alertes=alertes,
        brut=brut,
    )


def _lire_identite(bloc: _Bloc) -> Identite:
    return Identite(
        civilite=bloc.texte("civilite"),
        nom=bloc.texte("nom"),
        prenom=bloc.texte("prenom"),
        adresse=bloc.texte("adresse"),
        code_postal=bloc.texte("code_postal"),
        ville=bloc.texte("ville"),
        courriel=bloc.texte("courriel"),
        telephone=bloc.texte("telephone"),
    )


def _lire_classement(bloc: _Bloc) -> Classement:
    racine = Path(bloc.texte("racine", "coffre"))
    categories: dict[str, Categorie] = {}
    for cle, valeur in (bloc.brut.get("categories") or {}).items():
        sous = _Bloc(valeur, f"classement.categories.{cle}")
        categories[cle] = Categorie(
            cle=cle,
            libelle=sous.texte("libelle", cle),
            conservation_annees=sous.entier("conservation_annees", defaut=None, minimum=0),
        )
    if not categories:
        raise ErreurConfiguration("classement.categories : au moins une catégorie est attendue")
    return Classement(
        racine=racine,
        entree=Path(bloc.texte("entree", str(racine / "entree"))),
        classes=Path(bloc.texte("classes", str(racine / "classes"))),
        courriers=Path(bloc.texte("courriers", str(racine / "courriers"))),
        modele_nom=bloc.texte("modele_nom", "{date}_{emetteur}_{nature}_{montant}"),
        modele_dossier=bloc.texte("modele_dossier", "{annee}/{categorie}"),
        categories=categories,
    )


def _lire_extraction(bloc: _Bloc) -> Extraction:
    confiance = bloc.brut.get("confiance_minimale", 0.75)
    if not isinstance(confiance, (int, float)) or isinstance(confiance, bool) or not 0 <= confiance <= 1:
        raise ErreurConfiguration("extraction.confiance_minimale : un nombre entre 0 et 1 est attendu")
    return Extraction(
        active=bloc.booleen("active", True),
        fournisseur=bloc.texte("fournisseur", "anthropic"),
        modele=bloc.texte("modele"),
        origine_cle=bloc.texte("cle_api"),
        confiance_minimale=float(confiance),
        a_relire_si_doute=bloc.booleen("a_relire_si_doute", True),
        emetteurs_connus=bloc.brut.get("emetteurs_connus") or {},
    )


def _lire_rappels(bloc: _Bloc) -> Rappels:
    jours = bloc.liste("avant_echeance_jours") or [30, 7, 1]
    if not all(isinstance(j, int) and not isinstance(j, bool) and j >= 0 for j in jours):
        raise ErreurConfiguration("rappels.avant_echeance_jours : des nombres de jours sont attendus")
    return Rappels(
        avant_echeance_jours=sorted({int(j) for j in jours}, reverse=True),
        heure=bloc.heure("heure", "08:00"),
        sortie_ics=Path(bloc.texte("sortie_ics", "coffre/rappels.ics")),
        preavis_defaut_jours=bloc.entier("preavis_defaut_jours", 30, minimum=0) or 0,
        alerte_avant_defaut_jours=bloc.entier("alerte_avant_defaut_jours", 45, minimum=0) or 0,
    )


def _lire_abonnement(bloc: _Bloc, categories: dict[str, Categorie]) -> Abonnement:
    categorie = bloc.obligatoire("categorie")
    if categorie not in categories:
        connues = ", ".join(sorted(categories))
        raise ErreurConfiguration(
            f"{bloc.chemin}.categorie : « {categorie} » inconnue (connues : {connues})"
        )
    engagement = bloc.sous_bloc("engagement")
    return Abonnement(
        id=bloc.obligatoire("id"),
        libelle=bloc.obligatoire("libelle"),
        emetteur=bloc.texte("emetteur"),
        categorie=categorie,
        montant=bloc.montant("montant") or Decimal("0"),
        devise=bloc.texte("devise", "EUR"),
        periodicite=bloc.choix("periodicite", Periodicite, Periodicite.MENSUELLE),
        prochain_prelevement=bloc.jour("prochain_prelevement"),
        moyen_paiement=bloc.texte("moyen_paiement"),
        reference_client=bloc.texte("reference_client"),
        engagement=Engagement(
            debut=engagement.jour("debut"),
            fin=engagement.jour("fin"),
            duree_mois=engagement.entier("duree_mois", defaut=None, minimum=1),
        ),
        reconduction_tacite=bloc.booleen("reconduction_tacite"),
        date_avis_echeance=bloc.jour("date_avis_echeance"),
        preavis_jours=bloc.entier("preavis_jours", 0, minimum=0) or 0,
        resiliable_en_ligne=bloc.booleen("resiliable_en_ligne"),
        adresse_resiliation=bloc.texte("adresse_resiliation"),
        recommande=bloc.booleen("recommande"),
        statut=bloc.choix("statut", StatutAbonnement, StatutAbonnement.ACTIF),
        alerte_avant_jours=bloc.entier("alerte_avant_jours", defaut=None, minimum=0),
        documents_attendus=bloc.texte("documents_attendus") or None,
        notes=bloc.texte("notes"),
    )


def _refuser_doublons(abonnements: list[Abonnement]) -> None:
    """Deux contrats sous le même identifiant : les alertes de l'un iraient à l'autre."""
    vus: set[str] = set()
    for abonnement in abonnements:
        if abonnement.id in vus:
            raise ErreurConfiguration(f"abonnements : l'identifiant « {abonnement.id} » sert deux fois")
        vus.add(abonnement.id)


def _lire_alerte(bloc: _Bloc, identifiants: set[str]) -> Alerte:
    source = bloc.obligatoire("source")
    if ":" not in source:
        raise ErreurConfiguration(f"{bloc.chemin}.source : « abonnement:<id> » ou « document:<id> » attendu")
    genre, reference = source.split(":", 1)
    if genre == "abonnement" and reference not in identifiants:
        raise ErreurConfiguration(f"{bloc.chemin}.source : abonnement « {reference} » inconnu")
    echeance = bloc.jour("echeance", obligatoire=True)
    assert echeance is not None
    return Alerte(
        id=bloc.obligatoire("id"),
        type=bloc.choix("type", TypeAlerte, TypeAlerte.PREAVIS),
        source=source,
        echeance=echeance,
        declenchement=bloc.jour("declenchement") or echeance,
        statut=bloc.choix("statut", StatutAlerte, StatutAlerte.OUVERTE),
        montant=bloc.montant("montant", defaut=None),
        action=bloc.texte("action"),
    )


def alerte_en_json(alerte: Alerte) -> dict[str, Any]:
    """Une alerte telle qu'elle s'écrit dans le fichier — ordre des clés compris."""
    return {
        "id": alerte.id,
        "type": alerte.type.value,
        "source": alerte.source,
        "echeance": alerte.echeance.isoformat(),
        "declenchement": alerte.declenchement.isoformat(),
        "statut": alerte.statut.value,
        "montant": None if alerte.montant is None else float(alerte.montant),
        "action": alerte.action,
    }


def enregistrer_alertes(configuration: Configuration, alertes: list[Alerte]) -> None:
    """Réécrit la seule section `alertes`, après copie de sauvegarde.

    Le reste du fichier ressort tel qu'il est entré : c'est le dictionnaire relu
    qui est réémis, `_aide` et clés inconnues comprises.
    """
    brut = dict(configuration.brut)
    brut["alertes"] = [alerte_en_json(alerte) for alerte in alertes]

    chemin = configuration.chemin
    if chemin.exists():
        shutil.copy2(chemin, chemin.with_suffix(chemin.suffix + ".bak"))
    temporaire = chemin.with_name(chemin.name + ".tmp")
    temporaire.write_text(
        json.dumps(brut, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    os.replace(temporaire, chemin)  # atomique : jamais de fichier à moitié écrit
    configuration.brut = brut
    configuration.alertes = list(alertes)
