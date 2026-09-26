"""
capturer_page.py - Version réécrite pour compatibilité totale avec les terminaux Windows
"""
import sys
import argparse
from pathlib import Path

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

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("sortie")
    args = parser.parse_args()
    capturer_url_sync(args.url, Path(args.sortie))
