#!/usr/bin/env python3
"""Alignement d'une voix enregistrée sur son texte.

Deux chemins, parce qu'aucun des deux ne suffit seul :

**Par les mots.** Whisper transcrit l'enregistrement et rend chaque mot reconnu
avec son minutage ; on recale ensuite le script sur cette transcription. C'est
précis au mot, mais il faut installer PyTorch et attendre le premier chargement
du modèle. La voix de synthèse (`core/synthese.py`) emprunte le même chemin sans
rien transcrire : elle sait déjà quand elle prononce quoi.

**Par les silences.** Le signal est découpé aux silences et le texte réparti sur
les passages parlés au prorata des caractères. C'est juste à la réplique près,
faux au mot près — mais c'est instantané, sans modèle ni réseau, et cela ne se
trompe jamais complètement : un enregistrement bruité fait dérailler une
transcription, pas une détection de niveau.

Le recalage du script sur la transcription mérite un mot : on n'utilise pas le
texte reconnu, seulement ses minutages. Whisper se trompe de mot, invente une
liaison, francise un nom propre ; le script, lui, est ce que l'auteur a écrit.
On aligne donc les deux suites de mots (`aligner`) et on ne retient de la
transcription que le temps.

Tout ce qui décide est pur : cela travaille sur une enveloppe de niveaux ou sur
une liste de mots minutés, jamais sur un fichier. Seules `enveloppe()` et
`transcrire()` touchent au monde extérieur, et c'est ce qui rend le reste
testable sans installer ni ffmpeg ni PyTorch.
"""

from __future__ import annotations

import importlib.util
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# Un niveau de -120 dBFS tient lieu de « silence numérique » : pydub renvoie
# -inf sur un bloc parfaitement muet, et -inf contamine toute moyenne.
SILENCE_NUMERIQUE = -120.0

PAS_MS = 20                  # finesse de l'enveloppe : une syllabe dure ~150 ms
SILENCE_MIN_MS = 300         # en deçà, c'est une respiration, pas une coupure
PASSAGE_MIN_MS = 150         # en deçà, c'est un claquement de bouche
MARGE_MS = 80                # rendue au passage : une attaque douce commence sous le seuil
LONGUEUR_MAX = 90            # caractères par réplique, au-delà l'écran est illisible
MODELE_DEFAUT = 'small'      # le plus petit modèle qui ponctue correctement le français


@dataclass(frozen=True)
class Passage:
    """Un segment parlé, en millisecondes depuis le début de l'enregistrement."""
    debut_ms: int
    fin_ms: int

    @property
    def duree_ms(self) -> int:
        return self.fin_ms - self.debut_ms


@dataclass(frozen=True)
class Mot:
    """Un mot prononcé et son minutage — qu'il vienne d'une transcription ou
    d'une voix de synthèse. C'est la monnaie commune des deux chemins."""
    texte: str
    debut_ms: int
    fin_ms: int


@dataclass(frozen=True)
class Replique:
    """Un morceau de texte et le moment où il est dit.

    `cale` dit si le minutage vient d'un mot effectivement reconnu ou s'il a été
    interpolé entre deux voisins. L'interface s'en sert pour signaler les
    passages où l'alignement a perdu le fil, plutôt que de les donner pour aussi
    sûrs que les autres.
    """
    texte: str
    debut_ms: int
    fin_ms: int
    cale: bool = True


def lire_script(contenu: str) -> list[str]:
    """Découpe un script en répliques, qu'il vienne d'un .txt ou d'un .srt.

    Un .srt déjà minuté est accepté parce que c'est le format qui traîne le plus
    souvent sur un disque : on n'en garde que le texte, les minutages étant
    précisément ce qu'on s'apprête à recalculer.
    """
    morceaux: list[str] = []
    for bloc in re.split(r'\n\s*\n', contenu.strip()):
        lignes = [
            ligne.strip()
            for ligne in bloc.splitlines()
            if ligne.strip()
            and '-->' not in ligne
            and not re.fullmatch(r'\d+', ligne.strip())
        ]
        for ligne in lignes:
            morceaux.extend(_decouper_phrase(ligne))
    return morceaux


