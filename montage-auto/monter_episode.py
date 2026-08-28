#!/usr/bin/env python3
"""Monte un épisode à partir d'une liste de plans et d'une intention, pas d'un script.

Cinq versions d'un même épisode ont été montées à la main avant d'écrire ce
fichier, et chacune a été rejetée pour une raison qui se résume en une ligne.
Ce sont ces cinq lignes que le script encode, pour qu'on ne les repaie plus :

1. **Un plan se coupe sur sa courbe, pas sur sa durée.** Un plan de dragon de
   dix secondes coupé « au début pour faire court » avait pris son creux exact
   (−31,6 dB) et laissé dehors l'éclair et le rugissement. `--sonder` relève le
   niveau seconde par seconde avant qu'on choisisse.

2. **Égaliser tous les plans supprime le relief avec le défaut.** L'égalisation
   n'est qu'un point de départ ; ce qui fait un montage est une **courbe de
   cibles écrite**, qui monte vers le dénouement. Le champ `cible_db` de chaque
   plan est cette courbe.

3. **On ne normalise jamais avec `loudnorm` en une passe** : c'est un
   compresseur, il aplatit exactement le relief qu'on vient de construire.
   Mesure, gain unique, limiteur.

4. **Un seul élément possède le grave à la fois**, et rien de lourd sous une
   voix — c'est elle qui porte la synchronisation labiale.

5. **Les sous-titres se calent sur la parole mesurée**, pas sur une grille.
   `phrases()` relève les groupes de parole d'un plan ; leurs durées suffisent
   à reconnaître quelle réplique va où.

6. **Le lit s'efface sous la voix, il ne se baisse pas.** Un blanc entre deux
   répliques casse l'immersion ; un lit assez fort pour le combler couvre la
   voix. Les deux exigences sont incompatibles à gain constant et compatibles
   dès qu'il varie — c'est le champ `esquive`.

    python3 montage-auto/monter_episode.py episode.json sortie.mp4
    python3 montage-auto/monter_episode.py --sonder plan.mp4
    python3 montage-auto/monter_episode.py --phrases plan.mp4
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE.parent / ".claude" / "skills" / "bande-son" / "scripts"))

import bruitages                                                   # noqa: E402
import sfx_pro                                                     # noqa: E402

TAUX = 48000
MOYEN = re.compile(r"mean_volume:\s*(-?[\d.]+)")

# 1080 × 1920 : le seul format qui remplit un téléphone tenu droit.
LARGEUR, HAUTEUR = 1080, 1920
CADRE = (f"scale={LARGEUR}:{HAUTEUR}:force_original_aspect_ratio=increase,"
         f"crop={LARGEUR}:{HAUTEUR},setsar=1,fps=30,format=yuv420p")

# La bande du bas est mangée par la légende et les boutons de la plateforme.
# Sur 1920 de haut, on ne descend pas un texte sous 1300.
Y_SOUS_TITRE = 1180
POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def ffmpeg() -> str:
    """Le ffmpeg du système d'abord : celui d'`imageio` n'a pas `drawtext`."""
    import shutil
    if Path("/usr/bin/ffmpeg").is_file():
        return "/usr/bin/ffmpeg"
    trouve = shutil.which("ffmpeg")
    if trouve is None:
        raise SystemExit("ffmpeg est introuvable.")
    return trouve


# ── mesure ────────────────────────────────────────────────────────────────────

def entendu(media: Path, depart: float = 0.0, duree: float | None = None) -> float | None:
    """Niveau moyen **au-dessus de 400 Hz** : ce qu'un téléphone restituera.

    `volumedetect` écrit son résultat en niveau *info* ; le lancer avec
    `-v error` par réflexe d'économie le fait taire, et l'appelant conclut
    « muet » sans la moindre erreur.
    """
    commande = [ffmpeg(), "-hide_banner", "-nostats", "-ss", str(depart)]
    if duree is not None:
        commande += ["-t", str(duree)]
    commande += ["-i", str(media), "-af", "highpass=f=400,volumedetect", "-f", "null", "-"]
    rendu = subprocess.run(commande, capture_output=True, text=True)
    trouve = MOYEN.search(rendu.stderr)
    return float(trouve.group(1)) if trouve else None



def crete_db(media: Path) -> float | None:
    """Crête réelle, en dB. C'est elle qui borne tout gain propre.

    Séparée de `entendu` parce qu'elles répondent à deux questions : l'une dit
    ce qu'on entendra, l'autre ce qu'on peut encore ajouter avant d'écrêter.
    Les confondre fait viser une cible que le limiteur reprendra.
    """
    rendu = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(media),
         "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    for ligne in rendu.stderr.splitlines():
        if "max_volume" in ligne:
            return float(ligne.split(":")[-1].replace("dB", "").strip())
    return None


def sonder(media: Path, pas: float = 1.0) -> list[tuple[float, float]]:
    """Le niveau entendu, tranche par tranche. À lire **avant** de choisir une coupe."""
    duree = float(subprocess.run(
        [ffmpeg().replace("ffmpeg", "ffprobe"), "-v", "error",
         "-show_entries", "format=duration", "-of", "csv=p=0", str(media)],
        capture_output=True, text=True).stdout.strip() or 0)
    releve = []
    instant = 0.0
    while instant < duree - 0.05:
        valeur = entendu(media, instant, min(pas, duree - instant))
        if valeur is not None:
            releve.append((instant, valeur))
        instant += pas
    return releve


def phrases(media: Path, pause_s: float = 0.18) -> list[tuple[float, float]]:
    """Les groupes de parole d'un plan, par l'énergie du signal.

    Sert à caler des sous-titres sur ce qui est réellement dit. Leurs **durées**
    suffisent en général à reconnaître quelle réplique va où : « breach open »
    et « the shadow titan awakens » ne durent pas la même chose.
    """
    temporaire = media.parent / f"_{media.stem}_voix.wav"
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(media), "-ac", "1",
                    "-ar", "16000", "-af", "highpass=f=180,lowpass=f=3800",
                    str(temporaire)], check=True)
    with wave.open(str(temporaire), "rb") as source:
        signal = numpy.frombuffer(source.readframes(source.getnframes()),
                                  dtype=numpy.int16).astype(float) / 32768.0
    temporaire.unlink(missing_ok=True)

    taux, fenetre, pas = 16000, 400, 160
    energie = numpy.array([numpy.sqrt(numpy.mean(signal[i:i + fenetre] ** 2))
                           for i in range(0, max(0, len(signal) - fenetre), pas)])
    if energie.size == 0:
        return []
    db = 20 * numpy.log10(numpy.maximum(energie, 1e-6))
    parle = db > numpy.percentile(db, 55)

    creux = int(pause_s / (pas / taux))
    groupes, debut = [], None
    for i, actif in enumerate(parle):
        instant = i * pas / taux
        if actif and debut is None:
            debut = instant
        elif not actif and debut is not None:
            if not parle[i:i + creux].any():
                if instant - debut > 0.25:
                    groupes.append((round(debut, 2), round(instant, 2)))
                debut = None
    if debut is not None:
        groupes.append((round(debut, 2), round(len(parle) * pas / taux, 2)))
    return groupes


