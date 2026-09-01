"""Module 1 — le document devient des champs.

Nature, émetteur, montant, date d'émission, date limite de paiement, référence
client. C'est le seul module qui puisse sortir sur le réseau — et il est écrit
pour n'en avoir pas besoin.

Les décisions :

1. **La lecture par motifs d'abord, le modèle de vision seulement après.**
   L'ébauche de ce module prévoyait l'inverse. Sondé avant d'écrire :
   `api.anthropic.com` répond, mais aucune clé n'est présente dans cet
   environnement — et une facture française est un document très régulier.
   « Net à payer », « Référence client », une date en JJ/MM/AAAA : ce sont des
   motifs, pas de la compréhension. Le modèle est le recours pour ce que les
   motifs ne trouvent pas — un scan, une photo — et il ne part que si une clé
   existe. **Il complète, il ne remplace jamais** : un champ lu derrière son
   étiquette est vérifiable, un champ rendu par un modèle ne l'est pas.
   `anthropic` et `pydantic` s'importent **dans la fonction** et non en tête :
   la lecture par motifs doit rester utilisable sans rien installer, et c'est
   elle qui tourne dans l'intégration continue.
2. **Rien de ce qui est trouvé n'est cru sur parole.** Un montant doit être un
   nombre plausible, une date doit tomber entre 1990 et aujourd'hui, la nature
   doit appartenir à la liste connue. Ce qui ne passe pas ne devient pas un
   champ : il devient une absence, et l'absence se voit.
3. **La confiance se calcule sur la manière dont le champ a été trouvé**, pas
   sur une impression. Un montant lu derrière « Net à payer » vaut mieux qu'un
   nombre ramassé au milieu de la page ; le score le dit, et sous
   `confiance_minimale` le document part à relire plutôt qu'au coffre. Un
   document mal classé est un document perdu : le coffre est grand et la
   mémoire courte.
4. **Les émetteurs déjà rencontrés se reconnaissent sans rien envoyer.** Une
   facture EDF ressemble à la précédente : les motifs d'`extraction.
   emetteurs_connus` la rattachent à sa catégorie hors réseau.

Quatre pièges du document administratif français, chacun payé par un essai :

- **Les milliers sont séparés par une espace insécable.** « 1 234,56 € » porte
  un U+00A0 ou un U+202F, pas une espace ordinaire : un motif naïf y lit
  « 234,56 » et se trompe d'un facteur mille. D'où la normalisation en tête.
- **Une date française commence par le jour.** 03/04/2026 est le 3 avril, et
  jamais le 4 mars. Seule la forme AAAA-MM-JJ est non ambiguë.
- **Le plus gros nombre de la page n'est pas le total.** Un numéro SIRET, un
  IBAN, un total de commande antérieur : on cherche le montant **étiqueté**, et
  on ne se rabat sur le plus grand qu'en dernier ressort, avec la confiance qui
  baisse d'autant.
- **La date du pied de page est celle de l'impression.** Prise pour la date
  d'émission, elle range la facture au mauvais mois. On préfère toujours une
  date étiquetée à une date ramassée.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field, replace
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

from core.modele import Document, Nature
from core.scan import Lecture

# NFKC ramène déjà la plupart des espaces exotiques, mais pas toutes selon les
# versions d'Unicode : la table explicite garantit le résultat plutôt que de
# faire confiance à la bibliothèque du jour.
ESPACES = {" ": " ", " ": " ", " ": " ", " ": " ", " ": "\n"}

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12,
}

# Dans l'ordre de préférence : le premier trouvé gagne. « Net à payer » est ce
# qui sera prélevé ; « total TTC » peut inclure un acompte déjà versé.
ETIQUETTES_MONTANT = (
    "net a payer", "montant a payer", "reste a payer", "total a payer",
    "montant du", "total ttc", "montant ttc", "total",
)
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

# Ces lignes portent des suites de chiffres qui ressemblent à des montants ou à
# des dates sans en être : les écarter vaut mieux que de les décoder.
LIGNES_A_IGNORER = re.compile(r"siret|siren|\btva\b|iban|bic|rcs|\bape\b|naf", re.I)

MONTANT = re.compile(r"(?<![\d,.])(\d{1,3}(?: \d{3})+|\d+)[,.](\d{2})(?![\d])")
DATE_NUMERIQUE = re.compile(r"(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?!\d)")
DATE_ISO = re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)")
DATE_LETTRES = re.compile(
    r"(?<!\d)(\d{1,2})(?:er)?\s+(" + "|".join(MOIS) + r")\s+(\d{4})", re.I)
REFERENCE = re.compile(r"[A-Z0-9][A-Z0-9\-/ ]{4,24}[A-Z0-9]")

MOTS_DE_NATURE = {
    Nature.FACTURE: ("facture", "note d honoraires"),
    Nature.AVIS: ("avis d echeance", "avis d imposition", "avis de somme a payer", "avis"),
    Nature.CONTRAT: ("contrat", "conditions particulieres", "bulletin d adhesion"),
    Nature.RELEVE: ("releve de compte", "releve"),
    Nature.ATTESTATION: ("attestation", "certificat"),
    Nature.BULLETIN: ("bulletin de paie", "bulletin de salaire", "fiche de paie"),
    Nature.COURRIER: ("courrier", "lettre"),
}

# Un montant à sept chiffres devant la virgule n'est pas une facture de
# particulier : c'est un numéro qu'on a mal découpé.
MONTANT_MAXIMUM = Decimal("999999.99")
ANNEE_MINIMALE = 1990


@dataclass
class Champs:
    """Ce qui a été trouvé, et **comment** — c'est le comment qui fait la confiance."""

    nature: Nature = Nature.INCONNUE
    emetteur: str = ""
    categorie: str = "divers"
    montant: Decimal | None = None
    date_emission: date | None = None
    date_limite: date | None = None
    reference: str = ""
    trouvailles: dict[str, str] = field(default_factory=dict)

    @property
    def confiance(self) -> float:
        """De 0 à 1, selon ce qui a été trouvé et par quel chemin.

        Un champ lu derrière son étiquette compte plus qu'un champ ramassé au
        milieu de la page : c'est exactement la différence entre « la facture
        dit 78,42 € » et « il y avait 78,42 quelque part ».
        """
        points = 0.0
        poids = {
            # Le modèle vaut mieux qu'un champ ramassé au hasard et moins qu'un
            # champ étiqueté : il lit l'image, mais rien ne confirme sa lecture.
            "emetteur": {"connu": 0.30, "modele": 0.24},
            "montant": {"etiquete": 0.25, "devine": 0.08, "modele": 0.20},
            "date_emission": {"etiquete": 0.20, "iso": 0.20, "devine": 0.07, "modele": 0.16},
            "date_limite": {"etiquete": 0.10, "modele": 0.08},
            "reference": {"etiquete": 0.10, "devine": 0.03, "modele": 0.08},
            "nature": {"connu": 0.05, "modele": 0.04},
        }
        for champ, comment in self.trouvailles.items():
            points += poids.get(champ, {}).get(comment, 0.0)
        return round(min(points, 1.0), 2)


