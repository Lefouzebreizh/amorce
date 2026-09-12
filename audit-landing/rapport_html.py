"""Transforme le rapport structuré d'analyser_captures.py en page web.

Troisième pièce du produit « Audit de page de vente en 24h » : lit le
`rapport.json` écrit par `analyser_captures.py` et rend un unique fichier
HTML autonome — sobre, en sections claires, verdict et priorités mis en
avant — prêt à être envoyé tel quel à un client par courriel ou lien.

Autonome veut dire : aucune ressource externe (pas de police ni de feuille de
style chargée sur le réseau, voir CLAUDE.md §7 sur les hôtes refusés depuis
une session distante), et les vignettes des segments cités par au moins un
constat sont encodées en base64 directement dans le fichier — il s'ouvre et
se transmet seul, sans dossier joint.

## Pourquoi repartir du JSON et non du Markdown

`rendre_markdown` (dans `analyser_captures.py`) et `rendre_html` (ici) lisent
tous deux le même `Rapport` structuré, jamais l'un la sortie de l'autre : un
texte déjà mis en forme perd la structure (quelle note pour quelle
catégorie, quel constat cite quel segment) qu'il faudrait reparser pour
construire des barres de note ou retrouver la bonne image — reparser du
Markdown pour ça serait fragile et referait un travail déjà fait à la
génération du rapport.
"""

from __future__ import annotations

import argparse
import base64
import html
import io
import sys
from pathlib import Path

from analyser_captures import (
    ORDRE_SEVERITE,
    Rapport,
    analyser_reponse_json,
)

# Couleur par verdict global — les mêmes quatre valeurs que VERDICTS dans
# analyser_captures.py, un déclin de rouge à vert plutôt qu'un jugement
# binaire, parce qu'un audit « à améliorer » n'est ni un échec ni un succès.
LIBELLES_VERDICT = {
    "excellent": ("Excellent", "#1a7f4b"),
    "solide": ("Solide", "#1f5fa8"),
    "a_ameliorer": ("À améliorer", "#b3690a"),
    "problematique": ("Problématique", "#b3261e"),
}

# Même principe pour la sévérité d'un constat — les mêmes trois valeurs que
# SEVERITES dans analyser_captures.py.
LIBELLES_SEVERITE = {
    "bloquant": ("Bloquant", "#b3261e"),
    "important": ("Important", "#b3690a"),
    "mineur": ("Mineur", "#5b6472"),
}

# Largeur maximale d'une vignette embarquée. Un segment est capturé à
# 2880×1800 px (échelle 2, voir capturer_page.py) — plusieurs centaines de
# kilooctets par image, largement plus qu'il n'en faut pour illustrer un
# constat dans un document qu'on envoie par courriel. Réduit la portabilité
# du fichier, pas sa lisibilité : l'original reste dans le dossier de capture.
LARGEUR_VIGNETTE_PX = 640


def echapper(texte: str) -> str:
    """Échappe un texte pour l'insertion sûre dans du HTML.

    Le texte vient du modèle de vision, qui peut citer littéralement ce
    qu'il lit sur une page (un titre contenant un « & », une URL avec des
    chevrons dans un exemple) — jamais fiable tel quel dans un document HTML.
    """
    return html.escape(texte, quote=True)


