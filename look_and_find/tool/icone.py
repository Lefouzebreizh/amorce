#!/usr/bin/env python3
"""Fabrique l'icône de Look & Find, pour Android et iOS.

**Pourquoi un générateur plutôt qu'un lot de PNG déposés.** Une icône vit dans
une vingtaine de fichiers, à autant de tailles, sur deux plateformes. Déposée
telle quelle, elle ne se corrige plus : changer l'épaisseur d'un trait
demanderait de refaire les vingt à la main, et personne ne saurait dire d'où
vient celle qui est en place. Ici, le dessin est le code, et les vingt fichiers
en découlent — c'est le même choix que partout dans ce dépôt : ce qui se mesure
et se rejoue vaut mieux que ce qui se constate.

**Le dessin est le cadre de visée de l'application**, les quatre équerres qu'on
voit à l'écran en visant un objet. Il n'a pas été choisi pour être joli : c'est
la seule forme déjà associée au produit par quelqu'un qui l'a utilisé, et la
seule des trois envisagées — loupe, lettre, cadre — qui ne ressemble à aucune
autre icône du téléphone.

**Blanc sur `ink`, et non l'accent violet.** Mesuré : `#7C5CFF` rend 4,48:1 sur
`#0B0D10`, ce qui passe pour un aplat mais pas pour quatre traits fins à 48 px,
la taille où l'icône est réellement vue. La lisibilité est le seul critère qui
compte ici, et le §2 du dépôt la fait primer sur l'envie de placer une couleur
de marque.

**Le tracé est suréchantillonné quatre fois puis réduit.** Pillow ne lisse ni
les arcs ni les extrémités ; dessiné à la taille finale, un trait de deux
pixels ressort crénelé et l'icône a l'air fabriquée à la main. La réduction
fait le lissage.

Usage :
    python3 tool/icone.py            # écrit les fichiers Android et iOS
    python3 tool/icone.py --apercu   # écrit seulement une planche à regarder
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent

INK = (11, 13, 16, 255)  # AppColors.ink
TEXTE = (242, 244, 247, 255)  # AppColors.text

SUPER = 4  # facteur de suréchantillonnage

# Tailles Android, densité par densité, pour l'icône héritée.
ANDROID_HERITEE = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# L'avant-plan adaptatif est dessiné sur une toile de 108 dp dont seuls les
# 66 dp centraux sont garantis visibles : le système y applique un masque dont
# la forme change d'un constructeur à l'autre. Les densités valent donc 108/48
# de l'icône héritée.
ANDROID_ADAPTATIF = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def dessiner_cadre(taille: int, portee: float, epaisseur: float) -> Image.Image:
    """Les quatre équerres, centrées, sur fond transparent.

    [portee] est la fraction du côté qu'occupe le cadre, [epaisseur] la
    fraction du côté que fait le trait. Les deux sont relatives pour que le
    même dessin tienne de 48 à 1024 pixels sans réglage.
    """
    n = taille * SUPER
    image = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    trace = ImageDraw.Draw(image)

    trait = max(2, round(n * epaisseur))
    demi = n * portee / 2
    centre = n / 2
    gauche, haut = centre - demi, centre - demi
    droite, bas = centre + demi, centre + demi

    rayon = demi * 0.18  # arrondi du coin
    # **Le bras est court, et c'est tout le dessin.** À 0,80 du demi-côté, les
    # quatre équerres se rejoignent presque et l'icône se lit comme un carré
    # arrondi en pointillés — vérifié à 48 px, la taille qui décide. À 0,42,
    # les coins restent quatre coins, et le vide au milieu est ce qui dit
    # « viser ».
    bras = demi * 0.52  # longueur du bras depuis le coin

    def equerre(cx: float, cy: float, dx: int, dy: int, angles: tuple[int, int]):
        # Les deux bras droits.
        trace.line(
            [(cx + dx * bras, cy), (cx + dx * rayon, cy)],
            fill=TEXTE,
            width=trait,
        )
        trace.line(
            [(cx, cy + dy * bras), (cx, cy + dy * rayon)],
            fill=TEXTE,
            width=trait,
        )
        # Le coin arrondi qui les relie.
        ox, oy = cx + dx * rayon, cy + dy * rayon
        trace.arc(
            [ox - rayon, oy - rayon, ox + rayon, oy + rayon],
            angles[0],
            angles[1],
            fill=TEXTE,
            width=trait,
        )
        # Extrémités rondes : Pillow n'en pose pas, et un trait coupé net donne
        # au cadre un air de gabarit technique plutôt que de viseur.
        for bout in ((cx + dx * bras, cy), (cx, cy + dy * bras)):
            r = trait / 2
            trace.ellipse(
                [bout[0] - r, bout[1] - r, bout[0] + r, bout[1] + r],
                fill=TEXTE,
            )

    equerre(gauche, haut, 1, 1, (180, 270))
    equerre(droite, haut, -1, 1, (270, 360))
    equerre(gauche, bas, 1, -1, (90, 180))
    equerre(droite, bas, -1, -1, (0, 90))

    return image.resize((taille, taille), Image.LANCZOS)


def icone_pleine(taille: int) -> Image.Image:
    """L'icône complète, fond compris — Android hérité et iOS."""
    fond = Image.new("RGBA", (taille, taille), INK)
    fond.alpha_composite(dessiner_cadre(taille, portee=0.62, epaisseur=0.055))
    return fond


