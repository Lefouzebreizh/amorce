#!/usr/bin/env python3
"""Ce que le levier aurait coûté — mesuré, jamais appliqué.

**Ce module ne passe aucun ordre et n'entre nulle part dans le chemin
d'exécution.** Il lit un rejeu déjà fait et répond à une seule question : à
quel moment un compte à levier aurait-il été liquidé ? C'est délibéré. Le
levier se décide sur des liquidations comptées, pas sur une intuition, et une
option de levier posée dans le courtier serait utilisée avant d'avoir été
mesurée.

**Le modèle, écrit en clair pour qu'on puisse le contester.** Le levier
s'applique à une **position**, jamais au portefeuille. C'est la correction qui
a sauvé ce module d'être inutile : mesuré d'abord sur le recul du portefeuille,
il déclarait 10x survivant sur un marché où l'actif s'effondrait de 37 %.
L'explication tient en une ligne — le bot garde l'essentiel du capital en
liquide, donc le portefeuille recule peu quand l'actif plonge. Personne ne met
du levier sur du cash dormant, et une mesure qui l'autorise flatte le levier
d'un facteur dix.

Une position ouverte au prix `P` avec un levier `L` est liquidée quand le prix
touche `P × (1 − 1/L + maintenance)`. On mesure donc, pour **chaque achat**, la
pire excursion défavorable pendant sa détention : le plus bas atteint entre
l'entrée et la sortie, rapporté au prix d'entrée. Les ventes sont appariées aux
achats en premier entré, premier sorti ; un achat jamais revendu est tenu
jusqu'au bout de la série.

**Le financement est compté, et il change tout.** Un perpétuel facture toutes
les huit heures, sur le **notionnel** — donc `levier × marge`. Le levier
multiplie le coût une seconde fois, ce qui rend l'effet bien plus brutal qu'il
n'en a l'air : à 0,01 % par période, trois mois de détention coûtent 2,7 % du
notionnel, soit 27 % de la marge à x10. Mesuré sur BTC, il double environ le
nombre de liquidations, et à x10 il en vide certaines **sans qu'un prix ait
reculé d'un centime**. C'est le seul poste qu'aucun réglage de stop n'atténue :
il se combat en raccourcissant la détention, ou en baissant le levier.

**Deux raisons font que ce compte reste un plancher** — le vrai nombre de
liquidations est plus élevé, jamais plus bas :

1. **Le prix de liquidation d'une plateforme est un prix de marque**, moyenné
   entre places, et non le dernier prix échangé. Il diverge exactement pendant
   les secousses, c'est-à-dire au moment qui décide.
2. **Le rejeu lui-même est déjà optimiste** sur les actifs peu liquides, et son
   propre en-tête le dit : sans carnet d'ordres historique, le courtier papier
   retombe sur un glissement forfaitaire. Sur une pépite, l'écart réel est plus
   grand, et il l'est en silence.

Le taux retenu par défaut est le taux **neutre**. En marché haussier il monte,
souvent au double ou au triple, et toujours contre l'acheteur.

**L'excursion se mesure sur les plus bas, jamais sur les clôtures.** Une mèche
liquide un compte aussi sûrement qu'une clôture, et elle ne laisse aucune trace
dans une courbe bâtie sur les clôtures — celle du rejeu en est une. C'est
pourquoi ce module relit la série plutôt que de se contenter du résultat.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..core.modeles import SerieOHLCV, Sens

# Ordre de grandeur des plateformes majeures sur les paires liquides. Volontai-
# rement bas : le surestimer ferait paraître le levier plus dangereux qu'il
# n'est, et ce module perdrait la seule chose qui lui donne du poids — être
# accusé de noircir le tableau le rendrait inutile.
MAINTENANCE_PAR_DEFAUT = 0.005

LEVIERS_PAR_DEFAUT = (1.0, 2.0, 3.0, 5.0, 10.0)

# Financement d'un perpétuel, par période de huit heures. 0,01 % est le taux
# neutre des grandes plateformes — celui qu'on paie quand le marché ne penche
# ni d'un côté ni de l'autre. En marché haussier il monte, souvent au double ou
# au triple, et toujours contre l'acheteur : retenir le taux neutre est donc le
# choix prudent au sens où il **sous-estime** le coût, comme tout le reste de
# ce module.
FINANCEMENT_PAR_DEFAUT = 0.0001
HEURES_PAR_PERIODE = 8.0

# En dessous de ce nombre de positions, « aucune liquidation » ne veut rien dire
# statistiquement : deux positions sur une semaine calme survivent à n'importe
# quel levier, et c'est le marché qu'on mesure, pas le réglage. Le seuil est un
# ordre de grandeur assumé, pas un résultat de puissance statistique.
POSITIONS_POUR_CONCLURE = 10


def meches_absentes(serie: SerieOHLCV, tolerance: float = 0.98) -> bool:
    """Vrai quand la série ne porte aucune information intra-bougie.

    **Le piège que ce module s'était tendu à lui-même.** Toute sa méthode
    repose sur les plus bas — « une mèche liquide un compte aussi sûrement
    qu'une clôture ». Mais une source qui ne publie qu'une clôture quotidienne
    n'a pas de plus bas à donner : `lire_coinmetrics` fabrique alors
    `bas = min(clôture du jour, clôture de la veille)`, un plus bas de clôture
    à clôture. Le calcul tourne, ne lève rien, et mesure les clôtures en
    croyant mesurer les mèches.

    La détection est mécanique : sans information intra-bougie, aucune bougie
    ne dépasse son propre corps — `haut = max(ouverture, clôture)` et
    `bas = min(ouverture, clôture)`. Une vraie série de marché a des mèches sur
    la quasi-totalité de ses bougies ; la tolérance absorbe les rares séances
    qui n'en ont pas.

    Conséquence à dire au lecteur, jamais à taire : le vrai plus bas d'une
    journée est sous celui-là, donc les liquidations sont **sous-comptées**.
    """

    bougies = serie.bougies
    if not bougies:
        return False
    sans = sum(
        1 for b in bougies
        if b.haut <= max(b.ouverture, b.cloture) and b.bas >= min(b.ouverture, b.cloture)
    )
    return sans / len(bougies) >= tolerance


def part_de_marge_financee(levier: float, heures: float,
                           taux: float = FINANCEMENT_PAR_DEFAUT) -> float:
    """La fraction de la marge qu'un perpétuel prélève sur cette détention.

    Le financement se paie sur le **notionnel**, pas sur la marge — et le
    notionnel vaut `levier × marge`. Le coût rapporté à la marge est donc
    multiplié par le levier une seconde fois, ce qui rend l'effet bien plus
    brutal qu'il n'en a l'air : à 0,01 % par huit heures, une position tenue
    trois mois coûte 2,7 % du notionnel, soit **27 % de la marge à x10**.

    Au-delà de 1, la position est liquidée par le seul financement, sans qu'un
    prix ait bougé. Ce n'est pas un cas d'école : à x10 et taux neutre, cela
    arrive vers onze mois de détention — et un DCA garde ses lignes des mois.
    """

    if levier <= 1.0 or heures <= 0:
        return 0.0
    periodes = heures / HEURES_PAR_PERIODE
    return levier * taux * periodes


def seuil_liquidation(levier: float, maintenance: float = MAINTENANCE_PAR_DEFAUT,
                      *, heures: float = 0.0,
                      financement: float = 0.0) -> float:
    """Le recul, en fraction, qui épuise la marge.

    Rend `1.0` à levier 1 : sans levier on ne se fait pas liquider, on perd —
    ce qui n'est pas la même chose et ne doit pas se compter pareil.

    Avec `financement`, la marge disponible n'est plus entière au moment où le
    prix bouge : elle vaut `1 − part financée`, et le seuil se resserre
    d'autant. Une part supérieure à 1 rend `0.0` — tout recul, aussi petit
    soit-il, liquide alors une position déjà vidée par ses frais.
    """

    if levier <= 1.0:
        return 1.0
    part = part_de_marge_financee(levier, heures, financement) if financement else 0.0
    return max(0.0, (1.0 - part) / levier - maintenance)


@dataclass(frozen=True, slots=True)
class Position:
    """Un achat, et la pire excursion défavorable de sa détention."""

    ouverte_le: datetime
    prix_entree: float
    montant_usd: float
    plus_bas: float                    # le plus bas touché pendant la détention
    fermee_le: datetime | None         # None : jamais revendue
    duree_heures: float = 0.0          # détention réelle, pour le financement

    @property
    def excursion(self) -> float:
        """Fraction sous le prix d'entrée. 0 si la position n'a jamais baissé."""

        if self.prix_entree <= 0:
            return 0.0
        return max(0.0, (self.prix_entree - self.plus_bas) / self.prix_entree)


@dataclass(frozen=True, slots=True)
class Verdict:
    """Le sort d'un levier sur l'ensemble des positions d'un rejeu."""

    levier: float
    seuil: float                       # seuil médian, le financement variant par position
    positions: int
    liquidees: int
    montant_liquide: float             # capital perdu dans les liquidations
    premiere: datetime | None
    # Positions que le financement seul aurait vidées, sans qu'un prix bouge.
    # Comptées à part parce qu'aucun réglage de stop ne les évite : c'est la
    # durée de détention qu'il faut changer, ou le levier.
    tuees_par_le_financement: int = 0
    financement_median_pct: float = 0.0    # part de marge, en pourcentage
    # Porté par le verdict, et non passé au tableau : un appelant qui oublie de
    # transmettre l'avertissement est exactement le défaut qu'on corrige ici.
    sans_meches: bool = False

    @property
    def part_liquidee(self) -> float:
        return self.liquidees / self.positions if self.positions else 0.0

    @property
    def survit(self) -> bool:
        return self.liquidees == 0


