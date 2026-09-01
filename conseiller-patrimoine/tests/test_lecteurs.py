#!/usr/bin/env python3
"""Les quatre lecteurs, sur de vraies structures de fichiers.

Aucun de ces tests ne touche au vrai NexusCrypto ni au vrai radar : ils
fabriquent la forme exacte de leurs fichiers dans un dossier temporaire. C'est
la seule façon d'éprouver le cas qui compte le plus — celui où la source est
absente, vide ou illisible — sans avoir à casser quelque chose de réel.
"""

import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aides import AUJOURDHUI, VIEUX, reglages  # noqa: E402
from core.modeles import Disponibilite  # noqa: E402
from lecteurs import banque, nexuscrypto, pepites, saisie  # noqa: E402


MAINTENANT = datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc)

# La forme réelle du `config.yaml` de NexusCrypto, réduite à ce qu'on en lit.
CONFIG_NEXUS = """
general:
  devise: USDT
portefeuille:
  capital_initial_usd: 10000
  enveloppe_dca_usd: 200
  cadence_dca: hebdomadaire
  allocation:
    BTC/USDT:
      poids: 50
      role: socle
      vente_sur_signal: false
    SOL/USDT:
      poids: 20
      role: satellite
"""

# Le schéma réel du radar, réduit aux deux tables qu'on interroge. Transcrit,
# donc éprouvé : une base fabriquée par `pepites/core/stockage.py` lui-même a
# été lue par ce lecteur, colonne par colonne, avant que ce bloc soit figé.
SCHEMA_PEPITES = """
CREATE TABLE releves (
    chaine TEXT NOT NULL, adresse TEXT NOT NULL, vu_le TEXT NOT NULL,
    liquidite_usd REAL NOT NULL, market_cap REAL NOT NULL, volume_h1 REAL NOT NULL,
    volume_h24 REAL NOT NULL, prix_usd REAL NOT NULL, note REAL NOT NULL,
    acceleration REAL NOT NULL, symbole TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (chaine, adresse, vu_le)
);
CREATE TABLE alertes (
    chaine TEXT NOT NULL, adresse TEXT NOT NULL, envoyee_le TEXT NOT NULL,
    note REAL NOT NULL, symbole TEXT NOT NULL,
    PRIMARY KEY (chaine, adresse, envoyee_le)
);
"""

class TestNexuscrypto(unittest.TestCase):
    def test_une_source_non_declaree_n_est_pas_une_panne(self):
        lecture = nexuscrypto.lire(None)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.NON_BRANCHEE)

    def test_un_dossier_sans_config_est_declare_absent(self):
        with tempfile.TemporaryDirectory() as dossier:
            lecture = nexuscrypto.lire(Path(dossier))
        self.assertIs(lecture.etat.disponibilite, Disponibilite.ABSENTE)

    def test_l_allocation_cible_est_lue(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            (racine / "config").mkdir()
            (racine / "config" / "config.yaml").write_text(CONFIG_NEXUS, encoding="utf-8")
            lecture = nexuscrypto.lire(racine)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.LUE)
        self.assertTrue(any("BTC 50 %" in note for note in lecture.notes))

    def test_aucune_position_n_est_jamais_rendue(self):
        # Le test central de ce lecteur. NexusCrypto ne persiste pas son
        # portefeuille : présenter sa cible comme une détention afficherait un
        # patrimoine imaginaire, et parfaitement plausible.
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            (racine / "config").mkdir()
            (racine / "config" / "config.yaml").write_text(CONFIG_NEXUS, encoding="utf-8")
            lecture = nexuscrypto.lire(racine)
        self.assertEqual(lecture.lignes, ())
        self.assertTrue(any("non disponibles" in note for note in lecture.notes))

    def test_un_yaml_casse_est_declare_illisible_et_non_vide(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            (racine / "config").mkdir()
            (racine / "config" / "config.yaml").write_text("portefeuille: [", encoding="utf-8")
            lecture = nexuscrypto.lire(racine)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.ILLISIBLE)

    def test_l_absence_de_journal_se_dit(self):
        with tempfile.TemporaryDirectory() as dossier:
            racine = Path(dossier)
            (racine / "config").mkdir()
            (racine / "config" / "config.yaml").write_text(CONFIG_NEXUS, encoding="utf-8")
            lecture = nexuscrypto.lire(racine)
        self.assertTrue(any("jamais tourné" in note for note in lecture.notes))


