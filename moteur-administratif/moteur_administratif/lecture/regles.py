"""Texte → champs. Pur : aucune entrée-sortie, vérifiable sans rien installer.

Réconciliation du 03/09/2026 entre les deux implémentations trouvées dans le
dépôt :

- `paper-manager/core/extraction.py` sait éviter les pièges du document
  administratif français : espace insécable dans un montant, date qui commence
  par le jour, plus gros nombre de la page qui n'est pas le total, ligne de
  pied de page qui porte un SIRET plutôt qu'un vrai montant. Sa mécanique de
  recherche par motifs est reprise ici presque telle quelle.
- `life-organizer/modules/scan_ocr/regles.py` sait reconnaître une **nature**
  de document sans liste fermée — une table de mots-clés fournie par
  l'appelant, plutôt qu'un `Enum` de natures connues d'avance (`Nature.
  FACTURE`, `Nature.AVIS`…) — et repère un émetteur au premier coup d'œil,
  sans liste d'émetteurs déjà rencontrés, en écartant ce qui ressemble à une
  date, un montant, une adresse, ou au titre du document lui-même (un émetteur
  qui s'appellerait « Quittance-de-loyer » ne distinguerait plus les douze
  quittances de l'année).

Le second l'emporte partout où le moteur ne doit connaître aucun vocabulaire
produit : la nature se reconnaît par une table fournie à l'appel
(`types_reconnus`), jamais par une liste figée dans ce fichier. Le premier
l'emporte pour tout ce qui est un vrai piège de format, indépendant de qui
appelle : normalisation des espaces, positions préservées pour rattacher un
montant à son étiquette, plausibilité des dates et des montants.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from .modele import ChampsDocument

# --- normalisation -----------------------------------------------------------

# NFKC ramène déjà la plupart des espaces exotiques, mais pas toutes selon les
# versions d'Unicode : la table explicite garantit le résultat plutôt que de
# faire confiance à la bibliothèque du jour. Sans elle, « 1 234,56 € » séparé
# par une espace insécable (U+00A0, U+202F...) se lit « 234,56 » — une erreur
# d'un facteur mille, silencieuse, sur le champ qui compte le plus.
_ESPACES = {" ": " ", " ": " ", " ": " ", " ": " "}


def normaliser(texte: str) -> str:
    """Ramène le texte extrait à quelque chose que des motifs peuvent lire."""
    texte = unicodedata.normalize("NFKC", texte)
    for avant, apres in _ESPACES.items():
        texte = texte.replace(avant, apres)
    return re.sub(r"[ \t]+", " ", texte)


def aplatir(texte: str) -> str:
    """Le texte en minuscules, sans diacritiques, **caractère pour caractère**.

    C'est ce qui rend les positions trouvées dans le texte aplati valables
    dans le texte d'origine. Un aplatissement qui raccourcit (en fusionnant des
    espaces, par exemple) décale les fenêtres de recherche : mesuré sur une
    facture d'essai, une version raccourcie faisait lire le montant de la ligne
    d'à côté.
    """
    sortie = []
    for caractere in texte:
        base = unicodedata.normalize("NFD", caractere)[0]
        sortie.append(base.lower() if base.isalnum() else " ")
    return "".join(sortie)


def _lignes_utiles(texte: str) -> list[str]:
    return [l for l in texte.splitlines() if not _LIGNES_A_IGNORER.search(l)]


# Ces lignes portent des suites de chiffres qui ressemblent à des montants ou
# à des dates sans en être : les écarter vaut mieux que de les décoder.
_LIGNES_A_IGNORER = re.compile(r"siret|siren|\btva\b|iban|bic|rcs|\bape\b|naf", re.I)

# --- confiance -----------------------------------------------------------------


def confiance_pour(nombre_de_signaux: int) -> float:
    """La confiance qu'apportent `n` signaux concordants, saturante.

    0,50 pour un signal, 0,75 pour deux, 0,88 pour trois — jamais 1 : un texte
    n'est jamais une preuve. Reprise telle quelle de `life-organizer/modules/
    scan_ocr/regles.py::confiance_pour`, déjà générique — la formule ne dépend
    d'aucun vocabulaire métier.
    """
    if nombre_de_signaux <= 0:
        return 0.0
    return 1.0 - 0.5**nombre_de_signaux


def confiance(champs: ChampsDocument, poids: dict[str, dict[str, float]]) -> float:
    """La confiance globale d'une lecture, selon la manière dont chaque champ a
    été trouvé.

    `poids` vient du produit appelant — lui seul sait si un émetteur reconnu
    compte plus qu'une date étiquetée pour ses propres documents. Reprend le
    principe de `paper-manager/core/extraction.py::Champs.confiance`, dépouillé
    de ses poids en dur : ceux-ci sont un choix de produit, pas du moteur.
    """
    total = 0.0
    for champ, comment in champs.trouvailles.items():
        total += poids.get(champ, {}).get(comment, 0.0)
    return round(min(total, 1.0), 2)


# --- nature --------------------------------------------------------------------


def reconnaitre_nature(texte: str, types_reconnus: list[dict]) -> tuple[str | None, float, tuple[str, ...]]:
    """La nature du document, sa confiance, et les mots-clés qui l'ont emporté.

    `types_reconnus` est fourni par l'appelant : `[{"type": "facture",
    "mots_cles": ["facture", "note d'honoraires"]}, ...]`. Le moteur ne connaît
    aucune nature à l'avance — c'est le produit qui sait ce qu'il attend de
    voir passer.

    Cherché dans les 1000 premiers caractères seulement : le mot « facture »
    apparaît dans les conditions générales de presque tout document, y compris
    un contrat.

    À égalité de mots-clés trouvés, le premier type de la table l'emporte :
    même parti pris que le classement par thèmes de `life-organizer/modules/
    classement/regles.py` — un ordre que l'utilisateur maîtrise plutôt qu'un
    score qu'il devrait deviner.
    """
    aplati = aplatir(texte[:1000])
    meilleur: tuple[str, tuple[str, ...]] | None = None
    for entree in types_reconnus:
        nom = str(entree.get("type") or "").strip()
        if not nom:
            continue
        trouves = tuple(
            mot for mot in entree.get("mots_cles", [])
            if aplatir(str(mot)).strip() and aplatir(str(mot)).strip() in aplati
        )
        if trouves and (meilleur is None or len(trouves) > len(meilleur[1])):
            meilleur = (nom, trouves)
    if meilleur is None:
        return None, 0.0, ()
    return meilleur[0], confiance_pour(len(meilleur[1])), meilleur[1]


# --- montant ---------------------------------------------------------------------

_MONTANT = re.compile(r"(?<![\d,.])(\d{1,3}(?: \d{3})+|\d+)[,.](\d{2})(?![\d])")
# Un montant à sept chiffres devant la virgule n'est pas une facture de
# particulier : c'est un numéro qu'on a mal découpé.
_MONTANT_MAXIMUM = Decimal("999999.99")

# Dans l'ordre de préférence : le premier trouvé gagne. « Net à payer » est ce
# qui sera prélevé ; « total TTC » peut inclure un acompte déjà versé.
ETIQUETTES_MONTANT = (
    "net a payer", "montant a payer", "reste a payer", "total a payer",
    "montant du", "total ttc", "montant ttc", "total",
)


def montants(texte: str) -> list[Decimal]:
    """Tous les montants plausibles du texte, dans l'ordre d'apparition."""
    trouves: list[Decimal] = []
    for ligne in _lignes_utiles(texte):
        for entier, decimales in _MONTANT.findall(ligne):
            try:
                valeur = Decimal(entier.replace(" ", "") + "." + decimales)
            except InvalidOperation:
                continue
            if Decimal("0") < valeur <= _MONTANT_MAXIMUM:
                trouves.append(valeur)
    return trouves


def montant_principal(texte: str) -> tuple[Decimal | None, str]:
    """Le montant à retenir, et par quel chemin il a été trouvé.

    On cherche d'abord derrière une étiquette. Le plus gros nombre de la page
    n'est pas le total : un numéro mal découpé, un total de commande antérieur
    ou un cumul annuel le dépassent souvent.
    """
    aplati = aplatir(texte)
    for etiquette in ETIQUETTES_MONTANT:
        for trouve in re.finditer(re.escape(etiquette), aplati):
            fenetre = texte[trouve.start(): trouve.start() + 120]
            candidats = montants(fenetre)
            if candidats:
                return candidats[0], "etiquete"
    tous = montants(texte)
    return (max(tous), "devine") if tous else (None, "")


# --- dates -------------------------------------------------------------------

_MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12,
}
_DATE_NUMERIQUE = re.compile(r"(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?!\d)")
_DATE_ISO = re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)")
_DATE_LETTRES = re.compile(
    r"(?<!\d)(\d{1,2})(?:er)?\s+(" + "|".join(_MOIS) + r")\s+(\d{4})", re.I)

# Fenêtre de plausibilité d'une date de document. Large en arrière — on lit
# de vieux papiers. En avant, la marge dépend de **quelle** date on cherche :
# une date d'émission dans le futur est presque toujours un nombre mal lu,
# mais une date limite l'est *presque toujours pas* — c'est le sens même
# d'une échéance. Une seule fenêtre pour les deux (bug trouvé le 03/09/2026,
# voir `tests/test_lecture.py::TestDatePresDe`) rejetait toute date limite à
# venir. `MARGE_FUTUR_ECHEANCE_JOURS` reprend la valeur de `life-organizer/
# modules/scan_ocr/regles.py::MARGE_FUTUR_JOURS` : au-delà de 400 jours, ce
# n'est plus une échéance plausible, c'est un nombre mal lu.
ANNEE_MINIMALE = 1990
MARGE_FUTUR_EMISSION_JOURS = 0
MARGE_FUTUR_ECHEANCE_JOURS = 400

