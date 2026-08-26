#!/usr/bin/env python3
"""Toute la chaîne en une commande — voix, lèvres, timeline.

Enchaîne les trois maillons : le texte devient une voix off, les lèvres du
visage filmé s'y recalent, et le résultat atterrit sur une timeline DaVinci
Resolve. Les trois scripts restent utilisables seuls ; celui-ci ne fait que les
appeler dans l'ordre, en s'occupant de ce qui manquait entre eux — la reprise.

    python faire_ma_video.py --text "Bonjour à tous" --video mon_visage.mp4

Quatre décisions tiennent ce fichier :

1. **Une étape n'est rejouée que si ses entrées ont changé.** C'est toute la
   raison d'être de ce script. Le lip-sync coûte de quelques minutes à une
   heure : le relancer parce qu'on a corrigé une faute dans le texte est
   normal, le relancer parce qu'on a relancé la commande ne l'est pas. Chaque
   étape enregistre l'empreinte de ce qui l'a produite ; elle est réutilisée
   tant que cette empreinte tient.
2. **Réutiliser un fichier périmé est pire que tout recalculer.** Un texte
   corrigé et une voix inchangée donnent une vidéo qui s'ouvre normalement et
   dit la mauvaise chose. L'empreinte porte donc sur les *entrées* — texte,
   voix, modèle, fichiers sources et réglages — jamais sur la seule présence
   du fichier de sortie.
3. **Les maillons sont importés, pas relancés.** Appeler leurs fonctions plutôt
   que d'ouvrir trois processus Python évite de recharger PyTorch entre deux
   étapes, et surtout garde un seul chemin de code : ce sont exactement les
   fonctions déjà éprouvées par les tests.
4. **Resolve est un bonus, pas le livrable.** Le livrable est la vidéo. Si
   Resolve n'est pas ouvert, la chaîne ne fait pas semblant d'avoir échoué :
   elle dit où est le fichier et comment l'importer plus tard.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent

from auto_lipsync import run_lipsync  # noqa: E402
from elevenlabs_voice import MODELE_PAR_DEFAUT, VOIX_PAR_DEFAUT, generate_speech  # noqa: E402
from prepare_my_edit import preparer_montage  # noqa: E402

NOM_ETAT = ".chaine.json"


# --------------------------------------------------------------------------
# Empreintes et reprise
# --------------------------------------------------------------------------

def _empreinte(*parties: object) -> str:
    """Empreinte courte et stable des entrées d'une étape."""
    condense = hashlib.sha256("\x1f".join(str(partie) for partie in parties).encode()).hexdigest()
    return condense[:16]


def empreinte_fichier(chemin: Path) -> str:
    """Empreinte d'un fichier d'entrée, par sa taille et sa date.

    Volontairement pas un condensé du contenu : une vidéo source pèse souvent
    plusieurs centaines de mégaoctets, et la relire entièrement à chaque
    lancement coûterait plus que l'étape qu'on cherche à éviter. Le prix de ce
    choix est connu : un fichier restauré d'une sauvegarde avec sa date
    d'origine et la même taille passera pour inchangé. `--refaire` est là pour
    ce cas-là.
    """
    if not chemin.is_file():
        return "absent"
    infos = chemin.stat()
    return _empreinte(chemin.name, infos.st_size, int(infos.st_mtime))


def faut_il_executer(etat_precedent: dict | None, empreinte_voulue: str,
                     sortie: Path, refaire: bool) -> bool:
    """Dit si une étape doit tourner, ou si son résultat précédent tient encore.

    Les trois raisons d'exécuter sont distinctes et toutes nécessaires : jamais
    fait, entrées changées, ou fichier disparu depuis. La dernière est celle
    qu'on oublie — un résultat effacé à la main laisserait sinon un état qui
    prétend que l'étape est faite.
    """
    if refaire:
        return True
    if not sortie.is_file() or sortie.stat().st_size == 0:
        return True
    if etat_precedent is None:
        return True
    return etat_precedent.get("empreinte") != empreinte_voulue


