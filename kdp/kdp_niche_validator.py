#!/usr/bin/env python3
"""Validation d'une niche KDP à partir de trois chiffres relevés sur la boutique.

Choisir un mot-clé avant d'écrire un livre, c'est parier des mois de travail sur
une page de résultats Amazon. Les trois chiffres qui décident du pari sont
visibles gratuitement, sur les trois premiers livres de cette page : leur BSR
(le rang de vente), leur nombre d'avis, leur prix. Ce script ne fait que les
lire ensemble, parce que pris isolément chacun ment :

- Un **BSR bas** dit qu'on achète. Il ne dit pas qu'on pourra y entrer.
- **Peu d'avis** dit que la place est libre. Sur une niche morte, c'est parce
  que personne ne passe.
- Un **prix élevé** dit que la marge existe. Sur un rang de vente à 400 000, il
  n'y a aucune marge à faire sur zéro vente.

D'où deux sorties distinctes, à ne pas confondre :

**Le verdict** applique les règles de décision de l'utilisateur, telles quelles.
Ce sont des seuils francs, il n'y a rien à interpréter — un BSR au-delà de
150 000 disqualifie, un BSR sous 50 000 avec moins de 300 avis emporte tout.

**La note sur 100** est notre nuance sous le verdict, et elle est *recalibrable*.
Deux niches également « Excellentes » ne le sont pas également : un BSR de 8 000
face à un BSR de 49 000 sépare une niche qu'on attaque d'une niche qu'on
surveille. Les barèmes et les ancrages sont donc rassemblés en tête de fichier,
avec la raison de chaque chiffre. Quand une niche notée haut se révèle mauvaise
sur le terrain, c'est ici qu'on corrige — pas dans le rapport.

Les deux échelles sont **logarithmiques** parce que le BSR et les avis le sont :
entre 5 000 et 10 000 il y a le même écart de réalité qu'entre 100 000 et
200 000, et une échelle linéaire écraserait tout le haut du classement dans le
même point.

Enfin, l'estimation de ventes est un **ordre de grandeur, jamais une prévision**.
Elle sert à répondre à « est-ce que ça vaut le coup », pas à remplir un budget.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import date
from math import log10
from pathlib import Path

# --- Les règles de verdict ---------------------------------------------------
# Ce sont les seuils de décision, pas des réglages. Les modifier change ce que
# l'agent recommande d'écrire.

BSR_FORTE_DEMANDE = 50_000        # sous ce rang, la niche vend tous les jours
BSR_DEMANDE_MORTE = 150_000       # au-delà, on écrit pour personne
AVIS_FAIBLE_CONCURRENCE = 300     # au-delà, la preuve sociale des installés est un mur

# --- Le barème de la note, recalibrable --------------------------------------
# La demande pèse le plus lourd : sans acheteurs, ni la concurrence ni le prix
# n'ont d'importance. Le prix pèse le moins : c'est la seule des trois variables
# qu'on décide soi-même après coup.

POIDS_DEMANDE = 50.0
POIDS_CONCURRENCE = 30.0
POIDS_RENTABILITE = 20.0

# Bornes des échelles logarithmiques. Au-delà du plafond, la note est pleine :
# distinguer un BSR de 2 000 d'un BSR de 4 000 n'aide personne à choisir.
BSR_PLAFOND = 5_000
BSR_PLANCHER = 300_000
AVIS_PLAFOND = 20
AVIS_PLANCHER = 1_000

# Rendement du prix, par ancrages interpolés linéairement. La courbe monte
# jusqu'au palier des broché rentables, puis redescend : au-delà d'une vingtaine
# d'euros, l'acheteur d'un livre indépendant sans auteur connu se cabre, et le
# gain de marge est payé par une perte de conversion.
COURBE_PRIX = [
    (0.00, 0.0),
    (2.99, 5.0),    # sous 2,99, la redevance ebook tombe à 35 % et le broché ne couvre pas l'impression
    (6.99, 13.0),
    (9.99, 20.0),   # le palier confortable commence ici
    (19.99, 20.0),  # et finit là
    (29.99, 11.0),
    (49.99, 3.0),
]

# BSR -> ventes par jour. Règle d'ordre de grandeur, calée sur deux repères
# usuels du marché : un rang de 10 000 correspond à une dizaine de ventes par
# jour, un rang de 100 000 à une vente. Deux points qui se tiennent sur une loi
# en 1/BSR, d'où cette constante unique. Elle dépend de la boutique et de la
# catégorie : c'est le premier chiffre à recaler sur ses propres relevés.
VENTES_PAR_JOUR_A_RANG_UN = 100_000.0

# Redevance KDP retenue pour l'estimation : 60 % (broché et couverture rigide),
# volontairement *avant* frais d'impression, qui dépendent du nombre de pages —
# une donnée que ce script ne connaît pas. Le chiffre affiché est donc un
# plafond, pas un bénéfice.
TAUX_REDEVANCE = 0.60


@dataclass
class Niche:
    """Le résultat complet de l'analyse d'un mot-clé."""

    bsr: float
    avis: float
    prix: float
    verdict: str
    explication: str
    viable: bool
    note: float
    note_demande: float
    note_concurrence: float
    note_rentabilite: float
    ventes_par_jour: float
    redevance_unitaire: float
    revenu_mensuel: float
    recommandations: list[str]


def _nombre(valeur: float) -> str:
    """Milliers séparés par une espace, comme on écrit un nombre en français."""
    return f'{valeur:,.0f}'.replace(',', '\u202f')


def _decimal(valeur: float, decimales: int = 1) -> str:
    """Virgule décimale : un rapport en français n'écrit ni « 25.2 » ni « 12.99 »."""
    return f'{valeur:.{decimales}f}'.replace('.', ',')


