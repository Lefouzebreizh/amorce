#!/usr/bin/env python3
"""Les objets partagés par les quatre modules.

Ils sont ici et pas dans le module qui les produit, parce que chacun traverse le
projet : un `Abonnement` sert au tableau de bord, aux rappels d'agenda, au
courrier de résiliation et au remplissage d'un formulaire.

Trois décisions :

1. **Les dates sont des `date`, jamais des chaînes.** La conversion se fait une
   seule fois, à la lecture de la configuration. Comparer « 02/09/2026 » et
   « 2026-09-02 » est le genre de bogue qui ne se voit qu'un jour trop tard.
2. **Les montants sont des `Decimal`.** Un total d'abonnements en `float`
   affiche 149.99000000000001 au bout de cinq lignes. À l'écriture, un `Decimal`
   à deux décimales redevient un nombre JSON fidèle : `repr(float(...))` rend la
   représentation la plus courte qui se relit à l'identique.
3. **Le calcul du préavis est ici, pas dans le module qui alerte.** C'est de
   l'arithmétique de dates, pure et vérifiable sans rien autour ; `abonnements.py`
   n'a plus qu'à décider ce qu'il en affiche.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from enum import StrEnum

CENTIME = Decimal("0.01")


class Periodicite(StrEnum):
    MENSUELLE = "mensuelle"
    TRIMESTRIELLE = "trimestrielle"
    SEMESTRIELLE = "semestrielle"
    ANNUELLE = "annuelle"
    UNIQUE = "unique"

    @property
    def mois(self) -> int:
        """Nombre de mois entre deux échéances. 0 pour un paiement unique."""
        return {"mensuelle": 1, "trimestrielle": 3, "semestrielle": 6,
                "annuelle": 12, "unique": 0}[self.value]


class StatutAbonnement(StrEnum):
    ACTIF = "actif"
    EN_RESILIATION = "en_resiliation"
    RESILIE = "resilie"


class TypeAlerte(StrEnum):
    PREAVIS = "preavis"
    RENOUVELLEMENT = "renouvellement"
    PAIEMENT = "paiement"
    DOCUMENT_MANQUANT = "document_manquant"
    CONSERVATION = "conservation"


class StatutAlerte(StrEnum):
    OUVERTE = "ouverte"
    REPORTEE = "reportee"
    TRAITEE = "traitee"


class Nature(StrEnum):
    FACTURE = "facture"
    AVIS = "avis"
    CONTRAT = "contrat"
    COURRIER = "courrier"
    RELEVE = "releve"
    ATTESTATION = "attestation"
    BULLETIN = "bulletin"
    INCONNUE = "inconnue"


def ajouter_mois(depart: date, mois: int) -> date:
    """Décale une date d'un nombre de mois, en rabotant le jour si besoin.

    Le 31 janvier plus un mois donne le 28 février (ou le 29). Sans ce rabotage,
    un abonnement échu un 31 saute purement et simplement les mois de trente
    jours, et son alerte avec.
    """
    total = depart.month - 1 + mois
    annee = depart.year + total // 12
    mois_cible = total % 12 + 1
    return date(annee, mois_cible, min(depart.day, calendar.monthrange(annee, mois_cible)[1]))


@dataclass(frozen=True)
class Identite:
    """Ce qui remplit l'en-tête d'un courrier et l'état civil d'un formulaire."""

    civilite: str = ""
    nom: str = ""
    prenom: str = ""
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    courriel: str = ""
    telephone: str = ""

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip()


@dataclass(frozen=True)
class Categorie:
    """Une rubrique de classement. `conservation_annees` à None : à garder à vie."""

    cle: str
    libelle: str
    conservation_annees: int | None = None


@dataclass(frozen=True)
class Engagement:
    """La période pendant laquelle partir coûte quelque chose."""

    debut: date | None = None
    fin: date | None = None
    duree_mois: int | None = None

    def en_cours(self, le: date) -> bool:
        return self.fin is not None and le < self.fin

    def mois_restants(self, le: date) -> int:
        """Mois pleins restant à courir — le nombre d'échéances encore dues.

        Le jour du mois compte : du 25 août à une fin le 2 février, il reste cinq
        prélèvements (2/09 à 2/01) et non six. Un mois entamé de trop, et le coût
        annoncé d'un départ anticipé est faux.
        """
        if not self.en_cours(le):
            return 0
        assert self.fin is not None
        mois = (self.fin.year - le.year) * 12 + self.fin.month - le.month
        return max(0, mois - (1 if self.fin.day < le.day else 0))


@dataclass
class Abonnement:
    """Un contrat suivi. Un contrat résilié y reste : c'est l'historique."""

    id: str
    libelle: str
    emetteur: str
    categorie: str
    montant: Decimal = Decimal("0")
    devise: str = "EUR"
    periodicite: Periodicite = Periodicite.MENSUELLE
    prochain_prelevement: date | None = None
    moyen_paiement: str = ""
    reference_client: str = ""
    engagement: Engagement = field(default_factory=Engagement)
    reconduction_tacite: bool = False
    date_avis_echeance: date | None = None
    preavis_jours: int = 0
    resiliable_en_ligne: bool = False
    adresse_resiliation: str = ""
    recommande: bool = False
    statut: StatutAbonnement = StatutAbonnement.ACTIF
    alerte_avant_jours: int | None = None
    documents_attendus: str | None = None
    notes: str = ""

    @property
    def montant_mensuel(self) -> Decimal:
        """Ce que le contrat coûte par mois, pour le total du tableau de bord."""
        mois = self.periodicite.mois
        if mois == 0:
            return Decimal("0")
        return (self.montant / mois).quantize(CENTIME)

    def prochaine_echeance(self, le: date) -> date | None:
        """La prochaine date anniversaire à venir, ou None si le contrat n'en a pas.

        Un contrat à reconduction tacite dont la fin est passée n'est pas terminé :
        il a été reconduit, et son échéance a avancé d'une période. La faire avancer
        ici évite d'avoir à réécrire la configuration chaque année — et une
        configuration qu'il faut tenir à jour à la main n'est jamais à jour.
        """
        fin = self.engagement.fin
        if fin is None:
            return None
        if not self.reconduction_tacite:
            return fin if fin >= le else None
        pas = self.engagement.duree_mois or self.periodicite.mois or 12
        while fin < le:
            fin = ajouter_mois(fin, pas)
        return fin

    def date_preavis(self, le: date) -> date | None:
        """La date après laquelle il est trop tard. C'est elle qu'on alerte.

        Alerter sur l'échéance elle-même, c'est alerter une fois l'année suivante
        due : un contrat à deux mois de préavis n'est plus résiliable deux mois
        avant son terme.
        """
        echeance = self.prochaine_echeance(le)
        if echeance is None:
            return None
        return echeance - timedelta(days=self.preavis_jours)

    def date_alerte(self, le: date, avance_defaut: int) -> date | None:
        """À partir de quand la date de préavis doit apparaître dans le tableau de bord."""
        preavis = self.date_preavis(le)
        if preavis is None:
            return None
        avance = self.alerte_avant_jours if self.alerte_avant_jours is not None else avance_defaut
        return preavis - timedelta(days=avance)


@dataclass
class Alerte:
    """Ce qui est ouvert aujourd'hui. Le statut est la part humaine du fichier."""

    id: str
    type: TypeAlerte
    source: str
    echeance: date
    declenchement: date
    statut: StatutAlerte = StatutAlerte.OUVERTE
    montant: Decimal | None = None
    action: str = ""

    def visible(self, le: date) -> bool:
        """Une alerte traitée disparaît ; une alerte reportée revient à son échéance."""
        if self.statut is StatutAlerte.TRAITEE:
            return False
        if self.statut is StatutAlerte.REPORTEE:
            return le >= self.echeance
        return le >= self.declenchement


@dataclass
class Document:
    """Un document lu et rangé. Vit dans `coffre/documents.json`, pas dans la config."""

    id: str
    chemin: str
    nature: Nature = Nature.INCONNUE
    emetteur: str = ""
    categorie: str = "divers"
    montant: Decimal | None = None
    date_emission: date | None = None
    date_limite: date | None = None
    reference: str = ""
    empreinte: str = ""
    confiance: float = 1.0
    abonnement: str | None = None
