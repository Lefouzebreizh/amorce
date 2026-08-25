#!/usr/bin/env python3
"""Chaîne pré-presse « Roussy & Zéphy » : renommer, contrôler, assembler.

    python3 kdp/kdp.py renommer   --source DOSSIER --vers DOSSIER [--appliquer]
    python3 kdp/kdp.py controler  --source DOSSIER
    python3 kdp/kdp.py interieur  --source DOSSIER --vers interieur_kdp.pdf
    python3 kdp/kdp.py couverture --source DOSSIER --vers couverture_kdp.pdf

Trois partis pris, parce qu'ils conditionnent tout le reste :

1. **Aucune recompression destructive.** Une source JPEG dont le rapport
   correspond déjà à la page est recopiée telle quelle dans le PDF (flux
   DCTDecode d'origine, zéro perte supplémentaire). Tout le reste passe par un
   PNG (FlateDecode, sans perte). Le PDF pèse lourd ; c'est le prix demandé.
2. **Aucun rééchantillonnage.** Le seul traitement pixel autorisé est un
   recadrage centré, quand le rapport de la source diffère de celui de la page.
   La mise à l'échelle est faite par le PDF lui-même, en vectoriel.
3. **Une page manquante reste une page.** Plutôt que de décaler toute la
   pagination, on insère un carton d'attente très visible et on le signale.
   Un PDF au bon compte de pages se contrôle ; un PDF décalé se découvre à
   l'impression.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import charte  # noqa: E402

EXTENSIONS = (".webp", ".jpg", ".jpeg", ".png", ".tif", ".tiff")

# Un rapport largeur/hauteur qui s'écarte de moins de ça de celui de la page
# est considéré comme identique : en dessous, le recadrage rognerait moins d'un
# pixel et n'apporterait rien.
TOLERANCE_RAPPORT = 0.002


# --- Utilitaires -------------------------------------------------------------


def _pliage(texte: str) -> str:
    """Réduit une chaîne à ses lettres et chiffres, sans accent ni casse."""
    sans_accent = unicodedata.normalize("NFKD", texte)
    sans_accent = "".join(c for c in sans_accent if not unicodedata.combining(c))
    return "".join(c for c in sans_accent.lower() if c.isalnum())


def _index_des_pages() -> dict[str, charte.Page]:
    """Clés de reconnaissance -> page. Le slug et le titre mènent au même endroit."""
    index: dict[str, charte.Page] = {}
    for page in charte.TOME_1:
        for cle in (page.slug, page.titre, f"page{page.numero:02d}"):
            index[_pliage(cle)] = page
    return index


def identifier(nom: str) -> charte.Page | None:
    """Retrouve la page décrite par un nom de fichier, accents et casse ignorés."""
    plie = _pliage(Path(nom).stem)
    index = _index_des_pages()
    if plie in index:
        return index[plie]
    # Nom composite (« RoussyEtZephy_Page07_LAraigneeAuPlafond », « 07-araignee »…) :
    # on cherche la clé la plus longue contenue dans le nom, pour que
    # « LeSecretDeLHermine » l'emporte sur « LeSecret » s'il existait les deux.
    trouvees = [(len(cle), page) for cle, page in index.items() if cle and cle in plie]
    if not trouvees:
        return None
    return max(trouvees, key=lambda t: t[0])[1]


def _sources(dossier: Path) -> list[Path]:
    return sorted(
        p for p in dossier.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONS
    )


@dataclass
class Fichier:
    chemin: Path
    largeur: int
    hauteur: int
    format: str

    @property
    def rapport(self) -> float:
        return self.largeur / self.hauteur

    def dpi(self, largeur_page_pouces: float) -> float:
        return self.largeur / largeur_page_pouces


def _lire(chemin: Path) -> Fichier:
    with Image.open(chemin) as im:
        return Fichier(chemin, im.size[0], im.size[1], im.format or "?")


# --- Sous-commande : renommer ------------------------------------------------


def commande_renommer(args: argparse.Namespace) -> int:
    source = Path(args.source)
    destination = Path(args.vers)

    # Une correspondance explicite (nom d'origine -> numéro de page) prend le pas
    # sur la reconnaissance par le nom : les générateurs d'images produisent des
    # noms opaques qu'aucune heuristique ne saura relier à une histoire.
    forcees: dict[str, int] = {}
    if args.correspondance:
        forcees = {
            str(k): int(v)
            for k, v in json.loads(Path(args.correspondance).read_text("utf-8")).items()
        }

    par_numero = {p.numero: p for p in charte.TOME_1}
    plan: list[tuple[Path, str]] = []
    orphelins: list[Path] = []

    for chemin in _sources(source):
        if chemin.name in forcees:
            cle = forcees[chemin.name]
            if cle in par_numero:
                page = par_numero[cle]
                cible = charte.nom_de_page(page.numero, page.slug, chemin.suffix.lower())
            else:  # 0 et -1 servent à désigner les deux couvertures
                nom = charte.COUVERTURE_FACE if cle == 0 else charte.COUVERTURE_DOS
                cible = f"{nom}{chemin.suffix.lower()}"
            plan.append((chemin, cible))
            continue

        plie = _pliage(chemin.stem)
        if charte.COUVERTURE_FACE.replace("_", "") in plie:
            plan.append((chemin, f"{charte.COUVERTURE_FACE}{chemin.suffix.lower()}"))
            continue
        if charte.COUVERTURE_DOS.replace("_", "") in plie:
            plan.append((chemin, f"{charte.COUVERTURE_DOS}{chemin.suffix.lower()}"))
            continue

        page = identifier(chemin.name)
        if page is None:
            orphelins.append(chemin)
        else:
            plan.append((chemin, charte.nom_de_page(page.numero, page.slug, chemin.suffix.lower())))

    # Deux sources qui réclament le même nom : c'est toujours une erreur
    # d'identification, jamais un doublon volontaire.
    vus: dict[str, Path] = {}
    conflits: list[tuple[Path, Path, str]] = []
    for chemin, cible in plan:
        if cible in vus:
            conflits.append((vus[cible], chemin, cible))
        vus[cible] = chemin

    for chemin, cible in sorted(plan, key=lambda t: t[1]):
        print(f"  {chemin.name:32s} -> {cible}")
    for chemin in orphelins:
        print(f"  {chemin.name:32s} -> ??? non identifié")
    for avant, apres, cible in conflits:
        print(f"  CONFLIT : {avant.name} et {apres.name} visent tous deux {cible}")

    print(f"\n{len(plan)} fichier(s) identifié(s), {len(orphelins)} orphelin(s), "
          f"{len(conflits)} conflit(s).")

    if not args.appliquer:
        print("Simulation. Relancer avec --appliquer pour écrire.")
        return 0
    if conflits:
        print("Renommage refusé tant qu'il reste un conflit.", file=sys.stderr)
        return 1

    destination.mkdir(parents=True, exist_ok=True)
    for chemin, cible in plan:
        shutil.copy2(chemin, destination / cible)
    print(f"{len(plan)} fichier(s) écrit(s) dans {destination}")
    return 0


# --- Sous-commande : controler -----------------------------------------------


def commande_controler(args: argparse.Namespace) -> int:
    source = Path(args.source)
    gabarit = charte.GABARIT_INTERIEUR_KDP if args.kdp_strict else charte.GABARIT_INTERIEUR
    alertes: list[str] = []

    print(f"Gabarit intérieur : {gabarit.largeur} x {gabarit.hauteur} po "
          f"({gabarit.largeur * 25.4:.1f} x {gabarit.hauteur * 25.4:.1f} mm)")
    print(f"Pour {charte.DPI_CIBLE} DPI il faut au moins "
          f"{round(gabarit.largeur * charte.DPI_CIBLE)} x "
          f"{round(gabarit.hauteur * charte.DPI_CIBLE)} px\n")

    print(f"{'page':>4}  {'fichier':44s} {'pixels':>11s} {'DPI':>6s}  état")
    presentes = 0
    for page in charte.TOME_1:
        chemin = _trouver(source, charte.nom_de_page(page.numero, page.slug, ""))
        nom = charte.nom_de_page(page.numero, page.slug)
        if chemin is None:
            print(f"{page.numero:>4}  {nom:44s} {'—':>11s} {'—':>6s}  MANQUANT")
            alertes.append(f"page {page.numero:02d} ({page.titre}) : illustration absente")
            continue
        presentes += 1
        f = _lire(chemin)
        dpi = f.dpi(gabarit.largeur)
        etats = []
        if dpi < charte.DPI_CIBLE:
            etats.append(f"DPI insuffisant ({dpi:.0f} < {charte.DPI_CIBLE})")
            alertes.append(
                f"page {page.numero:02d} : {f.largeur}x{f.hauteur} px = {dpi:.0f} DPI, "
                f"il en faut {round(gabarit.largeur * charte.DPI_CIBLE)} px de côté")
        if abs(f.rapport - gabarit.rapport) > TOLERANCE_RAPPORT:
            rogne = _rognage(f.rapport, gabarit.rapport)
            etats.append(f"recadrage {rogne:.1%}")
        print(f"{page.numero:>4}  {chemin.name:44s} "
              f"{f.largeur}x{f.hauteur:<5d} {dpi:>6.0f}  {' / '.join(etats) or 'ok'}")

    print()
    for nom in (charte.COUVERTURE_FACE, charte.COUVERTURE_DOS):
        chemin = _trouver(source, nom)
        if chemin is None:
            print(f"      {nom:44s} {'—':>11s} {'—':>6s}  MANQUANT")
            alertes.append(f"{nom} : illustration absente")
        else:
            f = _lire(chemin)
            dpi = f.dpi(charte.FORMAT_ROGNE + charte.FOND_PERDU)
            print(f"      {chemin.name:44s} {f.largeur}x{f.hauteur:<5d} {dpi:>6.0f}  "
                  f"{'ok' if dpi >= charte.DPI_CIBLE else 'DPI insuffisant'}")
            if dpi < charte.DPI_CIBLE:
                alertes.append(f"{nom} : {dpi:.0f} DPI")

    total = len(charte.TOME_1)
    print(f"\n{presentes}/{total} illustration(s) intérieure(s) présente(s).")
    if total < charte.PAGES_MINIMUM_KDP:
        alertes.append(
            f"le tome compte {total} pages : KDP en exige {charte.PAGES_MINIMUM_KDP} "
            f"au minimum pour un broché ({charte.PAGES_MINIMUM_KDP - total} à ajouter)")
    if total % 2:
        alertes.append(f"{total} pages : un intérieur imprimé se compte toujours en pages paires")

    _, tranche = charte.gabarit_couverture(max(total, charte.PAGES_MINIMUM_KDP))
    print(f"Tranche pour {max(total, charte.PAGES_MINIMUM_KDP)} pages : "
          f"{tranche:.4f} po ({tranche * 25.4:.2f} mm)")

    if alertes:
        print(f"\n{len(alertes)} point(s) bloquant(s) ou à trancher :")
        for a in alertes:
            print(f"  - {a}")
        return 1
    print("\nAucune alerte.")
    return 0


def _rognage(rapport_source: float, rapport_page: float) -> float:
    """Part de l'image perdue par le recadrage centré, en surface."""
    if rapport_source > rapport_page:
        return 1 - rapport_page / rapport_source
    return 1 - rapport_source / rapport_page