def _interpoler(valeur: float, ancres: list[tuple[float, float]]) -> float:
    """Lit une courbe donnée par points, en la prolongeant à plat aux deux bouts."""
    if valeur <= ancres[0][0]:
        return ancres[0][1]
    for (x1, y1), (x2, y2) in zip(ancres, ancres[1:]):
        if valeur <= x2:
            return y1 + (y2 - y1) * (valeur - x1) / (x2 - x1)
    return ancres[-1][1]


def _note_log(valeur: float, plafond: float, plancher: float, poids: float) -> float:
    """Note décroissante sur une échelle logarithmique, bornée aux deux extrémités.

    `plafond` est la valeur en dessous de laquelle la note est pleine, `plancher`
    celle au-dessus de laquelle elle est nulle. Les deux sont des rangs ou des
    comptes : plus c'est petit, mieux c'est.
    """
    if valeur <= plafond:
        return poids
    if valeur >= plancher:
        return 0.0
    haut, bas = log10(plancher), log10(plafond)
    return poids * (haut - log10(valeur)) / (haut - bas)


def _juger(bsr: float, avis: float) -> tuple[str, str, bool]:
    """Applique les règles de décision, de la meilleure situation à la pire.

    Les deux règles fournies ne couvrent que les extrêmes ; les trois cas
    intermédiaires sont posés ici pour qu'aucune saisie ne reste sans verdict.
    """
    if bsr < BSR_FORTE_DEMANDE and avis < AVIS_FAIBLE_CONCURRENCE:
        return (
            'Excellente (Forte demande, faible concurrence)',
            'On achète tous les jours dans cette niche et personne n’y a encore '
            'accumulé la preuve sociale qui interdirait d’entrer. C’est la '
            'configuration qu’on cherche : écrivez.',
            True,
        )
    if bsr < BSR_FORTE_DEMANDE:
        return (
            'Forte demande, mais concurrence installée',
            'La demande est là, et elle est déjà servie. Entrer de face demande '
            'un budget d’avis que vous n’avez pas ; entrer de biais, par un '
            'angle que les trois premiers ne couvrent pas, reste possible.',
            True,
        )
    if bsr > BSR_DEMANDE_MORTE:
        return (
            'Trop faible demande',
            'À ce rang, les meilleurs livres de la niche vendent quelques '
            'exemplaires par mois. Aucun travail d’écriture ni de couverture ne '
            'rattrape une absence d’acheteurs : changez de mot-clé.',
            False,
        )
    if avis < AVIS_FAIBLE_CONCURRENCE:
        return (
            'Correcte (demande moyenne, place à prendre)',
            'La niche vend sans être disputée. Elle ne fera pas un lancement '
            'spectaculaire, mais elle accepte un nouveau venu — c’est le profil '
            'typique d’un revenu de fond qui s’accumule.',
            True,
        )
    return (
        'Moyenne (demande moyenne, concurrence installée)',
        'Ni le volume ni la place ne jouent en votre faveur. Rentable seulement '
        'si vous apportez un angle franchement différent, sinon à garder en '
        'réserve derrière une meilleure piste.',
        True,
    )