ETIQUETTES_ECHEANCE = (
    "date limite de paiement", "a payer avant", "date d echeance", "echeance",
    "date limite", "avant le", "au plus tard le",
)
ETIQUETTES_EMISSION = (
    "date d emission", "date de facture", "date du document", "emis le",
    "fait le", "date",
)
ETIQUETTES_REFERENCE = (
    "reference client", "numero de client", "n de client", "reference",
    "numero de contrat", "identifiant client",
)
_REFERENCE = re.compile(r"[A-Z0-9][A-Z0-9\-/ ]{4,24}[A-Z0-9]")


def _jour(annee: int, mois: int, jour: int, le: date,
          marge_future_jours: int = MARGE_FUTUR_EMISSION_JOURS) -> date | None:
    """Rend la date si elle est possible **et** plausible, sinon rien.

    Une date bien avant 1990 n'est pas un document : c'est une suite de
    chiffres mal découpée. Au-delà d'aujourd'hui plus `marge_future_jours`,
    même chose — la marge par défaut est nulle (aucune date future), à élargir
    explicitement pour chercher une échéance plutôt qu'une émission.
    """
    try:
        candidate = date(annee, mois, jour)
    except ValueError:
        return None
    if candidate.year < ANNEE_MINIMALE:
        return None
    return candidate if candidate <= le + timedelta(days=marge_future_jours) else None