# ── montage ───────────────────────────────────────────────────────────────────

# Le nombre de copies moyennées pour le flou radial. Sept suffisent : en
# dessous, les copies se comptent une à une et l'image se dédouble au lieu de
# filer ; au-dessus, le rendu s'allonge sans que l'œil y gagne.
COPIES_FLOU = 7


def graphe_flou_radial(cadre: str, force: float, duree: float) -> str:
    """Un flou de zoom, qui laisse le centre net et étire les bords.

    `ffmpeg` n'a pas de flou radial, et l'écrire image par image en Python
    coûterait des minutes par plan. Il s'obtient pourtant sans rien quitter :
    on superpose plusieurs copies de l'image à des **échelles croissantes**,
    recadrées au centre, et on les moyenne. Deux propriétés en découlent, et ce
    sont exactement celles d'une aspiration : le déplacement d'un point vaut
    zéro au centre et croît avec sa distance, donc le puits reste net pendant
    que le reste file vers l'extérieur.

    La force monte en puissance 2,2 sur la durée du plan plutôt que
    linéairement — au départ l'image est lisible, à l'arrivée on ne voit plus
    que la vitesse. C'est la même courbe que la poussée d'échelle, pour la même
    raison : une accélération constante s'entend et se voit comme une machine,
    une accélération croissante comme une chute.
    """
    copies = "".join(f"[v{k}]" for k in range(COPIES_FLOU))
    etages = ";".join(
        f"[v{k}]scale=iw*{1.0 + force * k / (COPIES_FLOU - 1):.4f}:"
        f"ih*{1.0 + force * k / (COPIES_FLOU - 1):.4f},crop={LARGEUR}:{HAUTEUR}[b{k}]"
        for k in range(COPIES_FLOU))
    entrees = "".join(f"[b{k}]" for k in range(COPIES_FLOU))
    poids = " ".join("1" for _ in range(COPIES_FLOU))
    montee = f"min(1,pow(T/{duree:.3f},2.2))"
    return (f"[0:v]{cadre},split={COPIES_FLOU + 1}[net]{copies};"
            f"{etages};"
            f"{entrees}mix=inputs={COPIES_FLOU}:weights='{poids}'[flou];"
            f"[net][flou]blend=all_expr='A*(1-{montee})+B*{montee}'[sortie]")


def filtre_tremblement(secousses: list, duree: float) -> str:
    """Une caméra qui encaisse : l'image se déplace, elle ne s'agrandit pas.

    Le geste est un **recadrage** qui bouge. On réserve une marge tout autour,
    puis on promène la fenêtre dedans — c'est ce que fait une caméra tenue à la
    main quand le sol bouge, et c'est pourquoi un simple zoom qui pulse n'y
    ressemble pas : le zoom rapproche, le tremblement décale.

    Deux fréquences se superposent, l'une rapide et l'autre lente, sans rapport
    entier entre elles. Une seule sinusoïde donnerait une vibration mécanique ;
    leur somme ne se répète jamais tout à fait, et c'est l'irrégularité que
    l'oreille interne lit comme un choc réel.

    L'amplitude retombe en exponentielle : un séisme ne s'arrête pas net.
    """
    marge = max(float(sec.get("force", 0.05)) for sec in secousses)
    marge = min(0.12, marge * 1.25)                # de quoi bouger sans bord noir

    dx, dy = [], []
    for sec in secousses:
        debut = float(sec.get("debut", 0.0))
        etendue = float(sec.get("duree", 0.3))
        force = float(sec.get("force", 0.05)) / max(marge, 1e-6)
        # `between` borne la secousse, l'exponentielle l'éteint.
        forme = (f"between(t,{debut:.3f},{debut + etendue:.3f})"
                 f"*exp(-3.2*(t-{debut:.3f})/{etendue:.3f})")
        dx.append(f"{force:.3f}*{forme}*(sin(2*PI*23.7*t)+0.55*sin(2*PI*8.3*t))/1.55")
        dy.append(f"{force:.3f}*{forme}*(cos(2*PI*19.1*t)+0.55*cos(2*PI*6.7*t))/1.55")

    largeur_utile = f"iw*{1 - 2 * marge:.4f}"
    hauteur_utile = f"ih*{1 - 2 * marge:.4f}"
    x = f"iw*{marge:.4f}+iw*{marge:.4f}*({'+'.join(dx)})"
    y = f"ih*{marge:.4f}+ih*{marge:.4f}*({'+'.join(dy)})"
    # `crop` reevalue deja x et y a chaque image ; lui passer « eval » leve
    # « Option not found » sur les versions qui ne portent pas cette option.
    return (f"crop=w={largeur_utile}:h={hauteur_utile}:x='{x}':y='{y}',"
            f"scale={LARGEUR}:{HAUTEUR}")


def filtre_flash(flashs: list) -> str:
    """Un éclat blanc, monté en une image et éteint en quelques dixièmes.

    `eq` accepte des expressions quand on lui demande de les réévaluer à chaque
    image ; c'est la seule voie qui ne coûte rien, `geq` calculant pixel par
    pixel. La montée est instantanée et la retombée exponentielle : l'inverse
    donnerait une lumière qui s'allume, pas un éclair.
    """
    termes = []
    for flash in flashs:
        debut = float(flash.get("debut", 0.0))
        etendue = float(flash.get("duree", 0.2))
        force = float(flash.get("force", 0.55))
        termes.append(f"{force:.3f}*between(t,{debut:.3f},{debut + etendue:.3f})"
                      f"*exp(-5.5*(t-{debut:.3f})/{etendue:.3f})")
    return f"eq=brightness='{'+'.join(termes)}':eval=frame"


