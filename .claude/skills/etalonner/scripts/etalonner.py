"""
Étalonne un montage : faire tenir les plans ensemble, puis poser un rendu.

Ce qui trahit un assemblage de rushes générés, ce n'est presque jamais un plan
pris isolément — c'est le saut d'un plan à l'autre. Deux images superbes qui ne
partagent ni la même exposition ni la même dominante se lisent comme deux
extraits collés, pas comme un film.

Le geste est donc en deux temps, et l'ordre compte :

1. **Accorder.** On mesure chaque plan et on rapproche ceux qui divergent sans
   raison. Rapprocher, pas aplatir : une bande-annonce a le droit de
   s'assombrir vers la fin, et lui imposer une exposition unique lui retirerait
   sa courbe. On corrige donc l'écart à la tendance, jamais l'écart à une
   constante.

2. **Poser un rendu.** Une fois les plans accordés, un seul traitement les
   traverse tous : contraste en S, ombres froides et hautes lumières chaudes,
   grain, vignettage. C'est ce qui fait qu'un ensemble paraît tourné plutôt
   qu'assemblé — et il ne peut venir qu'après, sinon il amplifie les écarts au
   lieu de les masquer.

La mesure passe par `signalstats`, qui rend directement la luminance moyenne et
les deux composantes de chrominance. Ce détour évite de lire des octets bruts,
où seize octets par ligne — non divisibles par trois — suffisent à mélanger les
canaux et à produire des chiffres crédibles et faux.
"""

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def outil(nom):
    chemin = shutil.which(nom)
    if chemin:
        return chemin
    # `imageio-ffmpeg` ne livre QUE ffmpeg. Déduire le chemin de ffprobe en y
    # remplaçant « ffmpeg » par « ffprobe » fabriquait un chemin qui ne peut
    # pas exister : `str.replace` emporte toutes les occurrences, donc le nom
    # du dossier `imageio_ffmpeg` avec — d'où un `.../imageio_ffprobe/...`
    # fantôme, et une `FileNotFoundError` brute au lieu du message ci-dessous.
    # Même corrigé, ce chemin n'existerait pas : le paquet n'a pas de ffprobe.
    if nom == "ffmpeg":
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pass
    raise SystemExit(f"{nom} introuvable : installe ffmpeg avant de relancer.")


FFMPEG, FFPROBE = outil("ffmpeg"), outil("ffprobe")


def lancer(args):
    return subprocess.run(args, capture_output=True, text=True)


def duree(source):
    r = lancer([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                "-of", "csv=p=0", str(source)])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def coupes(source, seuil=0.18):
    """
    Repère les coupes par changement de scène.

    Le seuil est volontairement haut : un mouvement de caméra rapide déclenche
    un faible score, une vraie coupe un score élevé. Trop bas, on découpe un
    plan en morceaux et on lui applique deux corrections différentes — ce qui
    se voit bien plus qu'un plan mal accordé.
    """
    r = lancer([FFMPEG, "-hide_banner", "-i", str(source),
                "-vf", f"select='gt(scene,{seuil})',metadata=print",
                "-f", "null", "-"])
    temps = []
    for ligne in r.stderr.splitlines():
        if "pts_time:" in ligne:
            try:
                temps.append(float(ligne.split("pts_time:")[1].split()[0]))
            except (IndexError, ValueError):
                continue
    fin = duree(source)
    bornes = [0.0] + [t for t in sorted(set(temps)) if 0.25 < t < fin - 0.25] + [fin]
    # Un plan de moins de 0,4 s n'est pas un plan : c'est un flash ou une
    # fausse détection. On le recolle au précédent.
    plans = []
    for a, b in zip(bornes, bornes[1:]):
        if plans and b - a < 0.4:
            plans[-1] = (plans[-1][0], b)
        else:
            plans.append((a, b))
    return plans


def mesurer(source, debut, fin):
    """Luminance et chrominance moyennes d'un plan, via signalstats."""
    marge = min(0.15, (fin - debut) / 4)
    r = lancer([FFMPEG, "-hide_banner", "-ss", f"{debut + marge:.3f}",
                "-t", f"{max(fin - debut - 2 * marge, 0.1):.3f}", "-i", str(source),
                "-vf", "signalstats,metadata=print", "-f", "null", "-"])
    sommes, comptes = {"YAVG": 0.0, "UAVG": 0.0, "VAVG": 0.0}, {"YAVG": 0, "UAVG": 0, "VAVG": 0}
    for ligne in r.stderr.splitlines():
        for cle in sommes:
            if f"signalstats.{cle}=" in ligne:
                try:
                    sommes[cle] += float(ligne.split("=")[-1])
                    comptes[cle] += 1
                except ValueError:
                    pass
    return {c: (sommes[c] / comptes[c] if comptes[c] else 0.0) for c in sommes}


