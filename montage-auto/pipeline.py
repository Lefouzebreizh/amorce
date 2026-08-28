#!/usr/bin/env python3
"""Chaîne complète : recette JSON → format court prêt à publier.

Une seule commande enchaîne ce qui était jusqu'ici quatre scripts appelés à la
main, et surtout **dans le bon ordre** — c'est l'ordre qui compte, chaque
inversion ayant coûté un défaut :

    1. montage      `monter_episode`  — plans, effets, titres, étalonnage
    2. carton       `carte_episode`   — l'annonce de l'épisode suivant
    3. boucle       ici               — la queue se fond dans la tête
    4. sous-titres  `sous_titres`     — le mot à mot, brûlé par libass
    5. master       `master-telephone`— présence, gain, limiteur

Le master vient **en dernier et une seule fois**. Masteriser avant d'assembler
masterise deux fois le film et une fois le carton, et le limiteur, appliqué
deux fois, se met à pomper — un gain qui varie de +1,0 à +6,1 dB selon
l'instant, que l'oreille rapporte comme une coupure au milieu du son.

La boucle vient **avant** le master et après le carton : elle fabrique une
image de plus, qui doit passer par la même chaîne que les autres.

Aucune dépendance nouvelle : ffmpeg, numpy, soundfile — ce que le dépôt a déjà.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import monter_episode as M
import carte_episode as C
import sous_titres as ST

RACINE = Path(__file__).resolve().parent
MASTER = (RACINE.parent / ".claude" / "skills" / "master-telephone"
          / "scripts" / "masteriser.py")


def verifier_outils(besoin_ass: bool = False) -> None:
    """Refuse de commencer plutôt que d'échouer au bout de deux minutes.

    Chaque manque est signalé avec ce qu'il empêche, parce qu'un « ffmpeg
    introuvable » à la neuvième minute d'un rendu ne dit pas laquelle des cinq
    étapes en avait besoin.
    """
    manques = []
    if not Path("/usr/bin/ffmpeg").is_file() and not shutil.which("ffmpeg"):
        manques.append("ffmpeg (toutes les étapes)")
    filtres = subprocess.run([M.ffmpeg(), "-hide_banner", "-filters"],
                             capture_output=True, text=True).stdout
    if " drawtext " not in filtres:
        manques.append("ffmpeg compilé avec libfreetype : pas de « drawtext », "
                       "donc ni titres ni sous-titres incrustés "
                       "(celui d'imageio en est dépourvu — installer "
                       "le paquet système)")
    if besoin_ass and " subtitles " not in filtres:
        manques.append("ffmpeg compilé avec libass : pas de filtre "
                       "« subtitles », donc pas de mot à mot")
    codeurs = subprocess.run([M.ffmpeg(), "-hide_banner", "-encoders"],
                             capture_output=True, text=True).stdout
    if " libx264 " not in codeurs:
        manques.append("libx264 (encodage H.264)")
    if " aac " not in codeurs:
        manques.append("aac (encodage audio)")
    try:
        import numpy, soundfile  # noqa: F401
    except ImportError as e:
        manques.append(f"paquet Python « {e.name} » "
                       f"(pip install -r montage-auto/requirements.txt)")
    if not MASTER.is_file():
        manques.append(f"{MASTER} (master téléphone)")
    if manques:
        raise SystemExit("Il manque :\n  · " + "\n  · ".join(manques))


def boucler(entree: Path, sortie: Path, recouvrement: float = 0.5) -> Path:
    """Fond la queue dans la tête pour qu'un deuxième tour ne se voie pas.

    Le principe : les dernières `recouvrement` secondes se dissolvent dans les
    premières, et le film **raccourcit** d'autant. Il ne s'allonge pas — un
    fondu ajouté à la fin laisserait le raccord exactement où il était.

    L'audio suit le même fondu croisé. Le laisser en coupe franche donne un
    clic à chaque tour, et un clic à chaque tour est plus visible qu'un raccord
    d'image : l'oreille repère une discontinuité que l'œil pardonne.
    """
    duree = float(subprocess.run(
        [M.ffmpeg().replace("ffmpeg", "ffprobe"), "-v", "error",
         "-show_entries", "format=duration", "-of", "csv=p=0", str(entree)],
        capture_output=True, text=True, check=True).stdout.strip())
    if duree <= recouvrement * 3:
        raise SystemExit(f"{entree.name} dure {duree:.2f} s : trop court pour "
                         f"un recouvrement de {recouvrement} s.")
    debut_fondu = duree - recouvrement
    graphe = (
        f"[0:v]trim=0:{recouvrement},setpts=PTS-STARTPTS[tete];"
        f"[0:v]trim={recouvrement}:{debut_fondu},setpts=PTS-STARTPTS[corps];"
        f"[0:v]trim={debut_fondu},setpts=PTS-STARTPTS[queue];"
        f"[queue][tete]xfade=transition=fade:duration={recouvrement}:"
        f"offset=0[raccord];"
        f"[corps][raccord]concat=n=2:v=1:a=0[v];"
        f"[0:a]atrim=0:{recouvrement},asetpts=PTS-STARTPTS[at];"
        f"[0:a]atrim={recouvrement}:{debut_fondu},asetpts=PTS-STARTPTS[ac];"
        f"[0:a]atrim={debut_fondu},asetpts=PTS-STARTPTS[aq];"
        f"[aq][at]acrossfade=d={recouvrement}:c1=tri:c2=tri[ar];"
        f"[ac][ar]concat=n=2:v=0:a=1[a]"
    )
    subprocess.run([M.ffmpeg(), "-y", "-v", "error", "-i", str(entree),
                    "-filter_complex", graphe, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "320k", str(sortie)], check=True)
    return sortie


def incruster_ass(entree: Path, ass: Path, sortie: Path,
                  polices: Path | None = None) -> Path:
    """Brûle les sous-titres ASS dans l'image."""
    chemin = str(ass).replace("\\", "/").replace(":", r"\:")
    filtre = f"subtitles=filename='{chemin}'"
    if polices:
        filtre += f":fontsdir='{polices}'"
    subprocess.run([M.ffmpeg(), "-y", "-v", "error", "-i", str(entree),
                    "-vf", filtre, "-c:v", "libx264", "-crf", "16",
                    "-pix_fmt", "yuv420p", "-c:a", "copy", str(sortie)],
                   check=True)
    return sortie