def normaliser(texte: str) -> str:
    """Ramène le texte extrait à quelque chose que des motifs peuvent lire.

    Sans cette étape, « 1 234,56 € » séparé par une espace insécable se lit
    « 234,56 » : une erreur d'un facteur mille, silencieuse, sur le champ qui
    compte le plus.
    """
    texte = unicodedata.normalize("NFKC", texte)
    for avant, apres in ESPACES.items():
        texte = texte.replace(avant, apres)
    return re.sub(r"[ \t]+", " ", texte)


def sans_accent(texte: str) -> str:
    """Pour comparer des étiquettes sans dépendre des accents de l'imprimeur."""
    deplie = unicodedata.normalize("NFKD", texte.lower())
    propre = "".join(c for c in deplie if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", propre)


def aplatir(texte: str) -> str:
    """Comme `sans_accent`, mais **caractère pour caractère**.

    C'est ce qui rend les positions trouvées ici valables dans le texte
    d'origine. Un aplatissement qui raccourcit décale les fenêtres de recherche,
    et l'on va lire le montant de la ligne d'à côté : mesuré sur une facture
    d'essai, « Net à payer 78,42 € » rendait le total TTC de 1 234,56 €.
    """
    sortie = []
    for caractere in texte:
        base = unicodedata.normalize("NFD", caractere)[0]
        sortie.append(base.lower() if base.isalnum() else " ")
    return "".join(sortie)


def _lignes_utiles(texte: str) -> list[str]:
    return [l for l in texte.splitlines() if not LIGNES_A_IGNORER.search(l)]


def montants(texte: str) -> list[Decimal]:
    """Tous les montants plausibles du document, dans l'ordre d'apparition."""
    trouves: list[Decimal] = []
    for ligne in _lignes_utiles(texte):
        for entier, decimales in MONTANT.findall(ligne):
            try:
                valeur = Decimal(entier.replace(" ", "") + "." + decimales)
            except InvalidOperation:
                continue
            if Decimal("0") < valeur <= MONTANT_MAXIMUM:
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


def dates(texte: str, le: date) -> list[tuple[date, str]]:
    """Toutes les dates plausibles, avec la forme sous laquelle elles étaient écrites."""
    trouvees: list[tuple[date, str]] = []
    for ligne in _lignes_utiles(texte):
        for annee, mois, jour in DATE_ISO.findall(ligne):
            trouvees.append((_jour(int(annee), int(mois), int(jour), le), "iso"))
        for jour, mois, annee in DATE_NUMERIQUE.findall(ligne):
            # Le jour d'abord : 03/04/2026 est le 3 avril, jamais le 4 mars.
            an = int(annee) if len(annee) == 4 else 2000 + int(annee)
            trouvees.append((_jour(an, int(mois), int(jour), le), "numerique"))
        # Les mois sont écrits sans accent dans la table : « août » ne se
        # trouve que sur la version aplatie. Les deux formes numériques, elles,
        # y perdraient leurs séparateurs — d'où ce seul motif sur `aplatir`.
        for jour, mois, annee in DATE_LETTRES.findall(aplatir(ligne)):
            trouvees.append(
                (_jour(int(annee), MOIS[mois.strip()], int(jour), le), "lettres"))
    return [(j, forme) for j, forme in trouvees if j is not None]


def _jour(annee: int, mois: int, jour: int, le: date) -> date | None:
    """Rend la date si elle est possible **et** plausible, sinon rien.

    Une date dans le futur ou d'avant 1990 n'est pas un document : c'est une
    suite de chiffres mal découpée.
    """
    try:
        candidate = date(annee, mois, jour)
    except ValueError:
        return None
    return candidate if ANNEE_MINIMALE <= candidate.year and candidate <= le else None


def date_pres_de(texte: str, etiquettes: Iterable[str], le: date) -> tuple[date | None, str]:
    """La première date qui suit l'une des étiquettes données."""
    aplati = aplatir(texte)
    for etiquette in etiquettes:
        for trouve in re.finditer(re.escape(etiquette), aplati):
            fenetre = texte[trouve.start(): trouve.start() + 80]
            proches = dates(fenetre, le)
            if proches:
                return proches[0][0], "etiquete"
    return None, ""


def reference_client(texte: str) -> tuple[str, str]:
    """La référence client, sans laquelle aucun service ne traitera un courrier."""
    aplati = aplatir(texte)
    for etiquette in ETIQUETTES_REFERENCE:
        for trouve in re.finditer(re.escape(etiquette), aplati):
            fenetre = texte[trouve.start() + len(etiquette): trouve.start() + len(etiquette) + 40]
            candidat = REFERENCE.search(fenetre.upper())
            if candidat:
                return candidat.group(0).strip(" -/"), "etiquete"
    return "", ""


def nature_de(texte: str) -> tuple[Nature, str]:
    """La nature du document, d'après ses premiers mots.

    Les premiers mille caractères seulement : le mot « facture » apparaît dans
    les conditions générales de presque tout, y compris d'un contrat.
    """
    aplati = sans_accent(texte[:1000])
    for nature, mots in MOTS_DE_NATURE.items():
        if any(mot in aplati for mot in mots):
            return nature, "connu"
    return Nature.INCONNUE, ""


def emetteur_de(texte: str, connus: dict[str, dict[str, str]]) -> tuple[str, str, str]:
    """Reconnaît un émetteur déjà rencontré, sans rien envoyer sur le réseau."""
    for nom, reglages in connus.items():
        motif = reglages.get("motif")
        if motif and re.search(motif, texte):
            return nom, reglages.get("categorie", "divers"), "connu"
    return "", "divers", ""


def champs_de(texte: str, connus: dict[str, dict[str, str]], le: date) -> Champs:
    """Le cœur du module : un texte devient des champs, et dit comment."""
    texte = normaliser(texte)
    resultat = Champs()

    resultat.emetteur, resultat.categorie, comment = emetteur_de(texte, connus)
    if comment:
        resultat.trouvailles["emetteur"] = comment

    resultat.nature, comment = nature_de(texte)
    if comment:
        resultat.trouvailles["nature"] = comment

    resultat.montant, comment = montant_principal(texte)
    if comment:
        resultat.trouvailles["montant"] = comment

    limite, comment = date_pres_de(texte, ETIQUETTES_ECHEANCE, le)
    if limite:
        resultat.date_limite = limite
        resultat.trouvailles["date_limite"] = comment

    emission, comment = date_pres_de(texte, ETIQUETTES_EMISSION, le)
    if emission is None:
        # À défaut d'étiquette, la plus ancienne date plausible : celle du pied
        # de page est presque toujours postérieure, c'est la date d'impression.
        toutes = [j for j, _ in dates(texte, le) if j != limite]
        if toutes:
            emission, comment = min(toutes), "devine"
    if emission:
        resultat.date_emission = emission
        resultat.trouvailles["date_emission"] = comment

    resultat.reference, comment = reference_client(texte)
    if comment:
        resultat.trouvailles["reference"] = comment

    return resultat


def extraire(lecture: Lecture, connus: dict[str, dict[str, str]], le: date,
             vision: Vision | None = None, seuil: float = 0.0) -> Document:
    """Un fichier lu devient un document, avec sa confiance.

    Une panne du chemin par modèle n'est pas rattrapée ici : elle remonte. Le
    modèle n'ayant été appelé que parce que les motifs ne suffisaient pas, le
    document part de toute façon à relire, et son appelant dira pourquoi plutôt
    que de le ranger sur une lecture incomplète.

    Les motifs sont essayés sur **tout** texte présent, si court soit-il. Le seuil
    de `scan.a_du_texte` répond à « faut-il rendre la page en image ? », pas à
    « faut-il essayer de lire ? » : une facture de mobile tient en cinq lignes, et
    la lui refuser la renvoyait à relire alors que tous ses champs étaient là.
    Essayer ne coûte rien — c'est la confiance qui dit ce que ça valait.
    """
    champs = champs_de(lecture.texte, connus, le)

    # Le modèle ne part que si les motifs n'ont pas suffi, et qu'il y a une image
    # à lui montrer. Un document dont le texte a tout donné n'a rien à gagner à
    # un aller-retour payant — et `scan.py` ne rend les pages en image que
    # lorsqu'il n'y avait pas de texte utile.
    if vision is not None and lecture.images and champs.confiance < seuil:
        bruts = lire_par_modele(lecture.images, vision.modele, vision.cle, vision.client)
        champs = completer(champs, champs_de_modele(bruts, connus, le))

    return Document(
        id="",
        chemin=str(lecture.chemin),
        nature=champs.nature,
        emetteur=champs.emetteur,
        categorie=champs.categorie,
        montant=champs.montant,
        date_emission=champs.date_emission,
        date_limite=champs.date_limite,
        reference=champs.reference,
        empreinte=lecture.empreinte,
        confiance=champs.confiance,
    )


# Ce que le modèle rend passe par les mêmes contrôles que le reste : un montant
# doit être un nombre plausible, une date doit tomber dans la fenêtre permise.
# Il rend donc des chaînes, jamais des nombres — c'est notre analyseur qui
# tranche, et pas la mise en forme du modèle.
INVITE = """Tu lis un document administratif français scanné.

Rends uniquement ce que tu vois écrit, sans rien déduire ni compléter :
- emetteur : le nom de l'organisme qui a émis le document
- nature : facture, avis, contrat, courrier, releve, attestation ou bulletin
- montant : la somme à payer, telle qu'écrite (par exemple « 78,42 »)
- date_emission : la date du document, au format AAAA-MM-JJ
- date_limite : la date limite de paiement, au format AAAA-MM-JJ
- reference : la référence ou le numéro de client

Laisse un champ vide si tu ne le vois pas. Ne devine pas : un champ absent se
corrige, un champ inventé se propage."""

MODELE_DEFAUT = "claude-opus-5"
JETONS_MAX = 2000
TYPES_IMAGE = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".gif": "image/gif", ".webp": "image/webp"}


