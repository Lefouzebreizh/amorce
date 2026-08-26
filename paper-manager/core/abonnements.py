#!/usr/bin/env python3
"""Module 3 — l'état des contrats, et le calcul des alertes.

Le tableau de bord répond à trois questions : combien je paie par mois, ce qui
se renouvelle bientôt, et ce qui est encore sous engagement.

La règle qui justifie ce module : **on alerte sur le préavis, pas sur
l'échéance.** Un contrat à reconduction tacite qui arrive à terme le 1er
novembre avec deux mois de préavis n'est plus résiliable après le 1er
septembre. Alerter au 1er novembre, c'est alerter une fois l'année suivante
déjà payée. La date portée par l'alerte est donc celle du préavis, et l'alerte
apparaît `alerte_avant_jours` avant elle.

Les cas particuliers que le calcul doit connaître, parce que chacun a déjà
coûté une année de reconduction à quelqu'un :

- **Résiliation à tout moment passé la première année** (assurances,
  complémentaires santé) : le préavis contractuel ne vaut plus que pour la date
  anniversaire, et une résiliation partie n'importe quand prend effet un mois
  plus tard. C'est au champ `notes` de le rappeler, faute de pouvoir le déduire.
- **Avis d'échéance reçu tard** : un assureur qui prévient moins de quinze
  jours avant la fin du préavis rouvre un droit de résiliation. D'où
  `date_avis_echeance` — une date à noter en ouvrant le courrier, elle ne se
  retrouve pas après.
- **Engagement en cours** : partir avant la fin fait payer les mois restants.
  Le coût est au tableau, où il éclaire une décision, et non dans l'alerte de
  préavis : résilier **pour le terme** ne coûte précisément rien.

Trois décisions sur les alertes elles-mêmes :

1. **Une échéance ratée ne se supprime jamais toute seule.** Le calcul possède
   les alertes qui viennent d'un contrat : celles qu'il ne régénère plus — le
   contrat a été résilié, ou son échéance a bougé — s'en vont. Mais une alerte
   dont la date est **passée** reste, jusqu'à ce qu'on la marque traitée : la
   faire disparaître, c'est décider à la place de l'utilisateur que l'année
   reconduite n'était pas grave. Les alertes venues d'un document, elles, ne
   sont pas à ce module et ne sont jamais touchées.
2. **Le statut décidé à la main survit au recalcul.** Une alerte reportée
   reste reportée ; c'est la seule chose que ce module lit dans le fichier
   plutôt que de la calculer.
3. **Pas d'alerte de paiement sur un prélèvement mensuel.** Trente euros tous
   les mois ne surprennent personne ; c'est la prime annuelle de deux cents
   euros qui vide le compte. Une alerte qui revient tous les mois est du bruit,
   et du bruit dans un outil fait pour supprimer la charge mentale.

Ce que ce module ne calcule pas encore, faute du journal des documents : les
alertes `document_manquant` (une facture mensuelle qui cesse d'arriver) et
`conservation` (un document qu'on peut jeter). Elles viendront avec
`journal.py`.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from decimal import Decimal

from core.config import Configuration
from core.modele import (
    Abonnement, Alerte, StatutAbonnement, StatutAlerte, TypeAlerte,
)

# Sept jours : le temps de virer de quoi couvrir, pas plus tôt — une alerte
# posée un mois à l'avance est une alerte qu'on apprend à ne plus voir.
JOURS_AVANT_PRELEVEMENT = 7

# Un contrat en cours de résiliation est encore prélevé : il compte au budget.
# Il n'a plus de préavis à surveiller : il ne compte plus aux alertes.
AU_BUDGET = (StatutAbonnement.ACTIF, StatutAbonnement.EN_RESILIATION)


def euros(montant: Decimal) -> str:
    """2 114,52 € — l'espace des milliers, sans quoi un total à quatre chiffres se relit deux fois."""
    return f"{montant:,.2f}".replace(",", "\u202f").replace(".", ",") + " €"


@dataclass(frozen=True)
class Ligne:
    """Un contrat, vu du tableau de bord."""

    abonnement: Abonnement
    mensuel: Decimal
    echeance: date | None
    preavis: date | None
    jours_avant_preavis: int | None
    mois_restants: int
    cout_sortie: Decimal


@dataclass(frozen=True)
class Tableau:
    le: date
    lignes: list[Ligne]
    alertes: list[Alerte]

    @property
    def total_mensuel(self) -> Decimal:
        return sum((ligne.mensuel for ligne in self.lignes), Decimal("0"))

    @property
    def total_annuel(self) -> Decimal:
        return self.total_mensuel * 12

    @property
    def par_categorie(self) -> dict[str, Decimal]:
        """Du plus cher au moins cher : c'est là qu'on cherche où couper."""
        cumul: dict[str, Decimal] = {}
        for ligne in self.lignes:
            cle = ligne.abonnement.categorie
            cumul[cle] = cumul.get(cle, Decimal("0")) + ligne.mensuel
        return dict(sorted(cumul.items(), key=lambda paire: paire[1], reverse=True))


def tableau(configuration: Configuration, le: date | None = None) -> Tableau:
    """L'état des contrats au jour dit. Les contrats résiliés restent hors du total."""
    le = le or date.today()
    lignes = [
        _ligne(abonnement, le, configuration.rappels.alerte_avant_defaut_jours)
        for abonnement in configuration.abonnements
        if abonnement.statut in AU_BUDGET
    ]
    lignes.sort(key=lambda ligne: (ligne.preavis or date.max, -ligne.mensuel))
    return Tableau(le=le, lignes=lignes, alertes=alertes(configuration, le))


