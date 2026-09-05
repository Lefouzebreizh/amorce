#!/usr/bin/env python3
"""Le témoin du bulletin : ce que le radar a écarté, relevé pour comparaison.

À ne pas confondre avec `test_temoin.py`, qui garde `temoin.py` — le banc
d'essai sur marché **fabriqué**. Ici il s'agit du témoin **réel** : les jetons
que les filtres ont écartés lors d'un vrai scan, relevés pour que `bilan` ait
un point de comparaison. Deux outils, deux fichiers, et le nom de celui-ci
porte `_bulletin` parce que le nom court était déjà pris — la première
rédaction l'a écrasé sans le voir, et la suite est restée verte.

Un taux de hausses ne dit rien tant qu'on ignore ce qu'a fait le tout-venant
sur la même fenêtre — dans un marché qui monte, « 60 % de hausses » peut être
une contre-performance. Ces tests gardent les quatre propriétés sans lesquelles
le témoin serait décoratif ou coûteux.
"""

import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bilan  # noqa: E402
import pipeline  # noqa: E402
from aides import MAINTENANT, candidat  # noqa: E402
from core.modeles import Metriques  # noqa: E402
from core.stockage import Memoire  # noqa: E402
from skills.radar import PART_TEMOIN, echantillon_temoin  # noqa: E402

METRIQUES = Metriques(acceleration=1.0, pression=0.0, discretion=0.0, rotation=0.0,
                      desequilibre=0.5, profondeur=0.1, taille_moyenne=100.0,
                      age_heures=240.0)


class EchantillonStable(unittest.TestCase):
    """La propriété qui décide de tout : un témoin n'a de valeur que **relevé
    plusieurs fois**, le bulletin comparant un premier et un dernier prix. Un
    échantillon qui change à chaque tour n'accumulerait jamais deux relevés du
    même jeton et resterait éternellement « indécidable »."""

    def test_l_echantillon_ne_depend_pas_de_la_graine_de_hachage(self):
        """Le défaut que ce test attrape est invisible autrement.

        `hash()` d'une chaîne est randomisé **par processus** en Python. Chaque
        tour du workflow étant un processus neuf, un échantillon bâti dessus
        aurait changé à chaque fois sans que rien ne le signale — le symptôme
        aurait ressemblé à un marché instable, jamais à un bug. Deux
        interpréteurs à graines opposées doivent donc rendre la même liste.
        """
        programme = (
            "import sys; sys.path.insert(0, %r)\n"
            "from skills.radar import echantillon_temoin\n"
            "from tests.aides import candidat\n"
            "import dataclasses\n"
            "lot = []\n"
            "for i in range(60):\n"
            "    c = candidat()\n"
            "    j = dataclasses.replace(c.jeton, adresse='0x%%04d' %% i)\n"
            "    lot.append(dataclasses.replace(c, jeton=j))\n"
            "print(','.join(c.jeton.adresse for c in echantillon_temoin(lot)))\n"
        ) % str(Path(__file__).resolve().parents[1])

        sorties = []
        for graine in ("0", "1"):
            resultat = subprocess.run(
                [sys.executable, "-c", programme],
                capture_output=True, text=True,
                env={"PYTHONHASHSEED": graine, "PATH": "/usr/bin:/bin"},
                cwd=str(Path(__file__).resolve().parents[1]),
            )
            self.assertEqual(resultat.returncode, 0, resultat.stderr)
            sorties.append(resultat.stdout.strip())

        self.assertEqual(sorties[0], sorties[1],
                         "L'échantillon change avec la graine de hachage : un "
                         "témoin ne serait jamais relevé deux fois.")
        self.assertTrue(sorties[0], "Échantillon vide sur soixante jetons.")

    def test_la_part_est_respectee_a_peu_pres(self):
        import dataclasses
        lot = []
        for i in range(400):
            c = candidat()
            jeton = dataclasses.replace(c.jeton, adresse=f"0x{i:04d}")
            lot.append(dataclasses.replace(c, jeton=jeton))
        garde = echantillon_temoin(lot)
        attendu = len(lot) / PART_TEMOIN
        self.assertGreater(len(garde), attendu * 0.6)
        self.assertLess(len(garde), attendu * 1.4)