def _trouver(dossier: Path, base: str) -> Path | None:
    """Retrouve un fichier par sa base de nom, quelle que soit son extension."""
    for extension in EXTENSIONS:
        candidat = dossier / f"{base}{extension}"
        if candidat.exists():
            return candidat
    return None


# --- Placement des images ----------------------------------------------------


def _placer(page: fitz.Page, rect: fitz.Rect, chemin: Path) -> str:
    """Pose une image dans un rectangle, sans perte et sans rééchantillonnage."""
    rapport_cible = rect.width / rect.height
    with Image.open(chemin) as im:
        largeur, hauteur = im.size
        rapport = largeur / hauteur

        if abs(rapport - rapport_cible) <= TOLERANCE_RAPPORT:
            if (im.format or "").upper() == "JPEG":
                # Flux d'origine recopié tel quel : aucune perte ajoutée.
                page.insert_image(rect, stream=chemin.read_bytes())
                return "jpeg intact"
            image = im.convert("RGB")
            note = "png sans perte"
        else:
            # Recadrage centré : on retire des pixels, on n'en recalcule aucun.
            if rapport > rapport_cible:
                neuve = round(hauteur * rapport_cible)
                marge = (largeur - neuve) // 2
                boite = (marge, 0, marge + neuve, hauteur)
            else:
                neuve = round(largeur / rapport_cible)
                marge = (hauteur - neuve) // 2
                boite = (0, marge, largeur, marge + neuve)
            image = im.convert("RGB").crop(boite)
            note = f"recadré {_rognage(rapport, rapport_cible):.1%}, png sans perte"

        tampon = io.BytesIO()
        image.save(tampon, format="PNG", compress_level=9)
    page.insert_image(rect, stream=tampon.getvalue())
    return note


