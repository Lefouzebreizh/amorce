#!/usr/bin/env python3
"""Le collecteur du volet A (README § 16 bis) : jamais de réseau ici.

Un `fetch` enregistré traverse toute la chaîne — recherche, résolution du
pool le plus liquide, bougies, écriture du CSV — exactement comme le reste de
la suite le fait pour les sources en direct du cœur.
"""

import csv
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import aides  # noqa: E402,F401 — met la racine du projet sur sys.path

from scripts.collecter_historique_pepites import (
    Candidat, ErreurCollecte, collecter, ecrire_csv, recuperer_ohlcv, resoudre_pool, sonder,
)

CANDIDAT = Candidat("TEST", "solana", "fabriqué pour le test")


def _reponse_recherche(*, deux_pools=False, chaine_differente=False, symbole_absent=False):
    def entree(adresse, reserve, chaine="solana", nom="TEST / SOL"):
        return {
            "attributes": {"address": adresse, "reserve_in_usd": str(reserve), "name": nom},
            "relationships": {"network": {"data": {"id": chaine}}},
        }

    donnees = [entree("pool-petit", 10_000)]
    if deux_pools:
        donnees.append(entree("pool-gros", 500_000))
    if chaine_differente:
        donnees.append(entree("pool-autre-chaine", 999_999, chaine="bsc"))
    if symbole_absent:
        donnees = [entree("pool-homonyme", 999_999, nom="AUTRECHOSE / SOL")]
    return {"data": donnees}


def _reponse_ohlcv(lignes):
    return {"data": {"attributes": {"ohlcv_list": lignes}}}


class FauxFetch:
    """Rend une réponse enregistrée par URL, sans toucher au réseau."""

    def __init__(self, table):
        self.table = table
        self.appels = []

    def __call__(self, url, params=None):
        self.appels.append((url, params))
        for motif, reponse in self.table:
            if motif in url:
                if isinstance(reponse, Exception):
                    raise reponse
                return reponse
        raise AssertionError(f"URL non prévue par le test : {url}")


class TestSonder(unittest.TestCase):
    def test_rend_vrai_quand_des_reseaux_sont_listes(self):
        fetch = FauxFetch([("/networks", {"data": [{"id": "eth"}]})])
        self.assertTrue(sonder(fetch))

    def test_rend_faux_sur_une_reponse_vide(self):
        fetch = FauxFetch([("/networks", {"data": []})])
        self.assertFalse(sonder(fetch))

    def test_rend_faux_sur_une_exception_reseau(self):
        fetch = FauxFetch([("/networks", ConnectionError("mandataire refusé"))])
        self.assertFalse(sonder(fetch))


class TestResoudrePool(unittest.TestCase):
    def test_prend_le_pool_le_plus_liquide(self):
        fetch = FauxFetch([("/search/pools", _reponse_recherche(deux_pools=True))])
        self.assertEqual(resoudre_pool(fetch, CANDIDAT), "pool-gros")

    def test_ignore_un_pool_dune_autre_chaine(self):
        fetch = FauxFetch([("/search/pools", _reponse_recherche(chaine_differente=True))])
        # Seul le pool "solana" doit être retenu, jamais celui de "bsc" —
        # même si sa liquidité annoncée est plus grande.
        self.assertEqual(resoudre_pool(fetch, CANDIDAT), "pool-petit")

    def test_rend_none_si_le_symbole_nest_dans_aucun_nom(self):
        fetch = FauxFetch([("/search/pools", _reponse_recherche(symbole_absent=True))])
        self.assertIsNone(resoudre_pool(fetch, CANDIDAT))

    def test_rend_none_sur_une_recherche_vide(self):
        fetch = FauxFetch([("/search/pools", {"data": []})])
        self.assertIsNone(resoudre_pool(fetch, CANDIDAT))

    def test_leve_une_erreur_de_collecte_nommee_sur_panne_reseau(self):
        fetch = FauxFetch([("/search/pools", TimeoutError("délai dépassé"))])
        with self.assertRaises(ErreurCollecte):
            resoudre_pool(fetch, CANDIDAT)


class TestRecupererOhlcv(unittest.TestCase):
    def test_trie_du_plus_ancien_au_plus_recent(self):
        # Volontairement rendues dans le désordre : le script ne doit jamais
        # faire confiance à l'ordre de l'API, faute d'avoir pu le vérifier
        # depuis cette session (voir l'en-tête du script).
        lignes = [
            [3000, 12.0, 13.0, 11.0, 12.5, 900.0],
            [1000, 10.0, 11.0, 9.0, 10.5, 1000.0],
            [2000, 11.0, 12.0, 10.0, 11.5, 800.0],
        ]
        fetch = FauxFetch([("/ohlcv/day", _reponse_ohlcv(lignes))])
        bougies = recuperer_ohlcv(fetch, CANDIDAT, "pool-quelconque")
        self.assertEqual([b[0] for b in bougies], [1000, 2000, 3000])

    def test_rend_une_liste_vide_sans_lever_si_aucune_bougie(self):
        fetch = FauxFetch([("/ohlcv/day", _reponse_ohlcv([]))])
        self.assertEqual(recuperer_ohlcv(fetch, CANDIDAT, "pool-quelconque"), [])


class TestEcrireCsv(unittest.TestCase):
    def test_le_format_se_relit_par_lire_csv(self):
        from src.rejeu.donnees import lire_csv

        bougies = [
            (1_700_000_000_000, 1.0, 1.2, 0.9, 1.1, 500.0),
            (1_700_086_400_000, 1.1, 1.3, 1.0, 1.2, 600.0),
        ]
        with TemporaryDirectory() as tmp:
            chemin = Path(tmp) / "test_solana.csv"
            ecrire_csv(chemin, bougies)
            serie = lire_csv(chemin, symbole="TEST/SOL")
            self.assertEqual(len(serie.bougies), 2)
            self.assertEqual(serie.bougies[0].cloture, 1.1)


class TestCollecter(unittest.TestCase):
    def test_un_candidat_sans_pool_ne_bloque_pas_les_autres(self):
        fetch = FauxFetch([
            ("/search/pools", {"data": []}),
        ])
        with TemporaryDirectory() as tmp:
            resultats = collecter(Path(tmp), candidats=(CANDIDAT,), fetch=fetch)
        self.assertIn("aucun pool trouvé", resultats["TEST"])

    def test_un_candidat_ecrit_bien_son_fichier(self):
        fetch = FauxFetch([
            ("/search/pools", _reponse_recherche()),
            ("/ohlcv/day", _reponse_ohlcv([[1000, 1.0, 1.1, 0.9, 1.05, 100.0]])),
        ])
        with TemporaryDirectory() as tmp:
            dossier = Path(tmp)
            resultats = collecter(dossier, candidats=(CANDIDAT,), fetch=fetch)
            self.assertTrue(resultats["TEST"].startswith("écrit"))
            fichiers = list(dossier.glob("*.csv"))
            self.assertEqual(len(fichiers), 1)
            with fichiers[0].open(encoding="utf-8") as f:
                lignes = list(csv.reader(f))
            self.assertEqual(lignes[0], ["horodatage", "ouverture", "haut", "bas", "cloture", "volume"])


if __name__ == "__main__":
    unittest.main()
