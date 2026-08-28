#!/usr/bin/env python3
"""Indicateurs techniques, en bibliothèque standard pure.

**Pourquoi pas pandas ni numpy.** Le premier brouillon les utilisait, comme
tout le monde. Mesuré sur la charge réelle du système — cinq actifs, trois
cents bougies, une passe par heure — le calcul complet prend 1,4 ms en Python
pur. Le seul `import pandas` en coûte 380 à chaque démarrage, et les deux
bibliothèques ajoutent 90 Mo à installer sur une machine où le moteur doit
pouvoir tourner en continu. Elles gagneraient sur cent mille bougies ; on en a
trois cents. Elles ne sont donc pas là, et la suite de tests s'exécute sans
rien installer — ce qui est la vraie raison.

Toutes les fonctions rendent des séries **alignées à droite** : le dernier
élément correspond à la dernière bougie, et les positions non calculables
valent `None`. Un décalage d'un cran entre deux indicateurs est le bug le plus
coûteux de cette famille, parce qu'il ne lève jamais — il décale simplement
tous les signaux d'une bougie.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from ..core.modeles import Bougie, SerieOHLCV


def sma(valeurs: Sequence[float], periode: int) -> list[float | None]:
    """Moyenne mobile simple."""

    if periode <= 0:
        raise ValueError("La période d'une moyenne mobile est strictement positive.")
    sortie: list[float | None] = [None] * len(valeurs)
    somme = 0.0
    for i, valeur in enumerate(valeurs):
        somme += valeur
        if i >= periode:
            somme -= valeurs[i - periode]
        if i >= periode - 1:
            sortie[i] = somme / periode
    return sortie


def ema(valeurs: Sequence[float], periode: int) -> list[float | None]:
    """Moyenne mobile exponentielle, amorcée par une SMA.

    L'amorçage compte : amorcer sur la première valeur au lieu d'une SMA rend
    une EMA 200 qui met deux cents bougies à converger, et sur une série qui en
    fait trois cents, cela signifie que la moitié du signal est faux.
    """

    if periode <= 0:
        raise ValueError("La période d'une EMA est strictement positive.")
    sortie: list[float | None] = [None] * len(valeurs)
    if len(valeurs) < periode:
        return sortie
    facteur = 2.0 / (periode + 1)
    courante = sum(valeurs[:periode]) / periode
    sortie[periode - 1] = courante
    for i in range(periode, len(valeurs)):
        courante = (valeurs[i] - courante) * facteur + courante
        sortie[i] = courante
    return sortie


def rsi(valeurs: Sequence[float], periode: int = 14) -> list[float | None]:
    """RSI de Wilder — lissage exponentiel de facteur 1/période, pas une
    moyenne simple. Les deux variantes circulent ; celle de Wilder est la
    référence, et l'écart entre les deux atteint six points en tendance,
    c'est-à-dire la largeur d'une zone de survente."""

    sortie: list[float | None] = [None] * len(valeurs)
    if len(valeurs) <= periode:
        return sortie

    gains = 0.0
    pertes = 0.0
    for i in range(1, periode + 1):
        ecart = valeurs[i] - valeurs[i - 1]
        gains += max(ecart, 0.0)
        pertes += max(-ecart, 0.0)
    gain_moyen = gains / periode
    perte_moyenne = pertes / periode
    sortie[periode] = _rsi_depuis(gain_moyen, perte_moyenne)

    for i in range(periode + 1, len(valeurs)):
        ecart = valeurs[i] - valeurs[i - 1]
        gain_moyen = (gain_moyen * (periode - 1) + max(ecart, 0.0)) / periode
        perte_moyenne = (perte_moyenne * (periode - 1) + max(-ecart, 0.0)) / periode
        sortie[i] = _rsi_depuis(gain_moyen, perte_moyenne)
    return sortie


def _rsi_depuis(gain: float, perte: float) -> float:
    if perte == 0.0:
        return 100.0 if gain > 0 else 50.0
    force = gain / perte
    return 100.0 - 100.0 / (1.0 + force)


def atr(bougies: Sequence[Bougie], periode: int = 14) -> list[float | None]:
    """Average True Range, lissage de Wilder.

    Sert au dimensionnement de position et au stop dynamique. Un stop posé à un
    pourcentage fixe traite Bitcoin et une pépite de la même façon, ce qui
    revient à sortir systématiquement trop tôt de l'un et trop tard de l'autre.
    """

    sortie: list[float | None] = [None] * len(bougies)
    if len(bougies) <= periode:
        return sortie

    tr: list[float] = [bougies[0].haut - bougies[0].bas]
    for i in range(1, len(bougies)):
        precedente = bougies[i - 1].cloture
        courante = bougies[i]
        tr.append(
            max(
                courante.haut - courante.bas,
                abs(courante.haut - precedente),
                abs(courante.bas - precedente),
            )
        )

    courant = sum(tr[1 : periode + 1]) / periode
    sortie[periode] = courant
    for i in range(periode + 1, len(bougies)):
        courant = (courant * (periode - 1) + tr[i]) / periode
        sortie[i] = courant
    return sortie


# En deçà, le profil décrit le bruit et non le marché.
MINIMUM_PROFIL = 20


@dataclass(frozen=True, slots=True)
class ProfilVolume:
    """Profil de volume par tranche de prix.

    `poc` est le prix où le plus de volume s'est échangé — le niveau que le
    marché considère comme juste. `zone_valeur` encadre 70 % du volume : sous
    sa borne basse, on achète dans une zone que le marché a désertée, ce qui
    est exactement le creux que le DCA dynamique cherche.
    """

    poc: float
    zone_valeur_basse: float
    zone_valeur_haute: float
    tranches: tuple[tuple[float, float], ...]

    def position(self, prix: float) -> float:
        """Où se situe un prix dans la zone de valeur, de 0 (borne basse) à 1
        (borne haute). Peut sortir des bornes, et c'est l'information utile."""

        etendue = self.zone_valeur_haute - self.zone_valeur_basse
        if etendue <= 0:
            return 0.5
        return (prix - self.zone_valeur_basse) / etendue


def profil_volume(bougies: Sequence[Bougie], tranches: int = 24) -> ProfilVolume | None:
    """Répartit le volume sur des tranches de prix.

    Approximation assumée : le volume d'une bougie est réparti uniformément
    entre son bas et son haut. Le vrai profil demanderait les échanges au tick,
    que les API gratuites ne donnent pas. L'écart sur le POC mesuré contre un
    profil au tick tient dans une tranche — assez pour situer un prix, pas pour
    poser un ordre dessus, et le système ne s'en sert que pour situer.
    """

    # Vingt bougies au minimum : un profil de volume sur cinq bougies ne
    # décrit rien, et rendrait pourtant une note au scoring — une note tirée du
    # bruit, qui pèserait autant qu'un RSI calculé sur deux cents bougies.
    if len(bougies) < MINIMUM_PROFIL or tranches < 2:
        return None
    bas = min(b.bas for b in bougies)
    haut = max(b.haut for b in bougies)
    if haut <= bas:
        return None

    largeur = (haut - bas) / tranches
    poids = [0.0] * tranches
    for bougie in bougies:
        depart = max(0, min(tranches - 1, int((bougie.bas - bas) / largeur)))
        arrivee = max(0, min(tranches - 1, int((bougie.haut - bas) / largeur)))
        touchees = arrivee - depart + 1
        part = bougie.volume / touchees
        for indice in range(depart, arrivee + 1):
            poids[indice] += part

    centres = [bas + largeur * (i + 0.5) for i in range(tranches)]
    indice_poc = max(range(tranches), key=lambda i: poids[i])

    # Zone de valeur : on part du POC et on absorbe la tranche voisine la plus
    # chargée jusqu'à couvrir 70 % du volume. C'est la construction classique,
    # et elle donne une zone asymétrique — ce qu'elle doit être.
    total = sum(poids)
    cible = total * 0.70
    basse = haute = indice_poc
    cumul = poids[indice_poc]
    while cumul < cible and (basse > 0 or haute < tranches - 1):
        gauche = poids[basse - 1] if basse > 0 else -1.0
        droite = poids[haute + 1] if haute < tranches - 1 else -1.0
        if droite >= gauche:
            haute += 1
            cumul += poids[haute]
        else:
            basse -= 1
            cumul += poids[basse]

    return ProfilVolume(
        poc=centres[indice_poc],
        zone_valeur_basse=bas + largeur * basse,
        zone_valeur_haute=bas + largeur * (haute + 1),
        tranches=tuple(zip(centres, poids)),
    )


def cote_z_volume(volumes: Sequence[float], periode: int = 20) -> float | None:
    """De combien d'écarts-types le dernier volume dépasse sa moyenne récente.

    C'est le détecteur de pépites en une ligne : un jeton dont le volume passe
    à trois écarts-types au-dessus de sa moyenne vient d'être découvert par
    quelqu'un. La moyenne exclut la dernière bougie, sinon elle se contamine
    elle-même et un pic de volume abaisse sa propre cote.
    """

    if len(volumes) < periode + 1:
        return None
    fenetre = volumes[-(periode + 1) : -1]
    moyenne = sum(fenetre) / periode
    variance = sum((v - moyenne) ** 2 for v in fenetre) / periode
    ecart = variance ** 0.5
    if ecart <= 0:
        return None
    return (volumes[-1] - moyenne) / ecart


def variation(valeurs: Sequence[float], bougies_en_arriere: int) -> float | None:
    """Variation relative sur N bougies. Rend `None` plutôt que 0.0 quand la
    série est trop courte — un 0.0 se confondrait avec « marché plat », et le
    coupe-circuit lit précisément ce nombre."""

    if len(valeurs) <= bougies_en_arriere:
        return None
    reference = valeurs[-1 - bougies_en_arriere]
    if reference == 0:
        return None
    return (valeurs[-1] - reference) / reference


@dataclass(frozen=True, slots=True)
class Lecture:
    """Tout ce que l'analyse technique sait dire d'une série, en un objet.

    Chaque champ vaut `None` quand la série est trop courte pour lui. Le
    scoring lit ces `None` et redistribue — il ne les remplace pas par une
    valeur neutre, qui serait un signal inventé.
    """

    prix: float
    rsi: float | None
    ema_courte: float | None
    ema_moyenne: float | None
    ema_longue: float | None
    atr: float | None
    cote_z_volume: float | None
    profil: ProfilVolume | None
    variation_1: float | None
    variation_6: float | None

    @property
    def sous_ema_longue(self) -> bool | None:
        if self.ema_longue is None:
            return None
        return self.prix < self.ema_longue

    @property
    def sous_ema_moyenne(self) -> bool | None:
        if self.ema_moyenne is None:
            return None
        return self.prix < self.ema_moyenne

    @property
    def tendance_haussiere(self) -> bool | None:
        """Empilement classique : courte au-dessus de moyenne au-dessus de
        longue. Sans les trois, on ne tranche pas."""

        if None in (self.ema_courte, self.ema_moyenne, self.ema_longue):
            return None
        return self.ema_courte > self.ema_moyenne > self.ema_longue  # type: ignore[operator]


def lire(serie: SerieOHLCV, *, rsi_periode: int = 14, courte: int = 21,
         moyenne: int = 50, longue: int = 200, volume_periode: int = 20,
         atr_periode: int = 14) -> Lecture:
    """Calcule tout en une passe. Un seul point d'entrée pour que le scoring et
    la gestion du risque lisent exactement les mêmes nombres — deux calculs
    séparés finissent toujours par diverger d'une période."""

    clotures = serie.clotures
    volumes = serie.volumes
    return Lecture(
        prix=serie.dernier_prix,
        rsi=rsi(clotures, rsi_periode)[-1],
        ema_courte=ema(clotures, courte)[-1],
        ema_moyenne=ema(clotures, moyenne)[-1],
        ema_longue=ema(clotures, longue)[-1],
        atr=atr(serie.bougies, atr_periode)[-1],
        cote_z_volume=cote_z_volume(volumes, volume_periode),
        profil=profil_volume(serie.bougies),
        variation_1=variation(clotures, 1),
        variation_6=variation(clotures, 6),
    )