class ErreurVision(Exception):
    """Le chemin par modèle n'a pas pu être emprunté. Jamais fatal : on retombe
    sur ce que les motifs ont trouvé."""


@dataclass(frozen=True)
class Vision:
    """De quoi emprunter le chemin par modèle, ou de quoi savoir qu'on ne peut pas."""

    modele: str = MODELE_DEFAUT
    cle: str | None = None
    client: object | None = None


def _bloc_image(chemin: Path) -> dict:
    """Une page rendue devient un bloc d'image pour la requête."""
    import base64

    genre = TYPES_IMAGE.get(chemin.suffix.lower())
    if genre is None:
        raise ErreurVision(
            f"{chemin.name} : format d'image non accepté par le modèle "
            f"(acceptés : {', '.join(sorted(TYPES_IMAGE))})"
        )
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": genre,
                   "data": base64.standard_b64encode(chemin.read_bytes()).decode("ascii")},
    }


def lire_par_modele(images: list[Path], modele: str = MODELE_DEFAUT,
                    cle: str | None = None, client: object | None = None) -> dict[str, str]:
    """Demande au modèle ce qu'il voit sur les pages rendues.

    Rend un dictionnaire de chaînes brutes, que `champs_de_modele` valide
    ensuite. Ce partage est délibéré : ce qui sort d'un modèle traverse
    exactement les mêmes contrôles que ce qui sort d'un motif.
    """
    if not images:
        raise ErreurVision("aucune page rendue : rien à montrer au modèle")
    if client is None:
        try:
            import anthropic
        except ImportError:
            raise ErreurVision(
                "la bibliothèque « anthropic » n'est pas installée : "
                "pip install anthropic, ou s'en tenir à la lecture par motifs"
            ) from None
        # Une clé absente de la configuration ne veut pas dire qu'il n'y en a
        # pas : le SDK sait aussi lire ANTHROPIC_AUTH_TOKEN et un profil ouvert
        # par « ant auth login ». On le laisse chercher plutôt que de conclure.
        client = anthropic.Anthropic(api_key=cle) if cle else anthropic.Anthropic()

    from pydantic import BaseModel

    class ChampsLus(BaseModel):
        emetteur: str = ""
        nature: str = ""
        montant: str = ""
        date_emission: str = ""
        date_limite: str = ""
        reference: str = ""

    contenu = [_bloc_image(image) for image in images]
    contenu.append({"type": "text", "text": INVITE})
    try:
        reponse = client.messages.parse(
            model=modele,
            max_tokens=JETONS_MAX,
            messages=[{"role": "user", "content": contenu}],
            output_format=ChampsLus,
        )
    except Exception as erreur:
        # Volontairement large : clé absente, quota, réseau coupé, modèle retiré
        # — la cause change, la conduite non. Le message est conservé tel quel,
        # c'est lui qui dira quoi corriger.
        raise ErreurVision(f"lecture par modèle impossible : {erreur}") from None
    lus = reponse.parsed_output
    return {champ: getattr(lus, champ, "") or "" for champ in
            ("emetteur", "nature", "montant", "date_emission", "date_limite", "reference")}


