#!/usr/bin/env python3
"""Palette de bruitages synthétisés, et le plan qui les pose sur une vidéo.

Aucun fichier de son n'est importé : chaque bruitage est fabriqué, donc réglable
par ses paramètres plutôt que choisi dans une banque — et rien à versionner, à
licencier ou à retrouver dans six mois.

La palette est ici, le **montage est dans un fichier JSON** (voir
`references/plan-exemple.json`) : d'une vidéo à l'autre, seuls les instants et
les gains changent, et les réécrire en Python obligerait à toucher au code à
chaque clip.

Une première version a été rejetée à l'écoute : « que des cloches et des bruits
de vague ».
Le diagnostic était juste, et il portait sur la méthode, pas sur les réglages.
Trois décisions en découlent, et ce sont elles qui font la différence entre un
dragon mécanique et une plage un dimanche.

1. **Un métal frappé n'a pas de traîne.** Des partiels inharmoniques qui
   sonnent une seconde et demie, c'est la définition d'une cloche. Les mêmes
   partiels éteints en un quart de seconde, avec les aigus qui meurent avant les
   graves, deviennent un choc sur de l'acier. Seule la durée change.

2. **Une modulation régulière fabrique du ressac.** Du bruit filtré dont
   l'amplitude suit une sinusoïde, l'oreille l'entend comme une vague — c'est
   littéralement ce qu'est une vague. Le feu, l'électricité et la pierre sont
   irréguliers : ici les enveloppes viennent de marches aléatoires et de
   trains d'impulsions, jamais d'un oscillateur lent.

3. **Le poids vient de la saturation, pas du niveau.** Un sinus grave monté
   fort reste inaudible sur un téléphone, qui ne restitue rien sous ~400 Hz.
   Passé dans une tangente hyperbolique, il fabrique ses propres harmoniques :
   la frappe s'entend sur le petit haut-parleur *et* garde son poids au casque.
   Les deux couches se partagent le niveau demandé — les additionner ferait
   pomper le mixage à chaque impact.
"""

from __future__ import annotations

import numpy
from scipy import signal as filtres

TAUX = 48000


def secondes(n: float) -> int:
    return int(n * TAUX)


def _bande(signal_entrant, bas, haut, ordre=4):
    sos = filtres.butter(ordre, [bas, haut], btype="bandpass", fs=TAUX, output="sos")
    return filtres.sosfilt(sos, signal_entrant)


def _bas(signal_entrant, coupure, ordre=4):
    sos = filtres.butter(ordre, coupure, btype="lowpass", fs=TAUX, output="sos")
    return filtres.sosfilt(sos, signal_entrant)


def _haut(signal_entrant, coupure, ordre=4):
    sos = filtres.butter(ordre, coupure, btype="highpass", fs=TAUX, output="sos")
    return filtres.sosfilt(sos, signal_entrant)


def porter_sur_telephone(signal_entrant, poids=1.0, plancher=400.0):
    """Rend un grave audible sur un haut-parleur qui ne le restitue pas.

    Un haut-parleur de téléphone ne descend pas sous ~400 Hz. Un bruitage dont
    toute l'énergie vit en dessous n'est pas « plus discret » sur l'appareil où
    le format court est regardé : il est **absent**. Mesuré sur la palette de ce
    fichier, le grondement tombait à −60 dB une fois filtré comme le fait un
    téléphone — rien ne passait.

    La parade est celle du mastering, et elle est déjà éprouvée dans le studio
    Amorce (`src/lib/sfx.ts`, fonction `impact`) : on ne remonte pas le grave,
    on lui **fabrique ses harmoniques**. Un redressement suivi d'une saturation
    douce engendre les partiels 2f, 3f, 4f… du contenu grave ; eux passent, et
    l'oreille reconstruit le fondamental manquant — c'est le phénomène de la
    fondamentale absente. Le son garde son poids sur une enceinte, et existe
    enfin sur un téléphone.

    Le point qui a coûté un débogage dans Amorce, et qu'on répète ici : **les
    deux couches se partagent le niveau demandé, elles ne s'y ajoutent pas.**
    Les additionner faisait grimper la crête d'un tiers, et le limiteur commun,
    en l'écrasant, faisait plonger tout le reste du mixage à chaque frappe — on
    entendait la musique pomper au rythme des impacts.

    `poids` dose les harmoniques face au signal propre : 0 les supprime, 1 les
    met à parité, au-delà le son devient agressif avant d'être plus audible.
    """
    grave = _bas(signal_entrant, plancher)
    if numpy.max(numpy.abs(grave)) < 1e-6:
        return signal_entrant          # rien à porter : le son est déjà en haut

    # Le redressement double la fréquence et crée les harmoniques paires ; la
    # tangente hyperbolique ajoute les impaires et borne la sortie. Les deux
    # ensemble donnent un spectre riche plutôt qu'un simple bourdon à 2f.
    excite = numpy.tanh(3.0 * numpy.abs(grave) - 0.5 * numpy.mean(numpy.abs(grave)))
    # On ne garde que ce qu'un téléphone restitue vraiment : au-dessus du
    # plancher, et sous 4 kHz où sa membrane cesse d'être efficace.
    excite = _bande(excite, plancher, 4000.0)

    crete = numpy.max(numpy.abs(excite))
    if crete > 0:
        excite *= numpy.max(numpy.abs(grave)) / crete

    part = 1.0 / (1.0 + poids)
    return signal_entrant * part + excite * part * poids


def _irregulier(n, lissage, graine):
    """Une marche aléatoire lissée, entre 0 et 1. Le contraire d'un oscillateur.

    C'est cette fonction qui sépare le feu de la vague : une flamme ne respire
    pas en cadence.
    """
    generateur = numpy.random.default_rng(graine)
    brut = generateur.normal(0, 1, n)
    lisse = _bas(brut, lissage)
    lisse -= lisse.min()
    return lisse / (lisse.max() + 1e-9)