def _carton_absent(page: fitz.Page, rect: fitz.Rect, libelle: str) -> None:
    """Carton d'attente impossible à confondre avec une page finie."""
    page.draw_rect(rect, color=(0.85, 0, 0.5), fill=(1, 0.93, 0.98), width=3)
    pas = 24
    x = rect.x0 - rect.height
    while x < rect.x1:
        page.draw_line(
            fitz.Point(max(x, rect.x0), rect.y0 + max(0, rect.x0 - x)),
            fitz.Point(min(x + rect.height, rect.x1), rect.y0 + min(rect.height, rect.x1 - x)),
            color=(0.95, 0.75, 0.87), width=1,
        )
        x += pas
    page.insert_textbox(
        fitz.Rect(rect.x0 + 24, rect.y0 + rect.height / 2 - 60, rect.x1 - 24, rect.y1 - 24),
        f"FICHIER MANQUANT\nNE PAS PUBLIER\n\n{libelle}",
        fontname="hebo", fontsize=20, color=(0.7, 0, 0.4), align=fitz.TEXT_ALIGN_CENTER,
    )


# --- Sous-commande : interieur -----------------------------------------------


def commande_interieur(args: argparse.Namespace) -> int:
    source = Path(args.source)
    gabarit = charte.GABARIT_INTERIEUR_KDP if args.kdp_strict else charte.GABARIT_INTERIEUR
    largeur, hauteur = gabarit.points

    document = fitz.open()
    manquantes: list[int] = []
    for page in charte.TOME_1:
        feuille = document.new_page(width=largeur, height=hauteur)
        rect = fitz.Rect(0, 0, largeur, hauteur)
        chemin = _trouver(source, charte.nom_de_page(page.numero, page.slug, ""))
        if chemin is None:
            _carton_absent(feuille, rect, charte.nom_de_page(page.numero, page.slug))
            manquantes.append(page.numero)
            print(f"  page {page.numero:02d}  MANQUANTE  {page.titre}")
        else:
            note = _placer(feuille, rect, chemin)
            print(f"  page {page.numero:02d}  {chemin.name:44s} {note}")

    document.set_metadata({
        "title": "Roussy & Zéphy — Tome 1",
        "author": "Erwann Lefouzèbreizh",
        "subject": f"Intérieur KDP {gabarit.largeur}x{gabarit.hauteur} po, fond perdu",
    })
    cible = Path(args.vers)
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    poids = cible.stat().st_size / 1e6
    print(f"\n{cible} — {len(charte.TOME_1)} pages, "
          f"{gabarit.largeur}x{gabarit.hauteur} po, {poids:.1f} Mo")
    if manquantes:
        print(f"ATTENTION : cartons d'attente aux pages {manquantes}. "
              f"Ce PDF n'est pas publiable en l'état.")
        return 1
    return 0