def _recommander(bsr: float, avis: float, prix: float, viable: bool) -> list[str]:
    """Une consigne par faiblesse constatée, dans l'ordre où elles bloquent."""
    conseils: list[str] = []

    if not viable:
        conseils.append(
            'Abandonnez ce mot-clé et élargissez : remontez d\u2019un cran vers le '
            'terme générique dont il est une déclinaison, puis redescendez sur '
            'une autre branche.')
    elif bsr >= BSR_FORTE_DEMANDE:
        conseils.append(
            f'La demande est moyenne (BSR {_nombre(bsr)}). Relevez deux ou trois '
            f'mots-clés voisins avant de vous engager : il y a souvent une '
            f'formulation à moitié moins disputée pour le même sujet.')
    else:
        conseils.append(
            f'La demande est solide (BSR {_nombre(bsr)}) : ne la laissez pas '
            f'refroidir, c\u2019est le genre de fenêtre qui se referme en un trimestre.')

    if avis < AVIS_FAIBLE_CONCURRENCE:
        conseils.append(
            f'Avec {_nombre(avis)} avis en moyenne chez les trois premiers, une '
            f'trentaine d\u2019avis honnêtes suffit à vous mettre au niveau. Prévoyez '
            f'la page de fin qui les demande dès la première édition.')
    else:
        conseils.append(
            f'{_nombre(avis)} avis en moyenne : vous ne rattraperez pas cette preuve '
            f'sociale de face. Cherchez un sous-segment (public, format, langue, '
            f'niveau) que les trois premiers traitent en une section et vous en un '
            f'livre entier.')

    if prix < 6.99:
        conseils.append(
            f'Le prix moyen de la niche ({_decimal(prix, 2)}) laisse peu de marge une fois '
            f'l\u2019impression payée. Vérifiez qu\u2019un format plus épais ou une version '
            f'reliée s\u2019y vend, sinon la niche est un travail bénévole.')
    elif prix > 19.99:
        conseils.append(
            f'Le prix moyen est haut ({_decimal(prix, 2)}) : la marge est belle, mais la '
            f'conversion se paie en qualité perçue. Couverture et intérieur devront '
            f'tenir la comparaison avec des livres d\u2019éditeur.')
    else:
        conseils.append(
            f'Le prix moyen ({_decimal(prix, 2)}) est dans la zone confortable : '
            f'alignez-vous dessus au lancement plutôt que de casser les prix, un '
            f'livre moins cher que ses voisins est lu comme un livre moins bon.')

    conseils.append(
        'Avant d\u2019écrire, vérifiez les trois mêmes chiffres sur les livres classés '
        '4 à 10 : c\u2019est là que se voit si la niche est profonde ou si trois '
        'best-sellers cachent un désert.')
    return conseils