def boom(duree: float, hauteur: float, graine: int) -> numpy.ndarray:
    """Une frappe lourde : claquement, corps saturé, et coup de médium.

    Le glissando descendant du corps est ce qui fait entendre « masse » ; le
    claquement est ce qui la fait exister sur un téléphone, où le corps seul
    serait simplement absent.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    # Le claquement s'éteignait en onze millisecondes : à cette durée l'oreille
    # entend un clic et non une frappe, et c'est la seule couche que le petit
    # haut-parleur restitue vraiment. Porté à quatre-vingt-dix millisecondes et
    # d'un sixième à un tiers du mélange, il fait tomber la perte téléphone de
    # 12,0 à 10,3 dB sur une frappe courte, de 15,9 à 13,6 sur une longue —
    # mesuré sur six réglages, celui-ci est le meilleur avant que la frappe ne
    # cesse de sonner comme une masse.
    claquement = _haut(generateur.normal(0, 1, n), 1800) * numpy.exp(-40 * t)
    frequence = hauteur * (2.4 * numpy.exp(-9 * t) + 0.55)
    corps = numpy.tanh(2.6 * numpy.sin(2 * numpy.pi * numpy.cumsum(frequence) / TAUX))
    corps *= numpy.exp(-3.4 * t / duree)
    coup = _bande(generateur.normal(0, 1, n), 160, 520) * numpy.exp(-15 * t)

    # Sans ce passage, tout ce qui précède est inaudible sur un
    # téléphone : l'énergie de ce bruitage vit sous les 400 Hz.
    return porter_sur_telephone((0.44 * corps + 0.22 * coup + 0.34 * claquement) * 1.25, poids=1.0)


def choc_metal(duree: float, fondamentale: float, graine: int) -> numpy.ndarray:
    """De l'acier frappé. Les partiels s'éteignent vite, les aigus les premiers.

    Même empilement inharmonique qu'une cloche : c'est l'amortissement qui les
    sépare. Au-delà d'une demi-seconde de traîne, on retombe sur le carillon
    qui a fait rejeter la première version.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    son = numpy.zeros(n)
    for rapport in (1.0, 1.71, 2.37, 3.14, 4.21, 5.62, 7.09):
        detune = 1 + generateur.normal(0, 0.004)
        # Une chute d'un demi-ton à l'attaque : c'est ce que fait un objet dont
        # la tension retombe, et ça retire tout ce qui restait de « musical ».
        glissement = 1 + 0.06 * numpy.exp(-60 * t)
        partiel = numpy.sin(2 * numpy.pi * fondamentale * rapport * detune
                            * numpy.cumsum(glissement) / TAUX)
        son += partiel * numpy.exp(-(11 + rapport * 4.5) * t) / (1 + rapport * 0.7)

    morsure = _bande(generateur.normal(0, 1, n), 2600, 9000) * numpy.exp(-90 * t)
    return numpy.tanh(1.7 * son) * 0.8 + morsure * 0.45


def grondement(duree: float, graine: int) -> numpy.ndarray:
    """Le lit de lave : masse grave dont l'intensité varie sans cadence."""
    n = secondes(duree)
    generateur = numpy.random.default_rng(graine)
    masse = _bas(generateur.normal(0, 1, n), 95)
    # Sans ce passage, tout ce qui précède est inaudible sur un
    # téléphone : l'énergie de ce bruitage vit sous les 400 Hz.
    return porter_sur_telephone(masse * (0.35 + 0.65 * _irregulier(n, 0.7, graine + 1)) * 3.0, poids=0.9)


def crepitement(duree: float, densite: float, graine: int) -> numpy.ndarray:
    """Des braises : un train d'impulsions courtes, réparties au hasard.

    Générer du bruit et le filtrer donnerait un sifflement continu — donc, à
    nouveau, du ressac. Ce qui fait le feu, ce sont les silences entre les
    éclats autant que les éclats.
    """
    n = secondes(duree)
    generateur = numpy.random.default_rng(graine)
    piste = numpy.zeros(n)
    combien = int(duree * densite)
    positions = generateur.integers(0, max(1, n - 2400), combien)
    for position in positions:
        longueur = generateur.integers(240, 1400)
        t = numpy.arange(longueur) / TAUX
        eclat = generateur.normal(0, 1, longueur) * numpy.exp(-generateur.uniform(90, 400) * t)
        piste[position:position + longueur] += eclat * generateur.uniform(0.25, 1.0)
    return _bande(piste, 900, 7000) * 1.6


def montee(duree: float, graine: int, descendante: bool = False) -> numpy.ndarray:
    """Une montée de tension : une hauteur qui grimpe, pas un souffle qui passe.

    C'est la partie tonale qui fait lire « il va se passer quelque chose ». Du
    bruit seul, si bien balayé soit-il, s'entend comme du vent — ou comme la mer.
    """
    n = secondes(duree)
    t = numpy.linspace(0, 1, n, endpoint=False)
    trajet = (1 - t) if descendante else t
    generateur = numpy.random.default_rng(graine)

    frequence = 90 * (11 ** trajet) * (1 + 0.02 * numpy.sin(2 * numpy.pi * 5.5 * t * duree))
    phase = 2 * numpy.pi * numpy.cumsum(frequence) / TAUX
    dents = sum(numpy.sin(rang * phase) / rang for rang in (1, 2, 3, 4, 5))

    # Le bruit est filtré par tranches : un filtre dont la bande suit la hauteur
    # colle au geste, là où une bande fixe le laisse traîner derrière.
    souffle = generateur.normal(0, 1, n)
    tranches = 40
    decoupe = numpy.array_split(numpy.arange(n), tranches)
    filtre = numpy.zeros(n)
    for index, tranche in enumerate(decoupe):
        centre = 400 * (14 ** trajet[tranche[0]])
        filtre[tranche] = _bande(souffle[tranche], max(120, centre * 0.55),
                                 min(18000, centre * 1.8))

    forme = numpy.exp(3.2 * (trajet - 1))
    return (0.5 * dents + 0.5 * filtre) * forme * 1.3