def couper(plan: dict, sortie: Path, plafond_db: float = 16.0) -> float:
    """Découpe un plan au format, et l'amène à **sa** cible entendue.

    La cible vient du plan, pas d'une constante : c'est elle qui fait la courbe
    dramatique. Un plan muet reçoit une piste de silence plutôt qu'un gain, qui
    ne remonterait rien.
    """
    source = Path(plan["source"]).expanduser()
    depart, duree = float(plan["depart"]), float(plan["duree"])
    mesure = entendu(source, depart, duree)

    filtre = CADRE
    if plan.get("vitesse"):
        # `setpts` **après** tout ce qui régénère les horodatages, jamais avant :
        # `zoompan` les réécrit et annulerait le changement de vitesse.
        pass
    if plan.get("zoom"):
        # Une poussée d'échelle qui **accélère** : linéaire, elle s'entend comme
        # un travelling ; exponentielle, comme une chute. `zoompan` régénère les
        # horodatages, d'où le `-t` explicite qui suit — sans lui le plan
        # s'allonge silencieusement.
        force = float(plan["zoom"])
        images = max(1, int(duree * 30))
        filtre += (f",zoompan=z='1+{force}*pow(on/{images},2.2)':d=1"
                   f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                   f":s={LARGEUR}x{HAUTEUR}:fps=30,format=yuv420p")
    if plan.get("tremblements"):
        filtre += "," + filtre_tremblement(plan["tremblements"], duree)
    if plan.get("flashs"):
        filtre += "," + filtre_flash(plan["flashs"])
    if plan.get("vitesse"):
        # En dernier : ce qui precede peut avoir reecrit les horodatages. Et il
        # faut **recadencer apres**, sinon le flux garde la cadence d'avant et
        # le multiplexeur refuse des horodatages qui n'avancent plus.
        filtre += f",setpts=PTS/{float(plan['vitesse']):.4f},fps=30"

    muet = mesure is None or mesure < -100
    gain = 0.0 if muet else max(-plafond_db, min(plafond_db,
                                                 float(plan["cible_db"]) - mesure))
    image = graphe_flou_radial(filtre, float(plan["flou_radial"]), duree) \
        if plan.get("flou_radial") else None

    commande = [ffmpeg(), "-y", "-v", "error", "-ss", str(depart), "-t", str(duree),
                "-i", str(source)]
    if muet:
        commande += ["-f", "lavfi", "-t", str(duree), "-i", "anullsrc=r=48000:cl=stereo"]

    if image is None:
        commande += ["-vf", filtre, "-map", "0:v"]
        commande += ["-map", "1:a"] if muet else ["-af", f"volume={gain}dB", "-map", "0:a"]
    else:
        # `-af` est **ignoré** dès qu'un `-filter_complex` est présent : le gain
        # du plan disparaissait en silence, et le seul plan flouté sortait au
        # niveau brut, dominant tout le montage. Le son passe donc par le même
        # graphe que l'image.
        source_son = "[1:a]" if muet else "[0:a]"
        commande += ["-filter_complex",
                     f"{image};{source_son}volume={gain}dB[audio]",
                     "-map", "[sortie]", "-map", "[audio]"]
    commande += ["-t", str(duree), "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                 "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", str(sortie)]
    subprocess.run(commande, check=True, capture_output=True)
    return round(gain, 1)


# Un son élargi l'est en décalant les deux oreilles de quelques millisecondes.
# **Réservé aux souffles et aux montées**, qui sont du bruit à bande large : un
# grave traité ainsi se creuse au repli mono du haut-parleur de téléphone, et
# c'est justement là qu'on regarde.
LARGEUR_PAR_DEFAUT = {"whoosh": 12, "riser": 9, "transition": 15, "souffle": 16,
                      "eclat": 14, "crepitement": 20}


def largeur(nom: str, donnee) -> int:
    if donnee is not None:
        return int(donnee)
    for motif, valeur in LARGEUR_PAR_DEFAUT.items():
        if nom.startswith(motif):
            return valeur
    return 0                                    # grave et ponctuations : au centre


def enveloppe_esquive(fenetres: list, total: int,
                      attaque_s: float = 0.08, retour_s: float = 0.28) -> numpy.ndarray:
    """Le gain du lit dans le temps : plein partout, creusé pendant qu'on parle.

    C'est l'esquive du mixage de cinéma, et elle résout un problème qu'aucun
    réglage de niveau ne résout. Mesuré sur un épisode : entre les phrases du
    conteur, le mixage tombait à −50 dB — un blanc qui casse l'immersion plus
    sûrement qu'un mauvais son. Monter le lit comblait le blanc **et** couvrait
    la voix ; le baisser rendait la voix et rouvrait le blanc. Les deux
    exigences sont incompatibles à gain constant, et compatibles dès que le gain
    varie : le lit joue fort, et s'efface le temps de chaque réplique.

    Les deux constantes ne sont pas décoratives. L'attaque doit être **plus
    rapide** que le retour — quatre-vingts millisecondes contre deux cent
    quatre-vingts — parce qu'un lit qui redescend trop vite après un mot
    s'entend comme une respiration, et qu'un lit qui s'efface trop lentement
    laisse passer la première syllabe par-dessus. Ce sont les temps d'un
    compresseur de voix, et pour la même raison.
    """
    gain = numpy.ones(total)
    for fenetre in fenetres:
        debut = int(float(fenetre["debut"]) * TAUX)
        fin = int(float(fenetre["fin"]) * TAUX)
        creux = 10.0 ** (float(fenetre.get("gain", -5)) / 20.0)
        montee = max(1, int(attaque_s * TAUX))
        descente = max(1, int(retour_s * TAUX))

        forme = numpy.ones(total)
        a, b = max(0, debut - montee), min(total, fin + descente)
        if a >= b:
            continue
        forme[max(0, debut):min(total, fin)] = creux
        if debut - montee >= 0:
            forme[debut - montee:debut] = numpy.linspace(1.0, creux, montee)
        if fin + descente <= total:
            forme[fin:fin + descente] = numpy.linspace(creux, 1.0, descente)
        # Plusieurs esquives se **multiplient** plutôt que de s'écraser : deux
        # répliques qui se chevauchent doivent creuser davantage, pas autant.
        gain = numpy.minimum(gain, forme)
    return gain


def esquive_suivie(piste_voix: Path, total: int, creux_db: float = -9.0,
                   depuis: float = 0.0, jusqu_a: float | None = None,
                   attaque_s: float = 0.05, retour_s: float = 0.22) -> numpy.ndarray:
    """L'esquive pilotée par la voix, syllabe par syllabe.

    Une première version creusait le lit sur des **fenêtres de phrases**, calées
    sur ce que `--phrases` avait relevé. Mesuré au dixième de seconde, le
    résultat était l'inverse du but : les trous les plus profonds ne sont pas
    entre les phrases mais **entre les mots**, donc à l'intérieur des fenêtres —
    le lit s'y effaçait précisément là où il fallait qu'il remplisse. Dix-neuf
    tranches sous −40 dB, jusqu'à −49,8.

    Un mixeur ne trace pas ces fenêtres à la main : il branche la voix sur
    l'entrée de détection d'un compresseur, et le lit suit. C'est ce que fait
    cette fonction. L'enveloppe est relevée **dans la bande de la voix**
    (300–3500 Hz) et non sur le signal entier, sans quoi un impact grave
    déclencherait l'esquive aussi sûrement qu'une syllabe.

    L'attaque est plus rapide que le retour, comme sur tout compresseur de voix :
    trop lente, la première syllabe passe par-dessus le lit ; trop rapide au
    retour, le lit remonte entre deux mots et s'entend respirer.
    """
    temporaire = piste_voix.parent / "_detection.wav"
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(piste_voix), "-ac", "1",
                    "-ar", "16000", "-af", "highpass=f=300,lowpass=f=3500",
                    str(temporaire)], check=True)
    with wave.open(str(temporaire), "rb") as source:
        detection = numpy.frombuffer(source.readframes(source.getnframes()),
                                     dtype=numpy.int16).astype(float) / 32768.0
    temporaire.unlink(missing_ok=True)
    if detection.size == 0:
        return numpy.ones(total)

    # Enveloppe efficace sur cinq millisecondes, puis lissage asymétrique.
    taux, bloc = 16000, 80
    blocs = numpy.array([numpy.sqrt(numpy.mean(detection[i:i + bloc] ** 2))
                         for i in range(0, len(detection) - bloc, bloc)])
    if blocs.size == 0:
        return numpy.ones(total)
    db = 20 * numpy.log10(numpy.maximum(blocs, 1e-6))

    # Le seuil se déduit du signal : au-dessus du quantile, on parle.
    seuil = numpy.percentile(db, 62)
    voulu = numpy.where(db > seuil, 10.0 ** (creux_db / 20.0), 1.0)

    pas_s = bloc / taux
    monte = numpy.exp(-pas_s / max(attaque_s, 1e-4))
    descend = numpy.exp(-pas_s / max(retour_s, 1e-4))
    lisse = numpy.ones_like(voulu)
    courant = 1.0
    for i, cible in enumerate(voulu):
        coefficient = monte if cible < courant else descend
        courant = cible + (courant - cible) * coefficient
        lisse[i] = courant

    # Ramené au taux du montage, puis borné à la fenêtre demandée.
    instants = numpy.arange(len(lisse)) * pas_s
    gain = numpy.interp(numpy.arange(total) / TAUX, instants, lisse,
                        left=1.0, right=1.0)
    fin = total / TAUX if jusqu_a is None else float(jusqu_a)
    horloge = numpy.arange(total) / TAUX
    dehors = (horloge < float(depuis)) | (horloge > fin)
    gain[dehors] = 1.0
    return gain