def dates(texte: str, le: date,
          marge_future_jours: int = MARGE_FUTUR_EMISSION_JOURS) -> list[tuple[date, str]]:
    """Toutes les dates plausibles, avec la forme sous laquelle elles étaient écrites."""
    trouvees: list[tuple[date, str]] = []
    for ligne in _lignes_utiles(texte):
        for annee, mois, jour in _DATE_ISO.findall(ligne):
            candidate = _jour(int(annee), int(mois), int(jour), le, marge_future_jours)
            if candidate:
                trouvees.append((candidate, "iso"))
        for jour, mois, annee in _DATE_NUMERIQUE.findall(ligne):
            # Le jour d'abord : 03/04/2026 est le 3 avril, jamais le 4 mars.
            an = int(annee) if len(annee) == 4 else 2000 + int(annee)
            candidate = _jour(an, int(mois), int(jour), le, marge_future_jours)
            if candidate:
                trouvees.append((candidate, "numerique"))
        # Les mois sont écrits sans accent dans la table : « août » ne se
        # trouve que sur la version aplatie.
        for jour, mois, annee in _DATE_LETTRES.findall(aplatir(ligne)):
            candidate = _jour(int(annee), _MOIS[mois.strip()], int(jour), le, marge_future_jours)
            if candidate:
                trouvees.append((candidate, "lettres"))
    return trouvees


def date_pres_de(texte: str, etiquettes: tuple[str, ...], le: date,
                  marge_future_jours: int = MARGE_FUTUR_EMISSION_JOURS) -> tuple[date | None, str]:
    """La première date qui suit l'une des étiquettes données."""
    aplati = aplatir(texte)
    for etiquette in etiquettes:
        for trouve in re.finditer(re.escape(etiquette), aplati):
            fenetre = texte[trouve.start(): trouve.start() + 80]
            proches = dates(fenetre, le, marge_future_jours)
            if proches:
                return proches[0][0], "etiquete"
    return None, ""


def reference(texte: str) -> tuple[str, str]:
    """La référence client, s'il y en a une — jamais devinée."""
    aplati = aplatir(texte)
    for etiquette in ETIQUETTES_REFERENCE:
        for trouve in re.finditer(re.escape(etiquette), aplati):
            fenetre = texte[trouve.start() + len(etiquette): trouve.start() + len(etiquette) + 40]
            candidat = _REFERENCE.search(fenetre.upper())
            if candidat:
                return candidat.group(0).strip(" -/"), "etiquete"
    return "", ""