def electricite(duree: float, graine: int) -> numpy.ndarray:
    """Une décharge : du bruit haché irrégulièrement, pas un sifflement."""
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    porte = (generateur.random(n) > 0.62).astype(float)
    porte = _bas(porte, 5200)
    crepite = _bande(generateur.normal(0, 1, n) * porte, 1400, 11000)
    arc = numpy.sin(2 * numpy.pi * numpy.cumsum(2600 * numpy.exp(-11 * t)) / TAUX)
    return (crepite * 0.9 + arc * 0.25) * numpy.exp(-6.5 * t / duree) * 1.1


def rugissement(duree: float, graine: int) -> numpy.ndarray:
    """Le cri du dragon : modulation de fréquence saturée, plus un souffle rauque.

    Un growl n'est pas une note tenue : c'est un timbre qui se déchire. La
    modulation à vingt-trois hertz place la rugosité juste sous le seuil où
    l'oreille entend encore des battements séparés — au-dessus, ça redevient un
    accord ; en dessous, un moteur.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    enveloppe = numpy.minimum(1.0, t / 0.18) * numpy.exp(-2.1 * t / duree)
    index = 9.0 * numpy.minimum(1.0, t / 0.25)
    modulante = numpy.sin(2 * numpy.pi * 23.0 * t)
    porteuse = 62.0 * (1 + 0.35 * numpy.exp(-1.6 * t))
    phase = 2 * numpy.pi * numpy.cumsum(porteuse * (1 + index * modulante / 14)) / TAUX
    gorge = numpy.tanh(3.4 * numpy.sin(phase))

    # Le souffle suit l'ouverture de la gueule : sa bande monte avec le cri.
    souffle = _bande(generateur.normal(0, 1, n), 380, 3400)
    souffle *= (0.4 + 0.6 * numpy.abs(gorge)) * _irregulier(n, 14, graine + 2)

    # Sans ce passage, tout ce qui précède est inaudible sur un
    # téléphone : l'énergie de ce bruitage vit sous les 400 Hz.
    return porter_sur_telephone((0.62 * gorge + 0.38 * souffle) * enveloppe * 1.35, poids=0.8)


def nappe_sombre(duree: float, fondamentale: float, graine: int) -> numpy.ndarray:
    """Le lit : trois voix, sourdes, et volontairement immobiles.

    Deux ondulations lentes ont été retirées après mesure, parce que ce sont
    elles qui restaient entendues comme du ressac :

    - **Le désaccord était proportionnel** (±0,4 %), donc à 41 Hz il produisait
      un battement de 0,16 Hz — un gonflement toutes les six secondes, soit
      exactement le rythme d'une vague. Les écarts sont désormais fixes en hertz
      et rapides : le battement devient une rugosité de timbre.
    - **Le filtre balayait cinq cents hertz** au gré d'une marche aléatoire très
      lente. Un lit sonore doit tenir la pièce sans bouger ; ce qui bouge, ce
      sont les bruitages posés dessus.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    son = numpy.zeros(n)
    for ecart_hz in (-1.4, 0.0, 0.9):
        phase = 2 * numpy.pi * (fondamentale + ecart_hz) * t
        son += sum(numpy.sin(rang * phase) / (rang ** 1.4) for rang in (1, 2, 3, 4, 6))
    ouverture = 320 + 150 * _irregulier(n, 1.3, graine)
    tranches = numpy.array_split(numpy.arange(n), 24)
    filtre = numpy.zeros(n)
    for tranche in tranches:
        filtre[tranche] = _bas(son[tranche], float(ouverture[tranche[0]]))
    # Sans ce passage, tout ce qui précède est inaudible sur un
    # téléphone : l'énergie de ce bruitage vit sous les 400 Hz.
    return porter_sur_telephone(filtre * 0.42, poids=0.6)


def reverberation(entree, duree, melange, graine):
    """Réverbération par convolution rapide sur une réponse fabriquée."""
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    reponse = numpy.random.default_rng(graine).normal(0, 1, n) * numpy.exp(-5.0 * t / duree)
    reponse = _bas(reponse, 2800)
    reponse[0] += 1.0
    humide = filtres.fftconvolve(entree, reponse)[:entree.size]
    humide *= numpy.max(numpy.abs(entree)) / (numpy.max(numpy.abs(humide)) + 1e-9)
    return (1 - melange) * entree + melange * humide


def poser(piste, son, instant, gain):
    debut = secondes(instant)
    fin = min(piste.size, debut + son.size)
    if debut < piste.size:
        piste[debut:fin] += son[:fin - debut] * gain


def souffle(duree: float, graine: int, montant: bool = True) -> numpy.ndarray:
    """Un passage d'air — le son qui accompagne une coupe ou un mouvement.

    C'est le manque le plus criant d'une palette de format court : sans lui,
    chaque coupe est un trou. Ce n'est pas un bruit blanc en fondu, mais une
    **bande qui se déplace** — l'oreille lit ce déplacement comme un objet qui
    passe, et c'est lui qui fait la transition, pas le volume.

    `montant` décide du sens : vers l'aigu pour entrer dans un plan, vers le
    grave pour en sortir. Les deux ensemble sur une même coupe la surchargent.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    base = generateur.normal(0, 1, n)

    # La bande balaie deux octaves et demie. Un balayage plus large sonne comme
    # un effet ; plus étroit, on n'entend qu'un souffle sourd.
    progression = t / max(duree, 1e-6)
    if not montant:
        progression = 1.0 - progression
    piste = numpy.zeros(n)
    # Trois tranches successives plutôt qu'un filtre variable : scipy ne sait pas
    # faire varier un butterworth dans le temps, et le découpage s'entend moins
    # qu'un filtre recalculé à chaque échantillon ne coûte.
    for part in range(6):
        d, fin = int(n * part / 6), int(n * (part + 1) / 6)
        centre = 320.0 * (2.0 ** (2.5 * progression[(d + fin) // 2]))
        piste[d:fin] = _bande(base, centre * 0.62, centre * 1.7)[d:fin]

    # Une enveloppe en cloche : le passage culmine au milieu, pas à la fin.
    cloche = numpy.exp(-((progression - 0.55) ** 2) / 0.055)
    return piste * cloche * 1.5


def eclat(duree: float, graine: int, densite: float = 90.0) -> numpy.ndarray:
    """Quelque chose qui vole en morceaux : un corps grave, puis des éclats.

    Deux couches, et l'ordre compte. Le corps grave donne la masse de ce qui
    casse ; les éclats brillants donnent le nombre de morceaux. L'un sans
    l'autre donne soit un coup sourd, soit une pluie de verre sans poids.

    Les éclats se raréfient au fil du temps — c'est ce qui distingue un objet
    qui explose d'une averse. `densite` compte les éclats par seconde au départ.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    corps = numpy.sin(2 * numpy.pi * numpy.cumsum(78 * numpy.exp(-5.5 * t)) / TAUX)
    corps *= numpy.exp(-7.0 * t / duree)

    eclats = numpy.zeros(n)
    instant = 0.0
    while instant < duree:
        # L'intervalle s'allonge : la pluie de morceaux s'espace en retombant.
        instant += generateur.exponential(1.0 / max(densite * (1 - instant / duree) ** 2, 4.0))
        d = int(instant * TAUX)
        if d >= n:
            break
        longueur = min(int(0.05 * TAUX), n - d)
        grain = generateur.normal(0, 1, longueur)
        grain *= numpy.exp(-numpy.linspace(0, 6, longueur))
        eclats[d:d + longueur] += grain * generateur.uniform(0.25, 1.0)
    eclats = _bande(eclats, 1800, 12000)

    return (corps * 0.62 + eclats * 0.85) * 1.2