def cible_locale(valeurs):
    """
    Ce vers quoi chaque plan doit tendre : la moyenne pondérée de ses voisins.

    Une première version ajustait sur une droite de tendance globale. Elle
    décrivait mal un film : sur une bande-annonce qui s'assombrit puis
    s'illumine au rugissement final, la droite réclamait d'assombrir
    précisément le plan qui doit éclater. Une intention devenait un défaut à
    corriger.

    Ce qui saute à l'œil n'est pas l'écart à une moyenne, c'est l'écart entre
    **deux plans voisins** : un film a le droit d'aller du clair au sombre, à
    condition de ne pas le faire d'un coup. La cible d'un plan est donc son
    propre voisinage — ce qui laisse intacte la courbe d'ensemble et ne réduit
    que les marches.
    """
    n = len(valeurs)
    if n < 2:
        return lambda i: valeurs[0] if valeurs else 0.0

    def cible(i):
        # Le plan compte pour moitié, ses voisins pour l'autre : sans ce poids,
        # deux plans clairs entourant un sombre l'éclaireraient à l'excès.
        poids = [(i, 2.0)]
        if i > 0:
            poids.append((i - 1, 1.0))
        if i < n - 1:
            poids.append((i + 1, 1.0))
        total = sum(p for _, p in poids)
        return sum(valeurs[j] * p for j, p in poids) / total

    return cible


def corrections(plans, mesures, force=0.75):
    """
    Ce qu'il faut appliquer à chaque plan pour qu'il rejoigne la tendance.

    `force` borne volontairement la correction à trois quarts de l'écart : une
    correction totale rend l'ensemble plat et fait ressortir le grain des plans
    remontés. On rapproche, on n'aligne pas.
    """
    lum = [m["YAVG"] for m in mesures]
    droite = cible_locale(lum)
    sorties = []
    for i, ((a, b), m) in enumerate(zip(plans, mesures)):
        vise = droite(i)
        actuel = max(m["YAVG"], 1.0)
        gain = 1.0 + force * (vise - actuel) / actuel
        gain = max(0.55, min(1.8, gain))  # au-delà, on casse plus qu'on ne répare
        # La chrominance se ramène vers le neutre (128), sans jamais l'atteindre :
        # une dominante partielle appartient souvent au parti pris du plan.
        du = -(m["UAVG"] - 128) / 255 * force
        dv = -(m["VAVG"] - 128) / 255 * force
        sorties.append({
            "plan": i + 1, "debut": round(a, 2), "fin": round(b, 2),
            "luminance": round(m["YAVG"], 1), "vise": round(vise, 1),
            "gain": round(gain, 3),
            "bleu": round(du, 3), "rouge": round(dv, 3),
            "ecart_avant": round(m["YAVG"] - vise, 1),
        })
    return sorties


def chaine(corrs, grain, rendu):
    """
    La chaîne de filtres : accord plan par plan, puis rendu commun.

    Chaque correction est bornée dans le temps par `enable`, ce qui permet de
    tout faire en une passe — réencoder deux fois coûte une génération de
    qualité pour rien.
    """
    filtres = []
    for c in corrs:
        entre = f"between(t,{c['debut']},{c['fin']})"
        if abs(c["gain"] - 1) > 0.01:
            filtres.append(f"eq=brightness=0:contrast=1:gamma={c['gain']:.3f}:enable='{entre}'")
        if abs(c["bleu"]) > 0.01 or abs(c["rouge"]) > 0.01:
            filtres.append(
                f"colorbalance=rm={c['rouge']:.3f}:bm={c['bleu']:.3f}"
                f":rs={c['rouge'] * 0.5:.3f}:bs={c['bleu'] * 0.5:.3f}:enable='{entre}'")

    if rendu:
        filtres += [
            # Contraste en S : les ombres se ferment, les hautes lumières
            # tiennent. C'est la signature d'une pellicule, pas d'un capteur.
            "curves=r='0/0 0.25/0.20 0.75/0.80 1/1'"
            ":g='0/0 0.25/0.20 0.75/0.80 1/1'"
            ":b='0/0.02 0.25/0.24 0.75/0.79 1/1'",
            # Ombres froides, hautes lumières chaudes : l'étalonnage le plus
            # employé du cinéma d'action, parce qu'il sépare la peau du décor.
            "colorbalance=rs=-0.04:bs=0.06:rh=0.05:bh=-0.04",
            "vignette=angle=PI/5",
        ]
    if grain > 0:
        # Le grain se pose en dernier : appliqué avant, les filtres suivants
        # le lissent et il ne reste qu'un flou.
        filtres.append(f"noise=alls={grain}:allf=t+u")
    return ",".join(filtres) if filtres else "null"


