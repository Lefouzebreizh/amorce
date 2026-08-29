#!/usr/bin/env python3
"""
Mesure la grammaire de montage d'une vidéo de référence.

Pas de jugement, pas d'interprétation : des nombres, et la planche d'images qui
va avec. Ce que l'outil rend est ce qu'Amorce sait régler — cadence des coupes,
durée des plans, hauteur des textes, niveau entendu sur un téléphone.

Bibliothèque standard pure, plus ffmpeg. Rien à installer.

Usage : python3 mesurer.py video.mp4 [--sortie dossier]
"""
import argparse
import json
import re
import subprocess
import tempfile
import sys
from pathlib import Path

# La bande où un texte survit aux trois plateformes, relevée sur des captures
# réelles et écrite dans src/lib/captions.ts. C'est elle qui sert d'étalon.
BANDE_SURE = (0.12, 0.45)
# La cadence que l'analyse d'Amorce récompense, dans src/lib/analysis.ts.
PLAN_BON = (1.1, 2.8)
# Rien sous ~400 Hz n'existe sur un haut-parleur de téléphone : le niveau qui
# compte se mesure au-dessus.
PLANCHER_TELEPHONE = 400


def ffmpeg(args: list[str], bavard: bool = False) -> subprocess.CompletedProcess:
    """
    `bavard` n'est pas un détail : `ebur128` n'imprime son résumé qu'au niveau
    `info`. Lancé en `error`, il travaille et ne dit rien — on lit alors des
    niveaux vides en croyant que le fichier n'a pas de son.
    """
    niveau = 'info' if bavard else 'error'
    # `-y` et `-nostdin` ne sont pas décoratifs.
    # Sans `-y`, ffmpeg demande « le fichier existe, écraser ? » et attend une
    # réponse : la première exécution passe, toutes les suivantes se bloquent
    # sans message. Mesuré ici — neuf secondes de calcul pour six minutes
    # quarante d'attente, ce qui ressemble à de la lenteur et n'en est pas.
    # `-nostdin` empêche la même chose de se reproduire par une autre porte.
    return subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', niveau, *args],
                          capture_output=True, text=True)


def sonde(video: Path) -> dict:
    sortie = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries',
         'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate',
         '-of', 'json', str(video)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(sortie.stdout)


# Le seuil de détection décide du résultat, et personne ne le devine.
# Mesuré sur un montage de 27 coupes connues : 0,25 en trouve 13, 0,20 en
# trouve 18, 0,15 en trouve 23, 0,10 en trouve 33. Aucun seuil n'est juste —
# c'est pourquoi on rend une fourchette et non un nombre.
SEUIL_BAS, SEUIL_RETENU, SEUIL_HAUT = 0.10, 0.15, 0.20

# On réduit avant de mesurer, et c'est ce qui rend l'outil utilisable.
# Ni la détection de coupe ni celle des contours n'ont besoin de 1080 × 1920 :
# elles cherchent des différences globales, pas du détail. Mesuré sur une
# vidéo verticale de trente secondes, la passe complète dépassait quatre
# minutes en pleine définition et tombe sous la minute réduite — pour des
# nombres identiques à l'arrondi près.
LARGEUR_ANALYSE = 270


def scores(video: Path) -> list[tuple[float, float]]:
    """
    Instant et score de changement pour chaque coupe candidate, en une passe.

    Relever le score plutôt que filtrer permet de recalculer n'importe quel
    seuil sans redécoder la vidéo. Trois seuils coûtaient trois décodages ;
    ici un seul suffit, et c'est ce qui rend la fourchette abordable.
    """
    # Les scores vont dans un fichier, jamais sur la sortie standard.
    # `metadata=print:file=-` et `-f null -` visent tous deux stdout : le
    # processus ne se referme alors jamais, et l'appel reste suspendu sans
    # message. Un fichier temporaire supprime la collision.
    with tempfile.NamedTemporaryFile('r+', suffix='.txt', delete=False) as tampon:
        chemin = tampon.name
    try:
        subprocess.run(
            ['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', str(video),
             '-vf', f'scale={LARGEUR_ANALYSE}:-2,'
                    f"select='gt(scene,{SEUIL_BAS / 2})',"
                    f'metadata=print:key=lavfi.scene_score:file={chemin}',
             '-an', '-f', 'null', '-'],
            capture_output=True, text=True, check=False,
        )
        texte = Path(chemin).read_text(encoding='utf-8', errors='replace')
    finally:
        Path(chemin).unlink(missing_ok=True)
    instants = re.findall(r'pts_time:([\d.]+)', texte)
    valeurs = re.findall(r'lavfi\.scene_score=([\d.]+)', texte)
    return [(float(t), float(v)) for t, v in zip(instants, valeurs)]