def carillon(duree: float, fondamentale: float, graine: int) -> numpy.ndarray:
    """Un cristal qui sonne — pour un signe qui apparaît, une rune, un éveil.

    Les partiels ne sont pas harmoniques : ce sont les rapports d'une plaque
    frappée, et c'est ce qui sépare une cloche d'un orgue. Ils s'éteignent
    d'autant plus vite qu'ils sont aigus, comme dans un vrai corps résonnant.

    À la différence de `choc_metal`, la traîne est longue : ici on veut que ça
    reste dans l'air, pas que ça frappe.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    piste = numpy.zeros(n)
    for rang, rapport in enumerate((1.0, 2.76, 5.40, 8.93, 13.34)):
        f = fondamentale * rapport
        if f > TAUX / 2.2:
            break
        phase = generateur.uniform(0, 2 * numpy.pi)
        # Les aigus meurent avant les graves : c'est la signature d'un métal.
        piste += (numpy.sin(2 * numpy.pi * f * t + phase)
                  * numpy.exp(-t * (1.1 + rang * 0.85))
                  / (1 + rang * 0.9))
    # Un souffle d'attaque très court donne le coup de mailloche.
    attaque = _haut(generateur.normal(0, 1, n), 3000) * numpy.exp(-90 * t)
    return (piste + attaque * 0.20) * 1.3


def pulsation(duree: float, graine: int, battements: float = 52.0) -> numpy.ndarray:
    """Un pouls sourd, sous une montée de tension.

    Deux coups par battement, le second plus faible et plus grave : c'est ce
    décalage qui le fait entendre comme un cœur plutôt qu'un métronome. La
    hauteur descend légèrement à chaque coup, ce qui donne la sensation d'un
    corps mou et non d'une percussion.

    À employer sous autre chose. Seul, il devient une horloge, et l'urgence
    fabriquée est précisément ce qu'on ne fait pas ici.
    """
    n = secondes(duree)
    generateur = numpy.random.default_rng(graine)
    piste = numpy.zeros(n)
    intervalle = 60.0 / max(battements, 1.0)
    instant = 0.02
    while instant < duree:
        for retard, gain, hauteur in ((0.0, 1.0, 62.0), (0.17, 0.62, 48.0)):
            d = int((instant + retard) * TAUX)
            if d >= n:
                continue
            longueur = min(int(0.30 * TAUX), n - d)
            u = numpy.arange(longueur) / TAUX
            coup = numpy.sin(2 * numpy.pi * numpy.cumsum(hauteur * numpy.exp(-9 * u)) / TAUX)
            piste[d:d + longueur] += coup * numpy.exp(-13 * u) * gain
        instant += intervalle * generateur.uniform(0.97, 1.03)
    # Mesuré sans cette ligne : -64,6 dB une fois filtré comme le fait un
    # téléphone, contre -27 en absolu. Un pouls en sinus pur n'existe tout
    # simplement pas sur l'appareil où le format court est regardé.
    return porter_sur_telephone(piste, poids=0.9) * 1.15


def souffle_tournant(duree: float, graine: int) -> numpy.ndarray:
    """Un vortex : de l'air qui tourne, et qui accélère.

    La rotation vient d'une modulation d'amplitude dont la vitesse **augmente**
    — à vitesse constante, l'oreille entend un hélicoptère ; en accélérant, elle
    entend une aspiration. C'est la seule différence entre les deux, et elle
    tient dans une ligne.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    air = _bande(generateur.normal(0, 1, n), 180, 5200)
    # La vitesse de rotation passe de 3 à 14 tours par seconde.
    vitesse = 3.0 + 11.0 * (t / max(duree, 1e-6)) ** 1.6
    rotation = 0.55 + 0.45 * numpy.sin(2 * numpy.pi * numpy.cumsum(vitesse) / TAUX)
    montee_gain = (t / max(duree, 1e-6)) ** 0.7
    return air * rotation * (0.35 + 0.65 * montee_gain) * 1.4


def respiration(duree: float, graine: int, inspire: bool = False) -> numpy.ndarray:
    """Un souffle de créature — l'expiration d'une gueule, la reprise d'air.

    Du bruit filtré sur la bande d'un conduit, avec une enveloppe asymétrique :
    une expiration monte vite et retombe lentement, une inspiration fait
    l'inverse. Inverser cette asymétrie suffit à changer ce qu'on croit
    entendre, sans toucher au timbre.
    """
    n = secondes(duree)
    t = numpy.arange(n) / max(duree * TAUX, 1e-6)
    generateur = numpy.random.default_rng(graine)
    air = _bande(generateur.normal(0, 1, n), 240, 3400)
    # Un peu de grave donne le volume d'une grande cage thoracique.
    corps = _bande(generateur.normal(0, 1, n), 70, 220) * 0.5
    forme = t ** 0.35 * numpy.exp(-2.6 * t) if not inspire else (1 - t) ** 0.35 * numpy.exp(-2.6 * (1 - t))
    return (air + corps) * forme * 1.6