def construire_vignettes(dossier_page: Path, rapport: Rapport) -> dict[str, str]:
    """Rend un dict segment → data URI JPEG réduit, pour les segments cités.

    Seuls les segments qu'au moins un constat référence sont encodés — un
    rapport qui n'en cite que trois sur treize n'a pas à embarquer les dix
    autres. Rend un dict vide si Pillow est absent ou si le dossier ne porte
    pas les fichiers (rapport régénéré sans les images source, par exemple) :
    le rapport reste complet, seulement sans illustration — jamais une
    exception qui empêche de produire la page.
    """
    noms_cites = {
        constat.segment
        for categorie in rapport.categories
        for constat in categorie.constats
    }
    if not noms_cites:
        return {}

    try:
        from PIL import Image
    except ImportError:
        return {}

    vignettes: dict[str, str] = {}
    for nom in noms_cites:
        chemin = dossier_page / nom
        if not chemin.is_file():
            continue
        with Image.open(chemin) as image:
            largeur, hauteur = image.size
            if largeur > LARGEUR_VIGNETTE_PX:
                ratio = LARGEUR_VIGNETTE_PX / largeur
                image = image.resize((LARGEUR_VIGNETTE_PX, round(hauteur * ratio)))
            tampon = io.BytesIO()
            image.convert("RGB").save(tampon, format="JPEG", quality=78)
        vignettes[nom] = (
            "data:image/jpeg;base64,"
            + base64.standard_b64encode(tampon.getvalue()).decode("ascii")
        )
    return vignettes


CSS = """
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #f4f5f7;
  color: #1c2128;
  line-height: 1.5;
}
.entete {
  background: #14181f;
  color: #f4f5f7;
  padding: 48px 24px 40px;
  text-align: center;
}
.sur-titre {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 13px;
  color: #9aa4b2;
  margin: 0 0 8px;
}
.entete h1 { margin: 0 0 16px; font-size: 28px; word-break: break-word; }
.verdict {
  display: inline-block;
  color: #fff;
  font-weight: 600;
  padding: 6px 18px;
  border-radius: 999px;
  font-size: 14px;
  margin-bottom: 20px;
}
.resume { max-width: 640px; margin: 0 auto; color: #cbd2db; font-size: 16px; }
.priorites, .categorie {
  max-width: 780px;
  margin: 24px auto;
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.priorites h2, .categorie h2 { margin-top: 0; font-size: 18px; }
.priorites ol { padding-left: 20px; font-size: 16px; }
.priorites li { margin-bottom: 8px; font-weight: 500; }
.categorie-entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.note-wrap { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.note-barre { width: 140px; height: 10px; background: #e7e9ec; border-radius: 999px; overflow: hidden; }
.note-remplie { height: 100%; background: #1f5fa8; }
.note-chiffre { font-size: 14px; font-weight: 600; color: #14181f; white-space: nowrap; }
.constats { list-style: none; margin: 20px 0 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.constat {
  border-left: 4px solid #ccc;
  background: #fafbfc;
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.constat-corps { flex: 1; min-width: 220px; }
.badge {
  display: inline-block;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 9px;
  border-radius: 999px;
  margin-right: 8px;
}
.constat-segment { font-size: 12px; color: #6b7280; font-family: ui-monospace, monospace; }
.constat-observation { margin: 8px 0 4px; font-size: 15px; }
.constat-recommandation { margin: 0; font-size: 15px; color: #1f5fa8; font-weight: 500; }
.constat-vide { color: #6b7280; font-style: italic; list-style: none; }
.vignette { max-width: 220px; width: 100%; border-radius: 6px; border: 1px solid #e2e5e9; display: block; }
footer { max-width: 780px; margin: 32px auto 60px; padding: 0 32px; font-size: 13px; color: #8b93a1; text-align: center; }
@media (max-width: 640px) {
  .entete { padding: 36px 16px 32px; }
  .priorites, .categorie { margin: 16px 12px; padding: 20px; }
  .constat { flex-direction: column; }
  .vignette { max-width: 100%; }
}
"""