def positions(resultat, serie: SerieOHLCV) -> list[Position]:
    """Les achats du rejeu, appariés aux ventes en premier entré, premier sorti.

    L'appariement est une convention, pas une vérité : un DCA accumule, et rien
    dans les exécutions ne dit quelle vente solde quel achat. Le premier entré,
    premier sorti est le choix habituel, et il est **conservateur du bon côté**
    — il attribue les détentions longues aux achats anciens, donc aux
    excursions les plus larges, ce qui compte davantage de liquidations plutôt
    que moins.
    """

    mouvements = sorted(resultat.executions, key=lambda e: e.horodatage)
    bougies = serie.bougies
    ouvertes: list[dict] = []
    closes: list[Position] = []

    # Une position jamais revendue est tenue jusqu'à la dernière bougie : c'est
    # cette date-là qui borne sa détention, et donc son financement.
    fin_serie = bougies[-1].horodatage if bougies else None

    def plus_bas_entre(debut: datetime, fin: datetime | None) -> float:
        fenetre = [b.bas for b in bougies
                   if b.horodatage >= debut and (fin is None or b.horodatage <= fin)]
        return min(fenetre) if fenetre else float("inf")

    def heures(debut: datetime, fin: datetime | None) -> float:
        borne = fin or fin_serie
        if borne is None:
            return 0.0
        return max(0.0, (borne - debut).total_seconds() / 3600.0)

    for execution in mouvements:
        if execution.ordre.sens is Sens.ACHAT:
            ouvertes.append({
                "le": execution.horodatage,
                "prix": execution.prix_execute,
                "quantite": execution.quantite_executee,
                "montant": execution.montant_usd,
            })
            continue

        # Une vente solde les plus anciennes d'abord.
        reste = execution.quantite_executee
        while reste > 1e-12 and ouvertes:
            plus_ancienne = ouvertes[0]
            pris = min(reste, plus_ancienne["quantite"])
            part = pris / plus_ancienne["quantite"] if plus_ancienne["quantite"] else 0.0
            closes.append(Position(
                ouverte_le=plus_ancienne["le"],
                prix_entree=plus_ancienne["prix"],
                montant_usd=plus_ancienne["montant"] * part,
                plus_bas=plus_bas_entre(plus_ancienne["le"], execution.horodatage),
                fermee_le=execution.horodatage,
                duree_heures=heures(plus_ancienne["le"], execution.horodatage),
            ))
            plus_ancienne["quantite"] -= pris
            plus_ancienne["montant"] -= plus_ancienne["montant"] * part
            reste -= pris
            if plus_ancienne["quantite"] <= 1e-12:
                ouvertes.pop(0)

    # Ce qui n'a jamais été revendu est tenu jusqu'au bout de la série.
    for restante in ouvertes:
        closes.append(Position(
            ouverte_le=restante["le"],
            prix_entree=restante["prix"],
            montant_usd=restante["montant"],
            plus_bas=plus_bas_entre(restante["le"], None),
            fermee_le=None,
            duree_heures=heures(restante["le"], None),
        ))

    closes.sort(key=lambda p: p.ouverte_le)
    return closes