def braam(duree: float, fondamentale: float, graine: int) -> numpy.ndarray:
    """Le cor de brume du film-catastrophe : une masse de cuivres désaccordés.

    Trois choses, et trois seulement, séparent un braam d'un simple accord grave
    tenu — chacune a été ajoutée après avoir manqué à l'écoute.

    1. **Le désaccord fait le nombre.** Une voix unique s'entend comme un
       synthétiseur ; six voix écartées de quelques hertz s'entendent comme une
       section. Les écarts sont fixes en hertz et non proportionnels, pour la
       raison déjà consignée dans `nappe_sombre` : un désaccord proportionnel
       produit dans le grave un battement si lent qu'il redevient du ressac.

    2. **L'attaque n'est pas un clic.** Un cuivre met une soixantaine de
       millisecondes à s'établir. Coupé plus court, le son cesse d'être un
       instrument pour devenir une porte qui claque.

    3. **La chute de hauteur à la fin** est la signature du genre. Un demi-ton
       sur le dernier tiers suffit : au-delà l'oreille entend une bande qui
       ralentit, en deçà elle n'entend rien.

    Comme tout ce qui vit sous 400 Hz ici, la sortie passe par
    `porter_sur_telephone` — sans quoi le plus massif des bruitages est celui
    qu'on entend le moins sur l'appareil où la vidéo sera regardée.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    # Le dernier tiers descend d'un demi-ton (2^(-1/12)).
    depart = numpy.clip((t / duree - 0.66) / 0.34, 0, 1)
    glissee = 2.0 ** (-depart / 12.0)

    son = numpy.zeros(n)
    for ecart_hz in (-2.7, -1.1, 0.0, 0.8, 2.2, 3.6):
        phase = 2 * numpy.pi * numpy.cumsum((fondamentale + ecart_hz) * glissee) / TAUX
        # Un cuivre est riche et impair-dominant : le rang 3 pèse plus que le 2.
        son += (numpy.sin(phase)
                + 0.55 * numpy.sin(2 * phase)
                + 0.70 * numpy.sin(3 * phase)
                + 0.34 * numpy.sin(4 * phase)
                + 0.22 * numpy.sin(5 * phase)
                + 0.14 * numpy.sin(7 * phase))
    son /= 6.0

    # Le grain d'embouchure, sans quoi la masse sonne électronique — et il pèse
    # plus qu'il n'y paraît. À 0,09 le braam mesurait 11,2 dB de perte sur un
    # haut-parleur de téléphone et réclamait au montage un gain que le plafond
    # de sécurité refusait : toute son énergie vivait sous 400 Hz. Le grain est
    # la seule couche qui y échappe, et c'est par lui que l'instrument existe
    # sur l'appareil où la vidéo sera regardée.
    souffle_air = _bande(generateur.normal(0, 1, n), 700, 5200)
    # L'embouchure crache à l'attaque puis se calme : un grain constant s'entend
    # comme un souffle de bande posé sur l'accord.
    crachement = 0.14 + 0.22 * numpy.exp(-9.0 * t / duree)
    son = son + souffle_air * crachement

    # La saturation resserre les rangs entre eux — c'est elle qui soude les six
    # voix en un seul instrument plutôt qu'un empilement.
    son = numpy.tanh(1.9 * son)

    attaque = secondes(min(0.065, duree * 0.2))
    forme = numpy.ones(n)
    forme[:attaque] = numpy.linspace(0, 1, attaque) ** 0.6
    tenue = numpy.exp(-1.15 * t / duree)
    chute = secondes(min(0.30, duree * 0.25))
    forme[-chute:] *= numpy.linspace(1, 0, chute) ** 1.5

    return porter_sur_telephone(son * forme * tenue * 0.55, poids=0.75)


def chute_sous_grave(duree: float, graine: int, depart_hz: float = 130.0) -> numpy.ndarray:
    """La chute qui suit un impact : une hauteur qui tombe sous le seuil.

    Le geste inverse de `montee`. Il tient à une exponentielle décroissante et à
    rien d'autre : une descente linéaire s'entend comme un ralenti mécanique,
    une descente exponentielle comme une masse qui tombe.

    Le fondamental finit vers 28 Hz, sous ce qu'un téléphone **et** la plupart
    des enceintes restituent. C'est voulu, et c'est pourquoi la sortie est
    excitée plus fort que le reste de la palette : ce qu'on entendra du son,
    ce sont ses harmoniques, jamais lui.
    """
    n = secondes(duree)
    t = numpy.linspace(0, 1, n, endpoint=False)
    generateur = numpy.random.default_rng(graine)

    frequence = depart_hz * numpy.exp(-numpy.log(depart_hz / 28.0) * t)
    phase = 2 * numpy.pi * numpy.cumsum(frequence) / TAUX
    son = numpy.sin(phase) + 0.28 * numpy.sin(2 * phase)

    # Un frottement discret qui suit la descente : sans lui, la chute est un
    # sinus nu, et un sinus nu ne raconte pas une masse.
    grain = _bas(generateur.normal(0, 1, n), 220) * 0.16
    forme = numpy.exp(-2.6 * t)
    return porter_sur_telephone((son + grain) * forme * 0.62, poids=1.0)


def cri_titan(duree: float, fondamentale: float, graine: int,
              dechirure: float = 1.0) -> numpy.ndarray:
    """Le cri d'un monstre de cent mètres, par la méthode qui l'a inventé.

    Le rugissement le plus célèbre du cinéma n'est pas un animal : c'est une
    **corde de contrebasse frottée avec un gant de résine**, ralentie. Le procédé
    importe plus que l'anecdote, parce qu'il explique le timbre. Un archet ne
    glisse pas sur une corde, il **accroche et décroche** des centaines de fois
    par seconde — chaque décrochage relâche la corde d'un coup. La forme d'onde
    obtenue n'est pas une sinusoïde mais une dent de scie **dont la période
    tremble**, et c'est ce tremblement qu'on entend comme un déchirement plutôt
    que comme une note.

    `rugissement` fabrique son grain par modulation de fréquence, ce qui donne un
    growl électronique convaincant mais lisse. Ici la rugosité vient de
    l'irrégularité de la période elle-même : deux mécanismes différents, deux
    familles de son. Le premier convient à une créature mécanique, le second à
    une masse organique.

    Trois choses le rendent énorme plutôt que simplement grave :

    1. **Les résonances de corps.** Une caisse de contrebasse chante à quelques
       fréquences fixes, indépendantes de la note jouée. Ce sont elles qui
       disent la taille de l'objet, et elles sont placées ici entre 180 Hz et
       1,8 kHz — au-dessus du plancher du haut-parleur de téléphone, sans quoi
       la taille ne s'entendrait que sur une enceinte.

    2. **L'attaque lente.** Un archet met deux à trois dixièmes de seconde à
       mettre la corde en régime. Une attaque immédiate rendrait le cri petit :
       c'est le temps de mise en route qui fait la masse.

    3. **La courbe de hauteur.** Le cri monte en s'ouvrant puis retombe. Plat,
       il devient une sirène.

    `dechirure` dose l'irrégularité : 0 rend une dent de scie propre — un cuivre
    synthétique —, 1 le frottement, au-delà de 1,5 le son se disloque.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    # La hauteur : montée sur le premier tiers, plateau, chute finale.
    montee = numpy.clip(t / (duree * 0.28), 0, 1)
    chute = numpy.clip((t - duree * 0.62) / (duree * 0.38), 0, 1)
    hauteur = fondamentale * (1 + 0.22 * montee - 0.30 * chute ** 1.6)
    # Un vibrato lent et irrégulier : régulier, il sonnerait chanté.
    hauteur *= 1 + 0.035 * _irregulier(n, 6.5, graine + 1)

    # L'accroche-décroche. La période tremble ; la dent de scie qui en sort est
    # le cœur du timbre, et `dechirure` en règle l'ampleur.
    tremblement = 1 + dechirure * 0.16 * _irregulier(n, 90.0, graine + 2)
    phase = numpy.cumsum(hauteur * tremblement) / TAUX
    dent = 2.0 * (phase - numpy.floor(phase)) - 1.0
    # Le relâchement n'est pas instantané : un lissage court arrondit l'angle,
    # sans quoi le son siffle au lieu de déchirer.
    dent = _bas(dent, 6500.0)

    # Les résonances de corps, fixes, qui disent la taille.
    corps = numpy.zeros(n)
    for centre, poids, largeur in ((180.0, 1.00, 0.35), (420.0, 0.72, 0.30),
                                   (900.0, 0.48, 0.28), (1800.0, 0.30, 0.26)):
        corps += poids * _bande(dent, centre * (1 - largeur), centre * (1 + largeur))
    corps /= 2.5

    # Le souffle de la gorge suit l'ouverture, et disparaît quand le cri retombe.
    ouverture = 0.35 + 0.65 * numpy.clip(montee - chute, 0, 1)
    gorge = _bande(generateur.normal(0, 1, n), 500, 4200)
    gorge *= ouverture * _irregulier(n, 22, graine + 3) * 0.5

    # L'attaque d'archet : deux dixièmes de seconde pour mettre en régime.
    attaque = numpy.clip(t / min(0.24, duree * 0.3), 0, 1) ** 1.4
    extinction = numpy.exp(-1.7 * numpy.clip(t - duree * 0.70, 0, None) / (duree * 0.30))
    forme = attaque * extinction

    melange = numpy.tanh(2.2 * (0.70 * corps + 0.30 * gorge)) * forme
    return porter_sur_telephone(melange * 1.3, poids=0.85)


