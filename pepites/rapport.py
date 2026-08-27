#!/usr/bin/env python3
"""Écriture de `pepites_radar.md`.

Le rapport montre **quatre** listes et pas une : ce qui a passé le bouclier, ce
que le bouclier a arrêté et pour quel motif, ce qui a bien noté sans être
confirmé, et ce qui a été écarté avant notation. Les deux dernières sont les
plus utiles au quotidien : un radar qui rend zéro candidat
sans dire pourquoi est indébogable — on ne sait pas si le marché est calme ou si
un seuil est de travers. Un soir où « capitalisation trop élevée » compte huit
cents rejets, c'est la découverte qui remonte de trop grosses paires, pas le
marché qui manque de pépites.

Le détail de la note s'affiche toujours. « 74/100 » ne dit rien ; « 74, dont 22
d'accélération et 0 de profondeur » dit qu'il faut regarder le pool avant
d'acheter.
"""

from __future__ import annotations

from pathlib import Path

from core.modeles import Pepite, Verdict
from core.reglages import Reglages

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


def _ligne_tableau(pepite: Pepite) -> str:
    candidat = pepite.candidat
    metriques = pepite.metriques
    return (
        f"| **{candidat.jeton.symbole}** | {candidat.jeton.chaine.nom} | "
        f"{pepite.note_finale:.0f} | {pepite.securite.verdict.value} | "
        f"{dollars(candidat.market_cap)} | {dollars(candidat.liquidite_usd)} | "
        f"×{nombre(metriques.acceleration)} | {signe(candidat.variation_h1)} | "
        f"{duree(metriques.age_heures)} | [voir]({pepite.lien_dexscreener}) |"
    )


ENTETE_TABLEAU = (
    "| Jeton | Chaîne | Note | Sécurité | Cap. | Liquidité | Accél. | 1 h | Âge | Lien |\n"
    "| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |"
)


def _detail(pepite: Pepite) -> list[str]:
    candidat = pepite.candidat
    metriques = pepite.metriques
    note = pepite.note
    securite = pepite.securite
    points = sorted(note.detail.items(), key=lambda couple: -couple[1])

    # Beaucoup de jetons ont un nom identique à leur symbole : le répéter
    # allonge le titre sans rien apprendre.
    nom = ("" if candidat.jeton.nom.upper() == candidat.jeton.symbole.upper()
           else f" — {candidat.jeton.nom}")
    lignes = [
        f"### {candidat.jeton.symbole}{nom} · {candidat.jeton.chaine.nom}",
        "",
        f"**{pepite.note_finale:.0f}/100** — {note.total:.0f} de convergence "
        f"× {nombre(securite.facteur, 2)} de sécurité"
        + (f" + {nombre(pepite.smart_money.bonus, 0)} de portefeuilles"
           if pepite.smart_money.bonus else ""),
        "",
        f"- {pepite.observation.raison_confirmation}",
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
        + " · ".join(f"{nom_critere} {valeur:.0f}" for nom_critere, valeur in points if valeur > 0.5),
        "",
        _bloc_securite(securite),
        "",
        f"[DexScreener]({pepite.lien_dexscreener}) · "
        f"[Explorateur]({pepite.lien_explorateur}) · `{candidat.jeton.adresse}`",
        "",
    ]
    return lignes


def _bloc_securite(securite) -> str:
    """Ce que le bouclier a vu — et par qui. Une ligne « sûr » sans nom de
    source laisserait croire à une vérification qui n'a peut-être pas eu lieu."""
    sources = ", ".join(securite.sources) or "aucune source n'a répondu"
    morceaux = [f"**Sécurité : {securite.verdict.value}** ({sources})"]
    if securite.taxe_achat_pct is not None or securite.taxe_vente_pct is not None:
        morceaux.append(
            f"taxes {nombre(securite.taxe_achat_pct or 0)} % / "
            f"{nombre(securite.taxe_vente_pct or 0)} %"
        )
    if securite.lp_verrouillee_pct is not None:
        morceaux.append(f"liquidité verrouillée {nombre(securite.lp_verrouillee_pct, 0)} %")
    if securite.top10_detenteurs_pct is not None:
        morceaux.append(f"dix premiers porteurs {nombre(securite.top10_detenteurs_pct, 0)} %")
    ligne = " · ".join(morceaux)
    if securite.avertissements:
        ligne += "\n> ⚠️ " + " ; ".join(securite.avertissements)
    return "> " + ligne


