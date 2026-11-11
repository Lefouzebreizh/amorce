"""Calculs purs historiques de segmentation, indépendants du navigateur.

Extraits de 93c1869c. Le script Windows capturer_page.py reste inchangé ;
il ne produit actuellement que capture_test.png et ne les appelle pas.
Ces tests vérifient les calculs, pas une capture segmentée opérationnelle.
"""
import re
from dataclasses import dataclass
from urllib.parse import urlparse

@dataclass(frozen=True)
class Segment:
    """Une tranche verticale de la capture, prête à être analysée seule."""

    nom: str
    y_debut_px: int
    y_fin_px: int


def calculer_segments(
    hauteur_totale_px: int,
    hauteur_segment_px: int = 1800,
) -> list[Segment]:
    """Découpe une hauteur totale en tranches logiques nommées.

    Fonction pure — aucun navigateur requis — pour rester testable sans
    réseau. Trois cas seulement, et c'est délibéré :

    - une seule tranche → elle vaut à la fois hero et bas ("01-hero-bas") ;
    - deux tranches → "01-hero" et "02-bas", pas de milieu ;
    - au-delà → la première est "hero", la dernière "bas", tout le reste
      "milieu-N" plutôt qu'un unique bloc de plusieurs milliers de pixels :
      un « milieu » monolithique sur une page SaaS de 8000 px reproduirait
      exactement le défaut que le découpage existe pour éviter.
    """
    if hauteur_totale_px <= 0:
        raise ValueError("hauteur_totale_px doit être positive")
    if hauteur_segment_px <= 0:
        raise ValueError("hauteur_segment_px doit être positive")

    nb_segments = max(1, -(-hauteur_totale_px // hauteur_segment_px))  # division arrondie au-dessus
    segments: list[Segment] = []
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

        segments.append(Segment(nom=nom, y_debut_px=y_debut, y_fin_px=y_fin))
    return segments


def nom_dossier_pour_url(url: str) -> str:
    """Un nom de dossier lisible et stable à partir d'une URL.

    `app.spendesk.com` → `app-spendesk-com` ; les chemins (`/fr`) sont
    conservés pour ne pas confondre deux pages du même domaine.
    """
    decoupee = urlparse(url if "://" in url else f"https://{url}")
    brut = f"{decoupee.netloc}{decoupee.path}".strip("/")
    brut = brut or decoupee.netloc
    nettoye = re.sub(r"[^a-zA-Z0-9]+", "-", brut).strip("-").lower()
    return nettoye or "page"