def aspiration(duree: float, graine: int, tours_final: float = 26.0) -> numpy.ndarray:
    """Être aspiré : une rotation qui accélère **et** une hauteur qui monte.

    `souffle_tournant` fait déjà tourner du bruit de plus en plus vite, et cela
    suffit à dire « vortex ». Cela ne dit pas « on y tombe » — parce qu'il
    manque le seul indice que l'oreille utilise vraiment pour juger d'une
    vitesse : **le déplacement en hauteur**. Un objet qui se rapproche monte en
    fréquence, et c'est cette montée, non la rotation, qui fabrique la sensation
    de traversée.

    Trois couches, et aucune n'est décorative :

    - **la rotation**, dont la vitesse suit une exponentielle : linéaire, elle
      s'entend comme un moteur qu'on pousse ; exponentielle, comme une chute ;
    - **la hauteur**, qui grimpe de deux octaves et demie sur la durée, avec le
      creux caractéristique du passage au plus près ;
    - **le grain**, du bruit dont la bande se resserre à mesure que la vitesse
      monte — ce qui donne l'impression que le tunnel se referme.

    La sortie n'est pas excitée : tout y vit déjà au-dessus du plancher du
    haut-parleur, et l'exciter n'ajouterait que de la dureté.
    """
    n = secondes(duree)
    t = numpy.linspace(0, 1, n, endpoint=False)
    generateur = numpy.random.default_rng(graine)

    # La rotation accélère : trois tours au départ, `tours_final` à l'arrivée.
    vitesse = 3.0 * (tours_final / 3.0) ** t
    tour = numpy.sin(2 * numpy.pi * numpy.cumsum(vitesse) / TAUX)

    # La hauteur : deux octaves et demie, avec le creux du passage au plus près.
    passage = numpy.clip((t - 0.86) / 0.14, 0, 1)
    hauteur = 260.0 * (5.6 ** t) * (1 - 0.34 * passage)
    phase = 2 * numpy.pi * numpy.cumsum(hauteur) / TAUX
    corps = (numpy.sin(phase) + 0.42 * numpy.sin(2 * phase)
             + 0.24 * numpy.sin(3 * phase)) / 1.66

    # Le grain : la bande se resserre, le tunnel se referme.
    souffle = generateur.normal(0, 1, n)
    tranches = numpy.array_split(numpy.arange(n), 48)
    grain = numpy.zeros(n)
    for tranche in tranches:
        avance = t[tranche[0]]
        bas = 300 + 2600 * avance
        grain[tranche] = _bande(souffle[tranche], bas, min(17000, bas * (5.5 - 3.4 * avance)))

    # La rotation module les deux autres : c'est elle qui fait tourner l'objet
    # autour de l'auditeur plutôt que de simplement l'accompagner.
    modulation = 0.45 + 0.55 * (0.5 + 0.5 * tour)
    forme = numpy.clip(t / 0.10, 0, 1) * numpy.exp(1.4 * t) / numpy.exp(1.4)
    melange = (0.44 * corps + 0.56 * grain) * modulation * forme
    return melange / max(float(numpy.max(numpy.abs(melange))), 1e-9) * 0.86