class TestPepites(unittest.TestCase):
    def _base(self, dossier: Path, alertes=(), releves=()):
        (dossier / "donnees").mkdir(parents=True, exist_ok=True)
        chemin = dossier / "donnees" / "pepites.sqlite3"
        connexion = sqlite3.connect(chemin)
        with connexion:
            connexion.executescript(SCHEMA_PEPITES)
            connexion.executemany(
                "INSERT INTO alertes VALUES (?,?,?,?,?)", alertes)
            connexion.executemany(
                "INSERT INTO releves VALUES (?,?,?,?,?,?,?,?,?,?,?)", releves)
        connexion.close()
        return chemin

    def test_une_base_absente_n_est_pas_un_radar_vide(self):
        # Les deux donneraient le même tableau sans trouvaille, et ce sont deux
        # situations opposées : ici il n'y a rien à lire, là il n'y a rien à voir.
        with tempfile.TemporaryDirectory() as dossier:
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.ABSENTE)

    def test_aucune_base_n_est_creee_par_la_lecture(self):
        # Sans cela, un chemin mal orthographié fabriquerait un fichier vide à
        # côté de la vraie base, et le radar paraîtrait n'avoir rien trouvé.
        with tempfile.TemporaryDirectory() as dossier:
            pepites.lire(Path(dossier), MAINTENANT)
            self.assertFalse((Path(dossier) / "donnees").exists())

    def test_les_alertes_recentes_sont_resumees(self):
        recent = (MAINTENANT - timedelta(days=2)).isoformat()
        with tempfile.TemporaryDirectory() as dossier:
            self._base(
                Path(dossier),
                alertes=[("base", "0xabc", recent, 82.0, "PEPE")],
                releves=[("base", "0xabc", recent, 1.0, 1.0, 1.0, 1.0, 1.0, 82.0, 1.0, "PEPE")],
            )
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.LUE)
        self.assertTrue(any("PEPE" in note for note in lecture.notes))

    def test_une_alerte_ancienne_sort_de_la_fenetre(self):
        vieux = (MAINTENANT - timedelta(days=40)).isoformat()
        with tempfile.TemporaryDirectory() as dossier:
            self._base(Path(dossier), alertes=[("base", "0xabc", vieux, 82.0, "PEPE")])
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertTrue(any("aucune alerte" in note for note in lecture.notes))

    def test_une_pepite_n_entre_jamais_dans_le_patrimoine(self):
        recent = (MAINTENANT - timedelta(days=1)).isoformat()
        with tempfile.TemporaryDirectory() as dossier:
            self._base(Path(dossier), alertes=[("base", "0xabc", recent, 91.0, "PEPE")])
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertEqual(lecture.lignes, ())
        self.assertTrue(any("pas des positions" in note for note in lecture.notes))

    def test_une_base_au_schema_inattendu_est_illisible(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "donnees" / "pepites.sqlite3"
            chemin.parent.mkdir(parents=True)
            sqlite3.connect(chemin).close()      # base vide, sans table
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.ILLISIBLE)

    def test_un_jeton_sans_symbole_porte_son_adresse(self):
        # Le symbole manque sur les relevés antérieurs à la migration qui l'a
        # ajouté. L'adresse est de toute façon le meilleur identifiant.
        recent = (MAINTENANT - timedelta(days=1)).isoformat()
        with tempfile.TemporaryDirectory() as dossier:
            self._base(Path(dossier), alertes=[("base", "0xdeadbeef", recent, 77.0, "")])
            lecture = pepites.lire(Path(dossier), MAINTENANT)
        self.assertTrue(any("0xdeadbeef" in note for note in lecture.notes))


class TestBanque(unittest.TestCase):
    def test_la_banque_est_declaree_non_branchee(self):
        lecture = banque.lire()
        self.assertIs(lecture.etat.disponibilite, Disponibilite.NON_BRANCHEE)
        self.assertEqual(lecture.lignes, ())

    def test_le_motif_nomme_la_portee_autorisee(self):
        # AISP, jamais PISP : le mot qui sépare consulter de virer. L'écrire
        # ici plutôt que le jour du branchement, c'est l'écrire tout court.
        self.assertIn("AISP", banque.lire().etat.motif)
        self.assertIn("PISP", banque.lire().etat.motif)


class TestSaisie(unittest.TestCase):
    def test_la_saisie_est_le_seul_lecteur_qui_apporte_des_montants(self):
        lecture = saisie.lire(reglages(), AUJOURDHUI)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.LUE)
        self.assertEqual(lecture.etat.lignes, 4)

    def test_un_fichier_sans_actif_est_vide_et_non_illisible(self):
        regles = reglages(actifs={c: [] for c in
                                  ("bourse", "crypto", "immobilier", "liquidites")})
        lecture = saisie.lire(regles, AUJOURDHUI)
        self.assertIs(lecture.etat.disponibilite, Disponibilite.VIDE)
        self.assertFalse(lecture.etat.muette)

    def test_un_cours_absent_est_signale_sans_valoir_zero(self):
        regles = reglages(actifs={"bourse": [
            {"nom": "Monde", "ticker": "CW8.PA", "quantite": 10}]})
        lecture = saisie.lire(regles, AUJOURDHUI)
        self.assertTrue(any("ne valent pas zéro" in note for note in lecture.notes))

    def test_un_cours_perime_est_signale_avec_son_age(self):
        regles = reglages(actifs={"crypto": [{
            "nom": "Bitcoin", "symbole": "BTC", "quantite": 0.1,
            "prix_eur": 50000.0, "releve_le": VIEUX,
        }]})
        lecture = saisie.lire(regles, AUJOURDHUI)
        self.assertTrue(any("il y a 92 jours" in note for note in lecture.notes))


if __name__ == "__main__":
    unittest.main()