def champs_de_modele(bruts: dict[str, str], connus: dict[str, dict[str, str]],
                     le: date) -> Champs:
    """Valide ce que le modèle a rendu, avec les contrôles de la lecture par motifs.

    Un modèle lit l'image directement et se trompe rarement, mais rien ne vient
    confirmer ce qu'il dit : ses champs pèsent donc moins qu'un champ lu derrière
    son étiquette. Et ce qui ne passe pas la validation devient une absence,
    exactement comme ailleurs.
    """
    resultat = Champs()

    emetteur = bruts.get("emetteur", "").strip()
    if emetteur:
        resultat.emetteur = emetteur
        nom, categorie, _ = emetteur_de(emetteur, connus)
        resultat.categorie = categorie if nom else "divers"
        resultat.trouvailles["emetteur"] = "modele"

    nature = sans_accent(bruts.get("nature", "")).strip()
    for candidate in Nature:
        if nature and nature == candidate.value:
            resultat.nature = candidate
            resultat.trouvailles["nature"] = "modele"
            break

    montants_lus = montants(normaliser(bruts.get("montant", "")))
    if montants_lus:
        resultat.montant = montants_lus[0]
        resultat.trouvailles["montant"] = "modele"

    for champ, cle_brute in (("date_emission", "date_emission"), ("date_limite", "date_limite")):
        trouvees = dates(bruts.get(cle_brute, ""), le)
        if trouvees:
            setattr(resultat, champ, trouvees[0][0])
            resultat.trouvailles[champ] = "modele"

    reference = bruts.get("reference", "").strip()
    if reference:
        resultat.reference = reference
        resultat.trouvailles["reference"] = "modele"

    return resultat


