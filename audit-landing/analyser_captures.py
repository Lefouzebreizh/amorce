"""Analyse les captures d'une page de vente avec un modèle de vision.

Deuxième étage du produit « Audit de page de vente en 24h » : `capturer_page.py`
transforme une URL en segments nets ; celui-ci les montre à Claude et rend un
rapport structuré — six catégories fixes, une note et des constats sur
chaque, triés par sévérité, plus les trois priorités à corriger en premier.

Le modèle voit les images, jamais du texte extrait : juger la clarté d'un
titre ou la crédibilité d'un témoignage demande de voir la mise en page, la
taille, le contraste — pas une chaîne de caractères hors contexte.

## Ce qui n'est PAS vérifié depuis cette session

`api.anthropic.com` n'a jamais été sondé ni appelé d'ici : ce module est écrit
contre la surface réelle du SDK (lue directement dans le paquet téléchargé
sans l'installer, jamais de mémoire — voir `/api-tierce-verifiee`), et sa
partie qui ne dépend ni du réseau ni d'une clé (analyse et mise en forme de la
réponse) est couverte par `tests/test_analyser_captures.py`. L'appel réel au
modèle de vision n'a été exercé nulle part : à faire tourner sur la machine du
propriétaire, ou sur un environnement dont la politique réseau laisse joindre
`api.anthropic.com` — voir CLAUDE.md §7 sur ce mur, déjà mesuré pour la
capture elle-même.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Claude 5 (voir CLAUDE.md, section modèles) : le plus récent qui gère la
# vision au moment où ce module est écrit. Configurable via --modele au cas
# où un compte n'y aurait pas encore accès (voir /api-tierce-verifiee : « le
# plus récent n'est pas le plus disponible »).
MODELE_PAR_DEFAUT = "claude-sonnet-5"

# Le rapport tient en JSON structuré (moins de 4000 jetons mesurés sur un
# brouillon de six catégories avec trois constats chacune) ; une marge large
# évite une troncature silencieuse plutôt que d'optimiser le coût ici.
TOKENS_MAX_REPONSE = 4096

# Six catégories fixes, dans cet ordre. Fixées plutôt que laissées au libre
# choix du modèle : un rapport dont les catégories changent d'un audit à
# l'autre ne se compare pas d'un site à l'autre, et c'est précisément ce
# qu'un produit d'audit doit pouvoir faire.
CATEGORIES = (
    "Message et promesse",
    "Preuve sociale",
    "Appel à l'action",
    "Objections et confiance",
    "Lisibilité et hiérarchie visuelle",
    "Cohérence de marque",
)

SEVERITES = ("bloquant", "important", "mineur")
VERDICTS = ("excellent", "solide", "a_ameliorer", "problematique")

# Schéma JSON passé à output_config pour forcer une réponse exploitable sans
# analyse de texte libre — voir /api-tierce-verifiee : signature relevée dans
# le paquet `anthropic` réel (types/output_config_param.py,
# types/json_output_format_param.py), pas de mémoire.
SCHEMA_RAPPORT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["verdict_global", "resume", "categories", "priorites"],
    "properties": {
        "verdict_global": {"type": "string", "enum": list(VERDICTS)},
        "resume": {"type": "string"},
        "categories": {
            "type": "array",
            "minItems": len(CATEGORIES),
            "maxItems": len(CATEGORIES),
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["nom", "note", "constats"],
                "properties": {
                    "nom": {"type": "string", "enum": list(CATEGORIES)},
                    "note": {"type": "integer", "minimum": 0, "maximum": 10},
                    "constats": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "segment",
                                "severite",
                                "observation",
                                "recommandation",
                            ],
                            "properties": {
                                "segment": {"type": "string"},
                                "severite": {"type": "string", "enum": list(SEVERITES)},
                                "observation": {"type": "string"},
                                "recommandation": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
        "priorites": {
            "type": "array",
            "maxItems": 3,
            "items": {"type": "string"},
        },
    },
}


def construire_prompt_systeme() -> str:
    """Rend le prompt système : la charte de jugement du modèle.

    Fixe, versionné dans ce fichier plutôt que lu depuis un document à part —
    un prompt qui décide d'un rapport payant est du code, pas de la
    documentation, et se relit comme tel (§10 du dépôt : chirurgical, pas
    d'écrasement).
    """
    categories_listees = "\n".join(f"- {nom}" for nom in CATEGORIES)
    return f"""Tu es un expert en optimisation de taux de conversion (CRO) qui \
audite des pages de vente B2B et B2C. On te montre les segments d'une page, \
capturés dans l'ordre de lecture (haut vers bas), chacun à la hauteur d'un \
écran — jamais la page entière écrasée en une seule image.

Juge exactement ce que voit un visiteur, pas ce que la page prétend faire. \
Un bouton d'appel à l'action existant mais peu contrasté est un défaut, même \
si le texte du bouton est parfait.

Rends ton jugement sur ces six catégories, toujours dans cet ordre :
{categories_listees}

Pour chaque catégorie : une note sur 10, et une liste de constats. Chaque \
constat cite le nom du fichier segment où il se voit, une sévérité \
(bloquant / important / mineur), ce qui est observé, et une recommandation \
concrète et actionnable — jamais un conseil générique du type « améliorer \
la clarté ».

Termine par un verdict global (excellent / solide / a_ameliorer / \
problematique), un résumé de deux à trois phrases, et les trois priorités \
absolues à corriger en premier, classées par impact décroissant.

Sois direct et concret, jamais complaisant : ce rapport sert à quelqu'un qui \
va agir dessus, pas à le rassurer."""


# Exclu explicitement : `00-pleine-page.png` est une capture de référence
# (voir capturer_page.py), pas un segment de lecture. Elle reste en
# `full_page=True` et peut donc être tronquée sur une page très haute même
# après son propre correctif d'échelle — l'envoyer au modèle de vision
# ferait analyser un aplat blanc plutôt que le pied de page réel, déjà
# couvert par le dernier segment numéroté.
NOM_CAPTURE_REFERENCE = "00-pleine-page.png"


def lister_segments(dossier_page: Path) -> list[Path]:
    """Rend les fichiers PNG d'un dossier de capture, dans l'ordre de lecture.

    Les noms (`01-hero.png`, `02-milieu.png`…) sont préfixés par un numéro à
    deux chiffres par `capturer_page.py` précisément pour que le tri
    alphabétique soit aussi l'ordre de lecture — voir `calculer_segments`.
    """
    if not dossier_page.is_dir():
        raise ValueError(f"Dossier de capture introuvable : {dossier_page}")
    segments = sorted(
        p for p in dossier_page.glob("*.png") if p.name != NOM_CAPTURE_REFERENCE
    )
    if not segments:
        raise ValueError(f"Aucun segment PNG dans {dossier_page}")
    return segments


def encoder_image_base64(chemin: Path) -> dict:
    """Rend un bloc de contenu image conforme à `ImageBlockParam` du SDK."""
    donnees = chemin.read_bytes()
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/png",
            "data": base64.standard_b64encode(donnees).decode("ascii"),
        },
    }