# --- Sous-commande : couverture ----------------------------------------------


def commande_couverture(args: argparse.Namespace) -> int:
    source = Path(args.source)
    pages = args.pages or max(len(charte.TOME_1), charte.PAGES_MINIMUM_KDP)
    gabarit, tranche = charte.gabarit_couverture(pages)
    largeur, hauteur = gabarit.points

    document = fitz.open()
    feuille = document.new_page(width=largeur, height=hauteur)

    # De gauche à droite, à plat : fond perdu, dos, tranche, face, fond perdu.
    p = charte.POUCE_EN_POINTS
    bord_face = (charte.FOND_PERDU + charte.FORMAT_ROGNE + tranche) * p
    panneaux = (
        (charte.COUVERTURE_DOS, fitz.Rect(0, 0, (charte.FOND_PERDU + charte.FORMAT_ROGNE) * p, hauteur)),
        (charte.COUVERTURE_FACE, fitz.Rect(bord_face, 0, largeur, hauteur)),
    )

    absents: list[str] = []
    for nom, rect in panneaux:
        chemin = _trouver(source, nom)
        if chemin is None:
            _carton_absent(feuille, rect, nom)
            absents.append(nom)
            print(f"  {nom:20s} MANQUANT")
        else:
            note = _placer(feuille, rect, chemin)
            print(f"  {nom:20s} {chemin.name:36s} {note}")

    # La tranche reste unie : à 1,2 mm, aucun texte n'y tient et KDP refuse
    # tout titre en dos sous 79 pages.
    tranche_rect = fitz.Rect(
        (charte.FOND_PERDU + charte.FORMAT_ROGNE) * p, 0, bord_face, hauteur)
    feuille.draw_rect(tranche_rect, color=None, fill=(0.98, 0.96, 0.90))

    document.set_metadata({
        "title": "Roussy & Zéphy — Tome 1, couverture",
        "author": "Erwann Lefouzèbreizh",
        "subject": f"Couverture KDP {gabarit.largeur:.4f}x{gabarit.hauteur} po, "
                   f"tranche {tranche:.4f} po pour {pages} pages",
    })
    cible = Path(args.vers)
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True, garbage=4)
    document.close()

    print(f"\n{cible} — {gabarit.largeur:.4f} x {gabarit.hauteur:.4f} po "
          f"({gabarit.largeur * 25.4:.1f} x {gabarit.hauteur * 25.4:.1f} mm)")
    print(f"Tranche : {tranche:.4f} po ({tranche * 25.4:.2f} mm) pour {pages} pages")
    print(f"Zone code-barres à réserver : 2 x 1,2 po en bas à droite du dos, "
          f"soit x de {charte.FOND_PERDU + charte.FORMAT_ROGNE - charte.MARGE_SECURITE - 2:.3f} "
          f"à {charte.FOND_PERDU + charte.FORMAT_ROGNE - charte.MARGE_SECURITE:.3f} po")
    if pages < charte.PAGES_MINIMUM_KDP:
        print(f"ATTENTION : tranche calculée sur {pages} pages, "
              f"or KDP en exige {charte.PAGES_MINIMUM_KDP} au minimum.")
    if absents:
        print(f"ATTENTION : cartons d'attente pour {absents}. "
              f"Cette couverture n'est pas publiable en l'état.")
        return 1
    return 0


