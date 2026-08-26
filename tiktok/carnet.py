#!/usr/bin/env python3
"""Le carnet de tournage : les fichiers du volet, en un PDF tenu à la main.

Trois décisions, et aucune n'est décorative.

1. **Le PDF est fabriqué depuis les `.md`, jamais recopié.** Un carnet écrit à
   part diverge des scripts dès la première retouche, et plus personne ne sait
   lequel fait foi. Ici la source reste le Markdown ; ceci n'en est qu'un
   rendu.
2. **La page est au format d'un téléphone**, pas A4. Ce carnet se lit d'une
   main pendant qu'on tourne, pas sur un bureau : une page A4 sur un écran de
   téléphone oblige à zoomer, donc à lâcher la caméra.
3. **Le tableau minuté devient une liste verticale.** Cinq colonnes sur 100 mm
   de large donnent un texte illisible. Chaque instant est donc rendu en bloc —
   image, voix, texte incrusté, son — ce qui se lit mieux en tournage qu'un
   tableau, même sur grand écran.

    python3 tiktok/carnet.py             # → .fixtures/carnet-tiktok.pdf
    python3 tiktok/carnet.py --vers X    # ailleurs

Le fichier produit n'est pas versionné : le dépôt ne porte aucun binaire.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

RACINE = Path(__file__).resolve().parent

# DejaVu porte les guillemets français, les tirets cadratins et le ✓ des
# scripts ; il n'a pas d'oblique sur cette machine, d'où le repli sur
# Liberation pour ce seul cas. Chaque entrée est essayée dans l'ordre.
POLICES = {
    'DejaVu': ['dejavu/DejaVuSans.ttf', 'liberation/LiberationSans-Regular.ttf'],
    'DejaVu-Gras': ['dejavu/DejaVuSans-Bold.ttf', 'liberation/LiberationSans-Bold.ttf'],
    'DejaVu-Italique': ['dejavu/DejaVuSans-Oblique.ttf', 'liberation/LiberationSans-Italic.ttf'],
    'DejaVu-Mono': ['dejavu/DejaVuSansMono.ttf', 'liberation/LiberationMono-Regular.ttf'],
}
DOSSIER_POLICES = Path('/usr/share/fonts/truetype')

# Format d'un téléphone tenu en portrait, marges comprises.
LARGEUR, HAUTEUR = 100 * mm, 175 * mm
MARGE = 7 * mm

ENCRE = colors.HexColor('#14161a')
BRUME = colors.HexColor('#6b7280')
ACCENT = colors.HexColor('#b4552a')
TRAIT = colors.HexColor('#d9d6d0')
SURFACE = colors.HexColor('#f4f2ee')

# L'ordre de lecture : la méthode, puis les concepts, puis les scripts.
SOMMAIRE = ['README.md', 'concepts.md', 'modele-script.md']


def enregistrer_polices() -> None:
    for nom, candidats in POLICES.items():
        for candidat in candidats:
            chemin = DOSSIER_POLICES / candidat
            if chemin.exists():
                pdfmetrics.registerFont(TTFont(nom, str(chemin)))
                break
        else:
            raise SystemExit(
                f'Aucune police pour « {nom} ». Attendu l\'un de : '
                + ', '.join(candidats)
            )
    pdfmetrics.registerFontFamily(
        'DejaVu', normal='DejaVu', bold='DejaVu-Gras', italic='DejaVu-Italique'
    )


def styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle(
        'corps', fontName='DejaVu', fontSize=8, leading=11.5,
        textColor=ENCRE, alignment=TA_LEFT, spaceAfter=5,
    )
    return {
        'corps': base,
        'h1': ParagraphStyle('h1', parent=base, fontName='DejaVu-Gras',
                             fontSize=15, leading=18, textColor=ACCENT,
                             spaceBefore=0, spaceAfter=7),
        'h2': ParagraphStyle('h2', parent=base, fontName='DejaVu-Gras',
                             fontSize=10.5, leading=13, spaceBefore=9,
                             spaceAfter=4),
        'h3': ParagraphStyle('h3', parent=base, fontName='DejaVu-Gras',
                             fontSize=9, leading=12, textColor=ACCENT,
                             spaceBefore=7, spaceAfter=3),
        'liste': ParagraphStyle('liste', parent=base, leftIndent=8,
                                bulletIndent=1, spaceAfter=3),
        'cite': ParagraphStyle('cite', parent=base, leftIndent=7,
                               borderPadding=(0, 0, 0, 5),
                               textColor=colors.HexColor('#3d4148'),
                               backColor=SURFACE,
                               spaceBefore=2, spaceAfter=3),
        'fiche': ParagraphStyle('fiche', parent=base, fontSize=8,
                                leading=11, spaceAfter=1),
        'cle': ParagraphStyle('cle', parent=base, fontName='DejaVu-Gras',
                              fontSize=6.5, leading=9, textColor=BRUME,
                              spaceAfter=0),
        'valeur': ParagraphStyle('valeur', parent=base, fontSize=8,
                                 leading=10.5, spaceAfter=0),
        'instant': ParagraphStyle('instant', parent=base,
                                  fontName='DejaVu-Gras', fontSize=9,
                                  textColor=ACCENT, spaceAfter=0),
        'cellule': ParagraphStyle('cellule', parent=base, fontSize=7,
                                  leading=9.5, spaceAfter=0),
        'entete': ParagraphStyle('entete', parent=base,
                                 fontName='DejaVu-Gras', fontSize=7,
                                 leading=9.5, spaceAfter=0),
        'couv-titre': ParagraphStyle('couv-titre', parent=base,
                                     fontName='DejaVu-Gras', fontSize=21,
                                     leading=24, spaceAfter=6),
        'couv-sous': ParagraphStyle('couv-sous', parent=base, fontSize=9.5,
                                    leading=14, textColor=BRUME),
    }


def en_ligne(texte: str) -> str:
    """Markdown de ligne vers le balisage de reportlab."""
    texte = texte.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    texte = re.sub(r'`([^`]+)`', r'<font face="DejaVu-Mono" size="7">\1</font>', texte)
    texte = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', texte)
    texte = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<i>\1</i>', texte)
    return texte


def cellules(ligne: str) -> list[str]:
    return [c.strip() for c in ligne.strip().strip('|').split('|')]


def lire_tableau(lignes: list[str], i: int) -> tuple[list[list[str]], int]:
    table = []
    while i < len(lignes) and lignes[i].lstrip().startswith('|'):
        brut = cellules(lignes[i])
        if not all(re.fullmatch(r':?-{2,}:?', c) for c in brut):
            table.append(brut)
        i += 1
    return table, i


def rendre_blocs(table: list[list[str]], st: dict) -> list:
    """Une ligne de tableau devient un bloc vertical.

    Sur une page de 100 mm, un tableau large est illisible quoi qu'on fasse :
    un seul nom de fichier suffit à étrangler les autres colonnes. Chaque ligne
    devient donc un bloc — sa première cellule en titre, les autres en couples
    intitulé / valeur. Le déroulé minuté d'un script s'en trouve même plus lisible
    en tournage qu'un tableau, à n'importe quelle largeur.
    """
    entetes = [e.upper() for e in table[0][1:]]
    largeur = LARGEUR - 2 * MARGE
    # La colonne des intitulés se taille sur le plus long d'entre eux : figée,
    # elle coupait « TOURNABLE » en deux.
    colonne_cle = min(30 * mm, max(
        15 * mm,
        max(pdfmetrics.stringWidth(mot, 'DejaVu-Gras', 6.5)
            for entete in entetes for mot in entete.split()) + 8,
    ))
    blocs = []
    for ligne in table[1:]:
        lignes_bloc = [[Paragraph(en_ligne(ligne[0]), st['instant']), '']]
        for cle, valeur in zip(entetes, ligne[1:]):
            if valeur in ('', '—', '-'):
                continue
            lignes_bloc.append([
                Paragraph(cle, st['cle']),
                Paragraph(en_ligne(valeur), st['valeur']),
            ])
        t = Table(lignes_bloc, colWidths=[colonne_cle, largeur - colonne_cle])
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('BACKGROUND', (0, 0), (-1, -1), SURFACE),
            ('LINEBEFORE', (0, 0), (0, -1), 1.2, ACCENT),
            ('SPAN', (0, 0), (-1, 0)),
        ]))
        blocs.append(KeepTogether([t, Spacer(1, 3)]))
    return blocs


def largeurs_colonnes(table: list[list[str]], largeur: float) -> list[float]:
    """Répartir la largeur sans couper un mot en deux.

    Des colonnes égales coupent « Durée » en « Dur / ée » sur une page de
    100 mm. Chaque colonne reçoit donc d'abord de quoi loger son mot le plus
    long — mesuré dans la police, pas estimé en caractères — puis le reste se
    partage au prorata du volume de texte.
    """
    colonnes = len(table[0])
    marge_cellule = 7

    def mot_le_plus_large(c: int) -> float:
        plus = 0.0
        for n, ligne in enumerate(table):
            police = 'DejaVu-Gras' if n == 0 else 'DejaVu'
            for mot in re.sub(r'[*`|]', '', ligne[c]).split():
                plus = max(plus, pdfmetrics.stringWidth(mot, police, 7))
        return plus + marge_cellule

    planchers = [mot_le_plus_large(c) for c in range(colonnes)]
    if sum(planchers) >= largeur:
        facteur = largeur / sum(planchers)
        return [p * facteur for p in planchers]

    poids = [max(len(ligne[c]) for ligne in table) ** 0.75 for c in range(colonnes)]
    reste = largeur - sum(planchers)
    return [
        planchers[c] + reste * poids[c] / sum(poids) for c in range(colonnes)
    ]


def rendre_tableau(table: list[list[str]], st: dict) -> list:
    colonnes = len(table[0])
    largeur = LARGEUR - 2 * MARGE
    # Au-delà de trois colonnes, aucune répartition ne sauve la lisibilité à
    # cette largeur ; et le déroulé minuté passe toujours en blocs.
    if len(table) > 1 and (colonnes > 3 or table[0][0].strip().lower() == 't'):
        return rendre_blocs(table, st)
    donnees = [
        [Paragraph(en_ligne(c), st['entete' if n == 0 else 'cellule']) for c in ligne]
        for n, ligne in enumerate(table)
    ]
    t = Table(donnees, colWidths=largeurs_colonnes(table, largeur), repeatRows=1)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('BACKGROUND', (0, 0), (-1, 0), SURFACE),
        ('LINEBELOW', (0, 0), (-1, 0), 0.7, TRAIT),
        ('LINEBELOW', (0, 1), (-1, -2), 0.3, TRAIT),
    ]))
    return [t, Spacer(1, 5)]


def deplier(lignes: list[str]) -> list[str]:
    """Recoller les puces dont le texte court sur plusieurs lignes.

    Sans ça, la suite d'une puce est traitée comme un paragraphe à part et le
    `**gras**` ouvert sur la première ligne n'est jamais refermé : les
    astérisques ressortent telles quelles dans le PDF.
    """
    recollees: list[str] = []
    dans_bloc = False
    for ligne in lignes:
        nu = ligne.strip()
        if nu.startswith('```'):
            dans_bloc = not dans_bloc
            recollees.append(ligne)
            continue
        suite = (
            not dans_bloc
            and recollees
            and re.match(r'^[-*]\s+|^\d+\.\s+', recollees[-1].strip())
            and ligne.startswith(('  ', '\t'))
            and nu
        )
        if suite:
            recollees[-1] = recollees[-1].rstrip() + ' ' + nu
        else:
            recollees.append(ligne)
    return recollees


def convertir(texte: str, st: dict) -> list:
    """Le sous-ensemble de Markdown qu'écrivent réellement les fichiers du volet."""
    lignes = deplier(texte.splitlines())
    flux: list = []
    paragraphe: list[str] = []
    i = 0

    def vider() -> None:
        if paragraphe:
            flux.append(Paragraph(en_ligne(' '.join(paragraphe)), st['corps']))
            paragraphe.clear()

    while i < len(lignes):
        ligne = lignes[i]
        nu = ligne.strip()

        if nu.startswith('```'):
            vider()
            i += 1
            bloc = []
            while i < len(lignes) and not lignes[i].strip().startswith('```'):
                bloc.append(lignes[i])
                i += 1
            i += 1
            style = ParagraphStyle('bloc', parent=st['corps'],
                                   fontName='DejaVu-Mono', fontSize=6.5,
                                   leading=9, backColor=SURFACE,
                                   borderPadding=4, leftIndent=2)
            corps = '<br/>'.join(
                l.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                 .replace(' ', '&nbsp;')
                for l in bloc
            )
            flux += [Paragraph(corps, style), Spacer(1, 5)]
            continue

        if nu.startswith('|'):
            vider()
            table, i = lire_tableau(lignes, i)
            flux += rendre_tableau(table, st)
            continue

        if not nu:
            vider()
        elif nu.startswith('#'):
            vider()
            niveau = len(nu) - len(nu.lstrip('#'))
            flux.append(Paragraph(en_ligne(nu.lstrip('#').strip()),
                                  st.get(f'h{niveau}', st['h3'])))
        elif nu in ('---', '***', '___'):
            vider()
            flux.append(HRFlowable(width='100%', thickness=0.5, color=TRAIT,
                                   spaceBefore=4, spaceAfter=6))
        elif nu.startswith('> '):
            vider()
            flux.append(Paragraph(en_ligne(nu[2:]), st['cite']))
        elif re.match(r'^[-*]\s+', nu):
            vider()
            flux.append(Paragraph(en_ligne(re.sub(r'^[-*]\s+', '', nu)),
                                  st['liste'], bulletText='•'))
        elif re.match(r'^\*\*[^*]+\*\*\s*:', nu):
            # Les lignes de fiche d'un script — Concept, Dispositif, Durée — se
            # suivent sans ligne vide. Les fondre en un paragraphe, comme le
            # veut Markdown, les collerait bout à bout et rendrait la fiche
            # illisible : chacune tient sa ligne.
            vider()
            flux.append(Paragraph(en_ligne(nu), st['fiche']))
        elif re.match(r'^\d+\.\s+', nu):
            vider()
            numero = nu.split('.', 1)[0]
            flux.append(Paragraph(en_ligne(re.sub(r'^\d+\.\s+', '', nu)),
                                  st['liste'], bulletText=f'{numero}.'))
        else:
            paragraphe.append(nu)
        i += 1

    vider()
    return flux