def lire_catalogue(bibliotheque: Path) -> dict:
    """Relit l'index des sons, quel que soit le nom qu'il porte ici.

    Deux noms ont coexisté pour une seule chose : `audio_catalog.json` dans une
    bibliothèque autonome, et `second-brain/sound_index.json` dans le dépôt, où
    les sons vivent sous `kits/sfx/`. Le premier montage complet a échoué là,
    sur un `FileNotFoundError` qui ne disait pas que les deux moitiés de la
    chaîne s'étaient donné des noms différents.

    On lit donc les deux, et on normalise vers la forme attendue ici. Le champ
    `gain_conseille_db` est déduit de la mesure quand il manque : l'index du
    dépôt relève ce que le son rend **au-dessus de 400 Hz**, ce qu'un téléphone
    restitue, et viser −16 dB sur cette bande donne un bruitage présent sans
    qu'il domine.
    """
    autonome = bibliotheque / "audio_catalog.json"
    if autonome.is_file():
        return {s["nom"]: s for s in json.loads(autonome.read_text())["sons"]}

    racine = Path(__file__).resolve().parent.parent
    index = racine / "second-brain" / "sound_index.json"
    if not index.is_file():
        raise SystemExit(
            f"Aucun index de sons. Cherché :\n  {autonome}\n  {index}\n"
            "Lancer `python3 kits/sfx/indexer.py` pour en fabriquer un.")

    catalogue = {}
    for son in json.loads(index.read_text(encoding="utf-8"))["sons"]:
        if not son.get("utilisable", True):
            continue
        mesure = son.get("telephone_db")
        catalogue[son["id"]] = {
            "nom": son["id"],
            # Les chemins de cet index partent de la racine du dépôt, ceux de la
            # bibliothèque autonome de la bibliothèque : on rend absolu ici,
            # plutôt que de faire deviner à l'appelant lequel il tient.
            "chemin": str(racine / son["chemin"]),
            "gain_conseille_db": round(-16.0 - mesure, 1) if mesure is not None else 0.0,
        }
    return catalogue


