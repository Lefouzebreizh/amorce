#!/usr/bin/env python3
"""La voix du conseiller. Ce que le bilan dit, et surtout ce qu'il se refuse à dire.

Un tableau de chiffres n'est pas un conseil. Ce module met en français ce que
`ecarts` et `conseil` ont calculé, avec trois règles de ton qui viennent
directement du métier :

**On dit d'abord ce qui manque, jamais en pied de page.** Un avertissement lu
après le conseil arrive trop tard : la décision est déjà prise. Les réserves
ouvrent le rapport.

**On se tait plutôt que de conseiller sur du faux.** Bilan partiel — un cours
absent, un cours périmé, une source muette — et le rééquilibrage n'est pas
affiché du tout. Pas grisé, pas assorti d'un astérisque : absent. Une
répartition calculée sur un total incomplet reste parfaitement plausible à
l'écran, et c'est précisément ce qui la rend dangereuse.

**« Ne rien faire » se dit en toutes lettres.** Quand tout tient dans la bande,
le rapport l'écrit comme une décision et non comme une absence de résultat. Un
écran vide se lit comme une panne ; un feu vert se lit comme un feu vert.

Le format de sortie est du Markdown, pour les deux usages à la fois : il se lit
tel quel dans un terminal, et se dépose tel quel dans un fichier qu'on ouvre
depuis un téléphone.
"""

from __future__ import annotations

from core.modeles import Bilan, Classe, Disponibilite, Ecart, ETIQUETTES, Ligne
from core.reglages import Profil
from analyse import conseil as conseil_module

# Ce que chaque état de source raconte en un mot, dans le tableau récapitulatif.
LIBELLES_DISPONIBILITE: dict[Disponibilite, str] = {
    Disponibilite.LUE: "lue",
    Disponibilite.VIDE: "vide",
    Disponibilite.ABSENTE: "absente",
    Disponibilite.ILLISIBLE: "illisible",
    Disponibilite.NON_BRANCHEE: "non branchée",
}


# L'espace insécable du français, écrite en clair : tapée au clavier elle est
# invisible dans un diff, et c'est ainsi qu'on en perd une sans le voir.
INSECABLE = "\u00a0"


# --------------------------------------------------------------------------
# Écriture des nombres — à la française, et pas approximativement
# --------------------------------------------------------------------------

def euros(montant: float, decimales: int = 0) -> str:
    """Séparateur de milliers et espace avant le symbole, tous deux insécables.

    L'espace est écrit `\\u00a0` en toutes lettres et non tapé au clavier : une
    espace insécable est **invisible dans un diff**, et deux relecteurs ne
    voient pas la même chose selon leur éditeur. Ce module a déjà coûté deux
    tests faux pour cette seule raison.

    Elle est insécable parce qu'un montant coupé en fin de ligne entre ses
    milliers et ses centaines se relit comme deux nombres — et sur un écran de
    téléphone, la coupure arrive.
    """
    texte = f"{montant:,.{decimales}f}".replace(",", INSECABLE).replace(".", ",")
    return f"{texte}{INSECABLE}€"


def pourcent(valeur: float, decimales: int = 1) -> str:
    """Espace insécable avant le signe, comme l'exige le français."""
    return f"{valeur:.{decimales}f}".replace(".", ",") + INSECABLE + "%"


def points(valeur: float) -> str:
    """Un écart entre deux pourcentages se compte en **points**, pas en pourcent.

    Passer de 50 % à 55 %, c'est cinq points, et dix pour cent d'augmentation.
    Les confondre dans un rapport patrimonial fait raisonner sur des ordres de
    grandeur faux.
    """
    return f"{valeur:+.1f}".replace(".", ",") + INSECABLE + "pts"


def _nombre(valeur: float) -> str:
    return f"{valeur:g}".replace(".", ",")


# --------------------------------------------------------------------------
# Tableaux
# --------------------------------------------------------------------------

def _tableau(entetes: list[str], rangs: list[list[str]], alignements: str) -> str:
    """Un tableau Markdown. Pas de bibliothèque : trois lignes de format.

    `alignements` porte une lettre par colonne — « g » à gauche, « d » à droite.
    Les montants s'alignent à droite, sans quoi on ne compare pas deux nombres
    d'un coup d'œil ; c'est la seule raison d'être de ce paramètre.
    """
    separateur = "|" + "|".join(
        " ---: " if lettre == "d" else " :--- " for lettre in alignements
    ) + "|"
    lignes = ["| " + " | ".join(entetes) + " |", separateur]
    lignes += ["| " + " | ".join(rang) + " |" for rang in rangs]
    return "\n".join(lignes)