def avant_plan_adaptatif(taille: int) -> Image.Image:
    """L'avant-plan seul, transparent, pour l'icône adaptative Android.

    La portée tombe à 0,40 parce que la toile fait 108 dp là où l'icône en
    faisait 48 : à portée égale, le cadre déborderait de la zone garantie et
    se ferait rogner par le masque rond de certains lanceurs.
    """
    return dessiner_cadre(taille, portee=0.40, epaisseur=0.036)


def ecrire_android() -> list[Path]:
    base = RACINE / "android/app/src/main/res"
    ecrits = []

    for dossier, taille in ANDROID_HERITEE.items():
        chemin = base / dossier / "ic_launcher.png"
        icone_pleine(taille).convert("RGB").save(chemin, "PNG")
        ecrits.append(chemin)

    for dossier, taille in ANDROID_ADAPTATIF.items():
        chemin = base / dossier / "ic_launcher_foreground.png"
        avant_plan_adaptatif(taille).save(chemin, "PNG")
        ecrits.append(chemin)

    return ecrits


def ecrire_ios() -> list[Path]:
    """Toutes les tailles déclarées par le catalogue d'icônes d'Xcode.

    Les noms de fichiers ne sont pas devinés : ils sont relus du `Contents.json`
    existant. Une taille inventée serait ignorée par Xcode sans erreur, et
    l'application garderait l'ancienne icône sans que rien ne le signale.
    """
    dossier = RACINE / "ios/Runner/Assets.xcassets/AppIcon.appiconset"
    ecrits = []
    for chemin in sorted(dossier.glob("*.png")):
        taille = Image.open(chemin).size[0]
        # iOS refuse un canal alpha sur l'icône de l'App Store.
        icone_pleine(taille).convert("RGB").save(chemin, "PNG")
        ecrits.append(chemin)
    return ecrits


def planche(destination: Path) -> Path:
    """Une bande des tailles réelles, à regarder plutôt qu'à mesurer.

    48 px est la taille à laquelle l'icône est réellement vue dans un tiroir
    d'applications ; c'est celle qui décide, et aucune mesure ne la remplace.
    """
    tailles = [48, 72, 96, 144, 192]
    marge = 16
    largeur = sum(tailles) + marge * (len(tailles) + 1)
    hauteur = max(tailles) + marge * 2
    bande = Image.new("RGB", (largeur, hauteur), (60, 60, 66))

    x = marge
    for taille in tailles:
        bande.paste(icone_pleine(taille).convert("RGB"), (x, (hauteur - taille) // 2))
        x += taille + marge

    bande.save(destination, "PNG")
    return destination


if __name__ == "__main__":
    if "--apercu" in sys.argv:
        print(planche(Path("/tmp/apercu-icone.png")))
    else:
        for chemin in ecrire_android() + ecrire_ios():
            print(chemin.relative_to(RACINE))