def construire_messages(segments: list[Path]) -> list[dict]:
    """Alterne une légende texte et l'image pour chaque segment.

    La légende (nom du fichier) est ce qui permet au modèle de citer le bon
    segment dans un constat — sans elle, il ne peut que décrire une position
    approximative (« vers le milieu »), inexploitable pour retrouver l'image.
    """
    contenu: list[dict] = []
    for segment in segments:
        contenu.append({"type": "text", "text": f"Segment : {segment.name}"})
        contenu.append(encoder_image_base64(segment))
    contenu.append(
        {
            "type": "text",
            "text": "Analyse cette page de vente et rends le rapport demandé.",
        }
    )
    return [{"role": "user", "content": contenu}]


@dataclass
class Constat:
    segment: str
    severite: str
    observation: str
    recommandation: str


@dataclass
class Categorie:
    nom: str
    note: int
    constats: list[Constat] = field(default_factory=list)


@dataclass
class Rapport:
    verdict_global: str
    resume: str
    categories: list[Categorie]
    priorites: list[str]


def analyser_reponse_json(texte: str) -> Rapport:
    """Parse et valide la réponse du modèle en un `Rapport` structuré.

    Lève `ValueError` sur tout JSON absent, malformé ou incomplet — jamais un
    rapport à moitié rempli rendu comme s'il était complet. C'est la même
    règle que le §8 du dépôt sur les contrôles qui ne tournent pas : un échec
    de lecture doit se voir, pas disparaître dans un champ vide.
    """
    try:
        donnees = json.loads(texte)
    except json.JSONDecodeError as erreur:
        raise ValueError(f"Réponse du modèle non JSON : {erreur}") from erreur

    for champ in ("verdict_global", "resume", "categories", "priorites"):
        if champ not in donnees:
            raise ValueError(f"Champ manquant dans la réponse du modèle : {champ}")

    if donnees["verdict_global"] not in VERDICTS:
        raise ValueError(f"Verdict global inattendu : {donnees['verdict_global']!r}")

    categories: list[Categorie] = []
    for brute in donnees["categories"]:
        for champ in ("nom", "note", "constats"):
            if champ not in brute:
                raise ValueError(f"Catégorie incomplète, champ manquant : {champ}")
        constats = []
        for constat_brut in brute["constats"]:
            for champ in ("segment", "severite", "observation", "recommandation"):
                if champ not in constat_brut:
                    raise ValueError(f"Constat incomplet, champ manquant : {champ}")
            if constat_brut["severite"] not in SEVERITES:
                raise ValueError(f"Sévérité inattendue : {constat_brut['severite']!r}")
            constats.append(
                Constat(
                    segment=constat_brut["segment"],
                    severite=constat_brut["severite"],
                    observation=constat_brut["observation"],
                    recommandation=constat_brut["recommandation"],
                )
            )
        categories.append(
            Categorie(nom=brute["nom"], note=int(brute["note"]), constats=constats)
        )

    return Rapport(
        verdict_global=donnees["verdict_global"],
        resume=donnees["resume"],
        categories=categories,
        priorites=list(donnees["priorites"]),
    )