def analyser(
    resultat,
    serie: SerieOHLCV,
    leviers: tuple[float, ...] = LEVIERS_PAR_DEFAUT,
    maintenance: float = MAINTENANCE_PAR_DEFAUT,
    financement: float = FINANCEMENT_PAR_DEFAUT,
) -> list[Verdict]:
    """Le sort de chaque levier, du plus prudent au plus agressif.

    Le seuil se calcule **par position** et non une fois pour toutes : deux
    positions au même levier n'ont pas la même marge disponible si l'une est
    tenue trois jours et l'autre huit mois. Passer `financement=0.0` rend le
    calcul d'avant, utile pour isoler ce que les frais coûtent à eux seuls.
    """

    lignes = positions(resultat, serie)
    plates = meches_absentes(serie)
    verdicts: list[Verdict] = []

    for levier in sorted(leviers):
        touchees, par_frais, parts = [], 0, []
        for position in lignes:
            part = part_de_marge_financee(levier, position.duree_heures, financement)
            parts.append(part)
            seuil = seuil_liquidation(
                levier, maintenance,
                heures=position.duree_heures, financement=financement,
            )
            if part >= 1.0:
                # La marge est épuisée par les seuls frais : la position est
                # perdue même si le prix n'a jamais reculé d'un centime.
                par_frais += 1
                touchees.append(position)
            elif position.excursion >= seuil:
                touchees.append(position)

        parts.sort()
        median = parts[len(parts) // 2] if parts else 0.0
        verdicts.append(Verdict(
            levier=levier,
            seuil=seuil_liquidation(levier, maintenance),
            positions=len(lignes),
            liquidees=len(touchees),
            montant_liquide=sum(p.montant_usd for p in touchees),
            premiere=min((p.ouverte_le for p in touchees), default=None),
            tuees_par_le_financement=par_frais,
            financement_median_pct=median * 100,
            sans_meches=plates,
        ))
    return verdicts


def levier_maximal(verdicts: list[Verdict]) -> float | None:
    """Le plus grand levier dont aucune position n'aurait été liquidée.

    `None` a **deux** causes qu'il ne faut pas confondre, et c'est l'appelant
    qui doit les distinguer avec `sans_matiere` : ou bien tous les leviers
    tombent, ou bien il n'y avait aucune position à examiner.
    """

    if sans_matiere(verdicts):
        return None
    survivants = [v.levier for v in verdicts if v.survit]
    return max(survivants) if survivants else None


def sans_matiere(verdicts: list[Verdict]) -> bool:
    """Vrai quand le rejeu n'a ouvert aucune position.

    **Le cas le plus dangereux de tout ce module**, et il a bien failli être
    livré : sans position, aucune n'est liquidée, et un tableau naïf annonce
    « levier maximal 10x » — une conclusion rassurante tirée du vide. C'est le
    même défaut que le radar `pepites/` a corrigé la veille : un point absent
    d'un tableau se lit comme un point sain.

    Un rejeu sans ordre arrive pour une raison banale : une série trop courte
    pour la profondeur de bougies que le moteur exige. Il ne dit alors rien du
    levier, et il doit le dire.
    """

    return not verdicts or all(v.positions == 0 for v in verdicts)


def tableau(verdicts: list[Verdict], titre: str = "") -> str:
    """Le tableau à lire. Une ligne par levier, et la conclusion en dessous."""

    lignes = [f"### Levier — {titre}" if titre else "### Levier", ""]
    lignes.append("| levier | recul qui liquide | financement médian | positions liquidées | "
                  "dont par les frais seuls | capital perdu | première |")
    lignes.append("|---|---|---|---|---|---|---|")

    for v in verdicts:
        if v.levier <= 1.0:
            lignes.append(f"| {v.levier:g}x | — | — | aucune (pas de liquidation sans levier) "
                          f"| — | — | — |")
            continue
        date = v.premiere.strftime("%Y-%m-%d") if v.premiere else "—"
        part = f"{v.liquidees}/{v.positions} ({v.part_liquidee * 100:.0f} %)"
        frais = f"**{v.tuees_par_le_financement}**" if v.tuees_par_le_financement else "0"
        lignes.append(
            f"| {v.levier:g}x | {v.seuil * 100:.1f} % | {v.financement_median_pct:.0f} % "
            f"de la marge | {part} | {frais} | "
            f"{v.montant_liquide:,.0f} $ | {date} |".replace(",", " ")
        )

    if sans_matiere(verdicts):
        return "\n".join([
            lignes[0], "",
            "**Aucune position ouverte sur ce rejeu — il ne dit rien du levier.**",
            "",
            "Ce n'est pas « le levier passe », c'est « rien n'a été mesuré ». La cause "
            "habituelle est une série trop courte pour la profondeur de bougies que le "
            "moteur exige : sans assez d'historique, aucun indicateur n'est calculable et "
            "la stratégie s'abstient. Rallonger les données, puis relancer.",
        ])

    maximum = levier_maximal(verdicts)
    lignes.append("")
    if maximum is None or maximum <= 1.0:
        lignes.append("**Aucun levier ne tient sur cette série.** Le comptant survit, "
                      "tout multiple perd au moins une position entière.")
    else:
        lignes.append(f"**Levier maximal sans une seule liquidation : {maximum:g}x.** "
                      "Le financement est compté ; restent le prix de marque de la plateforme "
                      "et l'illiquidité réelle, qui poussent tous deux dans le même sens.")

    if verdicts and verdicts[0].sans_meches:
        lignes.append("")
        lignes.append(
            "⚠ **Cette série n'a pas d'information intra-bougie** : ses plus bas sont "
            "dérivés des clôtures, pas mesurés. Une source qui ne publie qu'un cours de "
            "clôture par jour ne peut pas dire jusqu'où le prix est descendu dans la "
            "journée — or c'est là que se jouent les liquidations. **Les chiffres "
            "ci-dessus sous-comptent**, et d'autant plus que le levier est élevé."
        )

    par_frais = [v for v in verdicts if v.tuees_par_le_financement]
    if par_frais:
        pire = max(par_frais, key=lambda v: v.tuees_par_le_financement)
        lignes.append("")
        lignes.append(
            f"⚠ **À {pire.levier:g}x, {pire.tuees_par_le_financement} position(s) sont vidées par "
            "le seul financement**, sans qu'un prix ait reculé. Aucun réglage de stop n'y change "
            "rien : c'est la durée de détention qu'il faut raccourcir, ou le levier."
        )

    tenues = verdicts[0].positions
    if tenues < POSITIONS_POUR_CONCLURE:
        lignes.append("")
        lignes.append(f"⚠ **{tenues} position(s) seulement — trop peu pour conclure.** "
                      f"En dessous de {POSITIONS_POUR_CONCLURE}, ce tableau décrit la période "
                      "rejouée bien plus que le réglage. Rallonger la série, ou en rejouer "
                      "plusieurs, avant d'en tirer un chiffre.")
    return "\n".join(lignes)
