#!/usr/bin/env python3
"""L'indice de confiance, de 0 à 100.

**C'est un indice d'opportunité d'achat, pas un indice de santé.** La nuance
décide de tous les signes : un RSI à 25 donne un *bon* score, parce qu'on
accumule dans la peur ; une avidité extrême donne un mauvais score alors que le
marché monte. Un lecteur pressé qui inverse cette convention obtient un système
qui achète les sommets, et rien dans les tests ne le lui dira — d'où ce
paragraphe, et le test `test_convention_contrarienne`.

**Une source absente n'est pas une source à zéro.** Compter à zéro ce qu'on ne
sait pas ferait passer tous les scores sous le seuil d'achat le jour où
DeFiLlama tombe : le système s'arrêterait d'acheter pour une raison qui n'a
rien à voir avec le marché. Le poids d'une famille absente est donc redistribué
sur celles qui ont répondu, et la liste des sources muettes part dans la
notification.
"""

from __future__ import annotations

from ..core.config import ConfigStrategie
from ..core.modeles import (
    Contexte, Gravite, MetriqueOnchain, Score, SignalSentiment, Zone, borner,
)
from .indicateurs import Lecture


def note_technique(lecture: Lecture, config: ConfigStrategie) -> tuple[float | None, list[str]]:
    """Quatre composantes, moyennées sur celles qui existent."""

    technique = config.technique
    composantes: list[float] = []
    raisons: list[str] = []

    # RSI — contrarien. En dessous du seuil de survente on est à 100, au-dessus
    # du seuil de surachat à 0, et linéaire entre les deux.
    if lecture.rsi is not None:
        etendue = technique.rsi_surachat - technique.rsi_survente
        brut = 100.0 * (technique.rsi_surachat - lecture.rsi) / etendue if etendue > 0 else 50.0
        composantes.append(borner(brut, 0.0, 100.0))
        if lecture.rsi <= technique.rsi_survente:
            raisons.append(f"RSI en survente ({lecture.rsi:.0f})")
        elif lecture.rsi >= technique.rsi_surachat:
            raisons.append(f"RSI en surachat ({lecture.rsi:.0f})")

    # Position par rapport aux moyennes mobiles. Sous l'EMA longue, on est dans
    # la zone d'accumulation historique ; loin au-dessus, on paie la tendance.
    if lecture.ema_longue is not None and lecture.ema_longue > 0:
        ecart = (lecture.prix - lecture.ema_longue) / lecture.ema_longue
        # -30 % → 100, +30 % → 0.
        composantes.append(borner(50.0 - ecart * 166.7, 0.0, 100.0))
        if ecart < -0.10:
            raisons.append(f"prix {abs(ecart):.0%} sous l'EMA {technique.ema_longue}")
        elif ecart > 0.30:
            raisons.append(f"prix {ecart:.0%} au-dessus de l'EMA {technique.ema_longue}")

    # Volume : un afflux modéré confirme, un afflux extrême dans une hausse est
    # une distribution. La note culmine autour de deux écarts-types.
    if lecture.cote_z_volume is not None:
        cote = lecture.cote_z_volume
        if cote <= 0:
            note = 40.0 + cote * 10.0
        elif cote <= 2.0:
            note = 40.0 + cote * 25.0
        else:
            note = max(30.0, 90.0 - (cote - 2.0) * 20.0)
        composantes.append(borner(note, 0.0, 100.0))
        if cote >= 2.0:
            raisons.append(f"volume à {cote:.1f} écarts-types")

    # Zone de valeur : sous sa borne basse, le marché a déserté ces prix.
    if lecture.profil is not None:
        position = lecture.profil.position(lecture.prix)
        composantes.append(borner(100.0 - position * 100.0, 0.0, 100.0))
        if position < 0:
            raisons.append("prix sous la zone de valeur")
        elif position > 1:
            raisons.append("prix au-dessus de la zone de valeur")

    if not composantes:
        return None, ["série trop courte pour l'analyse technique"]
    return sum(composantes) / len(composantes), raisons


def note_sentiment(signal: SignalSentiment | None) -> tuple[float | None, list[str]]:
    """Contrarien sur l'indice public, suiveur sur le social.

    Les deux sens coexistent volontairement. L'indice Fear & Greed mesure la
    *foule*, dont on veut faire l'inverse. Le score social mesure l'*intérêt*,
    dont un regain précoce est ce qu'on cherche. Les mélanger dans un seul sens
    annulerait les deux.
    """

    if signal is None:
        return None, []
    composantes: list[float] = []
    raisons: list[str] = []

    if signal.fear_greed is not None:
        composantes.append(borner(100.0 - float(signal.fear_greed), 0.0, 100.0))
        zone = signal.zone
        if zone is Zone.PEUR_EXTREME:
            raisons.append(f"peur extrême ({signal.fear_greed})")
        elif zone is Zone.AVIDITE_EXTREME:
            raisons.append(f"avidité extrême ({signal.fear_greed})")

    if signal.score_social is not None:
        composantes.append(borner(50.0 + signal.score_social * 50.0, 0.0, 100.0))
        if signal.score_social <= -0.4:
            raisons.append("social très négatif")
        elif signal.score_social >= 0.4:
            raisons.append("social très positif")

    if not composantes:
        return None, []
    return sum(composantes) / len(composantes), raisons


