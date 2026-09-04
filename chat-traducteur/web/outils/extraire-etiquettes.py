"""Extrait les 521 étiquettes **du fichier de poids lui-même**.

Le `.tflite` porte ses métadonnées, et un `.tflite` à métadonnées est aussi une
archive ZIP : `yamnet_label_list.txt` s'y lit sans rien installer. C'est la
seule source qui ne peut pas se désynchroniser du modèle — une liste recopiée
d'ailleurs décrirait un autre modèle, et rien ne le signalerait : les scores
sortiraient dans le bon ordre avec les mauvais noms.

    python3 chat-traducteur/web/outils/extraire-etiquettes.py
"""

import json
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
MODELE = RACINE.parent / "modeles" / "yamnet.tflite"


def principal() -> int:
    etiquettes = (zipfile.ZipFile(MODELE)
                  .read("yamnet_label_list.txt").decode("utf-8").splitlines())
    if len(etiquettes) != 521:
        print(f"521 étiquettes attendues, {len(etiquettes)} lues — modèle inattendu")
        return 1
    (RACINE / "donnees" / "etiquettes.json").write_text(
        json.dumps(etiquettes, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(etiquettes)} étiquettes écrites dans donnees/etiquettes.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