def chute_pierres(duree: float, graine: int, densite: float = 14.0) -> numpy.ndarray:
    """Des cailloux qui tombent : des corps qui rebondissent, pas un crépitement.

    `crepitement` fabrique des braises — un train d'impulsions très brèves, sans
    hauteur. Une pierre a un **corps** : elle sonne à une fréquence qui dépend
    de sa taille, elle rebondit deux ou trois fois de plus en plus vite, et son
    timbre est mat parce que la roche amortit tout ce qui est aigu.

    Les trois s'écrivent directement : une hauteur tirée par pierre, des
    rebonds dont l'intervalle se contracte, et un passe-bas serré. Sans les
    rebonds, on entend de la grêle ; sans la hauteur, du bruit blanc haché.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)
    piste = numpy.zeros(n)

    for _ in range(int(duree * densite)):
        depart = generateur.uniform(0, duree * 0.94)
        # Une petite pierre sonne haut, une grosse bas.
        hauteur = generateur.uniform(90, 420)
        vigueur = generateur.uniform(0.35, 1.0)
        intervalle = generateur.uniform(0.11, 0.26)

        for rebond in range(generateur.integers(2, 5)):
            instant = depart + intervalle * (1 - 0.55 ** (rebond + 1)) / 0.45
            debut = int(instant * TAUX)
            if debut >= n:
                break
            longueur = min(int(0.10 * TAUX), n - debut)
            if longueur < 32:
                break
            u = numpy.arange(longueur) / TAUX
            # Le corps, plus le grain du choc. Les deux s'éteignent vite.
            corps = numpy.sin(2 * numpy.pi * hauteur * (1 + 0.4 * numpy.exp(-90 * u)) * u)
            grain = generateur.normal(0, 1, longueur) * numpy.exp(-260 * u)
            enveloppe = numpy.exp(-38 * u) * vigueur * (0.62 ** rebond)
            piste[debut:debut + longueur] += (0.6 * corps + 0.4 * grain) * enveloppe

    # La roche amortit l'aigu : sans ce filtre, ce sont des billes de verre.
    piste = _bas(piste, 3200.0)
    crete = float(numpy.max(numpy.abs(piste)))
    return piste / crete * 0.82 if crete > 0 else piste


def montee_sans_fin(duree: float, graine: int, octaves: int = 7,
                    cycle: float = 4.0) -> numpy.ndarray:
    """Le ton de Shepard : une hauteur qui monte sans jamais arriver.

    L'illusion tient a une seule idee, et elle est geometrique. On empile des
    sinusoides espacees **d'une octave exacte**, toutes montant a la meme
    vitesse. Chacune finit par sortir par le haut — mais comme une nouvelle
    entre par le bas au meme instant et que l'ensemble se repete a l'octave,
    l'oreille ne peut designer aucune voix en particulier. Elle entend donc une
    montee continue, indefiniment.

    Ce qui fait tout, c'est l'**enveloppe de volume en cloche** posee sur le
    spectre : une voix est inaudible quand elle entre en bas, atteint son
    maximum au milieu du registre, et redevient inaudible en sortant en haut.
    Sans elle, on entend les voix apparaitre et disparaitre, et l'illusion
    tombe immediatement — c'est le seul point ou une premiere version echoue.

    `octaves` fixe la hauteur de l'empilement, `cycle` la duree d'une montee
    complete d'une octave. Quatre secondes est lent et pesant ; sous deux, cela
    devient une sirene.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    piste = numpy.zeros(n)

    base = 28.0                       # la voix la plus grave au depart
    for voix in range(octaves):
        # Chaque voix part une octave au-dessus de la precedente et monte de la
        # meme quantite : leur ecart reste donc exactement d'une octave.
        avance = (t / cycle + voix / octaves) % 1.0
        hauteur = base * 2.0 ** (avance * octaves)
        phase = 2 * numpy.pi * numpy.cumsum(hauteur) / TAUX
        # La cloche, en position **logarithmique** : c'est l'oreille qui juge,
        # et elle entend les octaves, pas les hertz.
        cloche = numpy.exp(-0.5 * ((avance - 0.5) / 0.22) ** 2)
        piste += numpy.sin(phase) * cloche

    piste /= octaves
    # Un souffle qui se resserre accompagne la montee sans la designer.
    generateur = numpy.random.default_rng(graine)
    tranches = numpy.array_split(numpy.arange(n), 40)
    grain = numpy.zeros(n)
    souffle = generateur.normal(0, 1, n)
    for tranche in tranches:
        avance = t[tranche[0]] / max(duree, 1e-6)
        grain[tranche] = _bande(souffle[tranche], 400 + 2200 * avance,
                                min(17000, 2600 + 9000 * avance))
    # La tension monte aussi en volume : une montee a niveau constant s'entend
    # comme un bourdon, pas comme une menace qui approche.
    forme = numpy.clip(t / 0.25, 0, 1) * (0.35 + 0.65 * (t / max(duree, 1e-6)) ** 1.4)
    melange = (0.68 * piste + 0.32 * grain) * forme
    return porter_sur_telephone(melange * 1.2, poids=0.5)


