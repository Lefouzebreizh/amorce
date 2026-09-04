"""Confronte la porte et la lecture directe à un corpus de **vrais** chats.

Jusqu'au 04/09/2026, tout ce que ce projet savait de YAMNet venait de quinze
sons **fabriqués** et de deux vidéos du chat d'Erwann. Le dépôt écrivait en
toutes lettres que le plancher de `Caterwaul` n'avait jamais vu un vrai chat.

Ce script va chercher ESC-50 — jeu de données de recherche publié sur GitHub,
2 000 clips de 5 s, 50 classes — et en tire les **40 enregistrements de chat**
plus des témoins choisis pour éprouver la porte : chien, bébé qui pleure,
oiseaux, aspirateur, coup à la porte.

    python3 chat-traducteur/scripts/mesurer_esc50.py

## Ce qu'il faut savoir avant de s'en servir

**La licence est CC BY-NC.** Le sous-ensemble commercial d'ESC-50 (*ESC-10*)
ne contient pas la classe `cat`. Ces fichiers servent donc à **éprouver**, ici,
et ne peuvent pas être embarqués dans un produit vendu. Ils atterrissent dans
`.fixtures/`, ignoré par Git, et n'en sortent pas.

**GitHub est le seul hôte joignable.** Sondés le 04/09/2026 : Wikimedia
Commons, archive.org, freesound.org et Zenodo rendent tous `000`.
`raw.githubusercontent.com` répond — c'est la parade que `CLAUDE.md` §7 nomme
déjà trois fois, et c'est encore elle qui débloque.
"""

import csv
import io
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
BASE = "https://raw.githubusercontent.com/karoldvl/ESC-50/master"
DOSSIER = RACINE / ".fixtures" / "esc50"

# Les témoins ne sont pas pris au hasard : ce sont les classes dont on peut
# craindre qu'elles franchissent la porte — un cri d'animal, une voix aiguë,
# un bruit large bande.
TEMOINS = {"dog", "crying_baby", "chirping_birds", "vacuum_cleaner", "door_wood_knock"}
TEMOINS_MAX = 20


def telecharger(url: str, cible: Path) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            cible.write_bytes(r.read())
        return cible.stat().st_size > 1024
    except Exception as e:  # noqa: BLE001 — on veut le message, pas la classe
        print(f"    échec {cible.name} : {e}", file=sys.stderr)
        return False


def principal() -> int:
    DOSSIER.mkdir(parents=True, exist_ok=True)
    print("Table des classes…")
    try:
        with urllib.request.urlopen(f"{BASE}/meta/esc50.csv", timeout=60) as r:
            lignes = list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))
    except Exception as e:  # noqa: BLE001
        print(f"ESC-50 injoignable : {e}", file=sys.stderr)
        print("Sondé le 04/09/2026 : seul raw.githubusercontent.com répond.", file=sys.stderr)
        return 3

    chats = [l["filename"] for l in lignes if l["category"] == "cat"]
    temoins = [l["filename"] for l in lignes if l["category"] in TEMOINS][:TEMOINS_MAX]
    print(f"  {len(chats)} chats, {len(temoins)} témoins")

    for prefixe, noms in (("chat-", chats), ("temoin-", temoins)):
        for nom in noms:
            cible = DOSSIER / f"{prefixe}{nom}"
            if cible.exists() and cible.stat().st_size > 1024:
                continue
            telecharger(f"{BASE}/audio/{nom}", cible)

    presents = sorted(DOSSIER.glob("*.wav"))
    print(f"{len(presents)} fichiers dans {DOSSIER.relative_to(RACINE.parent)}")
    print()
    print("Passer maintenant le dossier à la mesure :")
    print(f"  python3 chat-traducteur/scripts/mesurer_corpus.py "
          f"{DOSSIER.relative_to(RACINE.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
