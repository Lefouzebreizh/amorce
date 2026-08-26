#!/usr/bin/env python3
"""Module 4 — le courrier prêt à signer.

Un gabarit de `modeles/`, rempli avec l'identité et le contrat, puis mis en page
en PDF. Six décisions :

1. **Le gabarit garantit le fond, jamais le modèle.** Un courrier de résiliation
   n'est opposable que s'il porte certaines mentions : identité complète,
   référence client, contrat visé, date d'effet demandée, demande de
   confirmation écrite. Une lettre rédigée librement est plus élégante et en
   oublie une sur cinq. `controler` vérifie que le courrier composé les porte
   toutes, et refuse de produire un fichier s'il en manque une — une lettre à
   laquelle il manque la référence client se fait classer sans suite.
2. **La condition est le choix du gabarit, pas un `si` dans le gabarit.** Quatre
   situations juridiques distinctes, quatre fichiers lisibles à l'œil nu. Un
   gabarit truffé de conditions n'est plus relisible, et c'est un texte qu'il
   faut pouvoir relire avant de l'envoyer en son nom.
3. **Pas de moteur de gabarits.** `formulaires.resoudre` sait déjà remplir
   `{identite.nom}` et `{@aujourdhui}`, il est écrit et vérifié. Ajouter Jinja
   coûterait une dépendance à installer partout pour la même chose.
4. **Aucun courrier n'est envoyé.** Le module produit un fichier dans
   `coffre/courriers/`, à relire et à signer. Un courrier administratif parti
   tout seul ne se rattrape pas.
5. **La date d'effet est calculée, pas demandée.** C'est la prochaine échéance
   dont le préavis peut encore être respecté — partir au terme ne coûte rien.
   Quand ce n'est plus possible, un mois : le délai des résiliations hors terme.
6. **Le recommandé est indiqué quand il est nécessaire.** En cas de litige,
   c'est la preuve de l'envoi qui fait foi, pas le contenu du courrier.

Ce qui n'est pas là : la contestation de facture, qui vise un document et non un
contrat. Elle attend `journal.py`, sans quoi elle ne saurait pas de quelle
facture elle parle.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pymupdf

from core.config import Configuration
from core.formulaires import TRANSPOSITION, ErreurFormulaire, resoudre
from core.modele import Abonnement, Identite, ajouter_mois

GABARITS = Path(__file__).resolve().parent.parent / "modeles"

# Loi Chatel : l'avis d'échéance doit parvenir au plus tard quinze jours avant la
# fin du délai de préavis. Reçu plus tard, il rouvre un droit de résiliation.
DELAI_AVIS = 15
# Un an de contrat ouvre la résiliation à tout moment pour les assurances et les
# complémentaires santé, avec effet un mois après la notification.
CATEGORIES_INFRA_ANNUELLES = ("assurance", "sante")

MARGE = 60.0
LARGEUR_UTILE = 475.0
INTERLIGNE = 1.45
TAILLE = 10.5


class ErreurCourrier(Exception):
    """Gabarit introuvable, ou mention obligatoire absente du courrier composé."""


@dataclass(frozen=True)
class Courrier:
    """Un courrier composé, avant mise en page."""

    gabarit: str
    objet: str
    corps: str
    destinataire: str
    recommande: bool
    date_effet: date
    # Le jour de la composition, et non celui de l'impression : tout le corps du
    # courrier est calculé à cette date, et une lettre datée d'un autre jour que
    # ses propres délais se contredit.
    le: date


def part_au_terme(abonnement: Abonnement, le: date) -> bool:
    """Le préavis peut-il encore être respecté pour la prochaine échéance ?

    C'est la question qui commande tout le reste : partir au terme ne coûte ni
    mois supplémentaire ni pénalité, et c'est donc toujours la voie à préférer
    tant qu'elle est ouverte.
    """
    preavis = abonnement.date_preavis(le)
    return preavis is not None and abonnement.prochaine_echeance(le) is not None and le <= preavis


def date_effet(abonnement: Abonnement, le: date) -> date:
    """La date à laquelle la résiliation doit prendre effet.

    Au terme tant que le préavis tient ; sinon un mois, qui est le délai des
    résiliations hors terme comme des résiliations infra-annuelles.
    """
    if part_au_terme(abonnement, le):
        echeance = abonnement.prochaine_echeance(le)
        assert echeance is not None
        return echeance
    return ajouter_mois(le, 1)


def avis_tardif(abonnement: Abonnement, le: date) -> bool:
    """L'assureur a-t-il prévenu trop tard pour que le préavis soit tenable ?

    Un avis **à venir** ne compte pas : `date_avis_echeance` est une date de
    réception, et l'échéance annoncée pour dans trois semaines ne fonde aucun
    droit aujourd'hui. Sans ce contrôle, la lettre affirme avoir reçu un
    courrier qui n'est pas arrivé — de quoi la faire écarter d'un revers.
    """
    preavis = abonnement.date_preavis(le)
    recu = abonnement.date_avis_echeance
    if recu is None or preavis is None or recu > le:
        return False
    return (preavis - recu).days < DELAI_AVIS


def choisir_gabarit(abonnement: Abonnement, le: date) -> str:
    """La situation juridique décide du texte. Un `--gabarit` explicite prime."""
    if avis_tardif(abonnement, le):
        return "resiliation_avis_tardif"
    # Le gabarit doit s'accorder avec `date_effet` : un texte qui annonce un
    # effet « un mois après réception » sous une date d'effet calculée au terme
    # se contredit lui-même, et c'est le genre d'incohérence qu'un service
    # client relève avant de refuser.
    if part_au_terme(abonnement, le) and abonnement.preavis_jours > 0:
        return "resiliation_echeance"
    if abonnement.categorie in CATEGORIES_INFRA_ANNUELLES and _depuis_plus_d_un_an(abonnement, le):
        return "resiliation_infra_annuelle"
    return "resiliation_simple"


def fondement(abonnement: Abonnement, gabarit: str) -> str:
    """Le texte invoqué. Il n'est pas le même selon qui est en face.

    Un assureur et un opérateur télécom relèvent de codes différents ; citer
    le code des assurances à une salle de sport affaiblit précisément la lettre
    qu'on voulait rendre opposable.
    """
    assureur = abonnement.categorie in CATEGORIES_INFRA_ANNUELLES
    if gabarit == "resiliation_avis_tardif":
        return ("l'article L113-15-1 du code des assurances" if assureur
                else "l'article L215-1 du code de la consommation")
    if gabarit == "resiliation_infra_annuelle":
        return ("l'article L932-21-3 du code de la sécurité sociale"
                if abonnement.categorie == "sante"
                else "l'article L113-15-2 du code des assurances")
    return ""


def _depuis_plus_d_un_an(abonnement: Abonnement, le: date) -> bool:
    debut = abonnement.engagement.debut
    return debut is not None and le >= ajouter_mois(debut, 12)


def composer(
    configuration: Configuration,
    abonnement: Abonnement,
    le: date,
    gabarit: str | None = None,
    motif: str = "",
) -> Courrier:
    """Remplit le gabarit qui convient. Lève si une mention obligatoire manque."""
    nom = gabarit or choisir_gabarit(abonnement, le)
    fichier = GABARITS / f"{nom}.txt"
    if not fichier.exists():
        connus = ", ".join(sorted(c.stem for c in GABARITS.glob("resiliation_*.txt")))
        raise ErreurCourrier(f"gabarit « {nom} » introuvable (connus : {connus})")

    effet = date_effet(abonnement, le)
    contexte = {
        "identite": configuration.identite,
        "abonnement": abonnement,
        "effet": effet,
        "fondement": fondement(abonnement, nom),
        "motif": motif or "des raisons qui me sont personnelles",
    }
    brut = fichier.read_text(encoding="utf-8")
    try:
        rempli = resoudre({"texte": brut}, contexte, le)["texte"]
    except ErreurFormulaire as erreur:
        raise ErreurCourrier(f"gabarit « {nom} » : {erreur}") from None

    objet, _, corps = rempli.partition("\n")
    courrier = Courrier(
        gabarit=nom,
        objet=objet.removeprefix("Objet :").strip(),
        corps=corps.strip(),
        destinataire=abonnement.adresse_resiliation or abonnement.emetteur,
        recommande=abonnement.recommande,
        date_effet=effet,
        le=le,
    )
    manquantes = controler(courrier, abonnement)
    if manquantes:
        raise ErreurCourrier(
            f"gabarit « {nom} » : mentions absentes du courrier — {', '.join(manquantes)}. "
            "Un courrier incomplet se fait classer sans suite."
        )
    return courrier


def controler(courrier: Courrier, abonnement: Abonnement) -> list[str]:
    """Les mentions sans lesquelles un courrier de résiliation ne vaut rien.

    Le contrôle porte sur le texte composé et non sur le gabarit : c'est le
    seul moyen de voir qu'une référence client vide a laissé un trou.
    """
    entier = f"{courrier.objet}\n{courrier.corps}"
    attendues = {
        "la référence client": bool(abonnement.reference_client)
                               and abonnement.reference_client in entier,
        "le contrat visé": abonnement.libelle in entier,
        "la date d'effet demandée": f"{courrier.date_effet:%d/%m/%Y}" in entier,
        "la demande de confirmation écrite": "confirmation" in entier.lower(),
    }
    return [nom for nom, present in attendues.items() if not present]


def rendre_pdf(courrier: Courrier, identite: Identite, chemin: Path) -> Path:
    """Met le courrier en page sur du A4, prêt à imprimer et à signer."""
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    curseur = _Curseur(document, page)

    curseur.bloc(MARGE, 70, LARGEUR_UTILE / 2, [
        f"{identite.civilite} {identite.nom_complet}".strip(),
        identite.adresse,
        f"{identite.code_postal} {identite.ville}".strip(),
        identite.telephone,
        identite.courriel,
    ])
    curseur.bloc(320, 170, 235, courrier.destinataire.split(" — "))
    curseur.bloc(320, 260, 235, [f"{identite.ville}, le {courrier.le:%d/%m/%Y}"])

    curseur.y = 320
    if courrier.recommande:
        curseur.paragraphe("Lettre recommandée avec accusé de réception", gras=True)
    curseur.paragraphe(f"Objet : {courrier.objet}", gras=True)
    curseur.y += 12
    for paragraphe in courrier.corps.split("\n\n"):
        curseur.paragraphe(paragraphe.replace("\n", " ").strip())
    curseur.y += 30
    curseur.paragraphe("Signature :")

    chemin.parent.mkdir(parents=True, exist_ok=True)
    document.save(chemin)
    document.close()
    return chemin


class _Curseur:
    """Pose des blocs de texte de haut en bas, et tourne la page quand il faut."""

    def __init__(self, document: pymupdf.Document, page: pymupdf.Page) -> None:
        self.document = document
        self.page = page
        self.y = MARGE

    def bloc(self, x: float, y: float, largeur: float, lignes: list[str]) -> None:
        for ligne in [l for l in lignes if l.strip()]:
            self.page.insert_text((x, y), _lisible(ligne), fontname="helv", fontsize=TAILLE)
            y += TAILLE * 1.3

    def paragraphe(self, texte: str, gras: bool = False) -> None:
        police = "hebo" if gras else "helv"
        restant = 842 - MARGE - self.y
        # `insert_textbox` rend la hauteur inutilisée : c'est ce qui permet
        # d'enchaîner les paragraphes sans calculer soi-même les retours à la ligne.
        cadre = pymupdf.Rect(MARGE, self.y, MARGE + LARGEUR_UTILE, self.y + restant)
        reste = self.page.insert_textbox(cadre, _lisible(texte), fontname=police,
                                         fontsize=TAILLE, lineheight=INTERLIGNE)
        if reste < 0:
            self.page = self.document.new_page(width=595, height=842)
            self.y = MARGE
            cadre = pymupdf.Rect(MARGE, self.y, MARGE + LARGEUR_UTILE, 842 - MARGE)
            reste = self.page.insert_textbox(cadre, _lisible(texte), fontname=police,
                                             fontsize=TAILLE, lineheight=INTERLIGNE)
        self.y += cadre.height - reste + TAILLE * 0.6


def _lisible(texte: str) -> str:
    """Les polices de base d'un PDF sont en latin-1 : « œ » et « € » y deviennent
    « ? » sans avertissement. Même transposition que pour les formulaires."""
    return texte.translate(TRANSPOSITION)