def couche_voix(entrees: list, total_s: float, atelier: Path) -> tuple[numpy.ndarray, list]:
    """Fabrique les répliques sur la machine et les pose sur la ligne de temps.

    **Piste séparée, pas dans la couche d'effets.** C'est la voix qui fait
    plonger les effets ; l'y mêler la ferait s'esquiver elle-même. Elle échappe
    aussi à la normalisation de crête de cette couche, qui l'écraserait contre
    les impacts.

    **Et comme on la fabrique, on sait où elle parle.** L'esquive n'a plus à
    détecter des rafales dans le montage : les fenêtres sortent d'ici, exactes.
    Une détection reste nécessaire pour une voix déjà présente dans un rush ;
    elle devient inutile pour une voix qu'on vient d'écrire.

    Rend la piste entrelacée et la liste des fenêtres [début, fin] parlées.
    """
    total = int(total_s * TAUX)
    gauche, droite = numpy.zeros(total), numpy.zeros(total)
    fenetres = []
    if not entrees:
        return numpy.zeros(total * 2), fenetres

    outil = (Path(__file__).resolve().parent.parent / ".claude" / "skills"
             / "bande-son" / "scripts" / "voix.py")
    if not outil.is_file():
        print(f"   voix.py introuvable ({outil}) — répliques ignorées.", file=sys.stderr)
        return numpy.zeros(total * 2), fenetres

    for rang, entree in enumerate(entrees):
        brut = atelier / f"_voix{rang:02d}.wav"
        rendu = atelier / f"_voix{rang:02d}_48k.wav"
        resultat = subprocess.run(
            [sys.executable, str(outil), "--texte", entree["texte"],
             "--sortie", str(brut),
             "--voix", entree.get("timbre", "upmc"),
             "--vitesse", str(entree.get("vitesse", 0.95))],
            capture_output=True, text=True)
        if not brut.is_file():
            print(f"   réplique {rang} non fabriquée : "
                  f"{resultat.stderr.strip()[-160:]}", file=sys.stderr)
            continue

        # `voix.py` rend du 22 050 Hz mono ; tout le reste du montage travaille
        # en 48 kHz stéréo. Convertir ici plutôt qu'au mixage évite un
        # rééchantillonnage à la volée dont personne ne verrait le réglage.
        # La synthèse rend du −24,9 LUFS avec dix décibels de marge inutilisée.
        # Une voix qui mène un mixage se tient vers −16 : on vise donc une
        # **cible mesurée**, comme les plans, plutôt qu'un gain à deviner. Le
        # limiteur ne travaille que sur la crête — une voix compressée perd
        # ses consonnes, et ce sont elles qui la rendent intelligible.
        # −16 rend une voix à −15,9 LUFS, mesuré. C'est **un peu sous** un
        # master à −14 : une voix qui doit mener se règle plus haut, par
        # `cible_db`. Le défaut vise la voix qui accompagne, pas celle qui porte.
        cible = float(entree.get("cible_db", -16.0))
        mesure = entendu(brut)
        gain = 0.0 if mesure is None else cible - mesure
        # Le gain se borne à la **marge réelle**, jamais à la cible seule. La
        # synthèse rend une crête vers −10 dB : viser −16 au-dessus de 400 Hz
        # réclamait +12, le limiteur reprenait le dépassement, et la voix
        # sortait au même niveau qu'avant — écrasée en prime. Mesuré : la cible
        # ne bougeait pas d'un décibel entre deux rendus.
        crete = crete_db(brut)
        marge = 18.0 if crete is None else max(0.0, -0.5 - crete)
        gain = max(-12.0, min(marge, gain))
        subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(brut),
                        "-ar", str(TAUX), "-ac", "2",
                        "-af", f"volume={gain:.1f}dB,alimiter=limit=0.95",
                        str(rendu)], check=True)
        son, _ = sfx_pro.lire_wav(rendu)
        mono = son if son.ndim == 1 else son.mean(axis=1)

        debut = int(float(entree["instant"]) * TAUX)
        n = min(len(mono), total - debut)
        if n <= 0:
            continue
        gauche[debut:debut + n] += mono[:n]
        droite[debut:debut + n] += mono[:n]
        # La forme attendue par `enveloppe_esquive` : des `debut`/`fin` nommés,
        # pas des paires. Une liste de paires y lève un TypeError qui désigne
        # l'enveloppe alors que la faute est ici.
        fenetres.append({"debut": round(debut / TAUX, 3),
                         "fin": round((debut + n) / TAUX, 3)})

    # Deux répliques qui se recouvrent sont inintelligibles, et rien ne le
    # signale : le mixage les additionne sans broncher. La durée d'une phrase
    # de synthèse ne se devine pas non plus — « Le secteur quatre-vingt-dix-neuf
    # s'effondre » tient 4,6 s à vitesse 0,95, là où on en attendait deux.
    for premiere, seconde in zip(fenetres, fenetres[1:]):
        if seconde["debut"] < premiere["fin"]:
            print(f"   Répliques qui se recouvrent de "
                  f"{premiere['fin'] - seconde['debut']:.2f} s "
                  f"(la première finit à {premiere['fin']:.2f} s, "
                  f"la suivante entre à {seconde['debut']:.2f} s). "
                  f"Deux voix ensemble ne s'entendent pas.", file=sys.stderr)

    entrelace = numpy.empty(total * 2)
    entrelace[0::2], entrelace[1::2] = gauche, droite
    return entrelace, fenetres


def couche_effets(poses: list, bibliotheque: Path, total_s: float,
                  reverberation_s: float = 2.2,
                  esquive: list | None = None) -> numpy.ndarray:
    """Fabrique la couche cinématique, en stéréo, et lui donne sa pièce.

    La réverbération n'est pas un ornement : c'est elle qui fait entendre un
    volume autour des sons, donc la différence entre « être devant » et « être
    dedans ».
    """
    catalogue = lire_catalogue(bibliotheque)
    total = int(total_s * TAUX)
    gauche, droite = numpy.zeros(total), numpy.zeros(total)

    for pose in poses:
        nom = pose["son"]
        if nom in catalogue:
            son, _ = sfx_pro.lire_wav(Path(catalogue[nom]["chemin"]) if Path(catalogue[nom]["chemin"]).is_absolute()
                                      else bibliotheque / catalogue[nom]["chemin"])
            base = catalogue[nom]["gain_conseille_db"]
        elif nom in bruitages.BRUITAGES:
            # Un bruitage absent de la bibliothèque se fabrique à la volée — mais
            # il réclame alors ses paramètres, là où un son de la bibliothèque
            # est déjà rendu. Sans ce message, l'oubli remonte en `TypeError`
            # brute qui ne dit ni quel son ni quel paramètre.
            import inspect
            attendus = [p.name for p in
                        inspect.signature(bruitages.BRUITAGES[nom]).parameters.values()
                        if p.default is inspect.Parameter.empty]
            donnes = pose.get("parametres", {})
            manquants = [p for p in attendus if p not in donnes]
            if manquants:
                raise SystemExit(
                    f"« {nom} » se fabrique à la volée et réclame "
                    f"« parametres » : il manque {', '.join(manquants)}.")
            son = bruitages.BRUITAGES[nom](**donnes)
            crete = float(numpy.max(numpy.abs(son)))
            son = son / crete * 0.89 if crete else son
            base = -6.0
        else:
            raise SystemExit(f"Son inconnu : « {nom} »")

        son = son * 10.0 ** ((base + float(pose.get("gain", 0))) / 20.0)
        decalage = int(largeur(nom, pose.get("largeur")) * TAUX / 1000)
        for piste, retard in ((gauche, 0), (droite, decalage)):
            debut = int(float(pose["instant"]) * TAUX) + retard
            longueur = min(len(son), total - debut)
            if longueur > 0:
                piste[debut:debut + longueur] += son[:longueur]

    if reverberation_s:
        gauche = bruitages.reverberation(gauche, reverberation_s, melange=0.22, graine=91)
        droite = bruitages.reverberation(droite, reverberation_s, melange=0.22, graine=92)

    if esquive:
        # L'esquive s'applique **après** la réverbération : la queue d'un
        # impact posé avant une réplique doit s'effacer avec le reste, sinon
        # elle traverse la phrase qu'on cherchait à dégager.
        if isinstance(esquive, dict):
            forme = esquive_suivie(
                Path(esquive["voix"]), len(gauche),
                creux_db=float(esquive.get("gain", -9)),
                depuis=float(esquive.get("depuis", 0.0)),
                jusqu_a=esquive.get("jusqu_a"))
        else:
            forme = enveloppe_esquive(esquive, len(gauche))
        gauche, droite = gauche * forme, droite * forme

    fin = int(0.6 * TAUX)
    for piste in (gauche, droite):
        piste[-fin:] *= numpy.linspace(1, 0, fin)
    crete = max(float(numpy.max(numpy.abs(gauche))), float(numpy.max(numpy.abs(droite))))
    if crete:
        gauche, droite = gauche / crete * 0.85, droite / crete * 0.85

    entrelace = numpy.empty(total * 2)
    entrelace[0::2], entrelace[1::2] = gauche, droite
    return entrelace