# --- Sous-commande : epreuve -------------------------------------------------


def commande_epreuve(args: argparse.Namespace) -> int:
    """Recopie un PDF en surimprimant le trait de coupe et la zone de sécurité.

    Les bordures végétales de l'album courent à un ou deux pour cent du bord :
    trop loin pour être rognées à coup sûr, trop près pour être sûres. Un
    chiffre ne tranche pas ce genre de question, un tracé si — d'où cette
    épreuve, à regarder à l'écran et à ne jamais envoyer à l'imprimeur.
    """
    document = fitz.open(args.source)
    p = charte.POUCE_EN_POINTS
    for feuille in document:
        rect = feuille.rect
        largeur_po, hauteur_po = rect.width / p, rect.height / p

        if largeur_po > 2 * charte.FORMAT_ROGNE:
            # Couverture à plat : le fond perdu vaut la cote nominale sur les
            # quatre bords, et ce qui reste au centre est la tranche. La
            # déduire d'une soustraction serait faux — elle s'ajoute à la
            # largeur, elle ne se prélève pas sur le débord.
            debord_h = debord_v = charte.FOND_PERDU
            tranche = largeur_po - 2 * charte.FORMAT_ROGNE - 2 * charte.FOND_PERDU
            for x in (charte.FOND_PERDU + charte.FORMAT_ROGNE,
                      charte.FOND_PERDU + charte.FORMAT_ROGNE + tranche):
                feuille.draw_line(fitz.Point(x * p, 0), fitz.Point(x * p, rect.height),
                                  color=(0, 0.6, 0.3), width=1, dashes="[8 4] 0")
        else:
            # Page intérieure : le débord est ce qui dépasse du format rogné,
            # supposé réparti également de part et d'autre.
            debord_h = (largeur_po - charte.FORMAT_ROGNE) / 2
            debord_v = (hauteur_po - charte.FORMAT_ROGNE) / 2

        coupe = fitz.Rect(debord_h * p, debord_v * p,
                          rect.width - debord_h * p, rect.height - debord_v * p)
        marge = charte.MARGE_SECURITE * p
        securite = fitz.Rect(coupe.x0 + marge, coupe.y0 + marge,
                             coupe.x1 - marge, coupe.y1 - marge)
        feuille.draw_rect(coupe, color=(0.9, 0, 0.3), width=1.2, dashes="[6 4] 0")
        feuille.draw_rect(securite, color=(0, 0.55, 0.9), width=1.2, dashes="[3 3] 0")

    cible = Path(args.vers)
    cible.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(cible), deflate=True)
    document.close()
    print(f"{cible} — rouge : trait de coupe, bleu : zone de sécurité "
          f"({charte.MARGE_SECURITE} po), vert : pliures de la tranche. "
          f"Épreuve d'écran, à ne pas publier.")
    return 0