ORDRE_SEVERITE = {"bloquant": 0, "important": 1, "mineur": 2}


def rendre_markdown(rapport: Rapport, nom_page: str) -> str:
    """Rend le rapport en Markdown lisible, constats triés par sévérité."""
    lignes = [
        f"# Audit de page de vente — {nom_page}",
        "",
        f"**Verdict global : {rapport.verdict_global}**",
        "",
        rapport.resume,
        "",
        "## Priorités",
        "",
    ]
    for i, priorite in enumerate(rapport.priorites, start=1):
        lignes.append(f"{i}. {priorite}")
    lignes.append("")

    for categorie in rapport.categories:
        lignes.append(f"## {categorie.nom} — {categorie.note}/10")
        lignes.append("")
        constats_tries = sorted(
            categorie.constats, key=lambda c: ORDRE_SEVERITE[c.severite]
        )
        if not constats_tries:
            lignes.append("_Aucun constat particulier._")
        for constat in constats_tries:
            lignes.append(
                f"- **[{constat.severite}]** ({constat.segment}) "
                f"{constat.observation} → {constat.recommandation}"
            )
        lignes.append("")

    return "\n".join(lignes)


def analyser_page(dossier_page: Path, modele: str = MODELE_PAR_DEFAUT) -> Rapport:
    """Appelle Claude avec les segments capturés et rend un `Rapport`.

    Nécessite `ANTHROPIC_API_KEY` dans l'environnement — lu automatiquement
    par le SDK, jamais recopié à la main (voir la vérification de signature
    en tête de fichier). Non exercé depuis cette session : voir le README de
    ce dossier.
    """
    segments = lister_segments(dossier_page)

    import anthropic  # import différé : la dépendance ne coûte qu'à cette étape

    client = anthropic.Anthropic()

    try:
        reponse = client.messages.create(
            model=modele,
            max_tokens=TOKENS_MAX_REPONSE,
            system=construire_prompt_systeme(),
            messages=construire_messages(segments),
            output_config={"format": {"type": "json_schema", "schema": SCHEMA_RAPPORT}},
        )
    except anthropic.AuthenticationError as erreur:
        raise RuntimeError(
            "Clé API refusée — vérifier ANTHROPIC_API_KEY dans l'environnement."
        ) from erreur
    except anthropic.APIConnectionError as erreur:
        raise RuntimeError(
            "api.anthropic.com injoignable — mur réseau connu depuis une "
            "session distante de ce dépôt, voir CLAUDE.md §7."
        ) from erreur

    return analyser_reponse_json(reponse.content[0].text)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyse les segments capturés par capturer_page.py et écrit un rapport."
    )
    parser.add_argument(
        "dossier_page",
        type=Path,
        help="Dossier produit par capturer_page.py (ex : captures/qonto-com-fr/)",
    )
    parser.add_argument("--modele", default=MODELE_PAR_DEFAUT)
    parser.add_argument(
        "--sortie",
        type=Path,
        default=None,
        help="Fichier Markdown de sortie (défaut : rapport.md dans le dossier)",
    )
    args = parser.parse_args()

    try:
        rapport = analyser_page(args.dossier_page, modele=args.modele)
    except (ValueError, RuntimeError) as erreur:
        print(f"Échec de l'analyse : {erreur}", file=sys.stderr)
        raise SystemExit(1)

    markdown = rendre_markdown(rapport, nom_page=args.dossier_page.name)
    sortie = args.sortie or (args.dossier_page / "rapport.md")
    sortie.write_text(markdown, encoding="utf-8")
    print(f"Rapport écrit : {sortie}")


if __name__ == "__main__":
    main()
