#!/usr/bin/env python3
"""Voix de synthèse, et minutage offert avec.

`edge-tts` s'adresse au service de lecture à voix haute de Microsoft Edge : la
qualité est celle d'une voix neuronale, sans modèle à installer ni carte
graphique. Il faut en revanche une connexion — c'est le seul endroit de
l'application qui sorte de la machine, et le fichier produit est ensuite traité
comme n'importe quel autre enregistrement.

L'intérêt dépasse le confort : le service renvoie, avec l'audio, la position de
chaque mot prononcé. Une voix de synthèse arrive donc **déjà alignée**, et
`core/synchroniseur.py` n'a plus qu'à recaler le script dessus — sans Whisper,
sans détection de silences, et au mot près.

Les offsets arrivent en unités de 100 nanosecondes (la convention Windows) :
d'où la division par 10 000 pour retomber sur des millisecondes.
"""

from __future__ import annotations

import asyncio
import importlib.util
import io

from pydub import AudioSegment

from .synchroniseur import Mot

VOIX_DEFAUT = 'fr-FR-DeniseNeural'
TIC_PAR_MS = 10_000


def disponible() -> bool:
    return importlib.util.find_spec('edge_tts') is not None


def mot_depuis_bloc(bloc: dict) -> Mot:
    """Convertit une frontière de mot du service en `Mot` du studio. Isolée parce
    que c'est la seule part de ce fichier qui se vérifie sans réseau."""
    debut = bloc['offset'] // TIC_PAR_MS
    return Mot(bloc['text'], debut, debut + bloc['duration'] // TIC_PAR_MS)


async def _fabriquer(texte: str, voix: str, vitesse: str, hauteur: str):
    import edge_tts

    parleur = edge_tts.Communicate(texte, voix, rate=vitesse, pitch=hauteur)
    audio, mots = bytearray(), []
    async for bloc in parleur.stream():
        if bloc['type'] == 'audio':
            audio.extend(bloc['data'])
        elif bloc['type'] == 'WordBoundary':
            mots.append(mot_depuis_bloc(bloc))
    return bytes(audio), mots


def dire(texte: str, voix: str = VOIX_DEFAUT, vitesse_pourcent: int = 0,
         hauteur_hz: int = 0) -> tuple[AudioSegment, list[Mot]]:
    """Fabrique la voix et rend le son avec ses mots minutés.

    La vitesse et la hauteur s'expriment en écart signé (« +10% », « -20Hz ») :
    c'est ce qu'attend le service, et le signe est obligatoire même à zéro.
    """
    audio, mots = asyncio.run(_fabriquer(
        texte, voix, f'{vitesse_pourcent:+d}%', f'{hauteur_hz:+d}Hz'))
    if not audio:
        raise RuntimeError('Le service de synthèse n’a rien renvoyé.')
    # Le flux arrive en MP3 : on le ramène au format du studio pour qu'il se
    # mélange sans surprise au reste (voir `mixeur.charger`).
    son = AudioSegment.from_file(io.BytesIO(audio), format='mp3')
    return son.set_frame_rate(44_100).set_channels(2), mots


def voix_francaises() -> list[str]:
    """Les voix disponibles pour le français, la première étant celle par défaut."""
    import edge_tts

    catalogue = asyncio.run(edge_tts.list_voices())
    noms = sorted(v['ShortName'] for v in catalogue if v['Locale'].startswith('fr'))
    return sorted(noms, key=lambda nom: nom != VOIX_DEFAUT)
