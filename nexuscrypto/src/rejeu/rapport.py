#!/usr/bin/env python3
"""Mise en forme d'un rejeu.

**La comparaison au témoin passe avant le résultat absolu.** Un rejeu qui
annonce « +28 % » ne dit rien : le marché montait peut-être de 40 %. Ce qui se
lit ici est toujours un écart — contre le DCA plat, et contre le prix moyen de
la période.

Trois nombres suffisent à juger un DCA, et ils sont en tête du tableau :

- **le prix moyen d'achat**, comparé à celui du marché. C'est la seule mesure
  qui isole la qualité du *choix des montants*, indépendamment de savoir si le
  marché a monté ;
- **le capital engagé**, parce qu'un prix moyen flatteur obtenu en n'achetant
  presque rien n'est pas une performance, c'est une abstention ;
- **le pire recul**, parce qu'une stratégie qu'on ne tient pas est une
  stratégie qu'on abandonne au mauvais moment.
"""

from __future__ import annotations

from .donnees import Scenario
from .rejeu import Resultat


def _pourcent(valeur: float | None) -> str:
    return "—" if valeur is None else f"{valeur:+.1%}"


def ligne_comparaison(
    dynamique: Resultat, temoin: Resultat, prix_moyen_marche: float
) -> dict[str, str]:
    """Les nombres d'un scénario, prêts à être mis en colonnes."""

    def ecart_au_marche(resultat: Resultat) -> float | None:
        moyen = resultat.prix_moyen_achat
        if moyen is None or prix_moyen_marche <= 0:
            return None
        return moyen / prix_moyen_marche - 1.0

    ecart_dyn = ecart_au_marche(dynamique)
    ecart_tem = ecart_au_marche(temoin)
    gain = None
    if ecart_dyn is not None and ecart_tem is not None:
        gain = ecart_tem - ecart_dyn

    return {
        "prix moyen dyn.": "—" if dynamique.prix_moyen_achat is None
                            else f"{dynamique.prix_moyen_achat:.2f}",
        "vs marché": _pourcent(ecart_dyn),
        "vs témoin": _pourcent(gain),
        "engagé dyn.": f"{dynamique.capital_engage:,.0f} $",
        "engagé tém.": f"{temoin.capital_engage:,.0f} $",
        "PnL dyn.": _pourcent(dynamique.pnl_relatif),
        "PnL tém.": _pourcent(temoin.pnl_relatif),
        "recul max": f"{dynamique.drawdown_max:.1%}",
        "ordres": str(len(dynamique.executions)),
        "frais": f"{dynamique.frais:.0f} $",
        "coupures": str(len(dynamique.declenchements)),
        "reports": str(dynamique.temporisations),
    }


def tableau(lignes: list[tuple[str, dict[str, str]]]) -> str:
    """Un tableau Markdown, colonnes alignées sur le contenu."""

    if not lignes:
        return "(aucun scénario)"
    colonnes = list(lignes[0][1])
    largeurs = {c: max(len(c), *(len(v[c]) for _, v in lignes)) for c in colonnes}
    largeur_nom = max(len("scénario"), *(len(n) for n, _ in lignes))

    entete = "| " + "scénario".ljust(largeur_nom) + " | "
    entete += " | ".join(c.ljust(largeurs[c]) for c in colonnes) + " |"
    separateur = "| " + "-" * largeur_nom + " | "
    separateur += " | ".join("-" * largeurs[c] for c in colonnes) + " |"

    corps = []
    for nom, valeurs in lignes:
        corps.append(
            "| " + nom.ljust(largeur_nom) + " | "
            + " | ".join(valeurs[c].ljust(largeurs[c]) for c in colonnes) + " |"
        )
    return "\n".join([entete, separateur, *corps])


def rapport_scenario(scenario: Scenario, dynamique: Resultat, temoin: Resultat) -> str:
    """Le détail d'un scénario, pour quand le tableau surprend."""

    lignes = [
        f"### {scenario.nom}",
        "",
        scenario.description,
        "",
        f"- marché : {scenario.rendement_marche:+.1%} sur la période, "
        f"prix moyen {scenario.prix_moyen_marche:.2f}",
    ]
    for resultat in (dynamique, temoin):
        moyen = resultat.prix_moyen_achat
        lignes.append(
            f"- **{resultat.nom}** : {len(resultat.executions)} ordre(s), "
            f"{resultat.capital_engage:,.0f} $ engagés, "
            f"prix moyen {'—' if moyen is None else f'{moyen:.2f}'}, "
            f"valeur finale {resultat.valeur_finale:,.0f} $ "
            f"({resultat.pnl_relatif:+.1%}), recul max {resultat.drawdown_max:.1%}"
        )
    if dynamique.declenchements:
        motifs = ", ".join(
            sorted({d.motif.value.replace("_", " ") for d in dynamique.declenchements})
        )
        lignes.append(f"- coupe-circuit déclenché {len(dynamique.declenchements)}× : {motifs}")
    if dynamique.temporisations:
        lignes.append(f"- {dynamique.temporisations} passage(s) reportés par temporisation")
    return "\n".join(lignes)


def ligne_protection(resultat: Resultat) -> dict[str, str]:
    """Ce que la stratégie fait subir, pas ce qu'elle rapporte."""

    ratio = resultat.rendement_par_douleur
    return {
        "PnL": _pourcent(resultat.pnl_relatif),
        "recul max": f"{resultat.drawdown_max:.1%}",
        "temps sous l'eau": f"{resultat.temps_sous_eau:.0%}",
        "pire mois": _pourcent(resultat.pire_mois),
        "gain/douleur": "—" if ratio is None else f"{ratio:.2f}",
        "engagé": f"{resultat.capital_engage:,.0f} $",
    }


