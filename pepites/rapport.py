#!/usr/bin/env python3
"""Écriture de `pepites_radar.md`.

Le rapport montre **trois** listes et pas une : ce qui est confirmé, ce qui a
bien noté sans être confirmé, et ce qui a été écarté avec le compte des motifs.
La troisième est la plus utile au quotidien : un radar qui rend zéro candidat
sans dire pourquoi est indébogable — on ne sait pas si le marché est calme ou si
un seuil est de travers. Un soir où « capitalisation trop élevée » compte huit
cents rejets, c'est la découverte qui remonte de trop grosses paires, pas le
marché qui manque de pépites.

Le détail de la note s'affiche toujours. « 74/100 » ne dit rien ; « 74, dont 22
d'accélération et 0 de profondeur » dit qu'il faut regarder le pool avant
d'acheter.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from core.modeles import Observation
from core.reglages import Reglages
from skills.radar import Bilan

RACINE = Path(__file__).resolve().parent
RAPPORT_PAR_DEFAUT = RACINE / "pepites_radar.md"

# Au-delà, le rapport devient une liste qu'on ne lit plus.
DETAILS_MAX = 8


def _fr(texte: str) -> str:
    """Virgule décimale et espace avant le signe pourcent. Un rapport en
    français qui affiche « 8.0% » se lit comme une sortie de débogage."""
    return texte.replace(".", ",").replace("%", " %")


def nombre(valeur: float, decimales: int = 1) -> str:
    return _fr(f"{valeur:.{decimales}f}")


def pourcent(fraction: float, decimales: int = 0) -> str:
    return _fr(f"{fraction:.{decimales}%}")


def signe(pourcentage: float) -> str:
    return _fr(f"{pourcentage:+.1f}") + " %"


def pluriel(nombre_de: int, mot: str) -> str:
    return f"{nombre_de} {mot}" + ("s" if nombre_de > 1 else "")


def dollars(valeur: float) -> str:
    if valeur >= 1_000_000:
        return _fr(f"{valeur / 1_000_000:.2f}") + " M$"
    if valeur >= 1_000:
        return f"{valeur / 1_000:.0f} k$"
    return f"{valeur:.0f} $"


def duree(heures: float) -> str:
    if heures < 48:
        return f"{heures:.0f} h"
    return f"{heures / 24:.0f} j"


def _ligne_tableau(observation: Observation) -> str:
    candidat = observation.candidat
    metriques = observation.metriques
    return (
        f"| **{candidat.jeton.symbole}** | {candidat.jeton.chaine.nom} | "
        f"{observation.note.total:.0f} | {dollars(candidat.market_cap)} | "
        f"{dollars(candidat.liquidite_usd)} | ×{nombre(metriques.acceleration)} | "
        f"{pourcent(metriques.pression)} | {signe(candidat.variation_h1)} | "
        f"{duree(metriques.age_heures)} | [voir]({observation.lien_dexscreener}) |"
    )


ENTETE_TABLEAU = (
    "| Jeton | Chaîne | Note | Cap. | Liquidité | Accél. | V1/Cap | 1 h | Âge | Lien |\n"
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
)


def _detail(observation: Observation) -> list[str]:
    candidat = observation.candidat
    metriques = observation.metriques
    note = observation.note
    points = sorted(note.detail.items(), key=lambda couple: -couple[1])
    # Beaucoup de jetons ont un nom identique à leur symbole : le répéter
    # allonge le titre sans rien apprendre.
    nom = "" if candidat.jeton.nom.upper() == candidat.jeton.symbole.upper() else f" — {candidat.jeton.nom}"
    lignes = [
        f"### {candidat.jeton.symbole}{nom} · {candidat.jeton.chaine.nom}",
        "",
        f"**{note.total:.0f}/100** — {observation.raison_confirmation}",
        "",
        f"- Capitalisation {dollars(candidat.market_cap)}, liquidité "
        f"{dollars(candidat.liquidite_usd)} sur {pluriel(candidat.nombre_de_pools, 'pool')} "
        f"({pourcent(metriques.profondeur, 1)} de la capitalisation)",
        f"- Volume 1 h {dollars(candidat.volume_h1)} contre {dollars(candidat.volume_h24)} "
        f"sur 24 h — soit **×{nombre(metriques.acceleration)}** le rythme moyen",
        f"- {pluriel(candidat.achats_h1, 'achat')} / {pluriel(candidat.ventes_h1, 'vente')} "
        f"en 1 h ({pourcent(metriques.desequilibre)} d'achats), ticket moyen "
        f"{dollars(metriques.taille_moyenne)}",
        f"- Cours {signe(candidat.variation_h1)} sur 1 h, {signe(candidat.variation_h24)} sur 24 h",
        f"- Pool le plus profond : {candidat.paire_principale.dex}, "
        f"paire {candidat.jeton.symbole}/{candidat.paire_principale.quote_symbole}",
        "",
        "Répartition de la note : "
        + " · ".join(f"{nom} {valeur:.0f}" for nom, valeur in points if valeur > 0.5),
        "",
        f"[DexScreener]({observation.lien_dexscreener}) · "
        f"[Explorateur]({observation.lien_explorateur}) · `{candidat.jeton.adresse}`",
        "",
    ]
    if note.drapeaux:
        lignes.insert(3, "> ⚠️ " + " ; ".join(note.drapeaux) + "\n")
    return lignes


def composer(observations: list[Observation], bilan: Bilan, reglages: Reglages,
             debut: datetime, secondes: float, appels: int) -> str:
    notables = [o for o in observations
                if o.note.total >= reglages.bouclier.note_minimale_pour_analyser]
    confirmes = [o for o in notables if o.confirme and not o.note.drapeaux]
    en_attente = [o for o in notables if o not in confirmes]

    lignes = [
        "# Radar pépites",
        "",
        f"*Scan du {debut.astimezone().strftime('%d/%m/%Y à %H:%M')} — "
        f"{secondes:.0f} s, {appels} appels HTTP sur {len(reglages.chaines)} chaînes.*",
        "",
        "> **Le bouclier anti-rugpull n'est pas encore branché.** Les jetons "
        "ci-dessous ont passé les filtres de liquidité et l'analyse de momentum, "
        "**pas** l'analyse de contrat. Aucun n'est vérifié.",
        "",
        f"**Entonnoir** — {bilan.resume()}, dont {len(notables)} au-dessus de "
        f"{reglages.bouclier.note_minimale_pour_analyser:.0f}/100.",
        "",
    ]

    if confirmes:
        lignes += [
            f"## Confirmés sur deux relevés ({len(confirmes)})",
            "",
            ENTETE_TABLEAU,
            *[_ligne_tableau(o) for o in confirmes],
            "",
        ]
        for observation in confirmes[:DETAILS_MAX]:
            lignes += _detail(observation)
    else:
        lignes += [
            "## Confirmés sur deux relevés",
            "",
            "Aucun. Un signal n'est confirmé qu'en tenant sur deux relevés espacés "
            f"d'au moins {reglages.convergence.persistance.ecart_min_minutes} minutes — "
            "au premier scan, c'est donc normal.",
            "",
        ]

    if en_attente:
        lignes += [
            f"## Notés mais non confirmés ({len(en_attente)})",
            "",
            "| Jeton | Chaîne | Note | Pourquoi pas encore |",
            "| --- | --- | ---: | --- |",
            *[
                f"| **{o.candidat.jeton.symbole}** | {o.candidat.jeton.chaine.nom} | "
                f"{o.note.total:.0f} | {o.raison_confirmation} |"
                for o in en_attente
            ],
            "",
        ]

    if bilan.rejets:
        lignes += [
            "## Écartés avant notation",
            "",
            "| Motif | Jetons |",
            "| --- | ---: |",
            *[f"| {motif} | {nombre} |"
              for motif, nombre in bilan.rejets.most_common()],
            "",
        ]

    lignes += [
        "---",
        "",
        "*Cet outil repère une anomalie statistique de volume. Il ne prédit rien, "
        "et un jeton peut passer tous les filtres puis perdre 90 % le lendemain.*",
    ]
    return "\n".join(lignes) + "\n"


def ecrire(texte: str, chemin: Path | str = RAPPORT_PAR_DEFAUT) -> Path:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, "utf-8")
    return chemin
