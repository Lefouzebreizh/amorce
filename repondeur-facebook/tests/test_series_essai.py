#!/usr/bin/env python3
"""Ce que les bancs d'essai doivent tenir.

Un banc d'essai se dégrade en silence : personne ne relit une liste de
commentaires inventés, on regarde la colonne des écarts. Les trois façons dont
il cesse de mesurer sans rougir nulle part sont gardées ici — un cas trop court
que le modèle ne voit jamais, un geste qui n'est plus éprouvé par personne, et
un cas recopié deux fois qui compte double dans le total.

Le modèle n'est pas appelé, et le SDK n'est pas importé : c'est toute la raison
d'être de `core/series_essai.py`.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.redaction import (  # noqa: E402
    A_TOI, LONGUEUR_LISIBLE, MODERATION, REACTION, REPONSE,
)
from core.series_essai import LIMITES, SERIE  # noqa: E402

GESTES = {REACTION, REPONSE, A_TOI, MODERATION}


class BancsDEssai(unittest.TestCase):
    """Les deux bancs, et ce qui les rendrait muets."""

    def test_les_gestes_attendus_existent(self):
        for banc in (SERIE, LIMITES):
            for auteur, _texte, attendu in banc:
                self.assertIn(attendu, GESTES, f'geste inconnu attendu pour {auteur}')

    def test_les_quatre_gestes_sont_eprouves_par_chaque_banc(self):
        # Un banc qui perd un geste ne le signale pas : le total reste vert.
        for nom, banc in (('SERIE', SERIE), ('LIMITES', LIMITES)):
            self.assertEqual(GESTES, {attendu for _a, _t, attendu in banc},
                             f'{nom} n’éprouve plus les quatre gestes')

    def test_les_cas_de_bordure_atteignent_le_modele(self):
        # `rediger` court-circuite sous LONGUEUR_LISIBLE. Un cas de bordure plus
        # court que ça recevrait sa réaction sans que le modèle soit consulté :
        # il paraîtrait conforme en n’ayant rien mesuré du tout.
        for auteur, texte, _attendu in LIMITES:
            self.assertGreaterEqual(len(texte.strip()), LONGUEUR_LISIBLE,
                                    f'le cas de {auteur} est court-circuité avant le modèle')

    def test_la_serie_garde_un_cas_court_circuite(self):
        # L’inverse pour SERIE : le cas trop court y est délibéré, c’est lui qui
        # montre le court-circuit à l’écran. Le perdre passerait inaperçu.
        courts = [t for _a, t, _g in SERIE if len(t.strip()) < LONGUEUR_LISIBLE]
        self.assertTrue(courts, 'SERIE ne montre plus le court-circuit des commentaires courts')

    def test_aucun_commentaire_en_double(self):
        textes = [t for _a, t, _g in SERIE] + [t for _a, t, _g in LIMITES]
        self.assertEqual(len(textes), len(set(textes)), 'un commentaire est présent deux fois')

    def test_les_auteurs_sont_distincts(self):
        # Deux « Marc » dans la même sortie se relisent l’un pour l’autre.
        prenoms = [a for a, _t, _g in SERIE] + [a for a, _t, _g in LIMITES]
        self.assertEqual(len(prenoms), len(set(prenoms)), 'deux cas portent le même prénom')


if __name__ == '__main__':
    unittest.main()
