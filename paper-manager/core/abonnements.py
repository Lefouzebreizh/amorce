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

Les deux alertes qui dépendent du journal des documents, et leurs règles :

- **`document_manquant`** ne se déclenche que si l'on a **déjà vu** au moins un
  document de cet émetteur. Sans cette garde, chaque abonnement crierait au
  premier passage : l'assistant ne sait pas si la facture manque ou si le coffre
  vient d'être ouvert. Et un délai de grâce s'ajoute à la période attendue —
  une facture mensuelle n'arrive pas le même jour tous les mois, et alerter au
  trente-deuxième jour, c'est crier au loup chaque mois.
- **`conservation`** groupe par catégorie et par année. Cinq ans de factures
  d'énergie font soixante documents : une alerte par document noierait tout le
  reste, alors qu'« les douze factures d'énergie de 2020 peuvent être jetées »
  se traite d'un geste. Le groupe n'expire qu'avec son document **le plus
  récent**, pour ne jamais proposer de jeter trop tôt. Et le programme ne
  supprime jamais rien : il signale.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from decimal import Decimal

from core.config import Configuration
from core.journal import Journal
from core.modele import (
    Abonnement, Alerte, Document, StatutAbonnement, StatutAlerte, TypeAlerte, ajouter_mois,
)

# Sept jours : le temps de virer de quoi couvrir, pas plus tôt — une alerte
# posée un mois à l'avance est une alerte qu'on apprend à ne plus voir.
JOURS_AVANT_PRELEVEMENT = 7

# Un contrat en cours de résiliation est encore prélevé : il compte au budget.
# Il n'a plus de préavis à surveiller : il ne compte plus aux alertes.
AU_BUDGET = (StatutAbonnement.ACTIF, StatutAbonnement.EN_RESILIATION)

# Ce qu'un rythme annoncé vaut en jours, et le délai de grâce qui va avec. Une
# facture mensuelle n'arrive pas le même jour tous les mois : sans ce délai,
# l'alerte tomberait presque chaque mois, et on apprendrait à ne plus la lire.
RYTHMES = {
    "mensuel": (31, 15, "chaque mois"), "mensuelle": (31, 15, "chaque mois"),
    "trimestriel": (92, 20, "chaque trimestre"), "trimestrielle": (92, 20, "chaque trimestre"),
    "semestriel": (183, 25, "chaque semestre"), "semestrielle": (183, 25, "chaque semestre"),
    "annuel": (366, 30, "chaque année"), "annuelle": (366, 30, "chaque année"),
}

# Les préfixes de source que ce module possède : ce qu'il ne recalcule plus, il
# a le droit de le retirer. Le reste — une alerte née d'un document isolé — ne
# lui appartient pas et survit.
POSSEDES_SANS_JOURNAL = ("abonnement:",)
POSSEDES_AVEC_JOURNAL = ("abonnement:", "conservation:")


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


def tableau(configuration: Configuration, le: date | None = None,
            journal: Journal | None = None) -> Tableau:
    """L'état des contrats au jour dit. Les contrats résiliés restent hors du total."""
    le = le or date.today()
    lignes = [
        _ligne(abonnement, le, configuration.rappels.alerte_avant_defaut_jours)
        for abonnement in configuration.abonnements
        if abonnement.statut in AU_BUDGET
    ]
    lignes.sort(key=lambda ligne: (ligne.preavis or date.max, -ligne.mensuel))
    return Tableau(le=le, lignes=lignes, alertes=alertes(configuration, le, journal))


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


def alertes(configuration: Configuration, le: date | None = None,
            journal: Journal | None = None) -> list[Alerte]:
    """Les alertes du jour : celles qui se calculent, fondues avec celles du fichier.

    Sans journal, deux types restent muets — on ne peut pas dire qu'un document
    manque quand on ne sait pas lesquels sont arrivés. Ils ne sont alors ni
    calculés ni retirés : les taire vaut mieux que de les nier.
    """
    le = le or date.today()
    possedes = POSSEDES_AVEC_JOURNAL if journal is not None else POSSEDES_SANS_JOURNAL
    return fusionner(configuration.alertes, _calculer(configuration, le, journal), le, possedes)


