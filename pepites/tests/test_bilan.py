#!/usr/bin/env python3
"""Le bulletin du radar sur lui-même.

Ce fichier garde surtout des **refus de conclure**. C'est délibéré : le défaut
qu'on cherche ici n'est pas un calcul faux, c'est un calcul juste appliqué à
rien — « 0 % » sur un jeton vu une fois, « 60 % de réussite » sur cinq lignes.
Un bulletin bâti sur le vide rend toujours le verdict le plus rassurant, et
personne ne va vérifier un chiffre qui fait plaisir.

`TestMigration` est ici et non dans `test_stockage.py` parce qu'il éprouve
exactement ce que ce lot a ajouté, et parce qu'aucun autre test ne peut
l'attraper : ils partent tous d'une base neuve, où le schéma suffit. Le défaut
n'existe que sur un fichier qui a déjà vécu.
"""

import sqlite3
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bilan  # noqa: E402
from aides import MAINTENANT, candidat  # noqa: E402
from core.modeles import Chaine, Jeton  # noqa: E402
from core.stockage import Memoire  # noqa: E402
from skills.convergence import mesurer  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / "essai.sqlite3"
        self.memoire = Memoire(self.chemin)
        self.addCleanup(self.dossier.cleanup)
        self.addCleanup(self.memoire.fermer)

    def relever(self, heures, prix, note=70.0, adresse="0xPepite", symbole="PEP"):
        """Un relevé de plus pour ce jeton, `heures` après l'instant de départ."""
        chaine: Chaine = candidat().jeton.chaine
        jeton = Jeton(chaine=chaine, adresse=adresse, symbole=symbole, nom=symbole)
        c = candidat(jeton=jeton, prix_usd=prix)
        self.memoire.enregistrer(c, mesurer(c), note, MAINTENANT + timedelta(hours=heures))
        return c


class TestParcours(Base):
    def test_deux_releves_donnent_la_variation(self):
        self.relever(0, prix=0.0010)
        self.relever(24, prix=0.0013)
        p, = bilan.parcours(self.memoire)
        self.assertEqual(p.releves, 2)
        self.assertAlmostEqual(p.variation, 30.0, places=4)
        self.assertAlmostEqual(p.heures, 24.0)

    def test_un_seul_releve_est_indecidable_et_non_zero(self):
        """Le défaut que ce module existe pour éviter.

        « 0 % » se lit comme « ça n'a pas bougé », qui est une mesure. Un seul
        relevé n'en est pas une : personne n'a regardé deux fois.
        """
        self.relever(0, prix=0.0010)
        p, = bilan.parcours(self.memoire)
        self.assertFalse(p.decidable)
        self.assertIsNone(p.variation)

    def test_un_prix_de_depart_nul_est_indecidable(self):
        # Écrit en SQL direct : fabriquer un `Candidat` à prix nul passerait par
        # des calculs qui n'ont pas à être éprouvés ici. C'est la base qu'on
        # veut abîmer, pas le modèle.
        self.memoire.connexion.executemany(
            "INSERT INTO releves (chaine, adresse, vu_le, liquidite_usd, market_cap,"
            " volume_h1, volume_h24, prix_usd, note, acceleration, symbole)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [("base", "0xZero", "2026-08-25T12:00:00+00:00", 1, 1, 1, 1, 0.0, 70.0, 1.0, "ZER"),
             ("base", "0xZero", "2026-08-26T12:00:00+00:00", 1, 1, 1, 1, 5.0, 70.0, 1.0, "ZER")],
        )
        self.memoire.connexion.commit()
        p, = bilan.parcours(self.memoire)
        self.assertFalse(p.decidable)
        self.assertIsNone(p.variation)

    def test_une_baisse_se_lit_comme_une_baisse(self):
        self.relever(0, prix=0.0100)
        self.relever(48, prix=0.0055)
        p, = bilan.parcours(self.memoire)
        self.assertAlmostEqual(p.variation, -45.0, places=4)

    def test_un_ecart_trop_court_est_signale(self):
        # Une heure sur une pépite, c'est la respiration du carnet d'ordres.
        # La variation est vraie, le verdict qu'on en tirerait ne l'est pas.
        self.relever(0, prix=0.0010)
        self.relever(1, prix=0.0012)
        p, = bilan.parcours(self.memoire)
        self.assertTrue(p.decidable)
        self.assertTrue(p.trop_tot)

    def test_le_symbole_survit_au_scan(self):
        """La raison d'être de la migration : sans elle, une pépite sous le
        seuil d'alerte ne laissait qu'une adresse."""
        self.relever(0, prix=0.0010, symbole="MIAOU")
        p, = bilan.parcours(self.memoire)
        self.assertEqual(p.symbole, "MIAOU")
        self.assertEqual(p.nom, "MIAOU")

    def test_un_symbole_absent_ne_fait_pas_tomber_le_tableau(self):
        self.memoire.connexion.execute(
            "INSERT INTO releves (chaine, adresse, vu_le, liquidite_usd, market_cap,"
            " volume_h1, volume_h24, prix_usd, note, acceleration, symbole)"
            " VALUES ('base','0xVieux','2026-08-25T12:00:00+00:00',1,1,1,1,2.0,66.0,1.0,'')"
        )
        self.memoire.connexion.commit()
        p, = bilan.parcours(self.memoire)
        self.assertEqual(p.nom, "?")
        self.assertIn("0xVieux", bilan.tableau([p], bilan.juger([p])))

    def test_le_filtre_de_note_retient_le_maximum_et_non_le_dernier(self):
        # Un jeton qui a noté 80 puis retombé à 40 doit rester visible : c'est
        # au moment où il notait haut qu'on l'aurait acheté.
        self.relever(0, prix=0.0010, note=80.0)
        self.relever(24, prix=0.0004, note=40.0)
        self.assertEqual(len(bilan.parcours(self.memoire, note_minimale=70.0)), 1)