def note_onchain(metrique: MetriqueOnchain | None) -> tuple[float | None, list[str]]:
    """TVL, volume DEX et surtout flux des réserves de plateformes.

    Rappel du signe, parce qu'il est contre-intuitif et qu'il a déjà été
    inversé : `flux_reserves_exchanges_usd` **négatif** veut dire que les
    jetons *quittent* les plateformes, donc partent en portefeuille — lecture
    haussière. Positif veut dire qu'ils arrivent pour être vendus.
    """

    if metrique is None:
        return None, []
    composantes: list[float] = []
    raisons: list[str] = []

    if metrique.variation_tvl_7j is not None:
        # +20 % de TVL sur la semaine → 100, -20 % → 0.
        composantes.append(borner(50.0 + metrique.variation_tvl_7j * 250.0, 0.0, 100.0))
        if metrique.variation_tvl_7j >= 0.10:
            raisons.append(f"TVL +{metrique.variation_tvl_7j:.0%} sur 7 jours")
        elif metrique.variation_tvl_7j <= -0.10:
            raisons.append(f"TVL {metrique.variation_tvl_7j:.0%} sur 7 jours")

    if metrique.flux_reserves_exchanges_usd is not None and metrique.tvl_usd:
        # Rapporté à la TVL pour être comparable d'un actif à l'autre : dix
        # millions qui sortent n'ont pas le même sens sur Bitcoin et sur LINK.
        intensite = metrique.flux_reserves_exchanges_usd / max(metrique.tvl_usd, 1.0)
        composantes.append(borner(50.0 - intensite * 500.0, 0.0, 100.0))
        if intensite <= -0.02:
            raisons.append("sorties nettes des plateformes")
        elif intensite >= 0.02:
            raisons.append("entrées nettes sur les plateformes (pression vendeuse)")

    if metrique.volume_dex_24h_usd is not None and metrique.liquidite_dex_usd:
        # Rotation : volume sur liquidité. Au-delà de 1, le pool tourne
        # entièrement chaque jour — signe d'intérêt réel, pas d'un pool mort.
        rotation = metrique.volume_dex_24h_usd / max(metrique.liquidite_dex_usd, 1.0)
        composantes.append(borner(rotation * 60.0, 0.0, 100.0))

    if not composantes:
        return None, []
    return sum(composantes) / len(composantes), raisons


def calculer(contexte: Contexte, lecture: Lecture, config: ConfigStrategie) -> Score:
    """Combine les trois familles selon les poids configurés."""

    valeurs: dict[str, float | None] = {}
    raisons: list[str] = []

    valeurs["technique"], motifs = note_technique(lecture, config)
    raisons += motifs
    valeurs["sentiment"], motifs = note_sentiment(contexte.sentiment)
    raisons += motifs
    valeurs["onchain"], motifs = note_onchain(contexte.onchain)
    raisons += motifs

    presentes = {k: v for k, v in valeurs.items() if v is not None}
    absentes = [k for k, v in valeurs.items() if v is None]

    if not presentes:
        # Aucun signal du tout : 0, et surtout pas 50. Un « neutre » ici serait
        # lu comme une opinion, et le seuil d'achat pourrait être franchi par
        # une absence totale d'information.
        return Score(
            total=0.0, technique=0.0, sentiment=0.0, onchain=0.0,
            poids_effectifs={}, raisons=("aucune source exploitable",),
        )

    poids = {k: config.poids.get(k, 0.0) for k in presentes}
    somme_poids = sum(poids.values())
    if config.redistribuer_poids_absents and somme_poids > 0:
        poids = {k: v / somme_poids for k, v in poids.items()}
    elif somme_poids <= 0:
        poids = {k: 1.0 / len(presentes) for k in presentes}

    total = sum(presentes[k] * poids[k] for k in presentes)

    if absentes:
        raisons.append(f"famille(s) absente(s) : {', '.join(sorted(absentes))}")
    if contexte.sources_en_panne:
        raisons.append(f"source(s) en panne : {', '.join(contexte.sources_en_panne)}")

    # Une actualité macro grave ne fait pas baisser le score : elle le plafonne.
    # La différence compte — un plafond dit « on ne prend pas de risque tant que
    # ça n'est pas sorti », une soustraction dirait « le marché vaut moins »,
    # ce qui est une opinion qu'on n'a pas.
    gravite = contexte.gravite_macro
    if gravite >= Gravite.ELEVEE:
        plafond = 55.0 if gravite is Gravite.ELEVEE else 35.0
        if total > plafond:
            raisons.append(f"score plafonné à {plafond:.0f} : actualité macro {gravite.name.lower()}")
            total = plafond

    return Score(
        total=borner(total, 0.0, 100.0),
        technique=valeurs["technique"] or 0.0,
        sentiment=valeurs["sentiment"] or 0.0,
        onchain=valeurs["onchain"] or 0.0,
        poids_effectifs=poids,
        raisons=tuple(raisons),
    )