def coupes(candidats: list[tuple[float, float]], seuil: float) -> list[float]:
    """Les instants dont le score dépasse le seuil demandé."""
    return [t for t, v in candidats if v > seuil]


def profil_vertical(video: Path, bandes: int = 20, images_par_s: float = 2) -> list[float]:
    """
    Où l'image est « chargée », de haut en bas.

    Un texte incrusté, un logo, une interface : tout cela crée des contours là
    où la vidéo n'en a pas. On détecte les contours, on écrase l'image en une
    colonne de vingt cases, et on moyenne sur toute la durée. La case qui
    ressort porte les textes — sans lire un seul caractère.

    C'est un indice, pas une certitude : un plan très détaillé en haut ferait
    la même bosse. La planche d'images est là pour trancher, et c'est pour cela
    que les deux sortent ensemble.
    """
    # Huit colonnes et non une, en moyenne de surface.
    # Écrasée à une seule colonne, l'image d'un contour — fin et rare — tombe
    # sous l'unité et s'arrondit à zéro : le profil sortait entièrement nul,
    # et rien ne le signalait. Huit colonnes gardent assez de matière, et on
    # les moyenne ensuite.
    largeur = 8
    res = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(video),
         '-vf', f'fps={images_par_s},scale={LARGEUR_ANALYSE}:-2,'
                'edgedetect=low=0.1:high=0.3,'
                f'scale={largeur}:{bandes}:flags=area,format=gray',
         '-f', 'rawvideo', '-'],
        capture_output=True,
    )
    octets = res.stdout
    par_image = largeur * bandes
    if not octets or len(octets) < par_image:
        return []
    images = len(octets) // par_image
    total = [0] * bandes
    for i in range(images):
        base = i * par_image
        for b in range(bandes):
            total[b] += sum(octets[base + b * largeur: base + (b + 1) * largeur])
    return [t / (images * largeur) for t in total]


def niveaux(video: Path) -> dict:
    """Sonie intégrée et vrai pic, puis le niveau réellement entendu au téléphone."""
    def ebur128(filtres: str) -> dict:
        res = ffmpeg(['-i', str(video), '-af', filtres + 'ebur128=peak=true', '-f', 'null', '-'],
                     bavard=True)
        texte = res.stderr
        lufs = re.findall(r'I:\s*(-?[\d.]+) LUFS', texte)
        pic = re.findall(r'Peak:\s*(-?[\d.]+) dBFS', texte)
        return {
            'lufs': float(lufs[-1]) if lufs else None,
            'pic': float(pic[-1]) if pic else None,
        }

    return {
        'global': ebur128(''),
        'telephone': ebur128(f'highpass=f={PLANCHER_TELEPHONE},'),
    }


def planche(video: Path, duree: float, sortie: Path, images: int = 40) -> Path:
    """Quarante images sur toute la durée, dernière seconde comprise."""
    chemin = sortie / f'{video.stem}-planche.png'
    ffmpeg(['-i', str(video), '-vf',
            f'fps={images}/{duree:.3f},scale=216:384,tile=8x5', '-frames:v', '1', str(chemin)])
    return chemin