def pas_mecanique(duree: float, graine: int, poids_tonnes: float = 1.0) -> numpy.ndarray:
    """Un pas de machine lourde : trois choses qui arrivent presque ensemble.

    Un pas n'est pas un impact. Il en contient trois, decales de quelques
    dizaines de millisecondes, et c'est ce decalage qui donne la masse :

    1. **le contact** — un claquement metallique aigu, le pied qui touche ;
    2. **la charge** — le grave qui suit quand le poids s'y transfere, un
       vingtieme de seconde plus tard ;
    3. **le sol** — une traine de gravats et de poussiere.

    Les trois au meme instant donnent une detonation ; etales, ils donnent un
    pas. `poids_tonnes` etire l'ecart et abaisse la charge : plus la bete est
    lourde, plus le grave arrive tard et bas.
    """
    n = secondes(duree)
    t = numpy.arange(n) / TAUX
    generateur = numpy.random.default_rng(graine)

    contact = _haut(generateur.normal(0, 1, n), 1500) * numpy.exp(-55 * t)

    retard = int(0.045 * poids_tonnes * TAUX)
    charge = numpy.zeros(n)
    reste = n - retard
    if reste > 0:
        u = numpy.arange(reste) / TAUX
        hauteur = (46.0 / poids_tonnes) * (1.9 * numpy.exp(-11 * u) + 0.6)
        corps = numpy.tanh(2.8 * numpy.sin(2 * numpy.pi * numpy.cumsum(hauteur) / TAUX))
        charge[retard:] = corps * numpy.exp(-5.5 * u)

    sol = _bas(generateur.normal(0, 1, n), 900) * _irregulier(n, 40, graine + 3)
    sol *= numpy.exp(-7.0 * t) * 0.5

    melange = 0.26 * contact + 0.56 * charge + 0.18 * sol
    return porter_sur_telephone(melange * 1.3, poids=1.0)


BRUITAGES = {
    "boom": boom,
    "souffle": souffle,
    "eclat": eclat,
    "carillon": carillon,
    "pulsation": pulsation,
    "souffle_tournant": souffle_tournant,
    "respiration": respiration,
    "choc_metal": choc_metal,
    "grondement": grondement,
    "crepitement": crepitement,
    "montee": montee,
    "electricite": electricite,
    "rugissement": rugissement,
    "nappe_sombre": nappe_sombre,
    "braam": braam,
    "chute_sous_grave": chute_sous_grave,
    "cri_titan": cri_titan,
    "aspiration": aspiration,
    "chute_pierres": chute_pierres,
    "montee_sans_fin": montee_sans_fin,
    "pas_mecanique": pas_mecanique,
}

# Le lit sonore par défaut. La distinction n'est pas cosmétique : la
# réverbération ne s'applique qu'aux ponctuations — posée sur le lit, elle le
# rendrait flou, et c'est lui qui tient l'ensemble.
#
# Ce n'est qu'un défaut, que chaque pose peut contredire par « couche » : le
# même crépitement est un lit de braises quand il dure huit secondes sous un
# champ de lave, et une volée de débris quand il suit un impact — le second veut
# la réverbération, le premier la refuse.
COUCHE_AMBIANCE = ("nappe_sombre", "grondement", "crepitement",
                   "souffle_tournant", "respiration", "pulsation", "braam")


def fabriquer(plan: dict) -> numpy.ndarray:
    """Rend la piste décrite par le plan.

    Un plan est un objet JSON : `duree`, `fondu_final`, et une liste `poses`
    dont chaque entrée porte un `bruitage`, un `instant`, un `gain` et les
    paramètres attendus par la fonction correspondante.
    """
    duree = float(plan["duree"])
    total = secondes(duree)
    ambiance = numpy.zeros(total)
    effets = numpy.zeros(total)

    for rang, pose in enumerate(plan["poses"]):
        nom = pose["bruitage"]
        if nom not in BRUITAGES:
            raise SystemExit(
                f"Bruitage inconnu : « {nom} ». Disponibles : {', '.join(BRUITAGES)}"
            )
        parametres = {c: v for c, v in pose.items()
                      if c not in ("bruitage", "instant", "gain", "note", "couche")}
        # La graine se déduit du rang quand elle n'est pas donnée : deux poses
        # du même bruitage au même réglage sonneraient sinon rigoureusement
        # identiques, et l'oreille entend la répétition avant le son.
        parametres.setdefault("graine", 1000 + rang * 7)
        couche = pose.get("couche", "ambiance" if nom in COUCHE_AMBIANCE else "effets")
        if couche not in ("ambiance", "effets"):
            raise SystemExit(f"Couche inconnue : « {couche} » (ambiance ou effets)")
        piste = ambiance if couche == "ambiance" else effets
        poser(piste, BRUITAGES[nom](**parametres),
              float(pose["instant"]), float(pose.get("gain", 1.0)))

    effets = reverberation(effets, float(plan.get("reverberation_s", 1.5)),
                           melange=float(plan.get("reverberation_melange", 0.28)),
                           graine=51)
    piste = ambiance * float(plan.get("gain_ambiance", 0.5)) \
        + effets * float(plan.get("gain_effets", 0.8))

    # Une descente courte à la fin : une nappe coupée net s'entend comme un
    # fichier tronqué.
    fin = secondes(float(plan.get("fondu_final", 0.4)))
    if fin:
        piste[-fin:] *= numpy.linspace(1, 0, fin)

    crete = numpy.max(numpy.abs(piste))
    return piste / crete * 0.89 if crete > 0 else piste


if __name__ == "__main__":
    import argparse
    import json
    import wave

    analyseur = argparse.ArgumentParser(
        description="Fabrique une piste de bruitages à partir d'un plan JSON.")
    analyseur.add_argument("plan", help="le plan de montage (voir references/)")
    analyseur.add_argument("sortie", help="le fichier WAV à écrire")
    options = analyseur.parse_args()

    piste = fabriquer(json.loads(open(options.plan, encoding="utf-8").read()))
    entiers = (numpy.clip(numpy.stack([piste, piste], axis=1), -1, 1) * 32767).astype("<i2")
    with wave.open(options.sortie, "wb") as fichier:
        fichier.setnchannels(2)
        fichier.setsampwidth(2)
        fichier.setframerate(TAUX)
        fichier.writeframes(entiers.tobytes())
    print(f"{options.sortie} — {piste.size / TAUX:.2f} s")