def table_positions(bilan: Bilan) -> str:
    rangs: list[list[str]] = []
    ordre = list(Classe)
    for ligne in sorted(
        bilan.lignes,
        key=lambda l: (ordre.index(l.classe), -(l.valeur_eur or 0.0)),
    ):
        if ligne.plus_value_eur is not None:
            suivi = f"{euros(ligne.plus_value_eur)} latents"
            if ligne.plus_value_eur >= 0:
                suivi = "+" + suivi
        elif ligne.rendement_pct is not None:
            suivi = f"rendement {pourcent(ligne.rendement_pct)}"
        else:
            suivi = "—"
        rangs.append([
            ETIQUETTES[ligne.classe],
            ligne.nom,
            ligne.detail,
            "—" if ligne.quantite is None else _nombre(ligne.quantite),
            "—" if ligne.prix_eur is None else euros(ligne.prix_eur, 2),
            "cours absent" if ligne.valeur_eur is None else euros(ligne.valeur_eur),
            suivi,
        ])
    return _tableau(
        ["Poche", "Actif", "Détail", "Qté", "Cours", "Valeur", "Suivi"],
        rangs,
        "gggdddd",
    )


def table_repartition(ecarts: tuple[Ecart, ...], bande_pct: float) -> str:
    rangs: list[list[str]] = []
    for ecart in ecarts:
        if not ecart.hors_bande:
            statut = "dans la bande"
        elif ecart.ecart_pts > 0:
            statut = "à alléger"
        else:
            statut = "à renforcer"
        rangs.append([
            ETIQUETTES[ecart.classe],
            euros(ecart.valeur_eur),
            pourcent(ecart.part_pct),
            pourcent(ecart.cible_pct, 0),
            points(ecart.ecart_pts),
            statut,
        ])
    total = sum(ecart.valeur_eur for ecart in ecarts)
    rangs.append([
        "**Total**", f"**{euros(total)}**",
        f"**{pourcent(100.0 if total else 0.0)}**", f"**100{INSECABLE}%**", "", "",
    ])
    return _tableau(
        ["Poche", "Valeur nette", "Part", "Cible",
         f"Écart (bande ±{_nombre(bande_pct)}{INSECABLE}pts)", "Statut"],
        rangs,
        "gddddg",
    )


def table_apport(affectation: dict[Classe, float], apport_eur: float) -> str:
    rangs = [
        [ETIQUETTES[classe], euros(montant), pourcent(montant / apport_eur * 100)]
        for classe, montant in affectation.items()
        # Sous un euro, la ligne n'est pas actionnable : on ne verse pas
        # quarante centimes sur un livret pour la beauté de l'arrondi.
        if montant >= 1
    ]
    return _tableau(
        [f"Prochain apport ({euros(apport_eur)})", "Montant", "Part"], rangs, "gdd"
    )


def table_sources(bilan: Bilan) -> str:
    rangs = [
        [
            etat.nom,
            LIBELLES_DISPONIBILITE[etat.disponibilite],
            etat.motif or ("—" if etat.disponibilite is Disponibilite.LUE else ""),
        ]
        for etat in bilan.sources
    ]
    return _tableau(["Source", "État", "Ce qu'elle dit"], rangs, "ggg")


# --------------------------------------------------------------------------
# Le rapport
# --------------------------------------------------------------------------