def planche(avant, apres, corrs, sortie):
    """Une bande avant / après par plan, pour juger de l'œil et non du chiffre."""
    dossier = Path("/tmp/_etalonnage")
    shutil.rmtree(dossier, ignore_errors=True)
    dossier.mkdir(parents=True)
    for i, c in enumerate(corrs):
        t = (c["debut"] + c["fin"]) / 2
        for rang, src in ((0, avant), (1, apres)):
            lancer([FFMPEG, "-v", "error", "-ss", f"{t:.2f}", "-i", str(src),
                    "-frames:v", "1", "-vf", "scale=190:-2", "-y",
                    str(dossier / f"{rang:01d}{i:02d}.png")])
    images = sorted(dossier.glob("*.png"))
    if not images:
        return None
    for n, img in enumerate(images):
        img.rename(dossier / f"z{n:03d}.png")
    lancer([FFMPEG, "-v", "error", "-i", str(dossier / "z%03d.png"),
            "-filter_complex", f"tile={len(corrs)}x2:margin=8:padding=8:color=#0d1117",
            "-frames:v", "1", "-y", str(sortie)])
    return str(sortie) if Path(sortie).exists() else None


def main():
    p = argparse.ArgumentParser(description="Étalonner un montage.")
    p.add_argument("source")
    p.add_argument("-o", "--sortie", default=None)
    p.add_argument("--grain", type=int, default=6, help="0 pour aucun grain")
    p.add_argument("--sans-rendu", action="store_true", help="accorder seulement")
    p.add_argument("--force", type=float, default=0.75)
    p.add_argument("--mesurer-seulement", action="store_true")
    args = p.parse_args()

    source = Path(args.source)
    sortie = Path(args.sortie or source.with_name(source.stem + "-etalonne.mp4"))

    plans = coupes(source)
    mesures = [mesurer(source, a, b) for a, b in plans]
    corrs = corrections(plans, mesures, args.force)

    print(f"{len(plans)} plan(s) détecté(s)\n")
    print(f"{'plan':>4} {'de':>7} {'à':>7} {'lumin.':>8} {'visé':>7} {'écart':>7} {'gain':>6}")
    for c in corrs:
        print(f"{c['plan']:>4} {c['debut']:>7.2f} {c['fin']:>7.2f} "
              f"{c['luminance']:>8.1f} {c['vise']:>7.1f} {c['ecart_avant']:>+7.1f} {c['gain']:>6.3f}")
    ecarts = [abs(c["ecart_avant"]) for c in corrs]
    print(f"\nécart moyen à la tendance : {sum(ecarts) / len(ecarts):.1f} "
          f"(maximum {max(ecarts):.1f})")

    if args.mesurer_seulement:
        return

    vf = chaine(corrs, args.grain, not args.sans_rendu)
    print(f"\nrendu en cours…")
    r = lancer([FFMPEG, "-hide_banner", "-v", "error", "-i", str(source),
                "-vf", vf, "-c:v", "libx264", "-crf", "20", "-preset", "medium",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-c:a", "copy", "-y", str(sortie)])
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg a échoué :\n{r.stderr[-800:]}")

    img = planche(source, sortie, corrs, sortie.with_name(sortie.stem + "-avant-apres.png"))
    apres = [mesurer(sortie, c["debut"], c["fin"])["YAVG"] for c in corrs]
    droite = cible_locale(apres)
    restants = [abs(v - droite(i)) for i, v in enumerate(apres)]
    print(f"écart moyen après : {sum(restants) / len(restants):.1f} "
          f"(maximum {max(restants):.1f})")
    print(f"\n{sortie}")
    if img:
        print(f"{img}  ← à regarder")

    Path(sortie.with_suffix(".json")).write_text(
        json.dumps({"plans": corrs, "chaine": vf}, ensure_ascii=False, indent=2),
        encoding="utf-8")


if __name__ == "__main__":
    main()