def score_niche(bsr: float, reviews: float, price: float) -> Niche:
    """Évalue une niche à partir du BSR moyen, du nombre d'avis moyen et du prix.

    Renvoie un `Niche` complet et non la seule chaîne du verdict : le rapport a
    besoin du détail de la note, et une fonction qui recalculerait tout une
    seconde fois pour l'écrire finirait par diverger de celle-ci.
    """
    if bsr < 1:
        raise ValueError('Le BSR est un rang : il vaut au moins 1.')
    if reviews < 0:
        raise ValueError('Le nombre d’avis ne peut pas être négatif.')
    if price < 0:
        raise ValueError('Le prix ne peut pas être négatif.')

    verdict, explication, viable = _juger(bsr, reviews)

    note_demande = _note_log(bsr, BSR_PLAFOND, BSR_PLANCHER, POIDS_DEMANDE)
    # `max(reviews, 1)` : zéro avis et un avis disent la même chose — personne
    # n'a encore parlé — et log10(0) n'existe pas.
    note_concurrence = _note_log(max(reviews, 1), AVIS_PLAFOND, AVIS_PLANCHER,
                                 POIDS_CONCURRENCE)
    note_rentabilite = _interpoler(price, COURBE_PRIX)

    ventes = VENTES_PAR_JOUR_A_RANG_UN / bsr
    redevance = price * TAUX_REDEVANCE

    return Niche(
        bsr=bsr,
        avis=reviews,
        prix=price,
        verdict=verdict,
        explication=explication,
        viable=viable,
        note=note_demande + note_concurrence + note_rentabilite,
        note_demande=note_demande,
        note_concurrence=note_concurrence,
        note_rentabilite=note_rentabilite,
        ventes_par_jour=ventes,
        redevance_unitaire=redevance,
        revenu_mensuel=ventes * redevance * 30,
        recommandations=_recommander(bsr, reviews, price, viable),
    )


def rediger_rapport(niche: Niche, mot_cle: str, devise: str = '€',
                    jour: str | None = None) -> str:
    """Compose le rapport Markdown. Pure : c'est ce qui la rend vérifiable."""
    jour = jour or date.today().isoformat()
    barre = '█' * round(niche.note / 5) + '░' * (20 - round(niche.note / 5))

    lignes = [
        f'# Validation de niche — « {mot_cle} »',
        '',
        f'*Rapport produit le {jour} par `kdp_niche_validator.py`.*',
        '',
        '## Verdict',
        '',
        f'> ### {niche.verdict}',
        '>',
        f'> `{barre}` **{_decimal(niche.note)} / 100**',
        '>',
        f'> {niche.explication}',
        '',
        '## Les trois chiffres relevés',
        '',
        '| Variable | Valeur | Seuil de référence |',
        '| --- | ---: | --- |',
        f'| BSR moyen des 3 premiers | {_nombre(niche.bsr)} | '
        f'forte demande sous {_nombre(BSR_FORTE_DEMANDE)}, morte au-delà de '
        f'{_nombre(BSR_DEMANDE_MORTE)} |',
        f'| Avis moyens | {_nombre(niche.avis)} | '
        f'place à prendre sous {_nombre(AVIS_FAIBLE_CONCURRENCE)} |',
        f'| Prix moyen | {_decimal(niche.prix, 2)}\u202f{devise} | '
        f'palier confortable de 9,99 à 19,99 |',
        '',
        '## Décomposition de la note',
        '',
        '| Axe | Note | Maximum | Ce qu’il pèse |',
        '| --- | ---: | ---: | --- |',
        f'| Demande | {_decimal(niche.note_demande)} | {POIDS_DEMANDE:.0f} | '
        'sans acheteurs, rien d’autre ne compte |',
        f'| Concurrence | {_decimal(niche.note_concurrence)} | {POIDS_CONCURRENCE:.0f} | '
        'le mur d’avis à franchir pour exister |',
        f'| Rentabilité | {_decimal(niche.note_rentabilite)} | {POIDS_RENTABILITE:.0f} | '
        'la seule variable qu’on décide soi-même |',
        f'| **Total** | **{_decimal(niche.note)}** | **100** | |',
        '',
        '## Ordre de grandeur du marché',
        '',
        'Estimations, **pas des prévisions** — voir les réserves en fin de rapport.',
        '',
        f'- Ventes quotidiennes d’un livre à ce rang : '
        f'**≈ {_decimal(niche.ventes_par_jour)} par jour**',
        f'- Redevance brute par exemplaire, à {TAUX_REDEVANCE * 100:.0f}\u202f% et avant '
        f'frais d’impression : **{_decimal(niche.redevance_unitaire, 2)}\u202f{devise}**',
        f'- Revenu mensuel correspondant : **≈ {_nombre(niche.revenu_mensuel)}'
        f'\u202f{devise}**',
        '',
        '## Recommandations',
        '',
    ]
    lignes += [f'{rang}. {conseil}'
               for rang, conseil in enumerate(niche.recommandations, start=1)]
    lignes += [
        '',
        '## Ce que ce rapport ne dit pas',
        '',
        'Trois chiffres ne valident pas une niche, ils la présélectionnent. '
        'Restent hors de portée de ce calcul, et à vérifier à la main :',
        '',
        '- **La saisonnalité.** Un BSR relevé en décembre sur un livre de recettes '
        'de fêtes ne vaut rien en mars.',
        '- **La profondeur.** Trois best-sellers peuvent masquer une page de '
        'résultats vide dès le quatrième rang.',
        '- **Le coût d’impression**, qui dépend du nombre de pages et de la '
        'couleur, et qui peut annuler la redevance affichée plus haut.',
        '- **Les droits.** Personnages, marques et méthodes déposées se croisent '
        'souvent dans les niches les plus tentantes.',
        '- **La conversion de la boutique** aux mots-clés eux-mêmes : le volume de '
        'recherche ne se lit pas sur un BSR.',
        '',
        'La conversion BSR → ventes vaut pour une boutique et une catégorie '
        'données ; recalez `VENTES_PAR_JOUR_A_RANG_UN` sur vos propres relevés '
        'avant de vous fier aux montants.',
        '',
    ]
    return '\n'.join(lignes)