# La série vit entre 178° et 198° de teinte — un turquoise cyan, mesuré sur les
# six plans. Un sous-titre blanc y est un corps étranger ; teinté, il appartient
# à l'image. La valeur est claire à dessein : une couleur saturée serait jolie
# et illisible.
TEINTE = "#b4f2ff"
HALO = "#1fd8e6"


def texte_ffmpeg(entree: dict, y_defaut: int) -> list[str]:
    """Un sous-titre en deux passes : un halo derrière, le texte net devant.

    Le halo est le même texte, dans la couleur vive du plan, avec un contour
    épais et sans opacité pleine. Il détache le sous-titre d'un fond chargé sans
    la boîte noire qui fait « ajouté après coup ».

    L'apparition dure douze centièmes. Plus court, le texte clignote ; plus
    long, il traîne derrière la coupe.
    """
    contenu = str(entree["texte"]).replace("\\", r"\\").replace("'", r"\'")
    contenu = contenu.replace(":", r"\:").replace("%", r"\%")
    taille = int(entree.get("taille", 62))
    debut, fin = float(entree["debut"]), float(entree["fin"])
    y = entree.get("y", y_defaut)
    montee = f"if(lt(t-{debut},0.12),(t-{debut})/0.12,1)"
    quand = f"between(t,{debut},{fin})"
    commun = (f"fontfile={POLICE}:text='{contenu}':fontsize={taille}:"
              f"x=(w-text_w)/2:y={y}:enable='{quand}'")
    return [
        f"drawtext={commun}:fontcolor={entree.get('halo', HALO)}@0.55:"
        f"borderw={int(taille * 0.22)}:bordercolor=black@0.55:"
        f"alpha='{montee}*0.55'",
        f"drawtext={commun}:fontcolor={entree.get('couleur', TEINTE)}:"
        f"borderw={5 if taille < 100 else 8}:bordercolor=black@0.9:"
        f"alpha='{montee}'",
    ]


def normaliser(source: Path, sortie: Path, cible_lufs: float = -14.0,
               vrai_pic_db: float = -1.0) -> float:
    """Sonie cible **sans toucher à la dynamique**.

    `loudnorm` en une passe travaille au fil de l'eau : il remonte les creux et
    écrase les crêtes. Mesuré sur un montage, un impact sortant à −1,4 dB dans
    le mixage brut ressortait à −24 dB, c'est-à-dire au niveau du lit qu'il
    devait dominer. On mesure, on applique **un seul gain**, on limite.
    """
    mesure = subprocess.run(
        [ffmpeg(), "-hide_banner", "-nostats", "-i", str(source), "-af",
         f"loudnorm=I={cible_lufs}:TP={vrai_pic_db}:print_format=json",
         "-f", "null", "-"], capture_output=True, text=True)
    gain = 0.0
    depart = mesure.stderr.rfind("{")
    if depart != -1:
        try:
            valeur = float(json.loads(mesure.stderr[depart:])["input_i"])
            if valeur > -70:
                gain = cible_lufs - valeur
        except (ValueError, KeyError):
            gain = 0.0
    limite = 10.0 ** (vrai_pic_db / 20.0)
    subprocess.run(
        [ffmpeg(), "-y", "-v", "error", "-i", str(source), "-af",
         f"volume={gain:.2f}dB,alimiter=limit={limite:.4f}:level=disabled",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
         str(sortie)], check=True)
    return round(gain, 2)



# ── finition ──────────────────────────────────────────────────────────────────