def tableau_protection(comparaisons: list[tuple[str, Resultat, Resultat]]) -> str:
    """La protection, mise face au témoin.

    **Un recul brut ne se compare pas entre deux stratégies qui n'engagent pas
    le même capital** : celle qui investit moins a mécaniquement moins mal. La
    colonne qui tranche est donc `gain/douleur`, et elle seule.
    """

    lignes: list[tuple[str, dict[str, str]]] = []
    for nom, dynamique, temoin in comparaisons:
        lignes.append((f"{nom} — stratégie", ligne_protection(dynamique)))
        lignes.append((f"{nom} — témoin", ligne_protection(temoin)))
    return tableau(lignes)


def verdict_protection(comparaisons: list[tuple[str, Resultat, Resultat]]) -> str:
    """Dit si la protection paie son prix, et sait répondre non."""

    mieux, pire, egal_sous_eau = 0, 0, 0
    for _, dynamique, temoin in comparaisons:
        rd, rt = dynamique.rendement_par_douleur, temoin.rendement_par_douleur
        if rd is None or rt is None:
            continue
        if rd > rt:
            mieux += 1
        else:
            pire += 1
        if abs(dynamique.temps_sous_eau - temoin.temps_sous_eau) < 0.03:
            egal_sous_eau += 1

    total = mieux + pire
    if not total:
        return "Aucune fenêtre exploitable."

    phrases = []
    if pire == total:
        phrases.append(
            f"⚠ La protection **ne paie pas son prix** : le témoin rend plus par "
            f"unité de recul sur {pire}/{total} fenêtre(s). Le recul de la "
            "stratégie est bien plus faible, mais elle engage moins de capital — "
            "et une stratégie qui n'investit rien a un recul nul."
        )
    elif mieux == total:
        phrases.append(
            f"La protection paie : meilleur rendement par unité de recul sur "
            f"{mieux}/{total} fenêtre(s)."
        )
    else:
        phrases.append(
            f"Rendement par unité de recul : la stratégie l'emporte sur {mieux} "
            f"fenêtre(s), le témoin sur {pire}."
        )
    if egal_sous_eau == total:
        phrases.append(
            f"Et le temps passé sous l'eau est le **même** sur {egal_sous_eau}/"
            f"{total} fenêtre(s) : elle réduit l'amplitude de la douleur, pas sa durée."
        )
    return "\n".join(phrases)


def verdict(comparaisons: list[tuple[str, Resultat, Resultat]]) -> str:
    """La phrase qu'on lit en premier, et qui peut dire non.

    Un harnais qui ne sait annoncer que des succès ne sert à rien.

    **Une abstention est un échec, pas un match nul.** La première version de
    cette fonction lisait le tableau mis en forme et comptait « — » comme
    neutre : le scénario où la stratégie n'achète *rien* pendant que le témoin
    gagne 8 % — le pire cas possible pour un DCA, dont toute la promesse est de
    continuer d'acheter — était donc rangé avec les cas sans opinion. Elle
    prend maintenant les résultats bruts, et l'abstention est comptée pour ce
    qu'elle est.
    """

    mieux, pire, abstentions = 0, 0, []
    for nom, dynamique, temoin in comparaisons:
        if not dynamique.achats and temoin.achats:
            abstentions.append(nom)
            continue
        moyen_dyn = dynamique.prix_moyen_achat
        moyen_tem = temoin.prix_moyen_achat
        if moyen_dyn is None or moyen_tem is None:
            continue
        if moyen_dyn < moyen_tem:
            mieux += 1
        else:
            pire += 1

    # Un prix moyen flatteur obtenu en achetant peu n'est pas une performance,
    # c'est une abstention partielle. Mesuré sur BTC 2022-2023 : la modulation
    # paie 7,2 % moins cher que le témoin et gagne **deux fois moins** (+20 %
    # contre +39 %), parce qu'elle engage 1 400 $ de moins. Sans cette ligne, le
    # verdict annonçait la victoire sur le seul prix.
    perdants = [
        nom for nom, dyn, tem in comparaisons
        if dyn.achats and tem.achats and dyn.pnl_relatif < tem.pnl_relatif - 0.02
    ]

    total = len(comparaisons)
    phrases = []
    if abstentions:
        phrases.append(
            f"⚠ La stratégie n'achète **rien** sur {len(abstentions)}/{total} "
            f"scénario(s) — {', '.join(abstentions)} — alors que le témoin y "
            "investit. Pour un DCA, une abstention totale est le pire résultat "
            "possible : ce n'est pas de la prudence, c'est une panne de discipline."
        )
    if perdants:
        phrases.append(
            f"⚠ Elle **gagne moins** que le témoin sur {len(perdants)}/{total} "
            f"scénario(s) — {', '.join(perdants)} — malgré un meilleur prix d'achat : "
            "acheter moins cher en achetant moins n'est pas une performance."
        )
    if mieux and not pire:
        phrases.append(
            f"Là où elle achète, la modulation paie moins cher que le témoin "
            f"sur {mieux}/{mieux} scénario(s)."
        )
    elif mieux or pire:
        phrases.append(
            f"Là où elle achète : moins cher que le témoin sur {mieux} "
            f"scénario(s), plus cher sur {pire}."
        )
    return "\n".join(phrases) if phrases else "Aucun scénario exploitable."