def fusionner(existantes: list[Alerte], calculees: list[Alerte], le: date,
              possedes: tuple[str, ...] = POSSEDES_SANS_JOURNAL) -> list[Alerte]:
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
        if alerte.source.startswith(possedes) and not depassee:
            continue
        retenues.append(alerte)
    return sorted(retenues, key=lambda alerte: (alerte.echeance, alerte.id))


def _calculer(configuration: Configuration, le: date,
              journal: Journal | None = None) -> list[Alerte]:
    avance = configuration.rappels.alerte_avant_defaut_jours
    calculees: list[Alerte] = []
    for abonnement in configuration.abonnements:
        for alerte in (_alerte_echeance(abonnement, le, avance),
                       _alerte_paiement(abonnement, le),
                       _alerte_document_manquant(abonnement, le, journal)):
            if alerte is not None:
                calculees.append(alerte)
    if journal is not None:
        calculees += _alertes_conservation(configuration, le, journal)
    return calculees


def _alerte_document_manquant(abonnement: Abonnement, le: date,
                              journal: Journal | None) -> Alerte | None:
    """La facture attendue qui n'est pas arrivée.

    Ne se déclenche que si l'on a déjà vu passer un document de cet émetteur :
    sans cette garde, chaque abonnement crierait au premier passage, l'assistant
    ne sachant pas distinguer une facture manquante d'un coffre qu'on vient
    d'ouvrir. C'est le genre de faux signal qui fait ignorer les vrais.
    """
    if journal is None or abonnement.statut not in AU_BUDGET or not abonnement.documents_attendus:
        return None
    rythme = RYTHMES.get(abonnement.documents_attendus.lower())
    if rythme is None:
        return None
    periode, grace, cadence = rythme

    connus = journal.derniers_de(abonnement.emetteur)
    if not connus or connus[0].date_emission is None:
        return None
    dernier = connus[0].date_emission
    attendu = dernier + timedelta(days=periode)
    if le < attendu + timedelta(days=grace):
        return None

    return Alerte(
        id=_identifiant(abonnement, TypeAlerte.DOCUMENT_MANQUANT, attendu),
        type=TypeAlerte.DOCUMENT_MANQUANT,
        source=f"abonnement:{abonnement.id}",
        echeance=attendu,
        declenchement=attendu + timedelta(days=grace),
        montant=abonnement.montant,
        action=(
            f"Aucun document de {abonnement.emetteur or abonnement.libelle} depuis le "
            f"{dernier:%d/%m/%Y}, alors qu'il en arrive normalement un {cadence}. "
            "Vérifier la boîte mail ou l'espace client — une facture qui cesse "
            "d'arriver annonce souvent un changement de tarif."
        ),
    )


def _alertes_conservation(configuration: Configuration, le: date,
                          journal: Journal) -> list[Alerte]:
    """Ce qu'on a le droit de jeter, groupé par catégorie et par année.

    Groupé, parce que cinq ans de factures d'énergie font soixante documents et
    qu'une alerte par document noierait tout le reste. Le groupe n'expire qu'avec
    son document le plus récent : mieux vaut garder un an de trop que jeter un
    justificatif encore utile. Et rien n'est supprimé — le programme signale.
    """
    groupes: dict[tuple[str, int], list[Document]] = {}
    for document in journal:
        if document.date_emission is None:
            continue
        groupes.setdefault((document.categorie, document.date_emission.year), []).append(document)

    calculees: list[Alerte] = []
    for (categorie, annee), documents in sorted(groupes.items()):
        reglage = configuration.classement.categories.get(categorie)
        if reglage is None or reglage.conservation_annees is None:
            continue  # à garder à vie : un bulletin de paie, un acte notarié
        plus_recent = max(d.date_emission for d in documents if d.date_emission)
        expire = ajouter_mois(plus_recent, 12 * reglage.conservation_annees)
        if le < expire:
            continue
        calculees.append(Alerte(
            id=f"conservation-{categorie}-{annee}",
            type=TypeAlerte.CONSERVATION,
            source=f"conservation:{categorie}-{annee}",
            echeance=expire,
            declenchement=expire,
            montant=None,
            action=(
                f"{len(documents)} document(s) « {reglage.libelle} » de {annee} ont passé "
                f"leur durée de conservation de {reglage.conservation_annees} an(s) : "
                "ils peuvent être jetés. Rien n'a été supprimé."
            ),
        ))
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