def completer(motifs: Champs, modele: Champs) -> Champs:
    """Le modèle comble les trous, il n'écrase rien.

    Un champ lu derrière son étiquette est vérifiable — on peut rouvrir le
    document et le retrouver au même endroit. Un champ rendu par un modèle ne
    l'est pas : le laisser prendre la place du premier échangerait du sûr contre
    du probable.
    """
    fondu = replace(motifs, trouvailles=dict(motifs.trouvailles))
    for champ in ("emetteur", "nature", "montant", "date_emission", "date_limite", "reference"):
        if champ in fondu.trouvailles:
            continue
        valeur = getattr(modele, champ)
        if valeur in (None, "", Nature.INCONNUE):
            continue
        setattr(fondu, champ, valeur)
        fondu.trouvailles[champ] = modele.trouvailles.get(champ, "modele")
        if champ == "emetteur":
            fondu.categorie = modele.categorie
    return fondu


def a_relire(document: Document, seuil: float) -> list[str]:
    """Ce qui manque au document pour être rangé les yeux fermés.

    Rend la liste des raisons, vide si tout va bien. Une liste plutôt qu'un
    booléen : « il manque la date d'émission » se corrige, « à relire » non.
    """
    manques: list[str] = []
    if document.confiance < seuil:
        manques.append(f"confiance {document.confiance:.2f} sous le seuil de {seuil:.2f}")
    if document.date_emission is None:
        manques.append("aucune date d'émission trouvée")
    if not document.emetteur:
        manques.append("émetteur non reconnu")
    return manques