def cadencer(entree: Path, sortie: Path, cadence: int) -> Path:
    """Change la cadence par interpolation de mouvement.

    `minterpolate` fabrique les images manquantes au lieu de dupliquer les
    existantes. Dupliquer en montant de 24 à 60 ne rend pas fluide : cela pose
    deux images identiques puis une troisième, et ce battement irrégulier se
    voit plus que les 24 d'origine.

    C'est lent — plusieurs fois le temps réel — et c'est le prix. À ne demander
    que si la plateforme visée le rend vraiment.
    """
    subprocess.run(
        [M.ffmpeg(), "-y", "-v", "error", "-i", str(entree),
         "-vf", f"minterpolate=fps={cadence}:mi_mode=mci:mc_mode=aobmc:"
                f"me_mode=bidir:vsbmc=1",
         "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
         "-c:a", "copy", str(sortie)], check=True)
    return sortie


def masteriser(entree: Path, sortie: Path, gain: float) -> None:
    subprocess.run([sys.executable, str(MASTER), "--gain", str(gain),
                    str(entree), str(sortie)], check=True)


def executer(recette: Path, sortie: Path, *, carte: list[str] | None = None,
             duree_carte: float = 2.8, boucle: float = 0.0,
             sous_titres: Path | None = None, cadence: int = 0,
             gain: float = 2.0, atelier: Path | None = None) -> Path:
    verifier_outils(besoin_ass=sous_titres is not None)
    if not recette.is_file():
        raise SystemExit(f"Recette introuvable : {recette}")
    try:
        json.loads(recette.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{recette} : JSON illisible ligne {e.lineno} — {e.msg}")

    atelier = atelier or sortie.parent / "_pipeline"
    atelier.mkdir(parents=True, exist_ok=True)
    courant = atelier / "01_montage.mp4"
    subprocess.run([sys.executable, str(RACINE / "monter_episode.py"),
                    str(recette), str(courant)], check=True)

    if carte:
        lignes, tailles, y = [], (48, 62, 44), (830, 930, 1060)
        for i, texte in enumerate(carte[:3]):
            lignes.append({"texte": texte, "debut": 0.10 + i * 0.45,
                           "fin": duree_carte, "y": y[i], "taille": tailles[i],
                           "secousse": (5.0, 8.0, 4.0)[i]})
        suite = atelier / "02_carte.mp4"
        C.carte(courant, atelier / "carte.mkv", lignes, duree=duree_carte)
        _coudre(courant, atelier / "carte.mkv", suite)
        courant = suite

    if boucle:
        suite = atelier / "03_boucle.mp4"
        courant = boucler(courant, suite, boucle)

    if sous_titres:
        ass = ST.ecrire_ass(ST.lire(sous_titres), atelier / "sous_titres.ass")
        suite = atelier / "04_sous_titres.mp4"
        courant = incruster_ass(courant, ass, suite,
                                polices=M.police() and Path(M.police()).parent)

    if cadence:
        suite = atelier / "05_cadence.mp4"
        courant = cadencer(courant, suite, cadence)

    masteriser(courant, sortie, gain)
    return sortie


def _coudre(film: Path, carte: Path, sortie: Path) -> None:
    """Colle le carton au film sans faire passer d'audio encodé par la coupe.

    Concaténer deux flux AAC en copie produit un artefact au raccord : les deux
    fichiers n'ont pas le même délai d'amorçage. Mesuré, cela donnait un vrai
    pic à +9 dBTP sur un mixage qui ne dépassait pas −0,8. La vidéo se
    concatène donc en copie, l'audio se réassemble en PCM, et un seul
    encodage a lieu à la fin.
    """
    import numpy, soundfile
    F = M.ffmpeg()
    pistes = []
    for i, source in enumerate((film, carte)):
        subprocess.run([F, "-y", "-v", "error", "-i", str(source), "-an",
                        "-c:v", "copy", str(sortie.parent / f"_v{i}.mkv")],
                       check=True)
        wav = sortie.parent / f"_a{i}.wav"
        rendu = subprocess.run([F, "-y", "-v", "error", "-i", str(source),
                                "-vn", "-ac", "2", "-ar", str(M.TAUX),
                                "-c:a", "pcm_f32le", str(wav)])
        pistes.append(soundfile.read(wav, dtype="float64")[0]
                      if rendu.returncode == 0 and wav.is_file()
                      else numpy.zeros((0, 2)))
    liste = sortie.parent / "_liste.txt"
    liste.write_text("".join(f"file '{sortie.parent}/_v{i}.mkv'\n"
                             for i in range(2)))
    subprocess.run([F, "-y", "-v", "error", "-f", "concat", "-safe", "0",
                    "-i", str(liste), "-c", "copy",
                    str(sortie.parent / "_v.mkv")], check=True)
    ensemble = numpy.concatenate([p for p in pistes if len(p)]) \
        if any(len(p) for p in pistes) else numpy.zeros((1, 2))
    son = sortie.parent / "_a.wav"
    soundfile.write(son, ensemble, M.TAUX, subtype="FLOAT")
    subprocess.run([F, "-y", "-v", "error", "-i", str(sortie.parent / "_v.mkv"),
                    "-i", str(son), "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "320k", "-movflags", "+faststart", str(sortie)],
                   check=True)


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(
        description="Recette JSON → format court prêt à publier.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Exemple :\n"
               "  python3 montage-auto/pipeline.py \\\n"
               "      montage-auto/references/titans-ep01.json sortie.mp4 \\\n"
               "      --carte \"THE NEXT CREATURE\" \"THE CYBER HYDRA TITAN\" "
               "\"EPISODE 02\"")
    a.add_argument("recette", type=Path)
    a.add_argument("sortie", type=Path)
    a.add_argument("--carte", nargs="*", metavar="LIGNE",
                   help="jusqu'à trois lignes pour le carton de fin")
    a.add_argument("--duree-carte", type=float, default=2.8)
    a.add_argument("--boucle", type=float, default=0.0, metavar="SECONDES",
                   help="fond la queue dans la tête sur N secondes (ex. 0.5)")
    a.add_argument("--sous-titres", type=Path, metavar="SRT_OU_JSON",
                   help="mot à mot brûlé par libass")
    a.add_argument("--cadence", type=int, default=0, choices=[0, 30, 50, 60],
                   help="ré-interpole vers cette cadence (lent)")
    a.add_argument("--gain", type=float, default=2.0,
                   help="décibels du master téléphone (défaut : 2)")
    o = a.parse_args(argv)
    chemin = executer(o.recette, o.sortie, carte=o.carte,
                      duree_carte=o.duree_carte, boucle=o.boucle,
                      sous_titres=o.sous_titres, cadence=o.cadence,
                      gain=o.gain)
    print(f"\n→ {chemin}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
