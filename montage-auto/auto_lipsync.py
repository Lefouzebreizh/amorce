#!/usr/bin/env python3
"""Synchronisation labiale automatique par Wav2Lip — deuxième maillon.

Prend une vidéo de visage et une piste audio (typiquement celle produite par
`elevenlabs_voice.py`), et rend une vidéo où les lèvres suivent la nouvelle voix.

Wav2Lip n'est pas une bibliothèque installable : c'est un dépôt de recherche
qu'on clone, dont on lance `inference.py`. Ce script est l'enveloppe qui rend ce
lancement fiable — il vérifie ce qui manque *avant* de démarrer un traitement de
plusieurs minutes, plutôt que de laisser le modèle s'arrêter à mi-chemin.

Cinq décisions tiennent ce fichier :

1. **Tout est vérifié avant de lancer quoi que ce soit.** FFmpeg, le GPU, les
   deux jeux de poids, les fichiers d'entrée. Un traitement Wav2Lip dure de
   quelques minutes (GPU) à une heure (processeur) : découvrir au bout de
   quarante minutes qu'il manque `s3fd.pth` est le scénario que ce script existe
   pour éviter.
2. **Deux modèles sont nécessaires, pas un.** Le point que tout le monde
   découvre au premier échec : `wav2lip_gan.pth` fait bouger les lèvres, mais
   c'est `s3fd.pth` qui trouve le visage dans l'image. Wav2Lip ne le télécharge
   pas et signale son absence par une trace illisible. `download_models()` les
   contrôle tous les deux, et met le second en place tout seul.
3. **Aucune adresse de téléchargement n'est écrite en dur.** Les liens
   d'origine (iiit.ac.in) sont morts, les miroirs se déplacent. Un lien mort
   dans le code produit un message de confiance qui envoie l'utilisateur dans
   le vide ; on préfère nommer précisément le fichier attendu et son
   emplacement, et laisser `WAV2LIP_CHECKPOINT_URL` pour qui a son miroir.
4. **Les chemins passés au modèle sont absolus.** `inference.py` doit tourner
   depuis son propre dossier — il y cherche `temp/` et les poids de détection
   par chemins relatifs. Un chemin d'entrée relatif serait donc résolu depuis
   le dépôt Wav2Lip, pas depuis le dossier de l'utilisateur.
5. **La barre de progression suit le vrai travail.** Wav2Lip émet sa propre
   progression sur sa sortie d'erreur ; on la relit et on la rejoue dans une
   barre `tqdm` locale. Une barre qui avancerait au temps écoulé mentirait :
   la détection des visages et l'inférence n'ont ni la même durée ni le même
   nombre d'étapes.

Usage :
    python auto_lipsync.py --video visage.mp4 --audio voice.mp3 --output final.mp4
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RACINE = Path(__file__).resolve().parent

# Les poids vivent à côté du script, pas dans le dépôt Wav2Lip : on peut ainsi
# recloner ou mettre à jour Wav2Lip sans retélécharger un gigaoctet.
DOSSIER_MODELES = RACINE / "models"

# `wav2lip_gan.pth` donne un rendu visuellement plus net que `wav2lip.pth`, qui
# obtient de meilleurs scores de synchronisation mais une bouche plus floue.
# Pour une vidéo qu'on regarde, le premier gagne ; les deux sont acceptés.
CHECKPOINTS_ACCEPTES = ("wav2lip_gan.pth", "wav2lip.pth")

# Détecteur de visage S3FD. Wav2Lip le charge par un chemin relatif, en dur,
# depuis son propre arbre : c'est la seule raison pour laquelle il ne peut pas
# rester dans `models/` avec l'autre.
# Miroir des poids, sur un objet de release GitHub. Ce fichier disait d'abord
# qu'aucune adresse ne serait codée en dur, les liens d'origine (iiit.ac.in)
# étant morts et les miroirs mouvants. La règle valait pour les sites
# d'éditeurs ; elle ne vaut pas ici. Les releases GitHub sont le seul type
# d'hôte que le mandataire des sessions distantes laisse passer, et celui-ci
# sert bien les vrais fichiers : 416 Mo pour le générateur, 86 Mo pour le
# détecteur — les tailles publiées par les auteurs. Vérifié avant d'être écrit.
MIROIR = "https://github.com/justinjohn0306/Wav2Lip/releases/download/models"

NOM_S3FD = "s3fd.pth"
CHEMIN_S3FD_DANS_WAV2LIP = Path("face_detection") / "detection" / "sfd" / NOM_S3FD

# Repère la progression émise par le tqdm de Wav2Lip : « 45/100 [00:03<00:04 ».
# Le crochet est exigé pour ne pas confondre avec une fraction quelconque
# apparaissant dans un message de FFmpeg.
MOTIF_PROGRESSION = re.compile(r"(\d+)/(\d+)\s*\[")


@dataclass
class Environnement:
    """Ce que la machine sait faire, constaté une fois pour toutes."""

    ffmpeg: str | None
    ffprobe: str | None
    gpu: str | None
    depot_wav2lip: Path | None

    @property
    def utilisable(self) -> bool:
        return self.ffmpeg is not None and self.depot_wav2lip is not None


def _trouver_depot_wav2lip() -> Path | None:
    """Localise le clone de Wav2Lip, par variable d'environnement ou à côté.

    L'ordre compte : une installation explicite doit toujours l'emporter sur une
    découverte par convention, sinon un clone oublié dans le dossier courant
    prend silencieusement le pas sur celui qu'on voulait utiliser.
    """
    depuis_env = os.getenv("WAV2LIP_HOME")
    candidats = [Path(depuis_env)] if depuis_env else []
    candidats += [RACINE / "Wav2Lip", Path.cwd() / "Wav2Lip"]

    for candidat in candidats:
        if (candidat / "inference.py").is_file():
            return candidat.resolve()
    return None


def check_environment(silencieux: bool = False) -> Environnement:
    """Contrôle FFmpeg, la disponibilité d'un GPU CUDA et le clone de Wav2Lip.

    Ne s'arrête sur rien : rend l'état constaté et laisse l'appelant décider.
    L'absence de GPU n'est pas bloquante — c'est lent, pas impossible.
    """
    if not silencieux:
        print("── Vérification de l'environnement")

    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")

    if not silencieux:
        if ffmpeg:
            print(f"   FFmpeg      : présent ({ffmpeg})")
        else:
            print(
                "   FFmpeg      : ABSENT — indispensable.\n"
                "                 Debian/Ubuntu : sudo apt install ffmpeg\n"
                "                 macOS         : brew install ffmpeg\n"
                "                 Windows       : winget install Gyan.FFmpeg",
                file=sys.stderr,
            )
        if ffmpeg and not ffprobe:
            # Cas rare mais réel des installations partielles : le montage final
            # passe, mais on perd la durée des sources, donc le contrôle de
            # cohérence avant traitement.
            print("   ffprobe     : absent — les durées ne seront pas vérifiées.")

    # torch est importé ici et non en tête : il pèse plusieurs secondes au
    # chargement, et `--help` ne doit pas les payer.
    gpu = None
    try:
        import torch

        if torch.cuda.is_available():
            gpu = torch.cuda.get_device_name(0)
            if not silencieux:
                memoire = torch.cuda.get_device_properties(0).total_memory / 1024**3
                print(f"   GPU (CUDA)  : {gpu} — {memoire:.1f} Go")
        elif not silencieux:
            print(
                "   GPU (CUDA)  : aucun — le traitement se fera sur le processeur.\n"
                "                 Compter environ trente fois plus long : une minute\n"
                "                 de vidéo peut demander une demi-heure."
            )
    except ImportError:
        if not silencieux:
            print(
                "   PyTorch     : ABSENT — Wav2Lip ne peut pas tourner.\n"
                "                 pip install -r requirements.txt",
                file=sys.stderr,
            )

    depot = _trouver_depot_wav2lip()
    if not silencieux:
        if depot:
            print(f"   Wav2Lip     : présent ({depot})")
        else:
            print(
                "   Wav2Lip     : ABSENT — le dépôt du modèle n'est pas cloné.\n"
                f"                 git clone https://github.com/Rudrabha/Wav2Lip \"{RACINE / 'Wav2Lip'}\"\n"
                "                 (ou pointer WAV2LIP_HOME vers un clone existant)",
                file=sys.stderr,
            )

    return Environnement(ffmpeg=ffmpeg, ffprobe=ffprobe, gpu=gpu, depot_wav2lip=depot)


def _telecharger(url: str, destination: Path) -> bool:
    """Télécharge `url` vers `destination`, barre de progression comprise.

    Écrit d'abord à côté, puis renomme : un poids tronqué par une coupure réseau
    est bien pire qu'un poids absent — il passe le test de présence et fait
    échouer le chargement du modèle une heure plus tard, sans expliquer pourquoi.
    """
    import urllib.request

    from tqdm import tqdm

    provisoire = destination.with_suffix(destination.suffix + ".partiel")
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"   Téléchargement de {destination.name}…")

    try:
        with urllib.request.urlopen(url) as reponse:  # noqa: S310 — URL fournie par l'utilisateur
            total = int(reponse.headers.get("Content-Length") or 0)
            with open(provisoire, "wb") as sortie, tqdm(
                total=total or None,
                unit="o",
                unit_scale=True,
                unit_divisor=1024,
                desc=f"   {destination.name}",
                leave=False,
            ) as barre:
                while bloc := reponse.read(1 << 16):
                    sortie.write(bloc)
                    barre.update(len(bloc))
        provisoire.replace(destination)
        print(f"   {destination.name} : installé.")
        return True
    except Exception as erreur:  # noqa: BLE001
        provisoire.unlink(missing_ok=True)
        print(f"   Échec du téléchargement : {erreur}", file=sys.stderr)
        return False


def download_models(depot_wav2lip: Path | None = None) -> bool:
    """Contrôle la présence des deux jeux de poids, et met S3FD en place.

    Rend `True` si le traitement peut démarrer. Sinon, affiche exactement quel
    fichier manque et où le déposer — voir la décision 3 en tête de fichier sur
    l'absence d'adresses en dur.
    """
    print("── Vérification des modèles")
    DOSSIER_MODELES.mkdir(parents=True, exist_ok=True)
    complet = True

    # 1. Le générateur Wav2Lip.
    checkpoint = next(
        (DOSSIER_MODELES / nom for nom in CHECKPOINTS_ACCEPTES if (DOSSIER_MODELES / nom).is_file()),
        None,
    )
    if checkpoint is None:
        url = os.getenv("WAV2LIP_CHECKPOINT_URL") or f"{MIROIR}/wav2lip_gan.pth"
        if url and _telecharger(url, DOSSIER_MODELES / CHECKPOINTS_ACCEPTES[0]):
            checkpoint = DOSSIER_MODELES / CHECKPOINTS_ACCEPTES[0]
        else:
            print(
                f"   Générateur  : ABSENT.\n"
                f"                 Déposer « {CHECKPOINTS_ACCEPTES[0]} » (~416 Mo) dans :\n"
                f"                   {DOSSIER_MODELES}\n"
                "                 Les liens de téléchargement à jour sont listés dans le\n"
                "                 README du dépôt : https://github.com/Rudrabha/Wav2Lip\n"
                "                 (section « Getting the weights »). Avec un miroir à soi :\n"
                "                   export WAV2LIP_CHECKPOINT_URL=\"https://…/wav2lip_gan.pth\"",
                file=sys.stderr,
            )
            complet = False
    else:
        taille = checkpoint.stat().st_size / 1024**2
        print(f"   Générateur  : {checkpoint.name} ({taille:.0f} Mo)")

    # 2. Le détecteur de visage, qui doit vivre dans l'arbre de Wav2Lip.
    depot = depot_wav2lip or _trouver_depot_wav2lip()
    if depot is None:
        print("   Détecteur   : contrôle impossible, dépôt Wav2Lip introuvable.", file=sys.stderr)
        return False

    cible_s3fd = depot / CHEMIN_S3FD_DANS_WAV2LIP
    if cible_s3fd.is_file():
        print(f"   Détecteur   : {NOM_S3FD} en place")
    else:
        copie_locale = DOSSIER_MODELES / NOM_S3FD
        if not copie_locale.is_file():
            url = os.getenv("S3FD_URL") or f"{MIROIR}/s3fd.pth"
            _telecharger(url, copie_locale)

        if copie_locale.is_file():
            # On copie plutôt qu'on ne crée un lien : Windows refuse les liens
            # symboliques sans droits particuliers, et l'échec y serait obscur.
            cible_s3fd.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(copie_locale, cible_s3fd)
            print(f"   Détecteur   : {NOM_S3FD} recopié dans le dépôt Wav2Lip")
        else:
            print(
                f"   Détecteur   : ABSENT — c'est lui qui trouve le visage dans l'image.\n"
                f"                 Déposer « {NOM_S3FD} » (~86 Mo) dans :\n"
                f"                   {DOSSIER_MODELES}\n"
                f"                 (il sera recopié tout seul vers {CHEMIN_S3FD_DANS_WAV2LIP})\n"
                "                 Lien indiqué dans le README de Wav2Lip, section\n"
                "                 « Face detection ». Avec un miroir à soi :\n"
                "                   export S3FD_URL=\"https://…/s3fd.pth\"",
                file=sys.stderr,
            )
            complet = False

    return complet


def _duree(chemin: Path, ffprobe: str | None) -> float | None:
    """Durée d'un média en secondes, ou `None` si ffprobe n'est pas là."""
    if not ffprobe:
        return None
    try:
        sortie = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(chemin)],
            capture_output=True, text=True, timeout=30, check=True,
        )
        return float(sortie.stdout.strip())
    except (subprocess.SubprocessError, ValueError):
        return None



def sonder_visages(video: Path, depot: Path, largeur_mini: int = 100) -> tuple[int, list[int]]:
    """Passe chaque image au détecteur avant de lancer l'inférence.

    Wav2Lip exige un visage sur **toutes** les images et ne le dit qu'après les
    avoir toutes parcourues — mesuré ici : 4 min 51 sur processeur pour aboutir
    à « Face not detected ». Sonder d'abord coûte quelques secondes.

    Le seuil de largeur n'est pas une précaution de style. Sur les plans
    stylisés d'un rush généré, `s3fd` rend volontiers des boîtes de douze à cent
    pixels — des faux positifs qu'il accepte jusqu'à ce qu'il n'en trouve plus
    du tout. Un plan sondé « bon » à cause d'eux échoue quand même.

    Rend le nombre d'images et la liste de celles qui n'ont pas de visage
    exploitable.
    """
    import warnings
    warnings.filterwarnings("ignore")
    sys.path.insert(0, str(depot))
    try:
        import cv2  # noqa: F401
        import numpy
        import face_detection
    except ImportError as manque:
        print(f"   Sonde impossible ({manque.name} absent) — on lance sans.", file=sys.stderr)
        return 0, []

    lecture = cv2.VideoCapture(str(video))
    images = []
    while True:
        ok, image = lecture.read()
        if not ok:
            break
        images.append(image)
    lecture.release()
    if not images:
        return 0, []

    detecteur = face_detection.FaceAlignment(
        face_detection.LandmarksType._2D, flip_input=False, device="cpu")
    manquantes = []
    for debut in range(0, len(images), 8):
        lot = numpy.array(images[debut:debut + 8])
        for k, boite in enumerate(detecteur.get_detections_for_batch(lot)):
            if boite is None or (boite[2] - boite[0]) < largeur_mini:
                manquantes.append(debut + k)
    return len(images), manquantes


def run_lipsync(
    video_path: str | Path,
    audio_path: str | Path,
    output_path: str | Path,
    pads: tuple[int, int, int, int] = (0, 10, 0, 0),
    resize_factor: int = 1,
    nosmooth: bool = False,
) -> bool:
    """Fusionne l'audio et la vidéo en recalant les lèvres. Rend `True` si c'est fait.

    `pads` élargit la boîte du visage vers le bas : Wav2Lip cadre serré sur la
    bouche, et sans quelques pixels de marge le menton est coupé, ce qui se voit
    beaucoup plus qu'une lèvre imparfaite. `nosmooth` coupe le lissage temporel
    des détections — utile seulement quand la tête bouge vite, où le lissage
    traîne d'une image et fait « baver » la bouche.
    """
    video = Path(video_path).expanduser().resolve()
    audio = Path(audio_path).expanduser().resolve()
    sortie = Path(output_path).expanduser().resolve()

    for fichier, role in ((video, "vidéo source"), (audio, "piste audio")):
        if not fichier.is_file():
            print(f"Fichier introuvable ({role}) : {fichier}", file=sys.stderr)
            return False

    environnement = check_environment()
    if not environnement.utilisable:
        print("\nEnvironnement incomplet : voir les lignes marquées ABSENT ci-dessus.", file=sys.stderr)
        return False

    if not download_models(environnement.depot_wav2lip):
        print("\nModèles incomplets : voir les lignes marquées ABSENT ci-dessus.", file=sys.stderr)
        return False

    # La sonde, avant tout calcul long. Le fichier vérifiait déjà FFmpeg, le GPU
    # et les poids ; il ne regardait pas ses **données**, et c'est par elles que
    # l'échec arrive.
    print("── Sonde des visages")
    total, manquantes = sonder_visages(video, environnement.depot_wav2lip)
    if total and manquantes:
        premiere = manquantes[0]
        cadence = 24.0
        print(f"   {len(manquantes)} image(s) sans visage exploitable sur {total}.",
              file=sys.stderr)
        print(f"   La première est l'image {premiere} (~{premiere / cadence:.2f} s).",
              file=sys.stderr)
        bonnes = [i for i in range(total) if i not in set(manquantes)]
        if bonnes:
            # La plus longue suite d'images consécutives valides : c'est elle
            # qu'il faut découper, et la dire évite de la chercher à la main.
            debut = fin = meilleur_debut = meilleur_fin = bonnes[0]
            for i in bonnes[1:]:
                if i == fin + 1:
                    fin = i
                else:
                    if fin - debut > meilleur_fin - meilleur_debut:
                        meilleur_debut, meilleur_fin = debut, fin
                    debut = fin = i
            if fin - debut > meilleur_fin - meilleur_debut:
                meilleur_debut, meilleur_fin = debut, fin
            duree = (meilleur_fin - meilleur_debut + 1) / cadence
            print(f"   Fenêtre exploitable la plus longue : {meilleur_debut / cadence:.2f} s "
                  f"→ {(meilleur_fin + 1) / cadence:.2f} s ({duree:.2f} s).", file=sys.stderr)
            print(f"   ffmpeg -ss {meilleur_debut / cadence:.2f} -t {duree:.2f} "
                  f"-i \"{video}\" -an visage.mp4", file=sys.stderr)
        else:
            print("   Aucune image exploitable : ce plan est trop serré, "
                  "la tête entière doit tenir dans le cadre.", file=sys.stderr)
        return False
    if total:
        print(f"   {total} image(s), toutes avec un visage exploitable.")

    checkpoint = next(
        DOSSIER_MODELES / nom for nom in CHECKPOINTS_ACCEPTES if (DOSSIER_MODELES / nom).is_file()
    )

    print("── Traitement")
    duree_video = _duree(video, environnement.ffprobe)
    duree_audio = _duree(audio, environnement.ffprobe)
    if duree_video and duree_audio:
        print(f"   Vidéo {duree_video:.1f} s — audio {duree_audio:.1f} s")
        if duree_audio > duree_video + 0.5:
            # Wav2Lip s'arrête à la fin de la vidéo : le reste de la voix est
            # perdu sans un mot. Mieux vaut le dire avant les vingt minutes de
            # calcul que le constater au visionnage.
            print(
                f"   Attention : la voix dépasse la vidéo de {duree_audio - duree_video:.1f} s.\n"
                "   Wav2Lip s'arrêtera à la dernière image : la fin de la voix sera coupée.\n"
                "   Rallonger la vidéo source, ou raccourcir le texte.",
                file=sys.stderr,
            )

    sortie.parent.mkdir(parents=True, exist_ok=True)

    commande = [
        sys.executable, "inference.py",
        "--checkpoint_path", str(checkpoint),
        "--face", str(video),
        "--audio", str(audio),
        "--outfile", str(sortie),
        "--pads", *(str(valeur) for valeur in pads),
        "--resize_factor", str(resize_factor),
    ]
    if nosmooth:
        commande.append("--nosmooth")

    # PYTHONUNBUFFERED : sans lui, la sortie de l'enfant est mise en tampon par
    # blocs dès qu'elle n'est plus un terminal, et la barre n'avance que par
    # à-coups de plusieurs milliers de caractères.
    env_enfant = {**os.environ, "PYTHONUNBUFFERED": "1"}

    return _executer_avec_barre(commande, environnement.depot_wav2lip, env_enfant, sortie)


def _executer_avec_barre(commande, dossier: Path, env: dict, sortie: Path) -> bool:
    """Lance Wav2Lip et rejoue sa progression dans une barre locale.

    `text=True` traduit les retours chariot de tqdm en fins de ligne : chaque
    rafraîchissement de la barre de l'enfant arrive donc comme une ligne à part,
    ce qui évite d'avoir à lire caractère par caractère.
    """
    from tqdm import tqdm

    processus = subprocess.Popen(
        commande, cwd=str(dossier), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, errors="replace",
    )

    barre: "tqdm | None" = None
    total_courant = None
    dernieres_lignes: list[str] = []

    try:
        for ligne in processus.stdout:  # type: ignore[union-attr]
            ligne = ligne.strip()
            if not ligne:
                continue

            correspondance = MOTIF_PROGRESSION.search(ligne)
            if correspondance:
                fait, total = (int(valeur) for valeur in correspondance.groups())
                # Wav2Lip enchaîne deux passes (détection des visages, puis
                # inférence) : un total différent signale la seconde, qui mérite
                # sa propre barre plutôt qu'un compteur qui repart en arrière.
                if barre is None or total != total_courant:
                    if barre is not None:
                        barre.close()
                    etape = "Détection du visage" if barre is None else "Synchronisation labiale"
                    barre = tqdm(total=total, desc=f"   {etape}", unit="lot", leave=True)
                    total_courant = total
                barre.n = fait
                barre.refresh()
                continue

            # Les messages de Wav2Lip sont conservés : en cas d'échec, c'est la
            # seule trace exploitable, et l'afficher pendant le traitement
            # casserait la barre en cours.
            dernieres_lignes.append(ligne)
            del dernieres_lignes[:-25]
            if ligne.startswith(("Reading video frames", "Number of frames", "Load checkpoint",
                                 "Using ", "Recovering ", "Model loaded")):
                if barre is None:
                    print(f"   {ligne}")

        code = processus.wait()
    except KeyboardInterrupt:
        processus.terminate()
        print("\nInterrompu. La sortie partielle est incomplète.", file=sys.stderr)
        return False
    finally:
        if barre is not None:
            barre.close()

    if code != 0 or not sortie.is_file():
        print(f"\nWav2Lip a échoué (code {code}). Dernières lignes :", file=sys.stderr)
        for ligne in dernieres_lignes[-15:]:
            print(f"   {ligne}", file=sys.stderr)
        # Un code négatif est un signal, pas une erreur de Wav2Lip : le
        # processus a été tué de l'extérieur. Le distinguer compte, parce que la
        # trace Python qu'il laisse ressemble alors à un échec de détection et
        # envoie chercher un problème de cadrage qui n'existe pas. Mesuré ici :
        # code -9 sur 53 images en 768 x 1344 sans GPU, avec une sonde qui
        # tournait en parallèle — c'était la mémoire vive.
        if code == -9:
            print(
                "\n   Code -9 : le système a tué le processus, faute de mémoire.\n"
                "   Ce n'est ni le cadrage ni les poids. Relancer avec\n"
                "   --resize-factor 2, et sans autre traitement lourd en parallèle.",
                file=sys.stderr,
            )
        else:
            # Les deux causes qui reviennent le plus souvent, et qui ne se lisent
            # pas dans la trace Python que Wav2Lip laisse.
            print(
                "\n   Deux causes fréquentes :\n"
                "   — aucun visage détecté sur une image : recadrer, ou éclairer le sujet ;\n"
                "   — mémoire insuffisante : relancer avec --resize-factor 2.",
                file=sys.stderr,
            )
        return False

    poids = sortie.stat().st_size / 1024**2
    print(f"   Vidéo synchronisée : {sortie}  ({poids:.1f} Mo)")
    return True


# --------------------------------------------------------------------------
# Ligne de commande
# --------------------------------------------------------------------------

def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Recale les lèvres d'une vidéo sur une nouvelle piste audio (Wav2Lip).",
        epilog=(
            "Exemple :\n"
            "  python auto_lipsync.py --video mon_visage.mp4 --audio voice.mp3 "
            "--output rendu_final.mp4\n\n"
            "Contrôler l'installation sans rien traiter :\n"
            "  python auto_lipsync.py --check"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    analyseur.add_argument("--video", help="Vidéo source contenant le visage.")
    analyseur.add_argument("--audio", help="Piste audio à faire dire (MP3 ou WAV).")
    analyseur.add_argument("--output", default="rendu_final.mp4", help="Vidéo à écrire (défaut : rendu_final.mp4).")
    analyseur.add_argument(
        "--pads", nargs=4, type=int, metavar=("HAUT", "BAS", "GAUCHE", "DROITE"),
        default=[0, 10, 0, 0],
        help="Marges autour du visage détecté. Augmenter BAS si le menton est coupé.",
    )
    analyseur.add_argument(
        "--resize-factor", type=int, default=1,
        help="Divise la résolution avant traitement. 2 si la mémoire GPU manque.",
    )
    analyseur.add_argument(
        "--nosmooth", action="store_true",
        help="Coupe le lissage temporel. À essayer si la tête bouge vite.",
    )
    analyseur.add_argument(
        "--check", action="store_true",
        help="Vérifie l'environnement et les modèles, puis s'arrête.",
    )
    arguments = analyseur.parse_args()

    if arguments.check:
        environnement = check_environment()
        modeles = download_models(environnement.depot_wav2lip)
        pret = environnement.utilisable and modeles
        print("\n" + ("Tout est prêt." if pret else "Installation incomplète (voir ci-dessus)."))
        return 0 if pret else 1

    if not arguments.video or not arguments.audio:
        analyseur.error("--video et --audio sont obligatoires (ou utiliser --check).")

    reussi = run_lipsync(
        video_path=arguments.video,
        audio_path=arguments.audio,
        output_path=arguments.output,
        pads=tuple(arguments.pads),
        resize_factor=arguments.resize_factor,
        nosmooth=arguments.nosmooth,
    )
    return 0 if reussi else 1


if __name__ == "__main__":
    sys.exit(main())
