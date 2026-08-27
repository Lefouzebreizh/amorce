#!/usr/bin/env python3
"""Tient la frontière entre la clé publiable et le jeton à privilèges.

C'est la seule règle de ce relevé qui coûte cher dans les deux sens, et les
deux coûts tombent sur le même rapport : signaler une clé `anon` — publiable par
conception — discrédite les quatre constats suivants, parce que c'est le premier
que le lecteur vérifie et qu'il sait que c'est faux ; laisser passer une
`service_role` fait manquer le constat qui justifie à lui seul le prix de
l'audit. Les deux jetons ont le même préfixe et la même allure, et seule leur
charge utile les sépare : c'est exactement le genre de distinction qu'une
retouche ultérieure emporte sans s'en apercevoir.
"""

import base64
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scan import SECRETS, anodin, jeton_a_privileges, role_jwt  # noqa: E402


def forger(charge):
    """Un JWT d'allure crédible portant la charge utile demandée.

    Aucune signature valide : le relevé décode, il ne vérifie pas — et un test
    qui aurait besoin d'une vraie clé pour tourner serait un test qui ne tourne
    pas en intégration continue.
    """
    def encoder(donnees):
        brut = json.dumps(donnees, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(brut).decode().rstrip("=")

    return (f"{encoder({'alg': 'HS256', 'typ': 'JWT'})}."
            f"{encoder(charge)}.faussesignaturemaiscredible")


class TestJetonAPrivileges(unittest.TestCase):

    def test_service_role_est_signale(self):
        """Le constat qui vaut le prix de l'audit ne doit jamais passer."""
        constat = jeton_a_privileges(f'const K="{forger({"role": "service_role"})}";')
        self.assertIsNotNone(constat)
        self.assertIn("service_role", constat)

    def test_anon_ne_l_est_pas(self):
        """La clé publiable part au navigateur par conception."""
        self.assertIsNone(
            jeton_a_privileges(f'const K="{forger({"role": "anon"})}";'))

    def test_authenticated_ne_l_est_pas(self):
        """Un jeton de session d'utilisateur connecté n'est pas une fuite."""
        self.assertIsNone(
            jeton_a_privileges(f'const K="{forger({"role": "authenticated"})}";'))

    def test_le_jeton_n_est_jamais_recopie(self):
        """Un rapport qui reproduit la clé qu'il signale est la deuxième fuite."""
        jeton = forger({"role": "service_role"})
        constat = jeton_a_privileges(f'const K="{jeton}";')
        self.assertNotIn(jeton, constat)
        self.assertNotIn(jeton.split(".")[1], constat)

    def test_les_deux_jetons_sur_la_meme_ligne(self):
        """Un bundle minifié est une seule ligne : les deux clés s'y côtoient."""
        ligne = (f'a="{forger({"role": "anon"})}",'
                 f'b="{forger({"role": "service_role"})}"')
        self.assertIn("service_role", jeton_a_privileges(ligne))

    def test_un_jeton_malforme_ne_casse_rien(self):
        """Le relevé tourne sur du code inconnu : il ne s'arrête jamais dessus."""
        for ligne in ('x="eyJhbGciOiJIUzI1NiJ9.pastroisparties"',
                      'x="eyJhbGciOiJIUzI1NiJ9.eyJjYXNzZQ.sig"',
                      f'x="{forger([1, 2, 3])}"',
                      f'x="{forger({"role": 42})}"'):
            with self.subTest(ligne=ligne):
                self.assertIsNone(jeton_a_privileges(ligne))

    def test_role_jwt_lit_la_charge_utile(self):
        charge = base64.urlsafe_b64encode(b'{"role":"service_role"}').decode().rstrip("=")
        self.assertEqual(role_jwt(charge), "service_role")
        self.assertIsNone(role_jwt("pasdubase64!!"))


class TestAnodin(unittest.TestCase):
    """Le tri qui a évité d'envoyer un rapport de neuf faux positifs."""

    def test_les_jetons_de_theme_sont_anodins(self):
        for valeur in ("--background", "--muted-foreground", "#ffffff",
                       "var(--ring)", "./chemin/relatif", "muted-foreground"):
            with self.subTest(valeur=valeur):
                self.assertTrue(anodin(valeur))

    def test_les_classes_utilitaires_aussi(self):
        """Un fichier de thème en aligne des dizaines ; chacune est un faux positif."""
        for valeur in ("text-slate-500", "bg-red-50", "ring-offset-2",
                       "grid-cols-12", "font_size_14"):
            with self.subTest(valeur=valeur):
                self.assertTrue(anodin(valeur))

    def test_une_vraie_cle_ne_l_est_pas(self):
        for valeur in ("A1b2C3d4E5f6G7h8",
                       "a1b2c3d4e5f6a1b2c3d4",     # minuscules, mais sans séparateur
                       "hunter-2000"):             # un séparateur : sous la frontière
            with self.subTest(valeur=valeur):
                self.assertFalse(anodin(valeur))

    def test_les_cles_de_forme_connue_ne_passent_pas_par_ce_tri(self):
        """`anodin` ne filtre que le motif générique.

        Une clé au préfixe reconnaissable est attrapée par son propre motif, qui
        n'a pas de groupe de valeur et ne se fait donc jamais retrier — heureux,
        parce qu'une clé sans le moindre chiffre passerait pour une phrase.
        """
        for etiquette, motif in SECRETS:
            if etiquette == "clé OpenAI":
                self.assertTrue(motif.search('k="sk-proj-AAAAAAAAAAAABBBB"'))
                self.assertIsNone(motif.search('k="sk-court"'))
                break
        else:
            self.fail("le motif « clé OpenAI » a disparu de SECRETS")

    def test_un_jwt_n_est_jamais_anodin(self):
        """Le jeton à privilèges ne doit pas se faire absoudre par la forme."""
        self.assertFalse(anodin(forger({"role": "service_role"})))


if __name__ == "__main__":
    unittest.main()
