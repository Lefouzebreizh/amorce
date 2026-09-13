"""Contrats de la page source, sans réseau ni validation du déploiement Vercel."""

import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


SITE = Path(__file__).resolve().parent.parent / "site"


class ContenuPublic(HTMLParser):
    def __init__(self):
        super().__init__()
        self.textes = []
        self.ignore = False
        self.boutons = []

    def handle_starttag(self, tag, attrs):
        attributs = dict(attrs)
        if tag in {"style", "script"}:
            self.ignore = True
        if tag == "meta" and attributs.get("name") == "description":
            self.textes.append(attributs.get("content", ""))
        if tag == "button":
            self.boutons.append(attributs)

    def handle_endtag(self, tag):
        if tag in {"style", "script"}:
            self.ignore = False

    def handle_data(self, data):
        if not self.ignore:
            self.textes.append(data)


class TestSitePilote(unittest.TestCase):
    def setUp(self):
        self.html = (SITE / "index.html").read_text(encoding="utf-8")
        self.contenu = ContenuPublic()
        self.contenu.feed(self.html)

    def test_fichiers_html_bruts_et_non_base64(self):
        # Ne prouve pas que l'outil d'envoi publie ensuite ces mêmes octets.
        for nom in ("index.html", "exemple-rapport.html"):
            with self.subTest(fichier=nom):
                html = (SITE / nom).read_text(encoding="utf-8").strip()
                self.assertTrue(html.lower().startswith("<!doctype html>"))
                self.assertTrue(html.lower().endswith("</html>"))

    def test_aucune_promesse_24_heures_dans_page_ou_metadonnees(self):
        texte = " ".join(self.contenu.textes)
        self.assertNotRegex(texte, re.compile(r"\b24\s*(?:h\b|heures\b)", re.I))

    def test_commandes_fermees_par_defaut(self):
        achats = [b for b in self.contenu.boutons if b.get("type") == "submit"]
        self.assertTrue(achats)
        self.assertTrue(all("disabled" in b for b in achats))
        self.assertIn("var ADRESSE_SERVEUR_PAIEMENT = '';", self.html)

    def test_exemple_identifie_comme_fictif(self):
        self.assertIn("site fictif", " ".join(self.contenu.textes))


if __name__ == "__main__":
    unittest.main()