def finition(source: Path, sortie: Path, reglages: dict, atelier: Path) -> dict:
    """Accorde les plans entre eux, puis pose un rendu. Jamais l'inverse.

    L'ordre n'est pas une préférence. Un rendu posé avant l'accord **amplifie**
    les écarts au lieu de les masquer : chaque plan reçoit la même courbe, et
    deux plans qui divergeaient d'un tiers de diaphragme en divergent d'autant
    plus une fois contrastés. Accorder d'abord, colorer ensuite.

    Trois raisons de faire ça ici plutôt qu'à la main après coup :

    - `etalonner.py` **copie le son sans le réencoder**. Le mixage qu'on vient
      de construire, avec sa courbe de cibles et sa normalisation, traverse la
      finition intact — le refaire passer par un encodeur audio annulerait le
      travail du fichier entier.
    - Les calques ont un ordre, et il se retient mal : LUT, fuite, grain,
      vignettage. Le **grain se pose en dernier des images** — tout filtre qui
      le suit le lisse, et il ne reste qu'un flou.
    - Un calque se pose en fusion, jamais en opacité seule. `screen` pour ce qui
      ajoute de la lumière (grain, fuite, poussière), `multiply` pour ce qui en
      retire (vignettage). Une fuite de lumière en fondu simple grise l'image.

    Chaque étape est facultative : une recette sans `finition` sort le fichier
    du mixage tel quel.
    """
    if not reglages:
        return {"finition": "aucune"}

    racine = Path(__file__).resolve().parent.parent
    courant = source
    rapport: dict = {}

    accord = reglages.get("etalonnage")
    if accord:
        outil = racine / ".claude" / "skills" / "etalonner" / "scripts" / "etalonner.py"
        if outil.is_file():
            accorde = atelier / "_accorde.mp4"
            options = accord if isinstance(accord, dict) else {}
            commande = [sys.executable, str(outil), str(courant), "-o", str(accorde),
                        "--grain", str(options.get("grain", 0)),
                        "--force", str(options.get("force", 0.75))]
            # Sans rendu par défaut : le rendu vient des calques et de la LUT
            # ci-dessous, et le poser deux fois double contraste et grain.
            if not options.get("rendu"):
                commande.append("--sans-rendu")
            resultat = subprocess.run(commande, capture_output=True, text=True)
            if accorde.is_file():
                courant = accorde
                ecart = [l for l in resultat.stdout.splitlines() if "écart moyen après" in l]
                rapport["etalonnage"] = ecart[-1].strip() if ecart else "fait"
            else:
                rapport["etalonnage"] = "échec — plan gardé tel quel"
        else:
            rapport["etalonnage"] = "outil absent"

    calques = reglages.get("calques", [])
    lut = reglages.get("lut")
    if calques or lut:
        entrees = ["-i", str(courant)]
        # L'indice d'entrée se compte, il ne se déduit pas de la longueur de la
        # liste : « -stream_loop -1 -i fichier » y ajoute trois éléments et non
        # deux, et le calcul décalait alors d'un cran par calque bouclé.
        rang_entree = 0
        graphe = []
        courante = "[0:v]"
        if lut:
            chemin = (racine / lut) if not Path(lut).is_absolute() else Path(lut)
            graphe.append(f"{courante}lut3d='{chemin}'[etalonne]")
            courante = "[etalonne]"
        for rang, calque in enumerate(calques, start=1):
            chemin = racine / calque["fichier"]
            if not chemin.is_file():
                rapport.setdefault("calques_absents", []).append(calque["fichier"])
                continue
            # Une vidéo de calque se boucle : elle est plus courte que le film,
            # et sans boucle la seconde moitié n'en reçoit rien.
            # Une vidéo se rejoue en boucle, une image fixe se **tient** :
            # sans `-loop 1`, un PNG ne dure qu'une image, et le `shortest=1`
            # du mélange termine alors tout le film avec elle. Le premier essai
            # a rendu un fichier d'une seule image — sans la moindre erreur de
            # ffmpeg, qui a fait exactement ce qu'on lui demandait.
            if chemin.suffix == ".mp4":
                entrees += ["-stream_loop", "-1", "-i", str(chemin)]
            else:
                entrees += ["-loop", "1", "-i", str(chemin)]
            rang_entree += 1
            fusion = calque.get("fusion", "screen")
            opacite = float(calque.get("opacite", 0.15))
            marque, suivante = f"[c{rang}]", f"[m{rang}]"
            if chemin.suffix == ".mp4":
                # Un calque vidéo est une carte de luminance opaque — grain,
                # poussière, fumée. Il se mélange, et `all_opacity` est le
                # réglage prévu pour ça.
                graphe.append(f"[{rang_entree}:v]scale=1080:1920,format=gbrp{marque}")
                graphe.append(f"{courante}{marque}"
                              f"blend=all_mode={fusion}:all_opacity={opacite}"
                              f":shortest=1{suivante}")
            else:
                # Un calque image porte sa forme dans **l'alpha**, et son RVB
                # est souvent noir — c'est le cas du vignettage. `blend` ignore
                # l'alpha et mélange le RVB : multiplier par du noir a rendu un
                # film entièrement noir, sans erreur. Ces calques-là se posent
                # en `overlay`, qui respecte la transparence.
                graphe.append(f"[{rang_entree}:v]scale=1080:1920,format=rgba,"
                              f"colorchannelmixer=aa={opacite}{marque}")
                graphe.append(f"{courante}{marque}overlay=0:0:shortest=1{suivante}")
            courante = suivante
        if graphe:
            graphe[-1] = graphe[-1].replace(courante, "[final]") if courante != "[0:v]" else graphe[-1]
            chaine = ";".join(graphe)
            subprocess.run([ffmpeg(), "-y", "-v", "error", *entrees,
                            "-filter_complex", chaine, "-map", "[final]",
                            "-map", "0:a", "-c:v", "libx264", "-preset", "slow",
                            "-crf", "18", "-pix_fmt", "yuv420p",
                            # Le son est recopié tel quel : c'est le mixage
                            # normalisé, il n'a rien à gagner à repasser par un
                            # encodeur et tout à y perdre.
                            "-c:a", "copy", "-movflags", "+faststart",
                            str(sortie)], check=True)
            rapport["calques"] = len(calques)
            rapport["lut"] = bool(lut)
            return rapport

    if courant != sortie:
        shutil.copy(courant, sortie)
    return rapport