# --- émetteur ------------------------------------------------------------------


def emetteur_connu(texte: str, connus: dict[str, str]) -> tuple[str, str]:
    """Reconnaît un émetteur déjà rencontré, sans rien deviner.

    `connus` associe un nom à un motif d'expression régulière qui l'identifie
    — fourni par l'appelant, par exemple `{"EDF": r"\\bEDF\\b"}`.
    """
    for nom, motif in connus.items():
        if motif and re.search(motif, texte):
            return nom, "connu"
    return "", ""


def emetteur_devine(texte: str, indices: tuple[str, ...] = ()) -> str | None:
    """L'émetteur, cherché dans l'en-tête, quand aucun émetteur connu n'a répondu.

    Les premières lignes portent presque toujours le nom, en tête de papier. On
    écarte celles qui sont manifestement autre chose — une date, un montant,
    une adresse — plutôt que d'essayer de reconnaître un nom d'entreprise, ce
    qu'aucune règle courte ne sait faire.

    **Le titre d'un document n'est pas son émetteur.** `indices` porte les
    mots-clés qui ont désigné la nature (voir `reconnaitre_nature`) ; une ligne
    qui en contient un est ce titre, pas un nom. Sans ce filtre, une quittance
    de loyer s'appelle « Quittance-de-loyer », ce qui ne distingue plus les
    douze de l'année.
    """
    interdits = tuple(aplatir(mot).strip() for mot in indices)
    for ligne in texte.splitlines()[:12]:
        candidat = ligne.strip(" \t-—:|&*=_.,;#~<>[]()")
        if not 2 < len(candidat) <= 60:
            continue
        if re.search(r"\d{2}[/.\-]\d{2}|\d+[.,]\d{2}|@|www\.|\b\d{5}\b", candidat):
            continue
        lettres = sum(c.isalpha() for c in candidat)
        if lettres < max(3, len(candidat) // 2):
            continue
        aplati_candidat = aplatir(candidat)
        if any(mot and mot in aplati_candidat for mot in interdits):
            continue
        return " ".join(candidat.split())
    return None


# --- lecture complète ------------------------------------------------------------


def lire(texte: str, types_reconnus: list[dict] | None = None,
         emetteurs_connus: dict[str, str] | None = None,
         aujourdhui: date | None = None) -> ChampsDocument:
    """Le texte devient des champs : nature, émetteur, montant, dates, référence.

    Pure — ni disque, ni réseau : tout ce dont elle dépend est passé en
    argument. `types_reconnus` et `emetteurs_connus` sont facultatifs : sans
    eux, la nature reste absente et l'émetteur se devine dans l'en-tête plutôt
    que d'être reconnu.
    """
    aujourdhui = aujourdhui or date.today()
    texte = normaliser(texte)
    resultat = ChampsDocument()

    nature, _, indices = reconnaitre_nature(texte, types_reconnus or [])
    if nature is not None:
        resultat.nature = nature
        resultat.trouvailles["nature"] = "connu"

    nom, comment = emetteur_connu(texte, emetteurs_connus or {})
    if comment:
        resultat.emetteur = nom
        resultat.trouvailles["emetteur"] = comment
    else:
        devine = emetteur_devine(texte, indices)
        if devine:
            resultat.emetteur = devine
            resultat.trouvailles["emetteur"] = "devine"

    montant, comment = montant_principal(texte)
    if comment:
        resultat.montant = montant
        resultat.trouvailles["montant"] = comment

    limite, comment = date_pres_de(texte, ETIQUETTES_ECHEANCE, aujourdhui,
                                   marge_future_jours=MARGE_FUTUR_ECHEANCE_JOURS)
    if limite:
        resultat.date_limite = limite
        resultat.trouvailles["date_limite"] = comment

    emission, comment = date_pres_de(texte, ETIQUETTES_EMISSION, aujourdhui)
    if emission is None:
        # À défaut d'étiquette, la plus ancienne date plausible : celle du
        # pied de page est presque toujours postérieure, c'est la date
        # d'impression.
        toutes = [j for j, _ in dates(texte, aujourdhui) if j != limite]
        if toutes:
            emission, comment = min(toutes), "devine"
    if emission:
        resultat.date_emission = emission
        resultat.trouvailles["date_emission"] = comment

    ref, comment = reference(texte)
    if comment:
        resultat.reference = ref
        resultat.trouvailles["reference"] = comment

    return resultat