def lire_etat(fichier: Path) -> dict:
    """Relit l'état de la chaîne. Un état illisible n'arrête rien : on refait."""
    try:
        contenu = json.loads(fichier.read_text())
        return contenu if isinstance(contenu, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def ecrire_etat(fichier: Path, etat: dict) -> None:
    """Enregistre l'état. Un échec d'écriture ne fait perdre que la reprise."""
    try:
        fichier.parent.mkdir(parents=True, exist_ok=True)
        fichier.write_text(json.dumps(etat, indent=2, ensure_ascii=False))
    except OSError as erreur:
        print(f"   (état non enregistré : {erreur} — la prochaine fois, tout sera refait)")


# --------------------------------------------------------------------------
# La chaîne
# --------------------------------------------------------------------------

def _annoncer(numero: int, total: int, titre: str, reutilise: bool = False) -> None:
    suffixe = "  (inchangé, réutilisé)" if reutilise else ""
    print(f"\n── Étape {numero}/{total} · {titre}{suffixe}")


def faire_ma_video(
    texte: str,
    video_visage: Path,
    sortie_finale: Path,
    dossier_travail: Path,
    voice_id: str = VOIX_PAR_DEFAUT,
    model_id: str = MODELE_PAR_DEFAUT,
    pads: tuple[int, int, int, int] = (0, 10, 0, 0),
    resize_factor: int = 1,
    nosmooth: bool = False,
    refaire: bool = False,
    sans_resolve: bool = False,
) -> int:
    """Déroule les trois étapes. Rend le code de retour du programme."""
    total = 2 if sans_resolve else 3
    fichier_etat = dossier_travail / NOM_ETAT
    etat = lire_etat(fichier_etat)

    # --- Étape 1 : la voix off ---------------------------------------------
    voix = dossier_travail / "voix.mp3"
    empreinte_voix = _empreinte(texte, voice_id, model_id)

    if faut_il_executer(etat.get("voix"), empreinte_voix, voix, refaire):
        _annoncer(1, total, "Voix off")
        if generate_speech(texte, voice_id, voix, model_id) is None:
            return 1
        etat["voix"] = {"empreinte": empreinte_voix, "sortie": str(voix)}
        ecrire_etat(fichier_etat, etat)
    else:
        _annoncer(1, total, "Voix off", reutilise=True)
        print(f"   {voix}")

    # --- Étape 2 : la synchronisation labiale -------------------------------
    # L'empreinte inclut celle de la voix : une voix refaite doit entraîner un
    # lip-sync refait, même si le texte n'a pas bougé d'un caractère (un autre
    # modèle, une autre voix).
    empreinte_lipsync = _empreinte(
        empreinte_voix, empreinte_fichier(voix), empreinte_fichier(video_visage),
        pads, resize_factor, nosmooth,
    )

    if faut_il_executer(etat.get("lipsync"), empreinte_lipsync, sortie_finale, refaire):
        _annoncer(2, total, "Synchronisation labiale")
        if not run_lipsync(video_visage, voix, sortie_finale, pads, resize_factor, nosmooth):
            return 1
        etat["lipsync"] = {"empreinte": empreinte_lipsync, "sortie": str(sortie_finale)}
        ecrire_etat(fichier_etat, etat)
    else:
        _annoncer(2, total, "Synchronisation labiale", reutilise=True)
        print(f"   {sortie_finale}")

    if sans_resolve:
        print(f"\nTerminé. Vidéo prête : {sortie_finale}")
        return 0

    # --- Étape 3 : la timeline ----------------------------------------------
    # Jamais mise en cache : importer deux fois dans Resolve crée deux projets,
    # ce qui est sans danger, alors que sauter l'import laisserait l'utilisateur
    # devant un Resolve vide en croyant l'avoir rempli.
    _annoncer(3, total, "Timeline DaVinci Resolve")
    if not preparer_montage([sortie_finale]):
        # Voir la décision 4 : la vidéo existe, c'est ce qui compte.
        print(
            f"\nLa vidéo est prête : {sortie_finale}\n"
            "  Seul l'import dans Resolve a échoué (voir la cause ci-dessus).\n"
            f"  Une fois Resolve ouvert :  python prepare_my_edit.py --file \"{sortie_finale}\"",
            file=sys.stderr,
        )
        return 1

    print(f"\nTerminé. Vidéo prête : {sortie_finale}")
    return 0


# --------------------------------------------------------------------------
# Ligne de commande
# --------------------------------------------------------------------------

def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Enchaîne voix off, synchronisation labiale et dérushage en une commande.",
        epilog=(
            "Exemples :\n"
            "  python faire_ma_video.py --text \"Bonjour à tous\" --video visage.mp4\n"
            "  python faire_ma_video.py --text-file script.txt --video visage.mp4 "
            "--output episode_12.mp4\n"
            "  python faire_ma_video.py --text \"...\" --video visage.mp4 --sans-resolve\n\n"
            "Relancée après une correction du texte, la commande ne refait que ce\n"
            "qui en dépend. Après un échec, elle reprend où elle s'était arrêtée."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    source = analyseur.add_mutually_exclusive_group(required=True)
    source.add_argument("--text", help="Le texte à faire dire.")
    source.add_argument("--text-file", dest="fichier_texte",
                        help="Fichier contenant le texte (UTF-8).")

    analyseur.add_argument("--video", required=True, help="Vidéo du visage à animer.")
    analyseur.add_argument("--output", default="rendu_final.mp4",
                           help="Vidéo finale (défaut : rendu_final.mp4).")
    analyseur.add_argument("--travail", default=None,
                           help="Dossier des fichiers intermédiaires (défaut : .chaine/ à côté de la sortie).")
    analyseur.add_argument("--voice", default=VOIX_PAR_DEFAUT, help="Identifiant de la voix ElevenLabs.")
    analyseur.add_argument("--model", default=MODELE_PAR_DEFAUT, help="Modèle de synthèse.")
    analyseur.add_argument("--pads", nargs=4, type=int, default=[0, 10, 0, 0],
                           metavar=("HAUT", "BAS", "GAUCHE", "DROITE"),
                           help="Marges autour du visage. Augmenter BAS si le menton est coupé.")
    analyseur.add_argument("--resize-factor", type=int, default=1,
                           help="Divise la résolution. 2 si la mémoire GPU manque.")
    analyseur.add_argument("--nosmooth", action="store_true",
                           help="Coupe le lissage temporel du lip-sync.")
    analyseur.add_argument("--refaire", action="store_true",
                           help="Refait toutes les étapes, même celles qui n'ont pas changé.")
    analyseur.add_argument("--sans-resolve", action="store_true",
                           help="S'arrête après la vidéo, sans toucher à DaVinci Resolve.")
    arguments = analyseur.parse_args()

    if arguments.fichier_texte:
        chemin_texte = Path(arguments.fichier_texte).expanduser()
        try:
            texte = chemin_texte.read_text(encoding="utf-8")
        except OSError as erreur:
            print(f"Texte illisible : {erreur}", file=sys.stderr)
            return 1
    else:
        texte = arguments.text

    video = Path(arguments.video).expanduser().resolve()
    if not video.is_file():
        print(f"Vidéo introuvable : {video}", file=sys.stderr)
        return 1

    sortie = Path(arguments.output).expanduser().resolve()
    travail = (Path(arguments.travail).expanduser().resolve()
               if arguments.travail else sortie.parent / ".chaine")
    travail.mkdir(parents=True, exist_ok=True)

    return faire_ma_video(
        texte=texte,
        video_visage=video,
        sortie_finale=sortie,
        dossier_travail=travail,
        voice_id=arguments.voice,
        model_id=arguments.model,
        pads=tuple(arguments.pads),
        resize_factor=arguments.resize_factor,
        nosmooth=arguments.nosmooth,
        refaire=arguments.refaire,
        sans_resolve=arguments.sans_resolve,
    )


if __name__ == "__main__":
    sys.exit(main())
