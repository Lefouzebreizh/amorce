#!/usr/bin/env python3
"""Ajoute des couches sonores à un montage déjà mixé, et masterise l'ensemble.

Sert quand des bruitages arrivent **après** le montage — enregistrés, achetés,
ou rendus par un générateur. Le mixage existant devient le lit ; les couches se
posent dessus avec leurs instants, leurs gains et leur esquive.

## Ce que ce fichier a appris à mesurer avant de câbler

Seize bruitages « cinéma » sont arrivés d'un coup. Relevé bande par bande, la
moitié avait **toute** son énergie sous 400 Hz — soit exactement rien sur le
haut-parleur d'un téléphone. Un fichier mesurait −61,3 dB entendus : c'est du
silence, quel que soit le gain qu'on lui donne. Un « impact massif » qui
n'existe pas sur l'appareil où la vidéo sera regardée n'est pas un impact
discret, c'est une piste vide qui mange de la marge.

D'où `excitation` : le redressement fabrique les harmoniques du grave, et
elles, elles passent. Mesuré sur ces fichiers-là : **+32,6 dB** entendus sur le
pire, +6,7 sur le meilleur, et une rugosité qui bouge de 0,002 — rien. La règle
« ça grésille sur un enregistrement réel » vaut pour un signal déjà riche en
médium ; sur une nappe purement grave il n'y a rien à faire grésiller.

Le corollaire compte autant : sur un bruitage qui vit DÉJÀ dans le médium, elle
ne rend rien (−0,2 dB mesuré sur un froissement de tissu). On la réserve donc
au grave, et on la mesure au lieu de la supposer.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy
import soundfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from monter_episode import ffmpeg, TAUX
sys.path.insert(0, str(Path(__file__).resolve().parent.parent
                       / ".claude" / "skills" / "bande-son" / "scripts"))
import bruitages


def lire(chemin: Path, taux: int = TAUX, filtre: str = "") -> numpy.ndarray:
    """Décode n'importe quel média en stéréo flottant, au taux du montage.

    `filtre` est une chaîne ffmpeg appliquée **au décodage**, donc avant tout
    mélange. C'est là qu'un bruitage se sculpte : un rugissement relevé avec sa
    bosse de bas-médium — 400-900 Hz à −5,7 dB quand 2-5 kHz est à −13 — sonne
    congestionné, et ce n'est pas de la saturation. On creuse la boue et on
    relève les dents ; le monter n'aurait fait qu'empirer l'encombrement.
    """
    chemin = Path(chemin)
    if not chemin.is_file():
        raise SystemExit(f"Introuvable : {chemin}")
    tampon = chemin.with_suffix(".decode.wav")
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(chemin)]
                   + (["-af", filtre] if filtre else [])
                   + ["-ac", "2", "-ar", str(taux), "-c:a", "pcm_f32le",
                      str(tampon)], check=True)
    son, _ = soundfile.read(tampon, dtype="float64")
    tampon.unlink(missing_ok=True)
    return numpy.atleast_2d(son) if son.ndim > 1 else numpy.column_stack([son, son])


def etaler(son: numpy.ndarray, longueur: int, fondu_s: float = 0.4) -> numpy.ndarray:
    """Répète un son jusqu'à la longueur voulue, en fondu croisé.

    Une nappe de 3,5 s posée bout à bout sur vingt secondes s'entend comme une
    nappe de 3,5 s posée bout à bout : la couture revient six fois, toujours au
    même endroit du spectre, et l'oreille l'apprend. Le fondu croisé la noie —
    et il **raccourcit** chaque copie de sa durée, ce qui décale les coutures
    les unes par rapport aux autres.
    """
    if len(son) >= longueur:
        return son[:longueur]
    fondu = min(int(fondu_s * TAUX), len(son) // 3)
    pas = len(son) - fondu
    sortie = numpy.zeros((longueur, son.shape[1]))
    montee = numpy.linspace(0, 1, fondu)[:, None]
    place = 0
    while place < longueur:
        bout = son.copy()
        if place > 0:
            bout[:fondu] *= montee
        if place + len(bout) < longueur:
            bout[-fondu:] *= montee[::-1]
        n = min(len(bout), longueur - place)
        sortie[place:place + n] += bout[:n]
        place += pas
    return sortie


def enveloppe_voix(voix: numpy.ndarray, longueur: int, *, creux_db: float,
                   attaque_s: float = 0.08, relache_s: float = 0.28,
                   seuil_db: float = -42.0) -> numpy.ndarray:
    """L'esquive suivie : le lit baisse pendant que la voix parle, pas avant.

    Une esquive posée par fenêtres — « de 2,7 s à 7,6 s, moins cinq décibels »
    — creuse aussi les **silences entre les mots**, qui sont les endroits où le
    lit devrait justement respirer. Suivre l'énergie de la voix rend un creux
    qui épouse les phrases : mesuré sur ce montage, dix-neuf tranches sous
    −40 dB avec la fenêtre, deux avec le suivi.

    L'attaque est courte (le lit doit s'effacer avant la syllabe), le relâché
    long — un lit qui remonte trop vite pompe entre chaque mot.
    """
    v = numpy.abs(voix.mean(axis=1) if voix.ndim > 1 else voix)
    lisse = numpy.convolve(v, numpy.ones(int(0.02 * TAUX)) / (0.02 * TAUX),
                           mode="same")
    parle = (20 * numpy.log10(numpy.maximum(lisse, 1e-9))) > seuil_db
    creux = 10.0 ** (creux_db / 20.0)
    forme = numpy.where(parle[:longueur] if len(parle) >= longueur
                        else numpy.pad(parle, (0, longueur - len(parle))),
                        creux, 1.0)
    # Le lissage exponentiel donne l'attaque et le relâché en une passe : on
    # descend vite, on remonte lentement, jamais en marche d'escalier.
    a = numpy.exp(-1.0 / (attaque_s * TAUX))
    r = numpy.exp(-1.0 / (relache_s * TAUX))
    sortie = numpy.ones(longueur)
    etat = 1.0
    for i in range(longueur):
        cible = forme[i]
        coef = a if cible < etat else r
        etat = cible + (etat - cible) * coef
        sortie[i] = etat
    return sortie


def poser(lit: numpy.ndarray, couche: dict, longueur: int) -> numpy.ndarray:
    """Fabrique une couche prête à sommer : gain, excitation, place, fondus."""
    son = lire(Path(couche["fichier"]), filtre=couche.get("filtre", ""))
    crete = float(numpy.abs(son).max())
    if crete > 1.0:
        # Plusieurs des fichiers reçus décodaient AU-DESSUS du plein échelle
        # (jusqu'à 1,42). Les sommer tels quels écrête avant même le limiteur.
        son = son / crete
    if couche.get("excitation"):
        gauche = bruitages.porter_sur_telephone(son[:, 0],
                                                poids=float(couche["excitation"]))
        droite = bruitages.porter_sur_telephone(son[:, 1],
                                                poids=float(couche["excitation"]))
        son = numpy.column_stack([gauche, droite])
        son = son / max(float(numpy.abs(son).max()), 1e-9) * 0.89
    debut = int(float(couche.get("debut", 0.0)) * TAUX)
    fin = int(float(couche["fin"]) * TAUX) if "fin" in couche else longueur
    fin = min(fin, longueur)
    if fin <= debut:
        raise SystemExit(f"{couche['fichier']} : fin ({couche.get('fin')}) "
                         f"avant début ({couche.get('debut')}).")
    if couche.get("continue"):
        son = etaler(son, fin - debut)
    son = son[:fin - debut] * 10.0 ** (float(couche.get("gain_db", 0.0)) / 20.0)
    # Chaque couche entre et sort en fondu : un bruitage qui commence sur un
    # échantillon non nul claque, et le claquement s'entend plus que le son.
    f = min(int(0.05 * TAUX), len(son) // 4)
    if f > 1:
        rampe = numpy.linspace(0, 1, f)[:, None]
        son[:f] *= rampe
        son[-f:] *= rampe[::-1]
    piste = numpy.zeros((longueur, 2))
    piste[debut:debut + len(son)] = son
    return piste


def duree_video(media: Path) -> float:
    """La durée du FLUX VIDÉO, qui n'est pas celle du conteneur ni de l'audio."""
    rendu = subprocess.run(
        [ffmpeg().replace("ffmpeg", "ffprobe"), "-v", "error", "-select_streams",
         "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0",
         str(media)], capture_output=True, text=True, check=True)
    return float(rendu.stdout.strip())


def remixer(video: Path, plan: dict, sortie: Path) -> dict:
    """Assemble le lit et les couches, applique les esquives, écrit la vidéo."""
    lit = lire(video)
    # Le mixage se cale sur la VIDÉO, jamais sur l'audio décodé. L'AAC rend un
    # flux plus court que l'image — 21,696 s contre 21,749 ici — et un
    # `-shortest` posé sur cet écart tronque la fin du film. Mesuré : 0,2 s
    # perdues, soit la dernière ligne du carton d'annonce.
    longueur = max(len(lit), int(round(duree_video(video) * TAUX)))
    if len(lit) < longueur:
        lit = numpy.vstack([lit, numpy.zeros((longueur - len(lit), lit.shape[1]))])
    ensemble = lit.copy()

    voix = lire(Path(plan["voix"]["fichier"])) if plan.get("voix") else None
    esquive = numpy.ones(longueur)
    if voix is not None and plan["voix"].get("esquive_db"):
        decalage = int(float(plan["voix"].get("debut", 0.0)) * TAUX)
        piste_voix = numpy.zeros((longueur, 2))
        n = min(len(voix), longueur - decalage)
        piste_voix[decalage:decalage + n] = voix[:n]
        esquive = enveloppe_voix(piste_voix, longueur,
                                 creux_db=float(plan["voix"]["esquive_db"]))

    # Le micro-silence : il ne s'ajoute pas à l'esquive de la voix, il la
    # MULTIPLIE. Deux creux qui se cumulent en décibels sur un même instant
    # font un trou, pas un effet — et un trou, on l'entend comme une panne.
    for creux in plan.get("micro_silences", []):
        # « tenue » tient le creux ouvert : sans elle on ne pose qu'un V, ce qui
        # suffit pour un trou d'air avant un impact et pas pour rendre à une
        # scène le SILENCE qu'elle avait. Le rush du dragon ménageait 1,05 s
        # à -17,7 dB ; l'étirement à 0,8 par recouvrement l'avait comblé de
        # 11 dB, et aucun réglage de bruitage ne pouvait le rendre — c'est une
        # courbe d'automation qu'il fallait, pas un gain.
        instant = float(creux["instant"])
        tenue = float(creux.get("tenue", 0.0))
        a = int((instant - float(creux.get("avance", 0.15))) * TAUX)
        b = int(instant * TAUX)
        c = int((instant + tenue) * TAUX)
        d = int((instant + tenue + float(creux.get("retour", 0.30))) * TAUX)
        a, b, c, d = (max(0, min(x, longueur)) for x in (a, b, c, d))
        niveau = 10.0 ** (float(creux["gain_db"]) / 20.0)
        if b > a:
            esquive[a:b] *= numpy.linspace(1.0, niveau, b - a)
        if c > b:
            esquive[b:c] *= niveau
        if d > c:
            esquive[c:d] *= numpy.linspace(niveau, 1.0, d - c)

    ensemble *= esquive[:, None]
    for couche in plan.get("couches", []):
        piste = poser(ensemble, couche, longueur)
        if couche.get("suit_la_voix", True):
            piste *= esquive[:, None]
        ensemble += piste
    if voix is not None:
        decalage = int(float(plan["voix"].get("debut", 0.0)) * TAUX)
        n = min(len(voix), longueur - decalage)
        gain = 10.0 ** (float(plan["voix"].get("gain_db", 0.0)) / 20.0)
        ensemble[decalage:decalage + n] += voix[:n] * gain

    crete = float(numpy.abs(ensemble).max())
    if crete > 0.97:
        ensemble *= 0.97 / crete
    melange = sortie.with_suffix(".melange.wav")
    soundfile.write(melange, ensemble, TAUX, subtype="FLOAT")
    muet = sortie.with_suffix(".muet.mp4")
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(video),
                    "-an", "-c:v", "copy", str(muet)], check=True)
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(muet),
                    "-i", str(melange), "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "320k", "-ar", str(TAUX), str(sortie)], check=True)
    muet.unlink(missing_ok=True)
    return {"crete": crete, "creux_esquive": float(esquive.min()),
            "duree": longueur / TAUX}


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(description="Ajoute des couches à un montage mixé.")
    a.add_argument("video", type=Path)
    a.add_argument("plan", type=Path, help="JSON décrivant les couches")
    a.add_argument("sortie", type=Path)
    o = a.parse_args(argv)
    if not o.plan.is_file():
        raise SystemExit(f"Plan introuvable : {o.plan}")
    try:
        plan = json.loads(o.plan.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{o.plan} : JSON illisible ligne {e.lineno} — {e.msg}")
    r = remixer(o.video, plan, o.sortie)
    print(f"  {len(plan.get('couches', []))} couches · "
          f"crête avant garde {r['crete']:.3f} · "
          f"esquive la plus profonde {20 * numpy.log10(max(r['creux_esquive'], 1e-9)):.1f} dB · "
          f"{r['duree']:.2f} s")
    print(f"\n→ {o.sortie}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