class TemoinsHorsDuChemin(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.memoire = Memoire(Path(self.dossier.name) / "t.db")
        self.addCleanup(self.memoire.fermer)

    def test_un_temoin_n_est_jamais_re_interroge(self):
        """Le garde-fou qui protège le quota d'API.

        `jetons_suivis` rend ce que le radar re-interroge à chaque tour, **un
        appel DexScreener par jeton**. Un témoin qui y entrerait multiplierait
        les appels par le nombre d'écartés relevés. Le filtre de note ne suffit
        pas : `minimum` vaut 0.0 par défaut.
        """
        self.memoire.enregistrer(candidat(), METRIQUES, 0.0, MAINTENANT, temoin=True)
        self.assertEqual(
            self.memoire.jetons_suivis(minimum=0.0, maintenant=MAINTENANT), [],
            "Un témoin est re-interrogé : chaque tour coûterait un appel de plus.",
        )

    def test_un_candidat_reste_suivi(self):
        """Le symétrique : la garde ci-dessus ne doit pas assécher le suivi."""
        self.memoire.enregistrer(candidat(), METRIQUES, 80.0, MAINTENANT)
        self.assertEqual(
            len(self.memoire.jetons_suivis(minimum=0.0, maintenant=MAINTENANT)), 1)

    def test_les_deux_populations_ne_se_melangent_pas(self):
        import dataclasses
        garde = candidat()
        ecarte = dataclasses.replace(
            garde, jeton=dataclasses.replace(garde.jeton, adresse="0xEcarte"))
        self.memoire.enregistrer(garde, METRIQUES, 70.0, MAINTENANT)
        self.memoire.enregistrer(ecarte, METRIQUES, 12.0, MAINTENANT, temoin=True)

        # La base range l'adresse sous sa forme normalisée — minuscules sur
        # EVM, casse préservée sur Solana. Comparer à `jeton.adresse` brute
        # ferait échouer ce test pour une raison qui n'est pas son sujet.
        _, attendu_garde = garde.jeton.identite
        _, attendu_ecarte = ecarte.jeton.identite
        self.assertEqual([p.adresse for p in bilan.parcours(self.memoire)],
                         [attendu_garde])
        self.assertEqual([p.adresse for p in bilan.parcours(self.memoire, temoins=True)],
                         [attendu_ecarte])


class LeCheminComplet(unittest.TestCase):
    """Le tuyau réel, de la paire brute à la ligne en base.

    Les tests au-dessus éprouvent les pièces ; celui-ci vérifie qu'elles sont
    branchées. Le harnais vient de `test_pipeline` plutôt que d'être recopié :
    un second client factice divergerait du premier au premier changement.
    """

    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.memoire = Memoire(Path(self.dossier.name) / "t.db")
        self.addCleanup(self.memoire.fermer)

    def _scan(self, paires):
        import test_pipeline as tp
        client = tp.ClientFactice(paires, (), None)
        return pipeline.scanner(tp.REGLAGES, self.memoire, client,
                                MAINTENANT, tp.MessagerFactice())

    def test_un_jeton_ecarte_atterrit_en_temoin_et_pas_en_candidat(self):
        """L'adresse n'est pas quelconque : l'échantillon en garde un sur
        quatre, et celle-ci tombe dedans. La choisir au hasard rendrait ce test
        vert trois fois sur quatre — ce qui est pire que rouge."""
        import test_pipeline as tp
        resultat = self._scan([
            tp.brut(),                                        # passe les filtres
            tp.brut(symbole="JEUNE", adresse="0xecarte006",   # trop jeune : écarté
                    pool="0xPool2", age_heures=2.0),
        ])

        self.assertEqual(len(resultat.observations), 1,
                         "Le jeton trop jeune est devenu un candidat.")
        candidats = bilan.parcours(self.memoire)
        temoins = bilan.parcours(self.memoire, temoins=True)
        self.assertEqual([p.nom for p in candidats], ["PEP"])
        self.assertEqual([p.nom for p in temoins], ["JEUNE"])

    def test_un_ecarte_hors_echantillon_n_est_pas_releve(self):
        """Le témoin est un échantillon, pas la totalité : relever les 185
        écartés de chaque tour ferait enfler la base sans rien apporter."""
        import test_pipeline as tp
        self._scan([
            tp.brut(),
            tp.brut(symbole="JEUNE", adresse="0xhorsech000",
                    pool="0xPool2", age_heures=2.0),
        ])
        self.assertEqual(bilan.parcours(self.memoire, temoins=True), [])

    def test_un_temoin_ne_declenche_aucun_appel_supplementaire(self):
        """La propriété qui rend le témoin gratuit. Ses données viennent du
        tour de découverte qui vient d'avoir lieu ; s'il coûtait un appel, huit
        tours par jour sur des dizaines d'écartés épuiseraient le quota."""
        import test_pipeline as tp
        sans = tp.ClientFactice([tp.brut()], (), None)
        pipeline.scanner(tp.REGLAGES, self.memoire, sans, MAINTENANT,
                         tp.MessagerFactice())

        autre = Memoire(Path(self.dossier.name) / "u.db")
        self.addCleanup(autre.fermer)
        avec = tp.ClientFactice(
            [tp.brut(), tp.brut(symbole="JEUNE", adresse="0xecarte006",
                                pool="0xPool2", age_heures=2.0)], (), None)
        pipeline.scanner(tp.REGLAGES, autre, avec, MAINTENANT, tp.MessagerFactice())

        self.assertEqual(len(bilan.parcours(autre, temoins=True)), 1,
                         "Le témoin n'a pas été relevé : le test ne mesure rien.")
        self.assertEqual(avec.appels, sans.appels,
                         "Le témoin a coûté un appel réseau.")


class BaseDejaVecue(unittest.TestCase):
    def test_la_colonne_s_ajoute_sur_une_base_sans_elle(self):
        """Le cas réel : la base du cache d'Actions accumule depuis le 04/09,
        et `CREATE TABLE IF NOT EXISTS` ne touche pas une table qui existe. Le
        défaut n'apparaîtrait jamais en test, où toute base est neuve — c'est
        le piège déjà payé dans `iptv/`."""
        import sqlite3
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "ancienne.db"
            connexion = sqlite3.connect(chemin)
            connexion.execute(
                "CREATE TABLE releves (chaine TEXT NOT NULL, adresse TEXT NOT NULL, "
                "vu_le TEXT NOT NULL, liquidite_usd REAL NOT NULL, market_cap REAL "
                "NOT NULL, volume_h1 REAL NOT NULL, volume_h24 REAL NOT NULL, "
                "prix_usd REAL NOT NULL, note REAL NOT NULL, acceleration REAL "
                "NOT NULL, PRIMARY KEY (chaine, adresse, vu_le))")
            connexion.commit()
            connexion.close()

            memoire = Memoire(chemin)
            self.addCleanup(memoire.fermer)
            colonnes = {l["name"] for l in
                        memoire.connexion.execute("PRAGMA table_info(releves)")}
            self.assertIn("temoin", colonnes)
            # Et la base reste utilisable, ce qu'une migration bancale casse.
            memoire.enregistrer(candidat(), METRIQUES, 50.0, MAINTENANT, temoin=True)
            self.assertEqual(len(bilan.parcours(memoire, temoins=True)), 1)


class LeBulletinCompare(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.memoire = Memoire(Path(self.dossier.name) / "t.db")
        self.addCleanup(self.memoire.fermer)

    def _peupler(self, nombre: int, temoin: bool, hausse: float, prefixe: str):
        import dataclasses
        avant = MAINTENANT - timedelta(hours=8)
        for i in range(nombre):
            base = candidat()
            jeton = dataclasses.replace(base.jeton, adresse=f"0x{prefixe}{i:03d}")
            for quand, facteur in ((avant, 1.0), (MAINTENANT, 1.0 + hausse)):
                paire = dataclasses.replace(base.paire_principale,
                                            prix_usd=0.001 * facteur, jeton=jeton)
                c = dataclasses.replace(base, jeton=jeton, paire_principale=paire)
                self.memoire.enregistrer(c, METRIQUES, 60.0, quand, temoin=temoin)

    def test_la_comparaison_s_affiche_quand_les_deux_concluent(self):
        self._peupler(bilan.JETONS_POUR_CONCLURE, False, 0.20, "c")
        self._peupler(bilan.JETONS_POUR_CONCLURE, True, 0.05, "t")
        liste = bilan.parcours(self.memoire)
        temoins = bilan.parcours(self.memoire, temoins=True)
        texte = bilan.tableau(liste, bilan.juger(liste), MAINTENANT,
                              temoin=bilan.juger(temoins))
        self.assertIn("Témoin", texte)
        self.assertIn("+15.0 point(s)", texte)

    def test_il_refuse_de_comparer_sur_trop_peu(self):
        """Comparer deux nombres dont l'un n'est pas concluant ne l'est pas
        davantage : c'est exactement la faute que le bulletin évite déjà pour
        son propre taux."""
        self._peupler(bilan.JETONS_POUR_CONCLURE, False, 0.20, "c")
        self._peupler(2, True, 0.05, "t")
        liste = bilan.parcours(self.memoire)
        temoins = bilan.parcours(self.memoire, temoins=True)
        texte = bilan.tableau(liste, bilan.juger(liste), MAINTENANT,
                              temoin=bilan.juger(temoins))
        self.assertIn("il en faut", texte)
        self.assertNotIn("point(s)", texte)

    def test_un_bulletin_sans_temoin_reste_lisible(self):
        """Une base d'avant les témoins n'en a pas, et le bulletin doit rendre
        exactement ce qu'il rendait."""
        self._peupler(3, False, 0.20, "c")
        liste = bilan.parcours(self.memoire)
        texte = bilan.tableau(liste, bilan.juger(liste), MAINTENANT)
        self.assertNotIn("Témoin", texte)
        self.assertIn("Trop peu pour juger", texte)


if __name__ == "__main__":
    unittest.main()