def rapport(video: Path, sortie: Path) -> str:
    infos = sonde(video)
    duree = float(infos['format']['duration'])
    poids = int(infos['format']['size']) / 1e6
    flux = {s['codec_type']: s for s in infos['streams']}
    v = flux.get('video', {})
    largeur, hauteur = v.get('width', 0), v.get('height', 0)

    candidats = scores(video)
    instants = coupes(candidats, SEUIL_RETENU)
    bornes = [0.0, *instants, duree]
    plans = [b - a for a, b in zip(bornes, bornes[1:]) if b - a > 0.05]
    dans_bande = sum(1 for p in plans if PLAN_BON[0] <= p <= PLAN_BON[1])
    fourchette = (len(coupes(candidats, SEUIL_HAUT)) + 1, len(coupes(candidats, SEUIL_BAS)) + 1)

    profil = profil_vertical(video)
    son = niveaux(video)
    image = planche(video, duree, sortie)

    lignes = [
        f'# {video.name}',
        '',
        f'{duree:.1f} s · {largeur}×{hauteur} · {poids:.1f} Mo · {v.get("codec_name", "?")}',
        '',
        '## Le montage',
        '',
        f'- **{len(plans)} plans** (entre {fourchette[0]} et {fourchette[1]} selon la '
        f'sensibilité), soit une coupe toutes les {duree / max(1, len(plans)):.2f} s',
        f'- plan le plus court **{min(plans):.2f} s**, le plus long **{max(plans):.2f} s**',
        f'- durée moyenne **{sum(plans) / len(plans):.2f} s**'
        if plans else '- aucun plan détecté',
    ]
    if plans:
        moy = sum(plans) / len(plans)
        part = 100 * dans_bande / len(plans)
        lignes.append(
            f'- **{part:.0f} %** des plans tiennent dans la bande {PLAN_BON[0]}–{PLAN_BON[1]} s '
            f'que l’analyse d’Amorce récompense'
        )
        lignes += [
            '',
            'La fourchette n’est pas de la prudence : un fondu enchaîné est **invisible** '
            'à cette détection, et un panoramique rapide passe pour une coupe. Sur du '
            'format court à coupes franches, le nombre retenu est juste ; sur un montage '
            'en fondus, il est un plancher.',
            '', '### Ce que ça donne comme réglage', '',
        ]
        if moy < PLAN_BON[0]:
            lignes.append(f'Plus nerveux qu’Amorce ne sait faire : {moy:.2f} s par plan, '
                          f'sous le plancher de {PLAN_BON[0]} s. Reproduire cela demande de baisser '
                          '`MIN_SHOT_VU` dans `src/lib/autoEdit.ts`, et donc d’assumer que la note '
                          'de rythme baisse — ce sont les deux faces d’un même choix.')
        elif moy > PLAN_BON[1]:
            lignes.append(f'Plus posé qu’Amorce : {moy:.2f} s par plan. Le montage express vise '
                          f'{PLAN_BON[1]} s au maximum ; pour s’en approcher, importer moins de '
                          'rushes plutôt que de changer un réglage.')
        else:
            lignes.append(f'À portée du montage express tel qu’il est : {moy:.2f} s par plan, '
                          f'dans la bande visée. Le nombre de rushes importés suffit à s’en '
                          'approcher — le studio vise 22 s au total.')

    if profil:
        haut = max(profil)
        bas = min(profil)
        etendue = haut - bas
        # La moitié de l'étendue, pas les deux tiers : un titre occupe deux ou
        # trois bandes sur vingt, et un seuil trop haut n'en retenait aucune.
        chargees = [i for i, v_ in enumerate(profil) if etendue > 0 and (v_ - bas) / etendue > 0.5]
        if chargees:
            debut = min(chargees) / len(profil)
            fin = (max(chargees) + 1) / len(profil)
            dedans = debut >= BANDE_SURE[0] and fin <= BANDE_SURE[1]
            lignes += [
                '', '## Où vit le texte', '',
                f'- zone la plus chargée : **{debut * 100:.0f} % à {fin * 100:.0f} %** de la hauteur',
                f'- bande sûre des trois plateformes : {BANDE_SURE[0] * 100:.0f} % à '
                f'{BANDE_SURE[1] * 100:.0f} %',
                f'- **{"dedans" if dedans else "hors bande"}**'
                + ('' if dedans else ' — cette vidéo accepte de perdre du texte sous l’habillage, '
                                     'ou n’est pas destinée aux trois plateformes'),
                '',
                'Cet indice se lit **avec la planche**, jamais seul : un plan très détaillé en '
                'haut fait la même bosse qu’un titre.',
            ]

    g, t = son['global'], son['telephone']
    lignes += [
        '', '## Le son', '',
        f'- sonie intégrée **{g["lufs"]} LUFS**, vrai pic {g["pic"]} dBFS',
        f'- au-dessus de {PLANCHER_TELEPHONE} Hz — ce qu’un téléphone restitue vraiment — '
        f'**{t["lufs"]} LUFS**',
    ]
    if g['lufs'] is not None and g['lufs'] < -16:
        lignes.append('- plus faible que ce que le format court demande : sur un téléphone, '
                      'cette vidéo sera couverte par la suivante')
    if g['pic'] is not None and g['pic'] > -1:
        lignes.append(f'- vrai pic à {g["pic"]} dBFS : ça écrête. Une référence qui écrête n’est '
                      'pas un modèle à suivre sur ce point, même si le reste est bon')

    lignes += ['', '## À regarder', '', f'Planche : `{image}`', '',
               'La mesure dit la cadence et les niveaux. Elle ne dit ni ce que le texte raconte, '
               'ni pourquoi une coupe tombe là. C’est la planche qui le montre.']
    return '\n'.join(lignes)


def main() -> int:
    parseur = argparse.ArgumentParser(description=__doc__)
    parseur.add_argument('video', type=Path)
    parseur.add_argument('--sortie', type=Path, default=None)
    args = parseur.parse_args()

    if not args.video.exists():
        print(f'Fichier introuvable : {args.video}', file=sys.stderr)
        return 1
    sortie = args.sortie or args.video.parent
    sortie.mkdir(parents=True, exist_ok=True)
    print(rapport(args.video, sortie))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
