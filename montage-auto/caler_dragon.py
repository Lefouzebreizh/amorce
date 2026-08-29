#!/usr/bin/env python3
"""Recalcule tous les instants du montage à partir des durées de ses plans.

Écrit après avoir posé deux fois les mêmes accents au mauvais endroit. La
première fois parce qu'avec `vitesse`, `duree` compte en secondes **source** et
que la longueur rendue vaut `duree / vitesse` — 1,24 s d'écart, tous les accents
du dragon dans le creux de l'événement qu'ils devaient souligner. La seconde
parce qu'un plan d'ouverture raccourci de 1,3 s décale tout ce qui suit.

La parade n'est pas de recalculer plus soigneusement à la main : c'est de ne
plus calculer à la main. Les instants du dragon sont **dérivés** de la frise et
des événements relevés dans son rush ; changer la durée de l'affiche les déplace
tout seuls.

Les événements du rush, relevés une fois pour toutes tranche par tranche
au-dessus de 400 Hz (temps SOURCE, depuis le point de coupe) :

    0,10  l'arrivée          3,40  l'éclair (crête −17,4 dB)
    0,85  le silence         4,20  le second creux
    1,90  la montée          4,30  LE RUGISSEMENT (crête −14,1 dB)
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

# Les instants du rush, en secondes depuis son point de coupe.
RUSH = {"arrivee": 0.10, "silence": 0.85, "montee": 1.90,
        "creux": 2.80, "eclair": 3.40, "avant_cri": 4.20, "cri": 4.30,
        "debris": 4.85, "fin_silence": 1.90, "fin_creux": 3.30}


def frise(recette: dict) -> dict[str, float]:
    """L'instant de départ de chaque plan sur la frise rendue."""
    depart, table = 0.0, {}
    for plan in recette["plans"]:
        table[plan["nom"]] = depart
        depart += plan["duree"] / float(plan.get("vitesse", 1.0))
    table["_fin"] = depart
    return table


def instants(recette: dict) -> dict[str, float]:
    """Les événements du dragon, ramenés sur la frise."""
    table = frise(recette)
    debut = table["dragon"]
    vitesse = float(next(p for p in recette["plans"]
                         if p["nom"] == "dragon").get("vitesse", 1.0))
    return {nom: round(debut + t / vitesse, 3) for nom, t in RUSH.items()}