def _afficher(niche: Niche, mot_cle: str, devise: str, destination: Path) -> None:
    """Résumé au terminal : le rapport est le document, ceci n'est qu'un accusé."""
    print(f'Mot-clé  : {mot_cle}')
    print(f'BSR {_nombre(niche.bsr)} · {_nombre(niche.avis)} avis · '
          f'{_decimal(niche.prix, 2)} {devise}\n')
    print(f'{"✓" if niche.viable else "✗"} {niche.verdict}')
    print(f'  Potentiel {_decimal(niche.note)}/100 — '
          f'demande {_decimal(niche.note_demande)}, '
          f'concurrence {_decimal(niche.note_concurrence)}, '
          f'rentabilité {_decimal(niche.note_rentabilite)}')
    print(f'  ≈ {_decimal(niche.ventes_par_jour)} vente(s)/jour, soit environ '
          f'{_nombre(niche.revenu_mensuel)} {devise}/mois')
    print(f'\nRapport écrit dans {destination}')


def main() -> int:
    analyse = argparse.ArgumentParser(
        description='Évalue la rentabilité d’une niche KDP à partir du BSR moyen, '
                    'du nombre d’avis moyen et du prix moyen des trois premiers '
                    'livres du mot-clé.',
        epilog='Exemple : python3 kdp/kdp_niche_validator.py '
               '--mot-cle "carnet de gratitude" --bsr 38000 --avis 120 --prix 12.99')
    analyse.add_argument('--mot-cle', '--keyword', dest='mot_cle', required=True,
                         help='Le mot-clé examiné, tel qu’il est saisi dans la boutique.')
    analyse.add_argument('--bsr', required=True, type=float,
                         help='BSR moyen des 3 premiers livres.')
    analyse.add_argument('--avis', '--reviews', dest='avis', required=True, type=float,
                         help='Nombre moyen d’avis des 3 premiers livres.')
    analyse.add_argument('--prix', '--price', dest='prix', required=True, type=float,
                         help='Prix moyen du livre dans la niche.')
    # La boutique visée décide de la devise : un rapport en euros sur le marché
    # américain est un rapport faux, et rien dans les trois chiffres ne le dit.
    analyse.add_argument('--devise', default='€',
                         help='Symbole monétaire du rapport (défaut €).')
    analyse.add_argument('--vers', type=Path, default=Path('rapport_niche.md'),
                         help='Où écrire le rapport (défaut rapport_niche.md).')
    arguments = analyse.parse_args()

    try:
        niche = score_niche(arguments.bsr, arguments.avis, arguments.prix)
    except ValueError as erreur:
        print(f'Saisie invalide : {erreur}', file=sys.stderr)
        return 2

    rapport = rediger_rapport(niche, arguments.mot_cle, arguments.devise)
    arguments.vers.parent.mkdir(parents=True, exist_ok=True)
    arguments.vers.write_text(rapport, encoding='utf-8')

    _afficher(niche, arguments.mot_cle, arguments.devise, arguments.vers)
    return 0 if niche.viable else 1


if __name__ == '__main__':
    raise SystemExit(main())