def _decouper_phrase(ligne: str) -> list[str]:
    """Coupe aux fins de phrase, puis à l'espace avant `LONGUEUR_MAX`."""
    phrases = [p.strip() for p in re.split(r'(?<=[.!?…])\s+', ligne) if p.strip()]
    morceaux: list[str] = []
    for phrase in phrases:
        while len(phrase) > LONGUEUR_MAX:
            coupe = phrase.rfind(' ', 0, LONGUEUR_MAX + 1)
            if coupe <= 0:
                break        # un seul mot interminable : mieux vaut le laisser entier
            morceaux.append(phrase[:coupe].strip())
            phrase = phrase[coupe:].strip()
        morceaux.append(phrase)
    return morceaux


# ── Alignement par les silences ─────────────────────────────────────────────


def seuil_relatif(niveaux: list[float], sous_la_crete_db: float = 26.0) -> float:
    """Seuil de parole déduit de l'enregistrement lui-même.

    Un seuil absolu (« -38 dBFS ») ne marche que sur un enregistrement calibré :
    une voix captée au téléphone crête souvent vers -30 dBFS, et pas une seule de
    ses trames ne passerait la barre — l'alignement rendrait alors zéro passage
    sur un fichier parfaitement audible.
    """
    utiles = [n for n in niveaux if n > SILENCE_NUMERIQUE]
    if not utiles:
        return SILENCE_NUMERIQUE
    return max(utiles) - sous_la_crete_db


def detecter_passages(
    niveaux: list[float],
    pas_ms: int = PAS_MS,
    seuil_dbfs: float | None = None,
    silence_min_ms: int = SILENCE_MIN_MS,
    passage_min_ms: int = PASSAGE_MIN_MS,
    marge_ms: int = MARGE_MS,
) -> list[Passage]:
    """Repère les passages parlés dans une enveloppe de niveaux en dBFS."""
    if not niveaux:
        return []
    seuil = seuil_relatif(niveaux) if seuil_dbfs is None else seuil_dbfs

    bruts: list[list[int]] = []
    for index, niveau in enumerate(niveaux):
        if niveau < seuil:
            continue
        debut, fin = index * pas_ms, (index + 1) * pas_ms
        # Un silence plus court que `silence_min_ms` est une respiration : couper
        # dessus fabriquerait deux sous-titres là où l'oreille entend une phrase.
        if bruts and debut - bruts[-1][1] < silence_min_ms:
            bruts[-1][1] = fin
        else:
            bruts.append([debut, fin])

    duree_totale = len(niveaux) * pas_ms
    passages = []
    for debut, fin in bruts:
        if fin - debut < passage_min_ms:
            continue
        passages.append(Passage(
            max(0, debut - marge_ms),
            min(duree_totale, fin + marge_ms),
        ))
    return passages


def repartir(passages: list[Passage], morceaux: list[str]) -> list[Replique]:
    """Étale le texte sur le temps parlé, au prorata du nombre de caractères.

    Le texte est posé sur un axe qui ignore les silences : une réplique reçoit
    une part du **temps de parole**, pas une part de la durée du fichier. Sans
    cela, une pause de trois secondes au milieu du script décalerait tout ce qui
    suit. Une réplique peut donc enjamber un silence — c'est voulu, elle reste
    calée sur la voix de part et d'autre.
    """
    if not passages or not morceaux:
        return []

    poids = [max(1, len(m)) for m in morceaux]
    total_poids = sum(poids)
    parle = sum(p.duree_ms for p in passages)

    repliques: list[Replique] = []
    curseur = 0.0
    for morceau, part in zip(morceaux, poids):
        debut = curseur
        curseur += parle * part / total_poids
        repliques.append(Replique(
            morceau,
            _vers_temps_reel(passages, debut),
            _vers_temps_reel(passages, curseur, borne_fin=True),
        ))
    return repliques


def _vers_temps_reel(passages: list[Passage], instant_parle: float, borne_fin: bool = False) -> int:
    """Convertit un instant de l'axe « temps de parole » en temps du fichier.

    Le bord d'un passage appartient aux deux répliques qui s'y touchent, et il
    faut trancher : une fin de réplique reste sur le passage qui s'achève, un
    début bascule sur le suivant. Sans cette distinction, une réplique qui suit
    un silence commencerait juste avant celui-ci — affichée cinq secondes trop
    tôt, sur du vide.
    """
    reste = instant_parle
    for passage in passages:
        if reste < passage.duree_ms or (borne_fin and reste <= passage.duree_ms):
            return int(passage.debut_ms + reste)
        reste -= passage.duree_ms
    return passages[-1].fin_ms