def rendre_html(
    rapport: Rapport, nom_page: str, dossier_page: Path | None = None
) -> str:
    """Rend le rapport en une page HTML autonome.

    `dossier_page`, s'il est fourni et contient les fichiers de segments,
    permet d'embarquer une vignette par constat qui en cite un. Sans lui (ou
    si les fichiers sont absents), le rapport reste complet, texte seul.
    """
    vignettes = construire_vignettes(dossier_page, rapport) if dossier_page else {}
    libelle_verdict, couleur_verdict = LIBELLES_VERDICT[rapport.verdict_global]

    blocs_priorites = "".join(
        f"<li>{echapper(priorite)}</li>" for priorite in rapport.priorites
    )

    blocs_categories = []
    for categorie in rapport.categories:
        constats_tries = sorted(
            categorie.constats, key=lambda c: ORDRE_SEVERITE[c.severite]
        )
        blocs_constats = []
        for constat in constats_tries:
            libelle_sev, couleur_sev = LIBELLES_SEVERITE[constat.severite]
            vignette_html = ""
            if constat.segment in vignettes:
                vignette_html = (
                    f'<img class="vignette" src="{vignettes[constat.segment]}" '
                    f'alt="Capture du segment {echapper(constat.segment)}">'
                )
            blocs_constats.append(
                f"""<li class="constat" style="border-left-color:{couleur_sev}">
  <div class="constat-corps">
    <span class="badge" style="background:{couleur_sev}">{libelle_sev}</span>
    <span class="constat-segment">{echapper(constat.segment)}</span>
    <p class="constat-observation">{echapper(constat.observation)}</p>
    <p class="constat-recommandation">→ {echapper(constat.recommandation)}</p>
  </div>
  {vignette_html}
</li>"""
            )
        if not blocs_constats:
            blocs_constats.append(
                '<li class="constat-vide">Aucun constat particulier.</li>'
            )

        blocs_categories.append(
            f"""<section class="categorie">
  <div class="categorie-entete">
    <h2>{echapper(categorie.nom)}</h2>
    <div class="note-wrap" aria-label="Note {categorie.note} sur 10">
      <div class="note-barre"><div class="note-remplie" style="width:{categorie.note * 10}%"></div></div>
      <span class="note-chiffre">{categorie.note}/10</span>
    </div>
  </div>
  <ul class="constats">{"".join(blocs_constats)}</ul>
</section>"""
        )

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit de page de vente — {echapper(nom_page)}</title>
<style>{CSS}</style>
</head>
<body>
<header class="entete">
  <p class="sur-titre">Audit de page de vente en 24h</p>
  <h1>{echapper(nom_page)}</h1>
  <div class="verdict" style="background:{couleur_verdict}">{libelle_verdict}</div>
  <p class="resume">{echapper(rapport.resume)}</p>
</header>
<section class="priorites">
  <h2>Les trois priorités</h2>
  <ol>{blocs_priorites}</ol>
</section>
{"".join(blocs_categories)}
<footer>
  <p>Rapport généré à partir d'une analyse visuelle des segments capturés de la page, par intelligence artificielle.</p>
</footer>
</body>
</html>"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transforme le rapport.json d'analyser_captures.py en page HTML autonome."
    )
    parser.add_argument(
        "dossier_page",
        type=Path,
        help="Dossier de capture contenant rapport.json (ex : captures/qonto-com-fr/)",
    )
    parser.add_argument(
        "--rapport-json",
        type=Path,
        default=None,
        help="Chemin du rapport JSON (défaut : rapport.json dans le dossier)",
    )
    parser.add_argument(
        "--sortie",
        type=Path,
        default=None,
        help="Fichier HTML de sortie (défaut : rapport.html dans le dossier)",
    )
    args = parser.parse_args()

    chemin_json = args.rapport_json or (args.dossier_page / "rapport.json")
    if not chemin_json.is_file():
        print(
            f"Rapport JSON introuvable : {chemin_json} — lancer d'abord "
            "analyser_captures.py sur ce dossier.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    try:
        rapport = analyser_reponse_json(chemin_json.read_text(encoding="utf-8"))
    except ValueError as erreur:
        print(f"Rapport JSON invalide : {erreur}", file=sys.stderr)
        raise SystemExit(1)

    html_rendu = rendre_html(
        rapport, nom_page=args.dossier_page.name, dossier_page=args.dossier_page
    )
    sortie = args.sortie or (args.dossier_page / "rapport.html")
    sortie.write_text(html_rendu, encoding="utf-8")
    print(f"Page HTML écrite : {sortie}")


if __name__ == "__main__":
    main()