def couverture(st: dict, nombre: int) -> list:
    return [
        Spacer(1, 34 * mm),
        Paragraph('Carnet de<br/>tournage', st['couv-titre']),
        HRFlowable(width='38%', thickness=2, color=ACCENT, spaceBefore=2,
                   spaceAfter=8, hAlign='LEFT'),
        Paragraph(
            f'Le volet TikTok du dépôt <b>amorce</b> — la méthode, huit concepts '
            f'répétables et {nombre} scripts minutés.<br/><br/>'
            'Rendu des fichiers <font face="DejaVu-Mono" size="7">tiktok/*.md</font>. '
            'La source fait foi : ce carnet se régénère, il ne se corrige pas.',
            st['couv-sous']),
        PageBreak(),
    ]


def fabriquer(vers: Path) -> Path:
    enregistrer_polices()
    st = styles()
    vers.parent.mkdir(parents=True, exist_ok=True)

    scripts = sorted((RACINE / 'scripts').glob('*.md'))
    flux = couverture(st, len(scripts))

    for nom in SOMMAIRE:
        flux += convertir((RACINE / nom).read_text(encoding='utf-8'), st)
        flux.append(PageBreak())

    for n, script in enumerate(scripts):
        flux += convertir(script.read_text(encoding='utf-8'), st)
        if n < len(scripts) - 1:
            flux.append(PageBreak())

    def pied(canevas, doc) -> None:
        canevas.saveState()
        canevas.setFont('DejaVu', 6)
        canevas.setFillColor(BRUME)
        canevas.drawRightString(LARGEUR - MARGE, MARGE - 3.5 * mm,
                                str(canevas.getPageNumber()))
        canevas.restoreState()

    doc = BaseDocTemplate(
        str(vers), pagesize=(LARGEUR, HAUTEUR),
        leftMargin=MARGE, rightMargin=MARGE,
        topMargin=MARGE, bottomMargin=MARGE,
        title='Carnet de tournage — volet TikTok',
        author='amorce',
    )
    cadre = Frame(MARGE, MARGE, LARGEUR - 2 * MARGE, HAUTEUR - 2 * MARGE,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id='nue', frames=[cadre]),
        PageTemplate(id='courante', frames=[cadre], onPage=pied),
    ])
    doc.build([NextPageTemplate('courante')] + flux)
    return vers


if __name__ == '__main__':
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument('--vers', type=Path,
                           default=RACINE.parent / '.fixtures' / 'carnet-tiktok.pdf')
    fichier = fabriquer(analyseur.parse_args().vers)
    print(f'{fichier} — {fichier.stat().st_size // 1024} Ko')