def _ligne(abonnement: Abonnement, le: date, avance_defaut: int) -> Ligne:
    preavis = abonnement.date_preavis(le)
    mois_restants = abonnement.engagement.mois_restants(le)
    return Ligne(
        abonnement=abonnement,
        mensuel=abonnement.montant_mensuel,
        echeance=abonnement.prochaine_echeance(le),
        preavis=preavis,
        jours_avant_preavis=(preavis - le).days if preavis else None,
        mois_restants=mois_restants,
        cout_sortie=abonnement.montant_mensuel * mois_restants,
    )


def alertes(configuration: Configuration, le: date | None = None) -> list[Alerte]:
    """Les alertes du jour : celles qui se calculent, fondues avec celles du fichier."""
    le = le or date.today()
    return fusionner(configuration.alertes, _calculer(configuration, le), le)


def fusionner(existantes: list[Alerte], calculees: list[Alerte], le: date) -> list[Alerte]:
    """Le calcul reprend le statut déjà décidé, et n'efface que ce qui n'a plus lieu d'être."""
    connues = {alerte.id: alerte for alerte in existantes}
    retenues: list[Alerte] = []
    for alerte in calculees:
        ancienne = connues.get(alerte.id)
        retenues.append(alerte if ancienne is None else replace(alerte, statut=ancienne.statut))

    recalculees = {alerte.id for alerte in retenues}
    for alerte in existantes:
        if alerte.id in recalculees or alerte.statut is StatutAlerte.TRAITEE:
            continue
        # Une alerte de contrat que le calcul ne produit plus n'a plus lieu
        # d'être : le contrat est résilié, ou son échéance a bougé. Sauf si sa
        # date est passée — c'est alors une échéance ratée, et elle doit rester
        # sous les yeux. Ce qui ne vient pas d'un contrat n'est pas à ce module.
        depassee = alerte.echeance < le
        if alerte.source.startswith("abonnement:") and not depassee:
            continue
        retenues.append(alerte)
    return sorted(retenues, key=lambda alerte: (alerte.echeance, alerte.id))


def _calculer(configuration: Configuration, le: date) -> list[Alerte]:
    avance = configuration.rappels.alerte_avant_defaut_jours
    calculees: list[Alerte] = []
    for abonnement in configuration.abonnements:
        for alerte in (_alerte_echeance(abonnement, le, avance), _alerte_paiement(abonnement, le)):
            if alerte is not None:
                calculees.append(alerte)
    return calculees


def _identifiant(abonnement: Abonnement, genre: TypeAlerte, jour: date) -> str:
    """Stable, et daté : une échéance passée cède la place à la suivante sans se confondre."""
    return f"{abonnement.id}-{genre.value}-{jour:%Y-%m-%d}"


def _alerte_echeance(abonnement: Abonnement, le: date, avance_defaut: int) -> Alerte | None:
    if abonnement.statut is not StatutAbonnement.ACTIF:
        return None
    echeance = abonnement.prochaine_echeance(le)
    preavis = abonnement.date_preavis(le)
    declenchement = abonnement.date_alerte(le, avance_defaut)
    if echeance is None or preavis is None or declenchement is None:
        return None

    nom = f"{abonnement.libelle} ({abonnement.emetteur})" if abonnement.emetteur else abonnement.libelle
    if abonnement.preavis_jours > 0:
        genre = TypeAlerte.PREAVIS
        action = (
            f"Résilier {nom} avant le {preavis:%d/%m/%Y} — {abonnement.preavis_jours} jours "
            f"de préavis avant l'échéance du {echeance:%d/%m/%Y}."
        )
        if abonnement.resiliable_en_ligne and abonnement.adresse_resiliation:
            action += f" En ligne : {abonnement.adresse_resiliation}."
        elif abonnement.recommande:
            action += f" Lettre recommandée{f' à {abonnement.adresse_resiliation}' if abonnement.adresse_resiliation else ''}."
    elif abonnement.reconduction_tacite:
        genre = TypeAlerte.RENOUVELLEMENT
        action = (
            f"{nom} se reconduit le {echeance:%d/%m/%Y}, sans préavis à respecter : "
            "comparer les offres avant."
        )
    else:
        genre = TypeAlerte.RENOUVELLEMENT
        action = f"{nom} prend fin le {echeance:%d/%m/%Y} : prévoir ce qui le remplace."

    return Alerte(
        id=_identifiant(abonnement, genre, preavis),
        type=genre,
        source=f"abonnement:{abonnement.id}",
        echeance=preavis,
        declenchement=declenchement,
        montant=abonnement.montant,
        action=action,
    )


def _alerte_paiement(abonnement: Abonnement, le: date) -> Alerte | None:
    if abonnement.statut not in AU_BUDGET or abonnement.periodicite.mois < 3:
        return None
    jour = abonnement.prochain_paiement(le)
    if jour is None:
        return None
    return Alerte(
        id=_identifiant(abonnement, TypeAlerte.PAIEMENT, jour),
        type=TypeAlerte.PAIEMENT,
        source=f"abonnement:{abonnement.id}",
        echeance=jour,
        declenchement=jour - timedelta(days=JOURS_AVANT_PRELEVEMENT),
        montant=abonnement.montant,
        action=(
            f"Prélèvement {abonnement.emetteur or abonnement.libelle} de "
            f"{euros(abonnement.montant)} le {jour:%d/%m/%Y} : vérifier la provision."
        ),
    )
