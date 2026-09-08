"""Ce que le fichier de rappels doit tenir — repris des tests de paper-manager.

Un `.ics` mal formé ne se plaint pas : l'agenda refuse de l'ouvrir, ou pire,
avale l'événement en coupant la consigne en deux. Les contrôles portent donc
sur le texte produit, ligne par ligne.
"""

import tempfile
import unittest
from datetime import date, time
from pathlib import Path

from moteur_administratif.rappels.modele import Rappel
from moteur_administratif.rappels.regles import composer_ics, echapper, plier
from moteur_administratif.rappels.traitement import ecrire_ics


class TestEchapper(unittest.TestCase):
    def test_virgule(self):
        self.assertEqual(echapper("Taxe foncière, solde"), "Taxe foncière\\, solde")

    def test_ordre_antislash_avant_le_reste(self):
        self.assertEqual(echapper("a\\b;c"), "a\\\\b\\;c")


class TestPlier(unittest.TestCase):
    def test_ligne_courte_intacte(self):
        self.assertEqual(plier("SUMMARY:court"), "SUMMARY:court")

    def test_ligne_longue_pliee_sur_un_octet_utf8(self):
        long_libelle = "SUMMARY:" + "é" * 40  # chaque é pèse 2 octets en UTF-8
        pliee = plier(long_libelle)
        for ligne in pliee.split("\r\n"):
            self.assertLessEqual(len(ligne.encode("utf-8")), 75)
        # Aucun octet perdu au pliage : la reconstitution donne le texte d'origine.
        reconstitue = pliee.replace("\r\n ", "")
        self.assertEqual(reconstitue, long_libelle)


class TestComposerIcs(unittest.TestCase):
    def setUp(self):
        self.rappels = [Rappel(date(2026, 10, 1), "Résilier — Assurance habitation",
                               "préavis de 60 jours")]

    def test_structure_minimale(self):
        contenu = composer_ics(self.rappels, date(2026, 9, 3))
        self.assertTrue(contenu.startswith("BEGIN:VCALENDAR\r\n"))
        self.assertTrue(contenu.endswith("END:VCALENDAR\r\n"))
        self.assertIn("BEGIN:VEVENT\r\n", contenu)
        self.assertIn("SUMMARY:Résilier — Assurance habitation\r\n", contenu)

    def test_uid_stable(self):
        premier = composer_ics(self.rappels, date(2026, 9, 3))
        second = composer_ics(self.rappels, date(2026, 9, 4))  # `le` change, pas le rappel
        uid = [l for l in premier.split("\r\n") if l.startswith("UID:")][0]
        self.assertIn(uid, second)

    def test_une_alarme_par_jour_avant(self):
        contenu = composer_ics(self.rappels, date(2026, 9, 3), rappels_jours_avant=(30, 7, 1))
        self.assertEqual(contenu.count("BEGIN:VALARM"), 3)
        self.assertIn("TRIGGER:-P30D", contenu)

    def test_liste_vide(self):
        contenu = composer_ics([], date(2026, 9, 3))
        self.assertNotIn("VEVENT", contenu)

    def test_deterministe(self):
        self.assertEqual(
            composer_ics(self.rappels, date(2026, 9, 3)),
            composer_ics(self.rappels, date(2026, 9, 3)),
        )


class TestEcrireIcs(unittest.TestCase):
    def test_ecrit_sur_disque(self):
        with tempfile.TemporaryDirectory() as dossier:
            destination = Path(dossier) / "sous-dossier" / "rappels.ics"
            rendu = ecrire_ics([Rappel(date(2026, 10, 1), "Résilier")], destination)
            self.assertEqual(rendu, destination)
            contenu = destination.read_text(encoding="utf-8")
        self.assertIn("Résilier", contenu)
        # Pas de CRCRLF : `newline=""` doit avoir laissé les CRLF du contenu intacts.
        self.assertNotIn("\r\r\n", contenu)


if __name__ == "__main__":
    unittest.main()
