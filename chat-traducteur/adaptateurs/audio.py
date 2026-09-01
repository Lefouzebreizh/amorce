"""Amener n'importe quel enregistrement à ce que YAMNet exige.

YAMNet ne négocie pas : mono, 16 000 Hz, flottants entre -1 et 1, par fenêtres
de 15 600 échantillons (0,975 s). Tout le reste est du travail de conversion,
et c'est là que se logent les défauts silencieux — un fichier stéréo replié à
l'envers, un 44,1 kHz lu comme du 16 kHz, et le modèle rend des scores plats
sans qu'aucune exception ne soit levée.

**Un téléphone n'enregistre pas en WAV.** Android rend du `.m4a` (AAC), iOS du
`.m4a` aussi. La bibliothèque standard n'ouvre que le WAV : le chemin réel
passe donc par ffmpeg, et ce module le dit franchement plutôt que d'échouer sur
un `wave.Error` incompréhensible.
"""

import shutil
import subprocess
import wave
from pathlib import Path

FREQUENCE = 16_000
TAILLE_FENETRE = 15_600  # 0,975 s — imposé par le modèle, pas choisi
PAS = TAILLE_FENETRE // 2  # 50 % de recouvrement : un miaulement court tombe
                           # sinon à cheval sur deux fenêtres et n'est fort
                           # dans aucune des deux.


class AudioIllisible(Exception):
    """Le fichier n'a pas pu être amené au format du modèle."""


def _ffmpeg() -> str | None:
    """Trouve ffmpeg, sur le PATH ou dans la roue `imageio-ffmpeg`.

    Le dépôt installe ffmpeg par `imageio-ffmpeg` (voir le hook de démarrage),
    qui ne le pose **pas** sur le PATH. Chercher uniquement `shutil.which`
    conclurait donc à son absence sur une machine où il est présent.
    """
    trouve = shutil.which("ffmpeg")
    if trouve:
        return trouve
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _convertir(source: Path, cible: Path) -> None:
    """Passe par ffmpeg pour tout ce qui n'est pas déjà du WAV 16 kHz mono."""
    binaire = _ffmpeg()
    if binaire is None:
        raise AudioIllisible(
            f"« {source.name} » n'est pas un WAV et ffmpeg est introuvable. "
            "Installer `imageio-ffmpeg` (voir requirements.txt), ou convertir "
            "le fichier à la main en WAV 16 kHz mono."
        )
    resultat = subprocess.run(
        [binaire, "-y", "-loglevel", "error", "-i", str(source),
         "-ac", "1", "-ar", str(FREQUENCE), "-f", "wav", str(cible)],
        capture_output=True, text=True,
    )
    if resultat.returncode != 0:
        raise AudioIllisible(f"ffmpeg a refusé « {source.name} » : {resultat.stderr.strip()}")


def _lire_wav(chemin: Path) -> tuple[list[float], int]:
    """Lit un WAV PCM 16 bits en flottants, en repliant le stéréo en mono."""
    with wave.open(str(chemin), "rb") as f:
        if f.getsampwidth() != 2:
            raise AudioIllisible("Seul le PCM 16 bits est lu directement.")
        canaux, frequence = f.getnchannels(), f.getframerate()
        brut = f.readframes(f.getnframes())
    import array
    echantillons = array.array("h")
    echantillons.frombytes(brut)
    valeurs = [v / 32768.0 for v in echantillons]
    if canaux > 1:
        # Moyenne des canaux, jamais un seul : un chat qui miaule à droite du
        # micro disparaît si l'on ne garde que le canal gauche.
        valeurs = [sum(valeurs[i:i + canaux]) / canaux
                   for i in range(0, len(valeurs) - canaux + 1, canaux)]
    return valeurs, frequence


def _reechantillonner(valeurs: list[float], depuis: int, vers: int) -> list[float]:
    """Rééchantillonnage linéaire — suffisant ici, et sans dépendance.

    YAMNet mange un mel-spectrogramme : les artefacts d'un rééchantillonnage
    linéaire vivent très haut en fréquence et se retrouvent hors des bandes
    qui portent un miaulement. Un filtre polyphasé serait plus propre et
    n'apporterait rien de mesurable ici.
    """
    if depuis == vers:
        return valeurs
    rapport = depuis / vers
    n = int(len(valeurs) / rapport)
    sortie = []
    for i in range(n):
        pos = i * rapport
        g = int(pos)
        d = min(g + 1, len(valeurs) - 1)
        frac = pos - g
        sortie.append(valeurs[g] * (1 - frac) + valeurs[d] * frac)
    return sortie


def charger(chemin: str | Path) -> list[float]:
    """Rend l'enregistrement en mono 16 kHz, quel que soit son format d'entrée."""
    chemin = Path(chemin)
    if not chemin.exists():
        raise AudioIllisible(f"Fichier introuvable : {chemin}")

    try:
        valeurs, frequence = _lire_wav(chemin)
    except (wave.Error, AudioIllisible, EOFError):
        import tempfile
        with tempfile.TemporaryDirectory() as dossier:
            temporaire = Path(dossier) / "converti.wav"
            _convertir(chemin, temporaire)
            valeurs, frequence = _lire_wav(temporaire)

    return _reechantillonner(valeurs, frequence, FREQUENCE)


def fenetrer(valeurs: list[float]) -> list[list[float]]:
    """Découpe en fenêtres de 15 600 échantillons, avec 50 % de recouvrement.

    Un enregistrement plus court qu'une fenêtre est **complété par du
    silence** plutôt que rejeté : un miaulement de 0,6 s est parfaitement
    ordinaire, et le refuser pour cause de brièveté ferait échouer
    l'application exactement sur son cas d'usage.
    """
    if not valeurs:
        return []
    if len(valeurs) < TAILLE_FENETRE:
        return [valeurs + [0.0] * (TAILLE_FENETRE - len(valeurs))]
    return [valeurs[d:d + TAILLE_FENETRE]
            for d in range(0, len(valeurs) - TAILLE_FENETRE + 1, PAS)]
