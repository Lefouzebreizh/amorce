"""`noyau.redaction` : ce qui doit disparaître avant qu'un texte ne quitte la machine."""

import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from noyau import redaction  # noqa: E402


class MasquageIban(unittest.TestCase):
    def test_iban_espace_est_masque(self):
        texte = "IBAN : FR76 3000 4008 2800 0123 4567 890, à conserver."
        resultat = redaction.masquer(texte)
        self.assertNotIn("3000 4008", resultat)
        self.assertIn("[IBAN MASQUÉ]", resultat)

    def test_iban_colle_est_masque(self):
        texte = "FR7630004008280001234567890"
        self.assertEqual(redaction.masquer(texte), "[IBAN MASQUÉ]")

    def test_texte_sans_iban_ne_change_pas(self):
        texte = "Facture EDF n° F-2026-0842, total 84,20 €."
        self.assertEqual(redaction.masquer(texte), texte)


class MasquageNir(unittest.TestCase):
    def test_nir_espace_est_masque(self):
        texte = "N° Séc. Soc. 1 83 11 35 238 344 46"
        resultat = redaction.masquer(texte)
        self.assertNotIn("238 344", resultat)
        self.assertIn("[NUMÉRO DE SÉCURITÉ SOCIALE MASQUÉ]", resultat)

    def test_nir_avec_barre_avant_la_cle_est_masque(self):
        # Forme vue telle quelle sur des documents réels : les groupes collés,
        # une barre seulement avant la clé de contrôle à deux chiffres.
        texte = "Matricule 1831135238344/46 — à ne jamais recopier tel quel."
        resultat = redaction.masquer(texte)
        self.assertNotIn("1831135238344", resultat)
        self.assertIn("[NUMÉRO DE SÉCURITÉ SOCIALE MASQUÉ]", resultat)

    def test_texte_sans_nir_ne_change_pas(self):
        texte = "Née le 19 novembre 1983 à Rennes."
        self.assertEqual(redaction.masquer(texte), texte)


class Troncature(unittest.TestCase):
    def test_masquer_avant_troncature_ne_laisse_pas_une_moitie_d_iban(self):
        iban = "FR7630004008280001234567890"
        texte = "En-tête sans intérêt. " + iban
        masque = redaction.masquer(texte)
        tronque = masque[: len("En-tête sans intérêt. [IBAN MASQUÉ") + 2]
        self.assertNotIn("3000400828", tronque)


if __name__ == "__main__":
    unittest.main()