# --- Entrée ------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sous = analyseur.add_subparsers(dest="commande", required=True)

    r = sous.add_parser("renommer", help="trier et renommer les rushes")
    r.add_argument("--source", required=True)
    r.add_argument("--vers", required=True)
    r.add_argument("--correspondance", help="JSON {nom d'origine: numéro de page}, "
                                            "0 = couverture_face, -1 = couverture_dos")
    r.add_argument("--appliquer", action="store_true", help="écrire (sinon simulation)")
    r.set_defaults(fonction=commande_renommer)

    c = sous.add_parser("controler", help="contrôle pré-presse")
    c.add_argument("--source", required=True)
    c.add_argument("--kdp-strict", action="store_true")
    c.set_defaults(fonction=commande_controler)

    i = sous.add_parser("interieur", help="assembler interieur_kdp.pdf")
    i.add_argument("--source", required=True)
    i.add_argument("--vers", default="interieur_kdp.pdf")
    i.add_argument("--kdp-strict", action="store_true")
    i.set_defaults(fonction=commande_interieur)

    v = sous.add_parser("couverture", help="assembler couverture_kdp.pdf")
    v.add_argument("--source", required=True)
    v.add_argument("--vers", default="couverture_kdp.pdf")
    v.add_argument("--pages", type=int, help="nombre de pages du PDF intérieur final")
    v.set_defaults(fonction=commande_couverture)

    e = sous.add_parser("epreuve", help="surimprimer coupe et zone de sécurité")
    e.add_argument("--source", required=True, help="PDF déjà assemblé")
    e.add_argument("--vers", required=True)
    e.set_defaults(fonction=commande_epreuve)

    args = analyseur.parse_args(argv)
    return args.fonction(args)


if __name__ == "__main__":
    raise SystemExit(main())