def enveloppe(voix, pas_ms: int = PAS_MS) -> list[float]:
    """Niveau moyen de chaque tranche de `pas_ms`, en dBFS. Seul point de contact
    de ce module avec pydub."""
    niveaux = []
    for debut in range(0, len(voix), pas_ms):
        niveau = voix[debut:debut + pas_ms].dBFS
        niveaux.append(SILENCE_NUMERIQUE if niveau == float('-inf') else niveau)
    return niveaux


# ── Alignement par les mots ─────────────────────────────────────────────────


def _normaliser(mot: str) -> str:
    """Réduit un mot à ce qui est comparable : minuscules, sans accent, sans
    ponctuation. Whisper écrit « l'hermine » là où le script dit « L'Hermine »,
    et francise les accents au petit bonheur — comparer les formes brutes ferait
    échouer un mot sur trois."""
    plie = unicodedata.normalize('NFKD', mot.lower())
    return ''.join(c for c in plie if c.isalnum())


def _mots_du_texte(texte: str) -> list[str]:
    """Découpe aux espaces seulement. Couper aussi aux apostrophes serait tentant,
    mais Whisper rend « L'Hermine » d'un seul tenant : les deux côtés doivent
    tokeniser pareil, sinon aucune élision ne s'apparie jamais."""
    return [m for m in (_normaliser(brut) for brut in texte.split()) if m]


