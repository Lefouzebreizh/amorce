#!/usr/bin/env python3
"""Bruitages, volumes, et sortie du mixage.

Quatre décisions tiennent ce fichier :

1. **Le fond baisse sous la voix, il ne baisse pas tout le temps.** Une musique
   posée dix décibels plus bas pour rester intelligible sous la parole devient
   inaudible dans les blancs, là où elle devrait précisément porter. La baisse
   suit donc les passages parlés repérés par le synchroniseur.
2. **La baisse a son propre étage de gain.** Elle ne s'écrit jamais sur le
   réglage de volume du fond : les deux se marcheraient dessus, et bouger le
   curseur effacerait la baisse.
3. **L'assemblage passe par les octets bruts.** Une rampe de fondu fabrique des
   dizaines de tranches, et `a + b` recopie tout le tampon à chaque fois : sur
   une musique de trois minutes, l'attente devient visible. `_assembler` fait une
   seule concaténation.
4. **Le mixage final est normalisé.** Trois sources qui s'additionnent saturent ;
   mieux vaut redescendre sous la crête visée que livrer un fichier qui craque.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

from pydub import AudioSegment
from pydub import effects

PAS_RAMPE_MS = 25            # finesse d'un fondu : au-delà, la baisse s'entend « marcher »


@dataclass
class Bruitage:
    """Un son posé à un instant donné du montage."""
    nom: str
    son: AudioSegment = field(repr=False)
    position_ms: int = 0
    gain_db: float = 0.0
    fondu_ms: int = 0


@dataclass
class Reglages:
    """La table de mixage. Un curseur par source, plus la baisse automatique."""
    gain_voix_db: float = 0.0
    gain_bruitages_db: float = -4.0
    gain_musique_db: float = -16.0
    attenuation_db: float = -9.0     # de combien le fond baisse sous la voix
    marge_ms: int = 200              # ouverture de la baisse avant/après la parole
    fondu_ms: int = 150
    crete_visee_dbfs: float = -1.0


def outiller() -> str | None:
    """Branche pydub sur un ffmpeg utilisable et rend son chemin.

    pydub n'embarque aucun codec : sans ffmpeg il ne lit et n'écrit que du WAV.
    On prend celui du système s'il existe, sinon celui livré par le paquet
    `imageio-ffmpeg` — c'est la seule façon d'obtenir le MP3 par un simple
    `pip install`, sans demander une installation à part.

    `imageio-ffmpeg` ne fournit pas `ffprobe`, dont pydub se sert pour deviner le
    format d'un fichier. Sans lui, toute lecture échouerait sur un `ffprobe
    introuvable` ; on court-circuite donc l'analyse et on laisse ffmpeg
    reconnaître le format tout seul, ce qu'il fait très bien.
    """
    binaire = shutil.which('ffmpeg')
    if binaire:
        AudioSegment.converter = binaire
        return binaire

    try:
        import imageio_ffmpeg
    except ModuleNotFoundError:
        return None

    binaire = imageio_ffmpeg.get_ffmpeg_exe()
    AudioSegment.converter = binaire
    if not shutil.which('ffprobe'):
        import pydub.audio_segment as _segment
        _segment.mediainfo_json = lambda *_args, **_kwargs: {}
    return binaire


def charger(chemin: str | Path) -> AudioSegment:
    """Ouvre un fichier son. Tout est ramené en stéréo 44,1 kHz : mélanger un
    mono et un stéréo décale la position des bruitages d'un facteur deux."""
    if AudioSegment.converter == 'ffmpeg' and not shutil.which('ffmpeg'):
        raise RuntimeError(
            "ffmpeg est introuvable : seuls les fichiers WAV sont lisibles. "
            "Installez les dépendances avec « pip install -r requirements.txt »."
        )
    return AudioSegment.from_file(Path(chemin)).set_frame_rate(44_100).set_channels(2)


def exporter(mixage: AudioSegment, chemin: str | Path) -> Path:
    """Écrit le mixage, au format déduit de l'extension demandée."""
    chemin = Path(chemin)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    mixage.export(chemin, format=chemin.suffix.lstrip('.') or 'mp3')
    return chemin


def plan_attenuation(passages, duree_ms: int, marge_ms: int = 200) -> list[tuple[int, int]]:
    """Intervalles pendant lesquels le fond doit baisser, fusionnés et bornés.

    Deux passages rapprochés donnent un seul intervalle : laisser la musique
    remonter pendant la demi-seconde qui les sépare s'entend comme une pompe.
    """
    intervalles: list[list[int]] = []
    for passage in passages:
        debut = max(0, passage.debut_ms - marge_ms)
        fin = min(duree_ms, passage.fin_ms + marge_ms)
        if fin <= debut:
            continue
        if intervalles and debut <= intervalles[-1][1]:
            intervalles[-1][1] = max(intervalles[-1][1], fin)
        else:
            intervalles.append([debut, fin])
    return [(debut, fin) for debut, fin in intervalles]


def attenuer(
    fond: AudioSegment,
    intervalles: list[tuple[int, int]],
    attenuation_db: float,
    fondu_ms: int = 150,
) -> AudioSegment:
    """Applique la baisse sur les intervalles donnés, avec une rampe aux bords."""
    if not intervalles or attenuation_db >= 0:
        return fond

    tranches: list[AudioSegment] = []
    curseur = 0
    for debut, fin in intervalles:
        rampe = min(fondu_ms, max(0, (fin - debut) // 2))
        tranches.append(fond[curseur:debut - rampe])
        tranches += _rampe(fond, debut - rampe, debut, 0.0, attenuation_db)
        tranches.append(fond[debut:fin].apply_gain(attenuation_db))
        tranches += _rampe(fond, fin, fin + rampe, attenuation_db, 0.0)
        curseur = fin + rampe
    tranches.append(fond[curseur:])
    return _assembler(fond, tranches)


def _rampe(fond, debut: int, fin: int, depuis_db: float, vers_db: float) -> list[AudioSegment]:
    """Découpe [debut, fin] en paliers de gain — un fondu à la main, faute de
    quoi la baisse s'installe d'un coup et s'entend comme un déclic."""
    debut = max(0, debut)
    if fin <= debut:
        return []
    paliers = max(1, (fin - debut) // PAS_RAMPE_MS)
    tranches = []
    for palier in range(paliers):
        bord_g = debut + (fin - debut) * palier // paliers
        bord_d = debut + (fin - debut) * (palier + 1) // paliers
        avance = (palier + 0.5) / paliers
        tranches.append(fond[bord_g:bord_d].apply_gain(depuis_db + (vers_db - depuis_db) * avance))
    return tranches


def _assembler(modele: AudioSegment, tranches: list[AudioSegment]) -> AudioSegment:
    """Recolle des tranches de même format en une seule allocation."""
    return modele._spawn(b''.join(tranche.raw_data for tranche in tranches))


def caler(fond: AudioSegment, duree_ms: int, fondu_ms: int = 2000) -> AudioSegment:
    """Ajuste un lit sonore à la durée de la voix : bouclé s'il est trop court,
    coupé en fondu s'il est trop long — une musique tranchée net fait amateur."""
    if duree_ms <= 0:
        return fond[:0]
    while len(fond) < duree_ms:
        fond += fond
    return fond[:duree_ms].fade_out(min(fondu_ms, duree_ms))


def mixer(
    voix: AudioSegment,
    bruitages: list[Bruitage] | None = None,
    musique: AudioSegment | None = None,
    passages=None,
    reglages: Reglages | None = None,
) -> AudioSegment:
    """Assemble les trois sources en un seul fichier.

    La voix donne la durée du montage : c'est elle qu'on est venu habiller. Un
    bruitage posé au-delà de la fin l'allonge malgré tout, sinon poser un dernier
    impact sur la chute reviendrait à le supprimer.
    """
    reglages = reglages or Reglages()
    bruitages = bruitages or []
    passages = passages or []

    duree = len(voix)
    for bruitage in bruitages:
        duree = max(duree, bruitage.position_ms + len(bruitage.son))

    mixage = AudioSegment.silent(duration=duree, frame_rate=voix.frame_rate)
    mixage = mixage.set_channels(voix.channels)
    mixage = mixage.overlay(voix.apply_gain(reglages.gain_voix_db))

    intervalles = plan_attenuation(passages, duree, reglages.marge_ms)

    if musique is not None and len(musique):
        lit = caler(musique, duree).apply_gain(reglages.gain_musique_db)
        mixage = mixage.overlay(attenuer(lit, intervalles, reglages.attenuation_db, reglages.fondu_ms))

    for bruitage in bruitages:
        son = bruitage.son.apply_gain(reglages.gain_bruitages_db + bruitage.gain_db)
        if bruitage.fondu_ms:
            son = son.fade_in(min(bruitage.fondu_ms, len(son) // 2 or 1))
            son = son.fade_out(min(bruitage.fondu_ms, len(son) // 2 or 1))
        mixage = mixage.overlay(son, position=max(0, bruitage.position_ms))

    return effects.normalize(mixage, headroom=abs(reglages.crete_visee_dbfs))
