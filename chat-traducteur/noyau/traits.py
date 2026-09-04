"""Hauteur et durée d'une vocalisation — bibliothèque standard pure.

Ce module existe parce qu'un référentiel de miaulements classe par **hauteur et
durée**, deux grandeurs qui se mesurent sur le signal sans modèle entraîné.
C'est la seule voie ouverte vers l'étage 2 tant qu'aucun jeu d'étiquettes n'est
disponible.

Trois choses ont été mesurées le 03/09/2026 sur les premiers enregistrements
réels, et chacune interdit une implémentation naïve :

1. **L'autocorrélation ne sait pas ce qu'elle écoute.** Sur une vidéo portant
   une bande-son, elle rend 300 à 500 Hz avec une confiance de 0,8 pendant cinq
   secondes — c'est l'accordéon. D'où la règle qui tient tout ce module : on ne
   mesure **que dans les fenêtres que la porte a reconnues félines**. La
   hauteur n'est jamais calculée sur un fichier entier.

2. **Un ronronnement vit sous le plancher de silence.** Mesuré à 0,006 de RMS
   là où le seuil habituel est 0,01 — et ce sont précisément les fenêtres que
   YAMNet nomme `Purr` à 1,00. Un filtre d'énergie écarterait le son le mieux
   identifié du lot. Le plancher est donc très bas, et c'est la porte qui
   décide de la pertinence, jamais le niveau.

3. **Une autocorrélation qui échoue ne le dit pas, elle se colle à la borne.**
   Plusieurs mesures rendaient exactement `fmax`. Un résultat à la borne est
   donc rejeté explicitement : mieux vaut « hauteur inconnue » qu'un nombre
   faux qui a l'air juste.
"""

from dataclasses import dataclass

FREQUENCE = 16_000

# Bornes de recherche. Un miaulement de chat domestique vit entre 300 et
# 900 Hz ; un ronronnement descend vers 25 Hz mais son fondamental est hors
# de portée d'une autocorrélation sur 200 ms, et on ne cherche pas à le
# mesurer — YAMNet le nomme déjà.
F_MIN, F_MAX = 120.0, 1400.0

# En dessous, l'autocorrélation n'a rien trouvé de périodique : c'est du bruit,
# du souffle ou du silence. Relevé sur les vraies mesures, les vocalisations
# nettes tiennent entre 0,71 et 0,89.
CONFIANCE_MIN = 0.55

# Frontière aigu / grave, en hertz. Le référentiel oppose « aigu » et
# « grave » sans donner de nombre — il n'y en a pas dans une vidéo. 400 Hz est
# posé ici comme **hypothèse déclarée**, au milieu de ce qui a été observé :
# le bâillement grave du chat d'Erwann tient entre 150 et 270 Hz, ses
# vocalisations claires entre 300 et 500 Hz.
#
# Ce nombre n'est pas mesuré sur un corpus étiqueté, et il ne doit pas être
# lu comme s'il l'était. C'est le premier réglage que de vrais enregistrements
# annotés devront confirmer ou déplacer.
FRONTIERE_AIGU = 400.0

# Frontière court / long, en secondes. Même statut : hypothèse déclarée — mais
# elle ne porte pas la même charge que la précédente, et la transcription de la
# source, relue le 04/09/2026, l'a rendu visible.
#
# Les deux premiers types du référentiel sont **aigus tous les deux** : seule la
# durée les sépare. Ce nombre-ci décide donc à lui seul entre « il demande
# quelque chose » et « il te dit bonjour », là où `FRONTIERE_AIGU` ne fait que
# détacher l'alerte. À corpus annoté égal, c'est celui des deux qu'il faut
# mesurer en premier.
FRONTIERE_LONG = 0.7


