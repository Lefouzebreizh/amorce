"""
capturer_page.py - Version réécrite pour compatibilité totale avec les terminaux Windows
"""
import sys
import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

def capturer_url_sync(url: str, sortie: Path):
    sortie.mkdir(parents=True, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Erreur: playwright non installé")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        try:
            print(f"Navigating to {url}")
            page.goto(url, wait_until="networkidle")
            page.screenshot(path=str(sortie / "capture_test.png"))
            print(f"OK: Captures dans {sortie}")
        except Exception as e:
            print(f"ERREUR: Erreur capture {url}: {e}")
        finally:
            browser.close()

@dataclass(frozen=True)
class Segment:
    """Une tranche verticale de capture, prête à être analysée seule."""

    nom: str
    y_debut_px: int
    y_fin_px: int


def calculer_segments(
    hauteur_totale_px: int,
    hauteur_segment_px: int = 1800,
) -> list[Segment]:
    """Découpe une hauteur en segments hero, milieu et bas.

    Cette fonction pure conserve l'API attendue par les tests de découpage.
    """
    if hauteur_totale_px <= 0:
        raise ValueError("hauteur_totale_px doit être positive")
    if hauteur_segment_px <= 0:
        raise ValueError("hauteur_segment_px doit être positive")

    nb_segments = max(1, -(-hauteur_totale_px // hauteur_segment_px))
    segments = []
    for indice in range(nb_segments):
        y_debut = indice * hauteur_segment_px
        y_fin = min(y_debut + hauteur_segment_px, hauteur_totale_px)
        if nb_segments == 1:
            nom = "01-hero-bas"
        elif indice == 0:
            nom = "01-hero"
        elif indice == nb_segments - 1:
            nom = f"{indice + 1:02d}-bas"
        else:
            nom = f"{indice + 1:02d}-milieu"
        segments.append(Segment(nom, y_debut, y_fin))
    return segments


def nom_dossier_pour_url(url: str) -> str:
    """Construit un nom de dossier stable à partir du domaine et du chemin."""
    decoupee = urlparse(url if "://" in url else f"https://{url}")
    brut = f"{decoupee.netloc}{decoupee.path}".strip("/")
    brut = brut or decoupee.netloc
    nettoye = re.sub(r"[^a-zA-Z0-9]+", "-", brut).strip("-").lower()
    return nettoye or "page"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("sortie")
    args = parser.parse_args()
    capturer_url_sync(args.url, Path(args.sortie))
