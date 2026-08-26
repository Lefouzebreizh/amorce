#!/usr/bin/env python3
"""Monter la bande-son d'une vidéo et la sortir au niveau de la plateforme visée.

Quatre décisions tiennent ce fichier :

1. **Deux passes, toujours.** `loudnorm` en une passe travaille au fil de l'eau :
   il compresse ce qu'il n'a pas encore entendu et rate la cible de plusieurs
   LU. On mesure d'abord le mixage, on applique ensuite les valeurs mesurées.
   C'est la seule façon de promettre un chiffre et de le tenir.
2. **La baisse suit les passages parlés, elle n'est pas un réglage de volume.**
   Une musique posée douze décibels plus bas reste intelligible sous la parole
   mais disparaît dans les blancs, là où elle devrait porter. Elle plonge donc
   quand ça parle et remonte quand ça se tait — et cet étage de gain est
   distinct de celui du curseur, sinon les deux s'effacent l'un l'autre.
3. **La baisse est une enveloppe calculée, pas un compresseur à chaîne latérale.**
   Mesuré : `sidechaincompress` réglé pour douze décibels n'en rendait que huit,
   et donnait le même résultat pour zéro et pour six — son taux dépend du niveau
   instantané de la voix, qui n'est pas sa loudness intégrée. Une enveloppe
   trapézoïdale tracée sur les passages parlés donne exactement la profondeur
   demandée, ce qui est la condition pour l'annoncer dans la carte du mixage.
4. **L'image n'est jamais ré-encodée.** Seul le son change : `-c:v copy`. Le
   ré-encodage coûterait plusieurs minutes et une perte de qualité pour rien.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sonometre import (  # noqa: E402
    duree_secondes, mesurer_loudness, passages_parles, trouver_ffmpeg,
)

# Ce que chaque plateforme fait au fichier qu'on lui envoie. Elle baisse ce qui
# dépasse, elle ne remonte pas ce qui manque : viser la cible, jamais au-dessus.
PLATEFORMES = {
    "tiktok": -14.0, "reels": -14.0, "shorts": -14.0, "instagram": -14.0,
    "youtube": -14.0, "podcast": -16.0, "tv": -23.0,
}

# La phrase d'intention se traduit ici, en ÉCART à la voix et non en gain
# absolu. Mesuré au banc d'essai : sur des sources où la musique était déjà
# onze décibels sous la voix, appliquer les « -16 dB » du tableau l'enterrait
# vingt-sept décibels plus bas, donc inaudible. Seul l'écart a un sens, et un
# gain absolu n'en a aucun : la normalisation finale remet de toute façon
# l'ensemble à la cible de la plateforme.
# Premier mot-clé reconnu qui gagne ; contredisable par --ecart-db et --baisse-db.
INTENTIONS = [
    (("calme", "intime", "témoignage", "temoignage", "doux"), 20.0, 12.0),
    (("tutoriel", "voix off", "explication", "démonstration", "demonstration", "tuto"), 16.0, 10.0),
    (("produit", "présentation", "presentation"), 14.0, 10.0),
    (("rythmé", "rythme", "sport", "accroche", "dynamique", "énergique", "energique"), 10.0, 8.0),
    (("ambiance", "voyage", "paysage", "sans parole", "musical"), 12.0, 10.0),
]
INTENTION_DEFAUT = (16.0, 10.0)


def reglages_depuis_intention(phrase: str) -> tuple[float, float]:
    minuscule = phrase.lower()
    for mots, ecart_db, baisse_db in INTENTIONS:
        if any(mot in minuscule for mot in mots):
            return ecart_db, baisse_db
    return INTENTION_DEFAUT


def gain_musique(loudness_voix: float | None, loudness_musique: float | None,
                 ecart_db: float) -> float:
    """Le gain qui pose la musique `ecart_db` sous la voix, telles qu'elles sont.

    Sans voix, le gain de la musique n'a aucun effet : elle est seule, et la
    normalisation finale la ramène à la cible quoi qu'on fasse ici. On ne touche
    donc à rien plutôt que d'appliquer un chiffre qui ne veut rien dire.
    """
    if loudness_voix is None or loudness_musique is None:
        return 0.0
    return round((loudness_voix - ecart_db) - loudness_musique, 1)


def enveloppe_baisse(segments: list[dict], baisse_db: float,
                     attaque: float = 0.15, relache: float = 0.45) -> str | None:
    """Rend l'expression de gain qui fait plonger la musique sous la parole.

    Un trapèze par passage parlé — montée sur `attaque` avant le premier mot,
    plateau, descente sur `relache` après le dernier — et le maximum de tous les
    trapèzes. La relâche est trois fois plus longue que l'attaque : rattraper
    tard s'entend beaucoup moins que revenir trop tôt sur une fin de phrase.
    """
    if baisse_db <= 0 or not segments:
        return None

    # Deux passages plus rapprochés que la remontée complète seraient une
    # remontée pour rien, aussitôt suivie d'une replongée : ça pompe.
    fusionnes: list[list[float]] = []
    for segment in segments:
        debut, fin = segment["debut_s"], segment["fin_s"]
        if fusionnes and debut - fusionnes[-1][1] < attaque + relache:
            fusionnes[-1][1] = fin
        else:
            fusionnes.append([debut, fin])

    # L'expression passe entière à ffmpeg : au-delà d'une cinquantaine de
    # trapèzes elle devient illisible et lente à évaluer. On fusionne davantage.
    while len(fusionnes) > 50:
        ecarts = [fusionnes[i + 1][0] - fusionnes[i][1] for i in range(len(fusionnes) - 1)]
        i = ecarts.index(min(ecarts))
        fusionnes[i][1] = fusionnes[i + 1][1]
        del fusionnes[i + 1]

    gain = 10 ** (-baisse_db / 20)
    trapezes = [
        f"clip((t-{max(0.0, debut - attaque):.3f})/{attaque},0,1)"
        f"*clip(({fin + relache:.3f}-t)/{relache},0,1)"
        for debut, fin in fusionnes
    ]
    enveloppe = trapezes[0]
    for trapeze in trapezes[1:]:
        enveloppe = f"max({enveloppe},{trapeze})"
    return f"1-{1 - gain:.4f}*({enveloppe})"


def _lancer(commande: list[str], quoi: str) -> None:
    resultat = subprocess.run(commande, capture_output=True, text=True)
    if resultat.returncode != 0:
        sys.exit(f"Échec {quoi} :\n{resultat.stderr[-2000:]}")


def construire_mixage(ff: str, options, duree: float, temporaire: Path,
                      segments_parles: list[dict]) -> dict:
    """Première passe : assemble les sources dans un WAV flottant, sans normaliser.

    Le format flottant n'est pas un détail : deux sources additionnées dépassent
    régulièrement le plein niveau, et un entier 16 bits écrêterait sur place ce
    que la normalisation allait de toute façon redescendre.
    """
    entrees, etiquettes, index = [], {}, 0

    if options.voix_de_la_video:
        entrees += ["-i", str(options.video)]
        etiquettes["voix"] = f"{index}:a:0"
        index += 1
    elif options.voix:
        entrees += ["-i", str(options.voix)]
        etiquettes["voix"] = f"{index}:a:0"
        index += 1

    if options.musique:
        # `-stream_loop` boucle au démultiplexage : plus sûr qu'`aloop`, qui se
        # règle en nombre d'échantillons et dépend donc du fichier.
        entrees += ["-stream_loop", "-1", "-i", str(options.musique)]
        etiquettes["musique"] = f"{index}:a:0"
        index += 1

    if not etiquettes:
        sys.exit("Ni musique ni voix : il n'y a pas de bande-son à monter.")

    format_commun = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"
    chaines = []
    baisse = None
    if "musique" in etiquettes and "voix" in etiquettes:
        baisse = enveloppe_baisse(segments_parles, options.baisse_db)

    if "musique" in etiquettes:
        debut_fondu = max(0.0, duree - options.fondu)
        # La baisse s'écrit dans son propre `volume`, après celui du curseur :
        # les fondre en un seul ferait que bouger le niveau efface la baisse.
        creux = f",volume=volume='{baisse}':eval=frame" if baisse else ""
        chaines.append(
            f"[{etiquettes['musique']}]{format_commun},atrim=0:{duree:.3f},"
            f"asetpts=N/SR/TB,volume={options.musique_db}dB{creux},"
            f"afade=t=out:st={debut_fondu:.3f}:d={options.fondu}[mus]"
        )
    if "voix" in etiquettes:
        # `adelay` plutôt qu'un fichier de silence fabriqué à côté : une voix off
        # ne commence jamais sur la première image, et poser un décalage ne doit
        # pas obliger à réécrire le fichier source.
        decalage = ""
        if options.voix_debut > 0:
            millisecondes = int(options.voix_debut * 1000)
            decalage = f",adelay={millisecondes}|{millisecondes}"
        chaines.append(
            f"[{etiquettes['voix']}]{format_commun},volume={options.voix_db}dB{decalage}[voix]"
        )

    if "musique" in etiquettes and "voix" in etiquettes:
        # `normalize=0` : sans lui, amix divise par le nombre d'entrées et fait
        # perdre six décibels à tout le monde, voix comprise.
        chaines.append("[voix][mus]amix=inputs=2:duration=longest:normalize=0[somme]")
    else:
        chaines.append(f"[{'mus' if 'musique' in etiquettes else 'voix'}]anull[somme]")

    chaines.append(f"[somme]apad,atrim=0:{duree:.3f}[mix]")

    _lancer(
        [ff, "-y", "-hide_banner", "-nostats", *entrees,
         "-filter_complex", ";".join(chaines),
         "-map", "[mix]", "-ar", "48000", "-ac", "2",
         "-c:a", "pcm_f32le", str(temporaire)],
        "de l'assemblage des sources",
    )
    return {"passages_parles": len(segments_parles) if baisse else 0}


def normaliser_et_remultiplexer(ff: str, video: Path, mixage: Path,
                                mesures: dict, cible: float, sortie: Path) -> None:
    """Seconde passe : normalise avec les valeurs mesurées et recolle l'image."""
    loudnorm = (
        f"loudnorm=I={cible}:TP=-1:LRA=11"
        f":measured_I={mesures['measured_I']}"
        f":measured_TP={mesures['measured_TP']}"
        f":measured_LRA={mesures['measured_LRA']}"
        f":measured_thresh={mesures['measured_thresh']}"
        f":offset={mesures['offset']}:linear=true"
    )
    _lancer(
        [ff, "-y", "-hide_banner", "-nostats",
         "-i", str(video), "-i", str(mixage),
         "-map", "0:v:0", "-map", "1:a:0", "-af", loudnorm,
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-ar", "48000", "-ac", "2", "-shortest", str(sortie)],
        "de la normalisation",
    )


def main() -> None:
    analyseur = argparse.ArgumentParser(
        description="Monte la bande-son d'une vidéo et la normalise pour une plateforme."
    )
    analyseur.add_argument("--video", type=Path, required=True)
    analyseur.add_argument("--musique", type=Path)
    analyseur.add_argument("--voix", type=Path)
    analyseur.add_argument("--voix-de-la-video", action="store_true",
                           help="la voix est déjà dans la piste audio de la vidéo")
    analyseur.add_argument("--plateforme", default="tiktok", choices=sorted(PLATEFORMES))
    analyseur.add_argument("--intention", default="",
                           help="la phrase de l'utilisateur, d'où sont déduits les niveaux")
    analyseur.add_argument("--ecart-db", type=float,
                           help="de combien la musique se pose sous la voix (contredit l'intention)")
    analyseur.add_argument("--musique-db", type=float,
                           help="gain absolu de la musique, court-circuite le calcul d'écart")
    analyseur.add_argument("--baisse-db", type=float, help="profondeur de la baisse sous la voix")
    analyseur.add_argument("--voix-db", type=float, default=0.0)
    analyseur.add_argument("--voix-debut", type=float, default=0.0, metavar="SECONDES",
                           help="à quel instant la voix off commence (défaut : 0)")
    analyseur.add_argument("--fondu", type=float, default=2.0, help="fondu de sortie, en secondes")
    analyseur.add_argument("--sortie", type=Path)
    analyseur.add_argument("--json", action="store_true", help="ne rendre que la fiche JSON")
    options = analyseur.parse_args()

    ff = trouver_ffmpeg()
    if not options.video.exists():
        sys.exit(f"Vidéo introuvable : {options.video}")

    ecart_db, baisse_db = reglages_depuis_intention(options.intention)
    options.ecart_db = options.ecart_db if options.ecart_db is not None else ecart_db
    options.baisse_db = options.baisse_db if options.baisse_db is not None else baisse_db
    options.sortie = options.sortie or options.video.with_name(
        options.video.stem + "-bande-son" + options.video.suffix
    )

    cible = PLATEFORMES[options.plateforme]
    duree = duree_secondes(ff, options.video)
    if not duree:
        sys.exit("Durée de la vidéo illisible.")

    source_voix = options.video if options.voix_de_la_video else options.voix
    segments = passages_parles(ff, source_voix, duree) if source_voix else []
    if options.voix_debut and not options.voix_de_la_video:
        # Décaler aussi les passages parlés : la plongée de la musique se calcule
        # dessus, et une baisse qui tombe avant la voix s'entend comme un trou.
        segments = [{"debut_s": s["debut_s"] + options.voix_debut,
                     "fin_s": min(duree, s["fin_s"] + options.voix_debut)}
                    for s in segments if s["debut_s"] + options.voix_debut < duree]

    # Les deux sources se mesurent avant tout réglage : c'est ce qui distingue
    # « la musique seize décibels sous la voix » de « la musique à -16 dB ».
    if options.musique_db is None:
        voix_mesuree = mesurer_loudness(ff, source_voix, cible) if source_voix else None
        musique_mesuree = mesurer_loudness(ff, options.musique, cible) if options.musique else None
        options.musique_db = gain_musique(
            voix_mesuree["loudness_lufs"] if voix_mesuree else None,
            musique_mesuree["loudness_lufs"] if musique_mesuree else None,
            options.ecart_db,
        )

    with tempfile.TemporaryDirectory() as dossier:
        temporaire = Path(dossier) / "mixage.wav"
        laterale = construire_mixage(ff, options, duree, temporaire, segments)

        mesure_mixage = mesurer_loudness(ff, temporaire, cible)
        if not mesure_mixage:
            sys.exit("Le mixage assemblé n'a pas pu être mesuré.")

        normaliser_et_remultiplexer(
            ff, options.video, temporaire,
            mesure_mixage["_mesures_pour_seconde_passe"], cible, options.sortie,
        )

    # On mesure le fichier livré, pas le mixage d'avant encodage : l'encodeur AAC
    # déplace le vrai pic, et c'est ce fichier-là que la plateforme recevra.
    final = mesurer_loudness(ff, options.sortie, cible)
    fiche = {
        "sortie": str(options.sortie),
        "plateforme": options.plateforme,
        "cible_lufs": cible,
        "duree_s": round(duree, 2),
        "decide": {
            "ecart_db": options.ecart_db if source_voix and options.musique else None,
            "musique_db": options.musique_db,
            "baisse_db": options.baisse_db if source_voix and options.musique else None,
            "voix_db": options.voix_db,
            "voix_debut_s": options.voix_debut,
            "fondu_s": options.fondu,
            **laterale,
        },
        "mesure": {
            "loudness_lufs": final["loudness_lufs"] if final else None,
            "vrai_pic_dbtp": final["vrai_pic_dbtp"] if final else None,
            "etendue_lu": final["etendue_lu"] if final else None,
        },
    }

    if options.json:
        print(json.dumps(fiche, ensure_ascii=False, indent=2))
        return

    ecart = (final["loudness_lufs"] - cible) if final else math.nan
    verdict = "conforme" if abs(ecart) <= 1.0 else "hors cible — à reprendre"
    baisse = fiche["decide"]["baisse_db"]
    print(f"Bande-son — {options.sortie}")
    print(f"  Mesuré : {final['loudness_lufs']:.1f} LUFS · "
          f"vrai pic {final['vrai_pic_dbtp']:.1f} dBTP · "
          f"étendue {final['etendue_lu']:.1f} LU  → {verdict} ({options.plateforme})")
    ecart = fiche["decide"]["ecart_db"]
    print(f"  Décidé : musique {options.musique_db:+.0f} dB"
          + (f" (soit {ecart:.0f} dB sous la voix)" if ecart is not None else "")
          + (f", plongeant de {baisse:.0f} dB de plus sous la parole" if baisse else "")
          + f" · fondu de sortie {options.fondu:.1f} s")
    print("  À changer d'un mot : « plus de musique », « la voix devant », « plus calme »")


if __name__ == "__main__":
    main()