def composer(resultat, reglages: Reglages) -> str:
    """Assemble le rapport à partir du résultat complet d'un scan."""
    retenues = resultat.retenues
    rejetees = [p for p in resultat.pepites if p.securite.verdict is Verdict.REJETE]
    notables = [o for o in resultat.observations
                if o.note.total >= reglages.bouclier.note_minimale_pour_analyser]
    verifiees = {p.candidat.jeton.identite for p in resultat.pepites}
    en_attente = [o for o in notables if o.candidat.jeton.identite not in verifiees]

    lignes = [
        "# Radar pépites",
        "",
        f"*Scan du {resultat.debut.astimezone().strftime('%d/%m/%Y à %H:%M')} — "
        f"{resultat.secondes:.0f} s, {resultat.appels} appels HTTP sur "
        f"{len(reglages.chaines)} chaînes.*",
        "",
        f"**Entonnoir** — {resultat.bilan.resume()}, dont {len(notables)} au-dessus de "
        f"{reglages.bouclier.note_minimale_pour_analyser:.0f}/100, "
        f"{len(resultat.pepites)} passés au bouclier, {len(retenues)} retenus, "
        f"{len(resultat.alertes)} alertés.",
        "",
    ]

    if retenues:
        lignes += [
            f"## Retenues ({len(retenues)})",
            "",
            ENTETE_TABLEAU,
            *[_ligne_tableau(p) for p in retenues],
            "",
        ]
        for pepite in retenues[:DETAILS_MAX]:
            lignes += _detail(pepite)
    else:
        lignes += [
            "## Retenues",
            "",
            "Aucune. Un signal n'est examiné par le bouclier qu'après avoir tenu sur "
            f"deux relevés espacés d'au moins "
            f"{reglages.convergence.persistance.ecart_min_minutes} minutes — "
            "au premier scan, c'est donc attendu.",
            "",
        ]

    if rejetees:
        lignes += [
            f"## Arrêtées par le bouclier ({len(rejetees)})",
            "",
            "Bien notées sur le momentum, écartées sur le contrat.",
            "",
            "| Jeton | Chaîne | Note brute | Motif |",
            "| --- | --- | ---: | --- |",
            *[
                f"| **{p.candidat.jeton.symbole}** | {p.candidat.jeton.chaine.nom} | "
                f"{p.note.total:.0f} | {' ; '.join(p.securite.rejets)} |"
                for p in rejetees
            ],
            "",
        ]

    if en_attente:
        lignes += [
            f"## Notés mais non retenus ({len(en_attente)})",
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

    if resultat.bilan.rejets:
        lignes += [
            "## Écartés avant notation",
            "",
            "| Motif | Jetons |",
            "| --- | ---: |",
            *[f"| {motif} | {nombre_de} |"
              for motif, nombre_de in resultat.bilan.rejets.most_common()],
            "",
        ]

    lignes += [
        "---",
        "",
        "*Cet outil repère une anomalie statistique de volume et écarte les pièges "
        "mécaniques — revente bloquée, émission ouverte, liquidité retirable. Il ne "
        "prédit rien, et n'écarte pas la décision d'une équipe de vendre : un jeton "
        "peut passer tous les filtres puis perdre 90 % le lendemain.*",
    ]
    return "\n".join(lignes) + "\n"


def ecrire(texte: str, chemin: Path | str = RAPPORT_PAR_DEFAUT) -> Path:
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(texte, "utf-8")
    return chemin