def _bloc_conseil(bilan: Bilan, profil: Profil) -> list[str]:
    """Le rééquilibrage — ou la raison pour laquelle il n'y en a pas.

    Ce bloc est le seul du rapport qui puisse disparaître entièrement, et c'est
    voulu : voir la deuxième règle de ton, en tête de module.
    """
    if bilan.partiel:
        return [
            "## Conseil",
            "",
            "**Aucun conseil de rééquilibrage sur un total incomplet.** Les écarts "
            "ci-dessus sont faux tant qu'une valeur manque : les afficher comme "
            "une recommandation reviendrait à faire arbitrer sur un patrimoine "
            "qui n'existe pas. Complétez ce qui est signalé plus haut, puis "
            "relancez.",
        ]

    blocs = ["## Conseil", ""]
    affectation = conseil_module.affecter_apport(profil.apport_mensuel_eur, bilan.ecarts)
    hors_bande = bilan.hors_bande

    if not hors_bande:
        blocs.append(
            f"Tout tient dans la bande de ±{_nombre(profil.bande_pct)} points. "
            "**Ne rien faire est la bonne décision** : sous cet écart, arbitrer "
            "coûte plus en frais et en fiscalité que la discipline ne rapporte."
        )
    else:
        resume = ", ".join(
            f"{ETIQUETTES[e.classe]} {points(e.ecart_pts)} ({euros(abs(e.ecart_eur))})"
            for e in hors_bande
        )
        blocs.append(f"Hors de la bande : {resume}.")
        blocs.append("")
        a_vendre = conseil_module.ventes_restantes(
            bilan.ecarts, affectation, profil.bande_pct
        )
        if a_vendre:
            blocs.append(
                f"Même après {conseil_module.MOIS_DE_PATIENCE} mois de versements, "
                "il resterait à alléger :"
            )
            blocs += [
                f"- **{ETIQUETTES[classe]}** de {euros(montant)} — "
                f"{conseil_module.COMMENT_ALLEGER[classe]}."
                for classe, montant in a_vendre.items()
            ]
        else:
            blocs.append(
                f"**Aucune vente à prévoir.** {conseil_module.MOIS_DE_PATIENCE} mois "
                "de versements suffisent à ramener la répartition dans la bande — "
                "sans arbitrage, donc sans impôt."
            )

    if profil.apport_mensuel_eur > 0:
        blocs += ["", table_apport(affectation, profil.apport_mensuel_eur)]
        if affectation.get(Classe.IMMOBILIER, 0.0) >= 1:
            blocs += [
                "",
                "La part immobilière d'un versement mensuel se place en parts de "
                "SCPI ou en remboursement anticipé : elle ne s'achète pas au "
                "mètre carré.",
            ]
    return blocs


def _bloc_moteurs(bilan: Bilan, notes: dict[str, tuple[str, ...]]) -> list[str]:
    """Ce que NexusCrypto et le radar racontent — hors du total, exprès.

    Ces deux-là ne pèsent pas un euro dans le patrimoine : l'un annonce une
    intention d'allocation, l'autre des signalements. Leur donner une section à
    eux, après les tableaux et jamais dedans, est ce qui les empêche d'être lus
    comme des positions.
    """
    interessantes = [
        (etat, notes.get(etat.nom, ()))
        for etat in bilan.sources
        if etat.nom in ("nexuscrypto", "pepites") and notes.get(etat.nom)
    ]
    if not interessantes:
        return []
    blocs = ["## Du côté des moteurs", ""]
    for etat, lignes in interessantes:
        blocs.append(f"**{etat.nom}**")
        blocs += [
            ligne if ligne.startswith("  ") else f"- {ligne}" for ligne in lignes
        ]
        blocs.append("")
    return blocs


def rediger(
    bilan: Bilan,
    profil: Profil,
    notes: dict[str, tuple[str, ...]] | None = None,
    *,
    avec_conseil: bool = True,
) -> str:
    """Le rapport complet, en Markdown."""
    etat = "partiel" if bilan.partiel else "net"
    blocs: list[str] = ["# Patrimoine", ""]

    if bilan.avertissements:
        blocs += ["> **Total partiel.** Ce qui manque, avant tout le reste :", ">"]
        blocs += [f"> - {texte}" for texte in bilan.avertissements]
        blocs.append("")

    blocs += [
        f"**Patrimoine {etat} : {euros(bilan.total_eur)}** · profil "
        f"« {profil.appetence} » · horizon {profil.horizon_annees} ans",
        "",
        "## Positions",
        "",
        table_positions(bilan),
        "",
        "## Répartition",
        "",
        table_repartition(bilan.ecarts, profil.bande_pct),
        "",
    ]

    if avec_conseil:
        blocs += _bloc_conseil(bilan, profil)
        blocs.append("")

    blocs += _bloc_moteurs(bilan, notes or {})
    blocs += ["## Sources", "", table_sources(bilan), ""]
    return "\n".join(blocs).rstrip() + "\n"


def rediger_sources(bilan: Bilan, notes: dict[str, tuple[str, ...]]) -> str:
    """La vue « d'où viennent les chiffres », pour `main.py sources`.

    Elle existe séparément du bilan parce qu'elle répond à une autre question :
    non pas « combien », mais « qui a répondu, et qu'a-t-il dit ». C'est la
    première chose qu'on regarde quand un total surprend.
    """
    blocs = ["# Sources", "", table_sources(bilan), ""]
    for etat in bilan.sources:
        lignes = notes.get(etat.nom, ())
        if not lignes:
            continue
        blocs += [f"## {etat.nom}", ""]
        blocs += [f"- {ligne.strip()}" if not ligne.startswith("  ") else ligne
                  for ligne in lignes]
        blocs.append("")
    return "\n".join(blocs).rstrip() + "\n"