def _appariement(reference: list[str], reconnus: list[str]) -> dict[int, int]:
    """Apparie deux suites de mots, en tolérant les manques des deux côtés.

    Alignement global classique (Needleman-Wunsch) : un mot reconnu de travers
    coûte moins cher qu'un décalage de toute la suite, ce qui est exactement le
    comportement voulu — une erreur de transcription ne doit pas emporter le
    minutage des cinquante répliques suivantes.

    Le coût est en O(n × m) : quelques secondes pour un texte de dix minutes,
    négligeable à côté de la transcription qui vient de l'être.
    """
    n, m = len(reference), len(reconnus)
    if not n or not m:
        return {}

    precedent = [-j for j in range(m + 1)]
    chemins: list[bytearray] = []
    for i in range(1, n + 1):
        courant = [-i] + [0] * m
        trace = bytearray(m + 1)
        trace[0] = 2
        for j in range(1, m + 1):
            diagonale = precedent[j - 1] + (2 if reference[i - 1] == reconnus[j - 1] else -1)
            haut = precedent[j] - 1
            gauche = courant[j - 1] - 1
            meilleur = max(diagonale, haut, gauche)
            courant[j] = meilleur
            trace[j] = 1 if meilleur == diagonale else (2 if meilleur == haut else 3)
        chemins.append(trace)
        precedent = courant

    apparies: dict[int, int] = {}
    i, j = n, m
    while i > 0 and j > 0:
        pas = chemins[i - 1][j]
        if pas == 1:
            if reference[i - 1] == reconnus[j - 1]:
                apparies[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif pas == 2:
            i -= 1
        else:
            j -= 1
    return apparies


def aligner(morceaux: list[str], mots: list[Mot]) -> list[Replique]:
    """Cale le script sur des mots minutés. Seul le temps est retenu de la
    transcription : le texte affiché reste celui qui a été écrit."""
    if not morceaux or not mots:
        return []

    reference: list[tuple[int, str]] = []
    for index, morceau in enumerate(morceaux):
        reference += [(index, mot) for mot in _mots_du_texte(morceau)]
    apparies = _appariement([mot for _, mot in reference], [_normaliser(m.texte) for m in mots])

    bornes: dict[int, list[int]] = {}
    for position, (index, _) in enumerate(reference):
        if position not in apparies:
            continue
        mot = mots[apparies[position]]
        borne = bornes.setdefault(index, [mot.debut_ms, mot.fin_ms])
        borne[0] = min(borne[0], mot.debut_ms)
        borne[1] = max(borne[1], mot.fin_ms)

    if not bornes:
        return []
    return _combler(morceaux, bornes, mots[-1].fin_ms)


def _combler(morceaux: list[str], bornes: dict[int, list[int]], fin_totale: int) -> list[Replique]:
    """Donne un minutage aux répliques qu'aucun mot n'a accrochées, en les
    répartissant sur le temps laissé libre par leurs voisines.

    Une réplique sans minutage n'est pas affichable ; mieux vaut une position
    approchée, signalée comme telle, qu'un trou dans la liste."""
    repliques: list[Replique] = []
    index = 0
    while index < len(morceaux):
        if index in bornes:
            debut, fin = bornes[index]
            repliques.append(Replique(morceaux[index], debut, max(fin, debut), cale=True))
            index += 1
            continue

        suite = index
        while suite < len(morceaux) and suite not in bornes:
            suite += 1
        gauche = bornes[index - 1][1] if index > 0 else 0
        droite = bornes[suite][0] if suite < len(morceaux) else fin_totale
        droite = max(droite, gauche)

        poids = [max(1, len(morceaux[i])) for i in range(index, suite)]
        curseur = float(gauche)
        for rang, i in enumerate(range(index, suite)):
            debut = curseur
            curseur += (droite - gauche) * poids[rang] / sum(poids)
            repliques.append(Replique(morceaux[i], int(debut), int(curseur), cale=False))
        index = suite
    return repliques


def passages_depuis_mots(mots: list[Mot], silence_min_ms: int = SILENCE_MIN_MS,
                         marge_ms: int = MARGE_MS) -> list[Passage]:
    """Reconstitue les passages parlés à partir des mots minutés : c'est ce dont
    le mixeur a besoin pour baisser le fond, et la transcription le sait déjà."""
    passages: list[Passage] = []
    for mot in mots:
        if passages and mot.debut_ms - passages[-1].fin_ms < silence_min_ms:
            passages[-1] = Passage(passages[-1].debut_ms, mot.fin_ms)
        else:
            passages.append(Passage(mot.debut_ms, mot.fin_ms))
    return [Passage(max(0, p.debut_ms - marge_ms), p.fin_ms + marge_ms) for p in passages]


def whisper_disponible() -> bool:
    return importlib.util.find_spec('whisper') is not None


@lru_cache(maxsize=1)
def _modele(nom: str):
    """Un seul modèle en mémoire : le plus petit pèse déjà 150 Mo, et l'interface
    rejoue son script à chaque interaction."""
    import whisper
    return whisper.load_model(nom)


def mots_depuis_resultat(resultat: dict) -> list[Mot]:
    """Extrait les mots minutés d'une sortie Whisper. Isolée parce que c'est la
    seule part de la transcription qui se vérifie sans charger un modèle.

    Un segment sans clé `words` arrive dès que `word_timestamps` est oublié : on
    l'ignore plutôt que de le faire échouer, l'alignement se rabattra sur les
    silences."""
    mots = []
    for segment in resultat.get('segments', []):
        for mot in segment.get('words', []):
            mots.append(Mot(mot['word'].strip(),
                            int(mot['start'] * 1000), int(mot['end'] * 1000)))
    return mots


def transcrire(chemin: str | Path, modele: str = MODELE_DEFAUT, langue: str = 'fr') -> list[Mot]:
    """Transcrit un enregistrement et rend ses mots minutés."""
    return mots_depuis_resultat(
        _modele(modele).transcribe(str(chemin), language=langue, word_timestamps=True))


# ── Sortie ─────────────────────────────────────────────────────────────────


def vers_srt(repliques: list[Replique]) -> str:
    """Écrit les répliques au format SRT, prêt à être relu par un lecteur vidéo."""
    blocs = []
    for numero, replique in enumerate(repliques, start=1):
        blocs.append(
            f'{numero}\n'
            f'{_horodatage(replique.debut_ms)} --> {_horodatage(replique.fin_ms)}\n'
            f'{replique.texte}\n'
        )
    return '\n'.join(blocs)


def _horodatage(ms: int) -> str:
    ms = max(0, int(ms))
    heures, reste = divmod(ms, 3_600_000)
    minutes, reste = divmod(reste, 60_000)
    secondes, milli = divmod(reste, 1000)
    return f'{heures:02d}:{minutes:02d}:{secondes:02d},{milli:03d}'


def synchroniser(voix, script: str, mots: list[Mot] | None = None,
                 pas_ms: int = PAS_MS) -> tuple[list[Replique], list[Passage]]:
    """Aligne un script sur une voix : par les mots si on en a, par les silences
    sinon. Rend les répliques minutées et les passages parlés — ces derniers
    servent ensuite au mixeur pour baisser le fond."""
    morceaux = lire_script(script)
    if mots:
        return aligner(morceaux, mots), passages_depuis_mots(mots)
    passages = detecter_passages(enveloppe(voix, pas_ms), pas_ms)
    return repartir(passages, morceaux), passages
