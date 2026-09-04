#!/usr/bin/env python3
"""Ce que la carte doit garantir, et qu'aucun coup d'œil ne garantit.

Trois de ces invariants ont déjà été payés ailleurs dans le dépôt : la zone
sûre vient de l'épisode 1 de `motion/`, où un titre étiré se faisait manger par
les boutons de Facebook ; le contraste vient du §2 ; l'unicité des
identifiants vient de la planche de contrôle de ce projet, qui a montré cinq
cartes vertes alors que les cinq palettes étaient bonnes.

Le quatrième est propre à ce projet et c'est le plus important : **la carte ne
peut pas afficher un score que le modèle n'a pas mesuré.** Ce test est ce qui
empêche qu'une session pressée le rende « plus vendeur ».
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from habillage.carte import (  # noqa: E402
    BAS_SUR, COLONNE, HAUT_SUR, TAILLE_TITRE, blocs, couper, en_svg,
)
from habillage.palette import PALETTES, palette  # noqa: E402
from noyau.intentions import Intention, Source  # noqa: E402
from noyau.verdict import juger  # noqa: E402

# Un verdict par intention, et la liste doit **rester exhaustive** : c'est le
# seul endroit où les quatre palettes sont mesurées contre la barre de 7:1.
#
# Le 04/09/2026, le stress est passé par cette liste sans y être : le cas
# `{"Cat": 0.60, "Hiss": 0.51}` rendait « stress mesuré » jusqu'à ce que
# quarante vrais chats retirent `Hiss` des classes porteuses. Le test restait
# vert **en couvrant une intention de moins** — la palette du stress n'était
# plus éprouvée du tout, et rien ne le disait.
#
# D'où `test_les_quatre_intentions_sont_traversees` plus bas : une liste de cas
# ne se garde pas toute seule, il faut compter ce qu'elle produit.
def _verdicts():
    yield juger([{"Cat": 0.109, "Purr": 0.148}])          # contentement, mesuré
    yield juger([{"Cat": 0.988, "Meow": 0.891}])          # indécis
    yield juger([{"Speech": 0.99}])                       # porte fermée
    yield juger([{"Cat": 0.9, "Meow": 0.8}],
                tete_intention=lambda: (Intention.DEMANDE, 0.71))  # provisoire
    # Le stress ne vient plus que de la tête acoustique, en PROVISOIRE : aucune
    # classe de YAMNet ne le porte depuis le 04/09/2026.
    yield juger([{"Cat": 0.9, "Meow": 0.8}],
                tete_intention=lambda: (Intention.STRESS, 0.5))


def _luminance(hexa: str) -> float:
    """Luminance relative WCAG, pour un contraste calculé et non estimé."""
    def canal(v: float) -> float:
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, v, b = (int(hexa[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(b)


def _contraste(a: str, b: str) -> float:
    la, lb = sorted((_luminance(a), _luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


class TestZoneSure(unittest.TestCase):
    """Le texte vit entre 12 et 45 % de la hauteur — l'intersection des trois
    plateformes, jamais la plus permissive. Instagram ferme dès 63 %.
    """

    def test_tout_le_texte_tient_dans_la_bande(self):
        for verdict in _verdicts():
            with self.subTest(intention=verdict.intention):
                lignes = blocs(verdict)
                self.assertTrue(lignes, "une carte sans texte n'existe pas")
                # `y` est la ligne de base : le haut d'un glyphe est au-dessus.
                haut = min(l.y - l.taille for l in lignes)
                bas = max(l.y for l in lignes)
                self.assertGreaterEqual(haut, HAUT_SUR)
                self.assertLessEqual(bas, BAS_SUR)

    def test_aucune_ligne_ne_deborde_de_la_colonne(self):
        """Un texte qui déborde se fait couper par le bord de l'écran.

        On mesure à l'estimation d'avance utilisée par le découpage : ce n'est
        pas la vraie largeur du glyphe, mais c'est celle sur laquelle la mise
        en page a décidé, donc la seule qui puisse être fausse ici.
        """
        for verdict in _verdicts():
            for ligne in blocs(verdict):
                with self.subTest(texte=ligne.texte):
                    largeur = len(ligne.texte) * ligne.taille * 0.56
                    self.assertLessEqual(largeur, COLONNE + 1)

    def test_un_titre_tres_long_passe_a_la_ligne_sans_sortir(self):
        """Le défaut de l'épisode 1 de `motion/`, rendu impossible ici.

        Un titre de huit mots doit produire plusieurs lignes et rester dans la
        bande — jamais une ligne unique étirée ou débordante.
        """
        long = ("Ce titre est délibérément beaucoup trop long pour tenir "
                "sur une seule ligne de la carte")
        lignes = couper(long, TAILLE_TITRE)
        self.assertGreater(len(lignes), 1)
        for ligne in lignes:
            self.assertLessEqual(len(ligne) * TAILLE_TITRE * 0.56, COLONNE + 1)


class TestHonnetete(unittest.TestCase):
    """L'invariant qui vaut plus que les autres.

    Le §1 interdit le procédé qui manipule. Un pourcentage inventé sur un
    écran de partage en est un — il a exactement l'air d'une mesure. Ici la
    règle n'est pas une consigne laissée à la discipline de l'appelant : il
    n'existe aucun chemin de code menant à un score sur un verdict non mesuré.
    """

    def test_aucun_score_quand_la_lecture_n_est_pas_mesuree(self):
        for verdict in _verdicts():
            if verdict.source is Source.MESUREE:
                continue
            with self.subTest(source=verdict.source, intention=verdict.intention):
                # On regarde le **texte affiché**, pas le SVG brut : celui-ci
                # contient `offset="0%"` et `offset="100%"` dans le dégradé,
                # qui n'ont rien à voir avec un score. Chercher « % » dans la
                # source rendait ce test faux dans le sens le plus fâcheux —
                # rouge sur un code juste, donc bon à désactiver.
                for texte in re.findall(r"<text[^>]*>([^<]*)</text>", en_svg(verdict)):
                    self.assertNotIn("%", texte,
                                     "un verdict non mesuré ne montre jamais de pourcentage")

    def test_un_score_apparait_quand_c_est_mesure(self):
        """Le symétrique : ne rien montrer du tout serait aussi un défaut.

        Sans ce test, supprimer le bloc de confiance ferait passer le test
        précédent et personne ne le verrait.
        """
        verdict = juger([{"Cat": 0.109, "Purr": 0.148}])
        self.assertIs(verdict.source, Source.MESUREE)
        textes = re.findall(r"<text[^>]*>([^<]*)</text>", en_svg(verdict))
        self.assertTrue(any("15%" in t for t in textes))


class TestPalette(unittest.TestCase):
    def test_chaque_intention_a_sa_palette(self):
        for intention in Intention:
            self.assertIn(intention, PALETTES)

    def test_le_contraste_depasse_sept_pour_un(self):
        """7:1 et non 4,5:1 — le minimum légal ne tient pas en plein soleil.

        Vérifié sur les **deux** extrémités du dégradé : un texte lisible en
        haut de carte et noyé en bas serait un défaut que la moyenne cache.
        """
        for intention, teintes in PALETTES.items():
            for fond in (teintes.fond, teintes.fond_bas):
                with self.subTest(intention=intention, fond=fond):
                    self.assertGreaterEqual(_contraste(teintes.texte, fond), 7.0)

    def test_l_accent_tient_le_standard_de_la_maison(self):
        """7:1, et non 4,5:1 — le §2 bis l'a posé pour tous les produits.

        Ce test demandait 4,5:1, la barre légale, et **trois accents sur cinq
        étaient sous 7 sans que rien ne le dise** : `sortir` 6,80, `stress`
        6,24, `indecis` 5,59. Un test écrit sur l'ancienne barre ne signale pas
        qu'une nouvelle existe — c'est le plus discret des défauts, parce qu'il
        reste vert.

        La justification du §2 bis s'applique ici mot pour mot : ces cartes se
        regardent dehors, sur un téléphone, souvent à une main.
        """
        for intention, teintes in PALETTES.items():
            with self.subTest(intention=intention):
                self.assertGreaterEqual(_contraste(teintes.accent, teintes.fond), 7.0)


class TestSvg(unittest.TestCase):
    def test_les_identifiants_de_degrade_sont_uniques_par_intention(self):
        """Le défaut que la planche a montré et qu'aucun fichier ne trahissait.

        Un `id` est global au document, pas au SVG. Deux cartes inlinées dans
        la même page avec le même identifiant : la seconde prend la couleur de
        la première, et chaque fichier reste juste pris isolément.
        """
        vus = set()
        for verdict in _verdicts():
            trouve = re.findall(r'id="(fond-[a-z]+)"', en_svg(verdict))
            self.assertEqual(len(trouve), 1)
            vus.add((verdict.intention, trouve[0]))
        identifiants = {i for _, i in vus}
        self.assertEqual(len(identifiants), len({i for i, _ in vus}))

    def test_la_reference_pointe_bien_sur_le_degrade_declare(self):
        """Un identifiant unique mais mal référencé rendrait un fond noir."""
        for verdict in _verdicts():
            svg = en_svg(verdict)
            declare = re.search(r'id="(fond-[a-z]+)"', svg).group(1)
            self.assertIn(f"url(#{declare})", svg)

    def test_le_texte_est_echappe(self):
        """Les guillemets français traversent ; un `&` casserait le XML."""
        for verdict in _verdicts():
            svg = en_svg(verdict)
            self.assertNotIn("&&", svg)
            # Tout `&` doit ouvrir une entité.
            for position in (m.start() for m in re.finditer("&", svg)):
                self.assertRegex(svg[position:position + 8], r"^&(amp|lt|gt|quot|apos);")


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestCouvertureDesIntentions(unittest.TestCase):
    """Le garde-fou que l'absence de stress a rendu nécessaire.

    Une liste de cas écrite à la main dérive dès qu'une règle change : les
    entrées restent, les verdicts qu'elles produisent glissent, et le test
    continue de passer en mesurant moins. Compter ce qui **sort** de la liste
    est le seul contrôle qui ne dérive pas avec elle.
    """

    def test_les_quatre_intentions_sont_traversees(self):
        obtenues = {v.intention for v in _verdicts()}
        self.assertEqual(obtenues, set(Intention),
                         "la liste de cas ne produit plus toutes les intentions")
