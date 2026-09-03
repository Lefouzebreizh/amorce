#!/usr/bin/env python3
"""Passe tout un dossier de sons dans la chaîne et rend un tableau à lire.

Ce que le `cli.py` fait pour **un** fichier, celui-ci le fait pour un corpus —
et c'est une différence de nature, pas de degré. Un verdict isolé ne dit jamais
si une règle tient : il dit ce qu'elle a répondu une fois. Le défaut de la
classe parente `Cat` s'est vu parce qu'on a regardé plusieurs sons côte à côte,
et la question restée ouverte — `Meow` contre `Caterwaul` — ne peut se trancher
que de la même façon.

Le tableau porte donc, par fichier, ce qu'il faut pour décider :
le cumul félin (qui décide de la porte), les cinq classes une par une, et le
verdict. Rien n'est agrégé en une note : une moyenne cacherait exactement les
cas limites qu'on cherche.

    python3 chat-traducteur/scripts/mesurer_corpus.py .fixtures/corpus
"""

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from adaptateurs.audio import AudioIllisible, charger, fenetrer  # noqa: E402
from adaptateurs.yamnet import Yamnet  # noqa: E402
from noyau.verdict import CLASSES_FELINES, juger  # noqa: E402

# La vidéo est dans la liste, et ce n'est pas un luxe : **un téléphone filme
# autant qu'il enregistre**, et les premiers fichiers réels arrivés sur ce
# projet étaient deux `.mp4`. Le corpus les a refusés en bloc — « aucun son
# dans ce dossier » — alors que `adaptateurs.audio` sait les lire depuis le
# premier jour, puisqu'il passe par ffmpeg. Le manque était ici, dans une
# liste écrite en pensant à des fichiers son.
EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac",
              ".mp4", ".mov", ".m4v", ".webm", ".3gp"}


def mesurer(chemin: Path, modele: Yamnet) -> dict | None:
    """Rend une ligne de tableau, ou `None` si le fichier est illisible."""
    try:
        fenetres = fenetrer(charger(chemin))
    except AudioIllisible as erreur:
        print(f"  ✗ {chemin.name} : {erreur}", file=sys.stderr)
        return None

    scores = modele.scorer_toutes(fenetres)
    verdict = juger(scores)

    # La fenêtre la plus féline, celle-là même sur laquelle la porte statue :
    # afficher la moyenne du fichier dirait autre chose que ce qui a décidé.
    indice = max(range(len(scores)),
                 key=lambda i: sum(scores[i].get(c, 0.0) for c in CLASSES_FELINES))
    fenetre = scores[indice]

    return {
        "nom": chemin.stem,
        "cumul": sum(fenetre.get(c, 0.0) for c in CLASSES_FELINES),
        **{c: fenetre.get(c, 0.0) for c in CLASSES_FELINES},
        "intention": verdict.intention.value,
        "source": verdict.source.value,
        "dominante": verdict.classe_dominante or "—",
    }


def principal() -> int:
    dossier = Path(sys.argv[1] if len(sys.argv) > 1 else ".fixtures/corpus")
    if not dossier.is_dir():
        print(f"Dossier introuvable : {dossier}", file=sys.stderr)
        return 1

    fichiers = sorted(f for f in dossier.iterdir() if f.suffix.lower() in EXTENSIONS)
    if not fichiers:
        print(f"Aucun son dans {dossier}", file=sys.stderr)
        return 1

    modele = Yamnet()
    lignes = [l for l in (mesurer(f, modele) for f in fichiers) if l]

    entete = f"{'fichier':<22} {'cumul':>6} " + " ".join(f"{c:>10}" for c in CLASSES_FELINES) \
             + f"  {'dominante':<11} {'intention':<13} source"
    print(entete)
    print("─" * len(entete))
    for l in lignes:
        print(f"{l['nom']:<22} {l['cumul']:>6.3f} "
              + " ".join(f"{l[c]:>10.3f}" for c in CLASSES_FELINES)
              + f"  {l['dominante']:<11} {l['intention']:<13} {l['source']}")

    # ── Ce que le tableau seul ne montre pas : la régularité ────────────────
    print(f"\n{len(lignes)} fichiers mesurés.")
    print("Verdicts :", dict(Counter(l["intention"] for l in lignes)))

    felins = [l for l in lignes if l["dominante"] != "—"]
    if felins:
        cumuls = sorted(l["cumul"] for l in felins)
        print(f"Cumul félin des {len(felins)} sons qui passent la porte : "
              f"min {cumuls[0]:.3f}, médiane {cumuls[len(cumuls) // 2]:.3f}, "
              f"max {cumuls[-1]:.3f}")

    refuses = [l for l in lignes if l["dominante"] == "—"]
    if refuses:
        print(f"Cumul félin des {len(refuses)} sons refusés : "
              f"max {max(l['cumul'] for l in refuses):.3f}")

    # La question ouverte, chiffrée : quand les deux sont présents, qui gagne ?
    # On compte **qui a été retenu**, pas qui avait le score le plus haut. La
    # première version de ces lignes comptait les `Meow > Caterwaul` alors que
    # la règle venait de changer : elle annonçait « Meow l'emporte 3 fois » en
    # affichant cinq flèches vers Caterwaul. Un rapport qui contredit sa propre
    # liste est pire qu'un rapport absent — on croit celui des deux qui est le
    # plus court à lire.
    duel = [l for l in felins if l["Meow"] > 0.05 and l["Caterwaul"] > 0.05]
    if duel:
        retenu = sum(1 for l in duel if l["dominante"] == "Caterwaul")
        print(f"\nMeow et Caterwaul tous deux au-dessus de 0,05 : {len(duel)} cas, "
              f"Caterwaul retenu {retenu} fois")
        for l in duel:
            print(f"    {l['nom']:<22} Meow {l['Meow']:.3f}  Caterwaul {l['Caterwaul']:.3f}"
                  f"  -> {l['dominante']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