def monter(episode: dict, sortie: Path, atelier: Path) -> dict:
    atelier.mkdir(parents=True, exist_ok=True)
    for ancien in atelier.glob("_plan*.mkv"):
        ancien.unlink()

    gains, instant, reperes = [], 0.0, {}
    morceaux = []
    for rang, plan in enumerate(episode["plans"]):
        fichier = atelier / f"_plan{rang:02d}.mkv"
        gains.append((plan.get("nom", Path(plan["source"]).stem), couper(plan, fichier)))
        reperes[plan.get("nom", str(rang))] = round(instant, 2)
        instant += float(plan["duree"])
        morceaux.append(fichier)
    total = instant

    (atelier / "_liste.txt").write_text(
        "".join(f"file '{p.name}'\n" for p in morceaux), encoding="utf-8")
    base = atelier / "_base.mkv"
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-f", "concat", "-safe", "0",
                    "-i", str(atelier / "_liste.txt"), "-c:v", "copy",
                    "-c:a", "pcm_s16le", str(base)], check=True)

    voix_piste, fenetres_voix = couche_voix(episode.get("voix", []), total, atelier)
    voix = atelier / "_voix.wav"
    with wave.open(str(voix), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TAUX)
        f.writeframes(numpy.int16(numpy.clip(voix_piste, -1, 1) * 32767).tobytes())

    effets = atelier / "_effets.wav"
    reglage = episode.get("esquive")
    # Une voix écrite dans la recette pilote l'esquive d'elle-même : ses
    # fenêtres sont exactes, là où une détection sur le montage devine.
    if reglage is None and fenetres_voix:
        reglage = fenetres_voix
    if isinstance(reglage, dict):
        # La détection se fait sur le montage lui-même : c'est lui qui porte la
        # voix, et lui seul sait où elle tombe une fois les plans assemblés.
        reglage = dict(reglage, voix=str(base))
    piste = couche_effets(episode.get("effets", []),
                          Path(episode.get("bibliotheque", "sfx_library")).expanduser(),
                          total, float(episode.get("reverberation_s", 2.2)),
                          reglage)
    with wave.open(str(effets), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(TAUX)
        f.writeframes(numpy.int16(numpy.clip(piste, -1, 1) * 32767).tobytes())

    couches = []
    for entree in episode.get("sous_titres", []):
        couches += texte_ffmpeg(entree, Y_SOUS_TITRE)
    for entree in episode.get("titres", []):
        couches += texte_ffmpeg(entree, 1040)
    dessin = ",".join(couches) or "null"

    # 45 Hz : sous ce seuil ni téléphone ni casque grand public ne rend rien ;
    # ce qu'on y laisse ne s'entend pas et mange la marge du limiteur.
    # La présence à 2,5 et 6 kHz vise la bande où un petit haut-parleur est le
    # plus efficace — la mesure large bande ne la voit presque pas, l'oreille si.
    # La voix entre en troisième, à son niveau propre : elle ne passe ni par
    # l'élargissement stéréo — une parole élargie perd son centre — ni par la
    # normalisation de la couche d'effets.
    chaine = (f"[2:a]aformat=channel_layouts=stereo,"
              f"volume={episode.get('voix_db', 0)}dB[x];"
              f"[1:a]aformat=channel_layouts=stereo,"
              f"volume={episode.get('effets_db', 3)}dB,"
              f"stereotools=slev={episode.get('largeur_stereo', 2.0)}[s];"
              "[0:a]aformat=channel_layouts=stereo[v];"
              "[v][s][x]amix=inputs=3:duration=first:normalize=0,"
              "highpass=f=45:poles=2,"
              "equalizer=f=2500:t=q:w=1.2:g=4,equalizer=f=6000:t=q:w=1.4:g=3[a]")
    mixe = atelier / "_mixe.mkv"
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(base), "-i", str(effets),
                    "-i", str(voix),
                    "-filter_complex", chaine, "-map", "0:v", "-map", "[a]",
                    "-vf", dessin, "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", str(mixe)], check=True)

    if episode.get("silences"):
        # Un blanc voulu, juste avant la chute. Il ne se fabrique pas en
        # coupant la piste — la coupure claque — mais par une descente de
        # quelques centièmes de chaque côté.
        creux = []
        for trou in episode["silences"]:
            d, fin_t = float(trou["debut"]), float(trou["fin"])
            creux.append(f"if(between(t,{d:.3f},{fin_t:.3f}),0,"
                         f"if(between(t,{d - 0.04:.3f},{d:.3f}),(({d:.3f}-t)/0.04),"
                         f"if(between(t,{fin_t:.3f},{fin_t + 0.06:.3f}),"
                         f"((t-{fin_t:.3f})/0.06),1)))")
        avec_trous = atelier / "_troue.mkv"
        subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(mixe), "-af",
                        f"volume='{'*'.join(creux)}':eval=frame",
                        "-c:v", "copy", "-c:a", "pcm_s16le", str(avec_trous)], check=True)
        mixe = avec_trous

    reglages = episode.get("finition")
    if reglages:
        brut = atelier / "_normalise.mp4"
        gain = normaliser(mixe, brut)
        rapport_finition = finition(brut, sortie, reglages, atelier)
    else:
        gain = normaliser(mixe, sortie)
        rapport_finition = {"finition": "aucune"}
    for reste in atelier.glob("_*"):
        reste.unlink(missing_ok=True)

    releve = [(nom, entendu(sortie, reperes[nom], float(p["duree"])))
              for nom, p in zip((n for n, _ in gains), episode["plans"])]
    mesures = [v for _, v in releve if v is not None]
    return {"duree_s": round(total, 2), "gain_sonie_db": gain,
            "gains_plans": gains, "niveaux": releve,
            "relief_db": round(max(mesures) - min(mesures), 1) if mesures else 0.0,
            **rapport_finition}


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Monte un épisode vertical à partir d'un plan JSON.")
    analyseur.add_argument("episode", nargs="?", help="le montage (voir --exemple)")
    analyseur.add_argument("sortie", nargs="?", help="le MP4 à écrire")
    analyseur.add_argument("--sonder", metavar="PLAN",
                           help="relève le niveau entendu seconde par seconde")
    analyseur.add_argument("--phrases", metavar="PLAN",
                           help="relève les groupes de parole d'un plan")
    analyseur.add_argument("--atelier", default=None,
                           help="dossier de travail (défaut : à côté de la sortie)")
    options = analyseur.parse_args()

    if options.sonder:
        media = Path(options.sonder).expanduser()
        print(f"\n  {media.name} — niveau entendu, seconde par seconde\n")
        for instant, valeur in sonder(media):
            print(f"    {instant:>5.1f}s  {valeur:>7.1f} dB  "
                  f"{'█' * max(1, int((valeur + 45) / 1.2))}")
        print("\n  Couper là où le plan donne, pas là où il commence.")
        return 0

    if options.phrases:
        media = Path(options.phrases).expanduser()
        groupes = phrases(media)
        print(f"\n  {media.name} — {len(groupes)} groupe(s) de parole\n")
        for debut, fin in groupes:
            print(f"    {debut:>5.2f} → {fin:>5.2f}   ({fin - debut:.2f}s)")
        print("\n  Les durées disent quelle réplique va où.")
        return 0

    if not options.episode or not options.sortie:
        analyseur.error("il faut un épisode et une sortie, ou --sonder / --phrases")

    episode = json.loads(Path(options.episode).expanduser().read_text(encoding="utf-8"))
    sortie = Path(options.sortie).expanduser()
    sortie.parent.mkdir(parents=True, exist_ok=True)
    atelier = Path(options.atelier).expanduser() if options.atelier \
        else sortie.parent / "_atelier"

    bilan = monter(episode, sortie, atelier)
    print(f"\n  {sortie}  —  {bilan['duree_s']}s  (sonie {bilan['gain_sonie_db']:+} dB)\n")
    for nom, valeur in bilan["niveaux"]:
        if valeur is None:
            continue
        print(f"    {nom[:22]:<24}{valeur:>7.1f} dB  "
              f"{'█' * max(1, int((valeur + 38) / 0.5))}")
    print(f"\n  relief : {bilan['relief_db']} dB")
    if bilan["relief_db"] < 8:
        print("  ⚠ sous 8 dB, un montage s'entend plat : creuser les cibles.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
