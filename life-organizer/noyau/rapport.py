"""Une page à regarder, quand une liste de noms ne suffit pas à décider.

Le reste du projet rend du texte : « 47 photos floues », suivi de 47 chemins.
C'est assez pour un compte rendu, jamais pour **décider** — personne ne peut
dire à la lecture d'un nom de fichier si une photo méritait d'être écartée. Or
c'est exactement la décision que la commande demande de prendre avant
`--appliquer`.

Trois décisions tiennent ce fichier :

1. **Un seul fichier, qui s'ouvre d'un double-clic.** Les vignettes sont
   embarquées en base64 dans la page. Pas de dossier d'images à côté, pas de
   serveur à lancer, rien à installer : le rapport se copie, s'envoie et
   survit au déplacement. Il pèse plus lourd qu'une page ordinaire, et c'est le
   prix à payer pour qu'il s'ouvre partout, y compris sur un téléphone.
2. **Aucune requête ne sort de la page.** Ni police distante, ni feuille de
   style, ni script d'ailleurs. C'est la promesse du projet — rien ne quitte la
   machine — et une page qui appellerait un serveur pour afficher une fonte la
   trahirait pour un détail d'esthétique.
3. **La vignette porte le motif.** Voir la photo sans savoir pourquoi elle est
   là oblige à revenir au terminal ; le motif sans la photo ne permet pas de
   juger. Les deux ensemble, et la décision se prend en un coup d'œil.
"""

from __future__ import annotations

import base64
import html
import io
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Assez grand pour juger un flou, assez petit pour que deux cents vignettes
# tiennent dans une page qu'un téléphone ouvre sans peiner. Mesuré : à 320 px,
# une page de 200 vignettes pèse environ 6 Mo.
COTE_VIGNETTE = 320

# Les formats dont on sait tirer une vignette. Une vidéo demanderait ffmpeg et
# un décodage par fichier : elle est listée sans image, ce que la page dit.
EXTENSIONS_VIGNETTE = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif"}


@dataclass(frozen=True)
class Ligne:
    """Un fichier, ce qu'on compte en faire, et pourquoi."""

    chemin: Path
    action: str
    motif: str
    destination: Path | None = None


def vignette_base64(chemin: Path, cote: int = COTE_VIGNETTE) -> str | None:
    """Une vignette JPEG encodée pour être posée dans la page, ou `None`.

    `None` et non une exception : un fichier illisible se liste très bien sans
    image, et refuser d'écrire tout le rapport parce qu'une photo sur deux cents
    est corrompue serait une régression.
    """
    if chemin.suffix.lower().lstrip(".") not in EXTENSIONS_VIGNETTE:
        return None
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        with Image.open(chemin) as image:
            image.draft("RGB", (cote * 2, cote * 2))  # décodage réduit : bien plus rapide
            image = image.convert("RGB")
            image.thumbnail((cote, cote))
            tampon = io.BytesIO()
            image.save(tampon, format="JPEG", quality=72)
    except Exception:
        return None
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def ecrire(lignes: list[Ligne], destination: Path, titre: str,
           resume: str = "") -> Path:
    """Écrit la page et rend son chemin."""
    destination = Path(destination).expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True)

    par_action: dict[str, list[Ligne]] = {}
    for ligne in lignes:
        par_action.setdefault(ligne.action, []).append(ligne)

    corps = []
    for action, groupe in par_action.items():
        corps.append(f'<h2>{html.escape(action)} <span class="compte">{len(groupe)}</span></h2>')
        corps.append('<div class="grille">')
        for ligne in groupe:
            image = vignette_base64(ligne.chemin)
            cadre = (f'<div class="cadre"><img src="data:image/jpeg;base64,{image}" alt=""></div>'
                     if image else "")
            classe = "" if image else ' class="sans-image"' 
            # Le dossier d'arrivée, relatif à la bibliothèque dont l'en-tête
            # donne le chemin complet. Sur un téléphone, une ligne de cent
            # caractères écrase le nom du fichier et le motif — les deux
            # choses qui servent à décider.
            vers = (f'<p class="vers">→ {html.escape(str(ligne.destination.parent))}</p>'
                    if ligne.destination and str(ligne.destination.parent) != "." else "")
            corps.append(
                f'<figure{classe}>{cadre}'
                f'<figcaption><b>{html.escape(ligne.chemin.name)}</b>'
                f'<p class="motif">{html.escape(ligne.motif)}</p>{vers}</figcaption></figure>'
            )
        corps.append("</div>")

    page = _GABARIT.format(
        titre=html.escape(titre),
        quand=datetime.now().strftime("%d/%m/%Y à %H:%M"),
        resume=html.escape(resume),
        corps="\n".join(corps) or "<p>Rien à montrer.</p>",
    )
    destination.write_text(page, encoding="utf-8")
    return destination


# Le style est dans la page, comme tout le reste. Fond sombre parce qu'un
# rapport se regarde souvent le soir, et que des vignettes se jugent mieux sur
# un fond qui ne leur vole pas la lumière.
_GABARIT = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titre}</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin: 0; padding: 1.5rem; background: #14161a; color: #e8e6e3;
         font: 17px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  header {{ border-bottom: 1px solid #2a2e35; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
  h1 {{ font-size: 1.4rem; margin: 0 0 .3rem; }}
  .quand {{ color: #9aa0a8; font-size: .9rem; margin: 0; }}
  .resume {{ margin: .8rem 0 0; color: #c8ccd2; }}
  h2 {{ font-size: 1.1rem; margin: 2rem 0 .8rem; }}
  .compte {{ background: #2a2e35; border-radius: 999px; padding: .1rem .6rem;
            font-size: .85rem; color: #9aa0a8; margin-left: .4rem; }}
  .grille {{ display: grid; gap: 1rem;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }}
  figure {{ margin: 0; background: #1b1e24; border-radius: 12px; overflow: hidden; }}
  .cadre {{ aspect-ratio: 1; display: grid; place-items: center; background: #0f1114; }}
  img {{ max-width: 100%; max-height: 100%; display: block; }}
  figure.sans-image {{ border-left: 3px solid #3a4048; }}
  figcaption {{ padding: .7rem .8rem 1rem; }}
  figcaption b {{ font-size: .92rem; word-break: break-word; }}
  .motif {{ margin: .35rem 0 0; color: #9aa0a8; font-size: .85rem; }}
  .vers {{ margin: .35rem 0 0; color: #7fb3ff; font-size: .82rem; word-break: break-all; }}
</style></head><body>
<header>
  <h1>{titre}</h1>
  <p class="quand">{quand}</p>
  <p class="resume">{resume}</p>
</header>
{corps}
</body></html>
"""