def caler(recette: dict, couches: list | None = None) -> tuple[dict, dict, list]:
    """Rend la recette recalée, le plan d'automation et les sous-titres."""
    t = instants(recette)
    table = frise(recette)
    place = {
        "braam_massif": t["arrivee"],
        "pas_mecanique": None,          # deux occurrences, traitées à part
        "chute_pierres": None,          # deux aussi
        "riser_court": round(t["eclair"] - 0.55, 3),
        "electricite": t["eclair"],
        "eclat": round(t["eclair"] + 0.02, 3),
        "braam_double": round(t["cri"] - 0.06, 3),
    }
    pas = [round(t["silence"] + 0.10, 3), round(t["montee"] - 0.28, 3)]
    pierres = [round(t["montee"] - 0.20, 3), round(t["debris"] + 0.20, 3)]
    vus_pas = vus_pierres = 0
    for effet in recette["effets"]:
        if effet["instant"] < table["dragon"] - 0.5:
            continue
        nom = effet["son"]
        if nom == "pas_mecanique":
            effet["instant"] = pas[min(vus_pas, 1)]; vus_pas += 1
        elif nom == "chute_pierres":
            effet["instant"] = pierres[min(vus_pierres, 1)]; vus_pierres += 1
        elif place.get(nom) is not None:
            effet["instant"] = place[nom]
    recette["effets"].sort(key=lambda e: e["instant"])

    # Les flashs et les secousses du plan dragon se calent eux aussi sur les
    # instants du rush — et ils comptent en temps SOURCE, donc sans la division
    # par la vitesse. C'est ce qui les a fait deriver quand le ralenti a ete
    # retire : un flash ecrit pour un plan a 0,8 tombait 1,08 s APRES le cri,
    # c'est-a-dire tout a la fin du plan, ou il se lit comme un saut d'image.
    dragon = next(p for p in recette["plans"] if p["nom"] == "dragon")
    dragon["flashs"] = [
        {"debut": RUSH["eclair"], "duree": 0.14, "force": 0.50},
        {"debut": RUSH["cri"], "duree": 0.083, "force": 0.45},
    ]
    dragon["tremblements"] = [
        {"debut": RUSH["arrivee"], "duree": 0.35, "force": 0.10},
        {"debut": RUSH["cri"], "duree": 0.60, "force": 0.17},
    ]

    # L'automation. Le trou d'air avant le cri se termine 0,06 s AVANT lui,
    # jamais dessus : mesuré à −29,6 dB, il mordait sur les dix centièmes
    # d'attaque du rugissement et l'aplatissait en une montée molle. Un trou
    # d'air qui déborde sur ce qu'il annonce ne le prépare plus, il le coupe.
    trou_fin = round(t["cri"] - 0.06, 3)
    automation = {
        "_lisez_moi": [
            "Genere par caler_dragon.py — ne pas editer a la main.",
            "Les creux suivent les silences que le rush menage ; le dernier",
            "s'arrete 0,06 s AVANT le cri, jamais dessus.",
        ],
        "micro_silences": [
            {"instant": t["silence"], "avance": 0.30,
             "tenue": round(t["fin_silence"] - t["silence"], 3),
             "retour": 0.28, "gain_db": -9},
            {"instant": t["creux"], "avance": 0.22,
             "tenue": round(t["fin_creux"] - t["creux"], 3),
             "retour": 0.22, "gain_db": -4},
            {"instant": round(trou_fin - 0.26, 3), "avance": 0.16,
             "tenue": 0.10, "retour": 0.16, "gain_db": -9},
        ],
        # Les couches sonores déjà posées sont CONSERVÉES. Les écraser par une
        # liste vide a coûté trois mesures fausses de suite : le fichier
        # d'automation est régénéré à chaque recalage, et il porte aussi les
        # bruitages ajoutés à la main. Un outil qui régénère un fichier partagé
        # doit rendre ce qu'il n'a pas calculé, sinon il le supprime en silence.
        "couches": list(couches or []),
    }

    # Les sous-titres : groupes de parole relevés dans le rush du mage
    # (0,64-1,29 / 2,05-2,73 / 3,40-4,73 en temps source, depart 0,20), avec
    # 0,15 s d'avance — un sous-titre qui arrive AVEC le mot arrive en retard
    # pour qui doit encore le lire.
    mage = next(p for p in recette["plans"] if p["nom"] == "mage")
    base = table["mage"] - float(mage.get("depart", 0.0))
    groupes = [(0.64, 1.29), (2.05, 2.73), (3.40, 4.73)]
    textes = ["RIFT ZERO FIVE", "BREACH OPEN", "THE SHADOW TITAN AWAKENS"]
    # 0,30 s d'avance et non 0,15 : la BOUCHE s'ouvre avant que le son sorte,
    # et c'est sur la bouche que l'oeil cale la synchronisation, pas sur
    # l'oreille. Un sous-titre qui arrive avec le son arrive apres l'image.
    sous_titres = [(txt, round(base + a - 0.30, 3), round(base + b - 0.10, 3))
                   for txt, (a, b) in zip(textes, groupes)]
    return recette, automation, sous_titres


def _hms(t: float) -> str:
    h, reste = divmod(max(0.0, t), 3600)
    m, s = divmod(reste, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}".replace(".", ",")


def principal(argv=None) -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("recette", type=Path)
    a.add_argument("--automation", type=Path, required=True)
    a.add_argument("--srt", type=Path, required=True)
    o = a.parse_args(argv)
    recette = json.loads(o.recette.read_text())
    anciennes = []
    if o.automation.is_file():
        try:
            anciennes = json.loads(o.automation.read_text()).get("couches", [])
        except json.JSONDecodeError:
            pass
    recette, automation, sous_titres = caler(recette, anciennes)
    o.recette.write_text(json.dumps(recette, ensure_ascii=False, indent=2) + "\n")
    o.automation.write_text(json.dumps(automation, ensure_ascii=False, indent=2) + "\n")
    o.srt.write_text("".join(
        f"{i}\n{_hms(d)} --> {_hms(f)}\n{txt}\n\n"
        for i, (txt, d, f) in enumerate(sous_titres, 1)), encoding="utf-8")
    table, t = frise(recette), instants(recette)
    print("  frise : " + "  ".join(f"{n} {v:.2f}" for n, v in table.items()
                                   if not n.startswith("_"))
          + f"  → {table['_fin']:.2f} s")
    print("  dragon : " + "  ".join(f"{n} {v}" for n, v in t.items()
                                    if n in ("arrivee", "montee", "eclair", "cri")))
    print("  sous-titres : " + "  ".join(f"{d}" for _, d, _ in sous_titres))
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