@dataclass(frozen=True)
class Traits:
    """Ce qu'on a pu mesurer d'une vocalisation, et ce qu'on n'a pas pu.

    `hauteur` vaut `None` quand aucune fenêtre n'a donné de mesure fiable —
    cas normal sur un ronronnement, dont le fondamental est hors de portée.
    Un appelant qui traite `None` comme zéro fabriquerait un « grave » à
    partir d'une absence de mesure.
    """

    hauteur: float | None      # hertz, médiane des fenêtres fiables
    duree: float               # secondes de vocalisation féline continue
    mesures_fiables: int       # combien de fenêtres ont vraiment répondu

    @property
    def aigu(self) -> bool | None:
        if self.hauteur is None:
            return None
        return self.hauteur >= FRONTIERE_AIGU

    @property
    def long(self) -> bool:
        return self.duree >= FRONTIERE_LONG


def hauteur_bloc(bloc: list[float], frequence: int = FREQUENCE) -> tuple[float | None, float]:
    """Fondamentale d'un bloc par autocorrélation. Rend `(hertz, confiance)`.

    Rend `(None, confiance)` quand le maximum tombe **sur une borne** de la
    plage cherchée : c'est la signature d'un échec, pas d'un résultat. Voir le
    point 3 du bloc de tête.
    """
    n = len(bloc)
    if n < 256:
        return None, 0.0
    moyenne = sum(bloc) / n
    centre = [v - moyenne for v in bloc]
    energie = sum(v * v for v in centre)
    if energie < 1e-9:
        return None, 0.0

    tau_min = max(2, int(frequence / F_MAX))
    tau_max = min(int(frequence / F_MIN), n // 2)
    if tau_max <= tau_min + 1:
        return None, 0.0

    # Un échantillon sur quatre : la fondamentale d'un miaulement est bien
    # en dessous de Nyquist, et cela divise le coût par quatre sans rien
    # changer au résultat — vérifié sur les fichiers réels.
    meilleur_tau, meilleure = tau_min, -1.0
    for tau in range(tau_min, tau_max):
        somme = sum(centre[i] * centre[i + tau] for i in range(0, n - tau, 4))
        note = somme / (energie / 4)
        if note > meilleure:
            meilleure, meilleur_tau = note, tau

    if meilleur_tau <= tau_min or meilleur_tau >= tau_max - 1:
        return None, meilleure          # collé à une borne : échec
    return frequence / meilleur_tau, meilleure


def traits_vocalisation(
    echantillons: list[float],
    fenetres_felines: list[bool],
    taille_fenetre: int,
    pas: int,
) -> Traits:
    """Mesure hauteur et durée **dans les seules fenêtres félines**.

    `fenetres_felines` vient de la porte : c'est elle qui sait ce qui est un
    chat, et ce module ne le devine pas. Passer une liste toute vraie revient
    à mesurer la bande-son, ce que le point 1 du bloc de tête interdit.
    """
    hauteurs: list[float] = []
    for i, feline in enumerate(fenetres_felines):
        if not feline:
            continue
        debut = i * pas
        bloc = echantillons[debut:debut + taille_fenetre]
        f0, confiance = hauteur_bloc(bloc)
        if f0 is not None and confiance >= CONFIANCE_MIN:
            hauteurs.append(f0)

    # La durée est celle de la **plus longue suite continue** de fenêtres
    # félines, pas leur total : deux miaulements séparés par cinq secondes de
    # silence ne font pas une vocalisation longue.
    plus_longue = courante = 0
    for feline in fenetres_felines:
        courante = courante + 1 if feline else 0
        plus_longue = max(plus_longue, courante)
    duree = (plus_longue * pas + (taille_fenetre - pas)) / FREQUENCE if plus_longue else 0.0

    if not hauteurs:
        return Traits(None, duree, 0)
    hauteurs.sort()
    milieu = len(hauteurs) // 2
    mediane = (hauteurs[milieu] if len(hauteurs) % 2
               else (hauteurs[milieu - 1] + hauteurs[milieu]) / 2)
    return Traits(mediane, duree, len(hauteurs))
