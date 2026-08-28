#!/usr/bin/env python3
"""Actualités macro : flux RSS, et détection des événements à forte volatilité.

**Ce module ne lit pas les nouvelles, il repère les mots qui déclenchent des
mouvements.** La distinction est ce qui le rend faisable : comprendre un article
demanderait un modèle ; savoir qu'un titre contient « FOMC », « rate decision »
ou « SEC lawsuit » demande une liste. Et c'est cette liste-là qui décide de
suspendre les entrées trente minutes avant une décision de taux.

Le flux RSS est parsé avec `xml.etree` de la bibliothèque standard.
`feedparser` ferait la même chose en plus tolérant, mais ajoute une dépendance
pour deux formats — RSS 2.0 et Atom — dont les deux balises utiles sont connues.
Un flux malformé est ignoré avec un avertissement plutôt que de faire tomber la
passe : sur quatre flux, il y en a toujours un qui rend du HTML d'erreur.

**La gravité est volontairement conservatrice.** Un faux positif coûte quelques
heures sans achat ; un faux négatif coûte un achat au milieu d'un krach
réglementaire. Le déséquilibre des deux coûts justifie de classer large.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Iterable, Sequence
from xml.etree import ElementTree

from ..core.journal import obtenir
from ..core.modeles import Actualite, Gravite
from ..core.reseau import ErreurReseau, Fetcher

_journal = obtenir("data_engine.macro")

# Un mot-clé par ligne, associé à sa gravité. La casse est ignorée.
MOTS_CLES: dict[Gravite, tuple[str, ...]] = {
    Gravite.CRITIQUE: (
        "emergency rate", "circuit breaker", "exchange halts withdrawals",
        "bankruptcy", "insolvency", "hack", "exploit drains", "war declared",
        "faillite", "insolvabilité", "piratage", "retraits suspendus",
    ),
    Gravite.ELEVEE: (
        "fomc", "rate decision", "interest rate", "rate hike", "rate cut",
        "cpi", "inflation data", "sec sues", "sec lawsuit", "lawsuit against",
        "etf decision", "ban on crypto", "regulatory crackdown", "liquidation cascade",
        "décision de taux", "taux directeur", "inflation", "plainte de la sec",
        "interdiction", "régulation", "cascade de liquidations",
    ),
    Gravite.SURVEILLANCE: (
        "jobs report", "nonfarm payroll", "fed speech", "powell", "treasury yield",
        "unlock", "token unlock", "halving", "fork", "upgrade delayed",
        "emploi", "discours de la fed", "déblocage de jetons", "report",
    ),
}

_BALISES_TITRE = ("title", "{http://www.w3.org/2005/Atom}title")
_BALISES_DATE = (
    "pubDate", "published", "updated",
    "{http://www.w3.org/2005/Atom}published", "{http://www.w3.org/2005/Atom}updated",
)
_BALISES_LIEN = ("link", "{http://www.w3.org/2005/Atom}link")


def classer(titre: str) -> tuple[Gravite, tuple[str, ...]]:
    """Rend la gravité la plus élevée trouvée, et les mots qui l'ont déclenchée.

    On parcourt de la plus grave à la moins grave et on s'arrête à la première
    famille qui répond : un titre contenant à la fois « hack » et « inflation »
    est critique, pas élevé.
    """

    minuscule = titre.lower()
    for gravite in (Gravite.CRITIQUE, Gravite.ELEVEE, Gravite.SURVEILLANCE):
        trouves = tuple(mot for mot in MOTS_CLES[gravite] if mot in minuscule)
        if trouves:
            return gravite, trouves
    return Gravite.INFO, ()


def _texte(element, balises: Sequence[str]) -> str:
    for balise in balises:
        trouve = element.find(balise)
        if trouve is not None:
            if trouve.text:
                return trouve.text.strip()
            # Atom met le lien dans un attribut, pas dans le texte.
            href = trouve.get("href")
            if href:
                return href.strip()
    return ""


def _date(element) -> datetime | None:
    brut = _texte(element, _BALISES_DATE)
    if not brut:
        return None
    try:
        date = parsedate_to_datetime(brut)
    except (TypeError, ValueError):
        try:
            date = datetime.fromisoformat(brut.replace("Z", "+00:00"))
        except ValueError:
            return None
    return date if date.tzinfo else date.replace(tzinfo=timezone.utc)


def analyser_flux(xml: str, source: str) -> list[Actualite]:
    """Parse un flux RSS 2.0 ou Atom. Rend une liste vide sur flux illisible."""

    try:
        racine = ElementTree.fromstring(xml)
    except ElementTree.ParseError as erreur:
        _journal.warning("Flux %s illisible : %s", source, erreur)
        return []

    entrees = racine.iter("item")
    articles = list(entrees) or list(racine.iter("{http://www.w3.org/2005/Atom}entry"))

    actualites: list[Actualite] = []
    for article in articles:
        titre = _texte(article, _BALISES_TITRE)
        if not titre:
            continue
        gravite, mots = classer(titre)
        actualites.append(
            Actualite(
                titre=titre,
                source=source,
                publiee_le=_date(article) or datetime.now(timezone.utc),
                gravite=gravite,
                mots_cles=mots,
                lien=_texte(article, _BALISES_LIEN),
            )
        )
    return actualites


def filtrer_fenetre(
    actualites: Iterable[Actualite], *, maintenant: datetime, heures: float
) -> list[Actualite]:
    """Ne garde que ce qui est dans la fenêtre, et trie du plus grave au moins.

    Le tri par gravité et non par date est délibéré : la seule question posée à
    cette liste est « y a-t-il quelque chose de grave », et la réponse doit être
    en première position.
    """

    limite = maintenant - timedelta(hours=heures)
    dans_fenetre = [a for a in actualites if a.publiee_le >= limite]
    dans_fenetre.sort(key=lambda a: (-a.gravite.value, -a.publiee_le.timestamp()))
    return dans_fenetre


@dataclass
class IngestionMacro:
    fetcher: Fetcher
    flux: Sequence[str]
    fenetre_heures: float = 24.0

    async def actualites(self, maintenant: datetime) -> list[Actualite]:
        """Un flux mort n'arrête pas les autres : chacun est rattrapé chez lui."""

        collectees: list[Actualite] = []
        for url in self.flux:
            try:
                xml = await self.fetcher.texte(url)
            except ErreurReseau as erreur:
                _journal.info("Flux %s injoignable : %s", url, erreur)
                continue
            collectees += analyser_flux(xml, source=_domaine(url))
        return filtrer_fenetre(collectees, maintenant=maintenant, heures=self.fenetre_heures)


def _domaine(url: str) -> str:
    trouve = re.search(r"https?://([^/]+)", url)
    return trouve.group(1) if trouve else url