class TestVerdict(Base):
    def _lot(self, variations, heures=24):
        for i, var in enumerate(variations):
            self.relever(0, prix=0.0010, adresse=f"0x{i:04d}", symbole=f"T{i}")
            self.relever(heures, prix=0.0010 * (1 + var / 100), adresse=f"0x{i:04d}", symbole=f"T{i}")
        return bilan.juger(bilan.parcours(self.memoire))

    def test_trop_peu_de_jetons_ne_conclut_rien(self):
        v = self._lot([50.0, 40.0, 30.0])
        self.assertEqual(v.decidables, 3)
        self.assertFalse(v.concluant)
        self.assertIsNone(v.taux)

    def test_un_echantillon_suffisant_conclut(self):
        v = self._lot([10.0] * bilan.JETONS_POUR_CONCLURE)
        self.assertTrue(v.concluant)
        self.assertAlmostEqual(v.taux, 100.0)

    def test_la_mediane_resiste_a_un_jeton_extreme(self):
        """Pourquoi la médiane et pas la moyenne : un seul jeton multiplié par
        cinquante donnerait au radar un bulletin flatteur que dix-neuf lignes
        perdantes ne corrigeraient pas."""
        v = self._lot([5000.0] + [-10.0] * 20)
        self.assertLess(v.mediane, 0)
        self.assertTrue(v.concluant)

    def test_les_jetons_trop_recents_ne_comptent_pas(self):
        v = self._lot([30.0] * 25, heures=1)
        self.assertEqual(v.decidables, 0)
        self.assertFalse(v.concluant)


class TestTableau(Base):
    def test_une_base_vide_le_dit_au_lieu_de_rendre_un_tableau_vide(self):
        texte = bilan.tableau([], bilan.juger([]))
        self.assertIn("Aucun relevé", texte)

    def test_le_tableau_ne_promet_rien_sur_trop_peu(self):
        self.relever(0, prix=0.0010)
        self.relever(24, prix=0.0020)
        liste = bilan.parcours(self.memoire)
        texte = bilan.tableau(liste, bilan.juger(liste))
        self.assertIn("Trop peu pour juger", texte)
        # Le mot qui rassurerait à tort ne doit apparaître nulle part.
        self.assertNotIn("% de hausses", texte)

    def test_l_age_du_dernier_releve_est_dit(self):
        # Une hausse vieille de trois semaines se lit sinon comme une hausse
        # d'aujourd'hui, alors que le jeton est sorti de l'entonnoir depuis.
        self.relever(0, prix=0.0010)
        self.relever(24, prix=0.0020)
        liste = bilan.parcours(self.memoire)
        texte = bilan.tableau(liste, bilan.juger(liste),
                              maintenant=MAINTENANT + timedelta(days=21))
        self.assertIn("il y a 20 j", texte)


class TestMigration(unittest.TestCase):
    """Une base d'avant la migration doit gagner la colonne à l'ouverture.

    Aucun autre test ne peut attraper ce défaut : ils partent tous d'un fichier
    neuf, où `CREATE TABLE IF NOT EXISTS` crée la table complète. Le défaut
    n'apparaît que sur la base de quelqu'un qui scanne depuis des semaines —
    donc en production, et seulement là.
    """

    SCHEMA_AVANT = """
    CREATE TABLE releves (
        chaine TEXT NOT NULL, adresse TEXT NOT NULL, vu_le TEXT NOT NULL,
        liquidite_usd REAL NOT NULL, market_cap REAL NOT NULL,
        volume_h1 REAL NOT NULL, volume_h24 REAL NOT NULL, prix_usd REAL NOT NULL,
        note REAL NOT NULL, acceleration REAL NOT NULL,
        PRIMARY KEY (chaine, adresse, vu_le)
    );
    """

    def test_une_base_d_avant_gagne_la_colonne_et_garde_ses_lignes(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "vieille.sqlite3"
            vieille = sqlite3.connect(chemin)
            vieille.executescript(self.SCHEMA_AVANT)
            vieille.execute(
                "INSERT INTO releves VALUES"
                " ('solana','ChatDeLaNuit','2026-08-29T05:00:00+00:00',"
                "  50000,400000,9000,60000,0.0010,65.0,2.1)"
            )
            vieille.commit()
            vieille.close()

            with Memoire(chemin) as memoire:
                colonnes = {
                    l["name"] for l in memoire.connexion.execute("PRAGMA table_info(releves)")
                }
                self.assertIn("symbole", colonnes)
                p, = bilan.parcours(memoire)
                # La ligne d'avant survit, et son nom manque sans mentir.
                self.assertEqual(p.adresse, "ChatDeLaNuit")
                self.assertEqual(p.nom, "?")
                self.assertFalse(p.decidable)

    def test_la_migration_se_rejoue_sans_rien_casser(self):
        # Une base rouverte dix fois par jour ne doit pas accumuler d'erreur :
        # `ALTER TABLE` sur une colonne déjà là lèverait.
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "essai.sqlite3"
            for _ in range(3):
                Memoire(chemin).fermer()


if __name__ == "__main__":
    unittest.main()
