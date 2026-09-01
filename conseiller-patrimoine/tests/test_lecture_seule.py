#!/usr/bin/env python3
"""Le garde-fou, et le seul test qui protège le code pas encore écrit.

Les trois premières classes éprouvent `core.lecture_seule` à l'exécution. La
quatrième est différente en nature : elle **relit le source du paquet** et
échoue si un client réseau, un SDK de plateforme d'échange ou un accès direct à
l'environnement y apparaît — y compris dans un fichier ajouté demain par
quelqu'un qui n'aura pas lu ce README.

C'est le seul verrou de ce module qui ne dépende pas de la bonne volonté de
celui qui écrit la ligne suivante.
"""

import ast
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.lecture_seule import (  # noqa: E402
    MODULES_INTERDITS, SUFFIXE_REQUIS, AccesRefuse, BaseIntrouvable,
    ouvrir_sqlite, variable,
)


RACINE = Path(__file__).resolve().parents[1]

# Les fichiers du paquet lui-même. Les tests sont exclus : ils citent
# légitimement les noms bannis pour vérifier qu'ils sont bannis.
SOURCES = sorted(
    chemin for chemin in RACINE.rglob("*.py")
    if "tests" not in chemin.relative_to(RACINE).parts
)

# Le seul fichier autorisé à toucher `sys.path` : le point d'entrée, qui doit
# s'ajouter à la racine pour que les imports absolus fonctionnent.
CHEMIN_AUTORISE = {"main.py"}

def _modules_importes(arbre: ast.AST) -> set[str]:
    modules: set[str] = set()
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.Import):
            modules.update(alias.name for alias in noeud.names)
        elif isinstance(noeud, ast.ImportFrom) and noeud.module:
            modules.add(noeud.module)
    return modules


class TestPorteUnique(unittest.TestCase):
    def test_une_variable_sans_le_suffixe_est_refusee(self):
        with self.assertRaises(AccesRefuse) as capture:
            variable("CLE_BANCAIRE")
        self.assertIn(SUFFIXE_REQUIS, str(capture.exception))

    def test_le_suffixe_ne_suffit_pas_a_faire_passer_une_cle_de_negoce(self):
        # Le second filet. Le suffixe dit l'intention ; ces motifs disent ce que
        # la chose est. Quelqu'un qui exporte cette variable croit bien faire.
        for nom in (
            "BINANCE_API_KEY_LECTURE_SEULE",
            "COMPTE_TRADING_TOKEN_LECTURE_SEULE",
            "WALLET_PRIVATE_KEY_LECTURE_SEULE",
            "API_SECRET_LECTURE_SEULE",
            "WITHDRAW_TOKEN_LECTURE_SEULE",
            "SEED_PHRASE_LECTURE_SEULE",
        ):
            with self.subTest(nom=nom), self.assertRaises(AccesRefuse):
                variable(nom)

    def test_une_variable_de_lecture_correctement_nommee_passe(self):
        import os
        os.environ["AGREGATEUR_AISP_JETON_LECTURE_SEULE"] = "abc"
        try:
            self.assertEqual(variable("AGREGATEUR_AISP_JETON_LECTURE_SEULE"), "abc")
        finally:
            del os.environ["AGREGATEUR_AISP_JETON_LECTURE_SEULE"]

    def test_une_variable_absente_rend_le_defaut(self):
        self.assertEqual(
            variable("RIEN_DU_TOUT_LECTURE_SEULE", defaut="néant"), "néant")


class TestSqlite(unittest.TestCase):
    def test_une_base_absente_leve_au_lieu_d_etre_creee(self):
        with tempfile.TemporaryDirectory() as dossier:
            manquante = Path(dossier) / "jamais.sqlite3"
            with self.assertRaises(BaseIntrouvable):
                ouvrir_sqlite(manquante)
            self.assertFalse(manquante.exists())

    def test_le_moteur_lui_meme_refuse_l_ecriture(self):
        # `mode=ro` : ce n'est pas une convention d'appel qu'on peut contourner
        # par distraction, c'est SQLite qui dit non.
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "base.sqlite3"
            connexion = sqlite3.connect(chemin)
            with connexion:
                connexion.execute("CREATE TABLE t (a INTEGER)")
            connexion.close()

            lecture = ouvrir_sqlite(chemin)
            try:
                self.assertEqual(lecture.execute("SELECT COUNT(*) FROM t").fetchone()[0], 0)
                with self.assertRaises(sqlite3.OperationalError):
                    lecture.execute("INSERT INTO t VALUES (1)")
            finally:
                lecture.close()


class TestSourceDuPaquet(unittest.TestCase):
    """Le verrou qui couvre le code pas encore écrit."""

    def test_le_paquet_a_bien_ete_trouve(self):
        # Sans ce garde-fou-ci, un `rglob` qui ne ramène rien ferait passer
        # toute cette classe au vert sans avoir rien vérifié.
        self.assertGreaterEqual(len(SOURCES), 10)

    def test_aucun_client_reseau_n_est_importe(self):
        for chemin in SOURCES:
            arbre = ast.parse(chemin.read_text(encoding="utf-8"))
            for module in _modules_importes(arbre):
                racine_module = module.split(".")[0]
                for interdit in MODULES_INTERDITS:
                    with self.subTest(fichier=chemin.name, module=module):
                        self.assertNotEqual(module, interdit)
                        self.assertNotEqual(racine_module, interdit.split(".")[0])

    def test_seul_lecture_seule_touche_a_l_environnement(self):
        # Une seule porte vers `os.environ`, et elle filtre. Un `os.getenv`
        # posé ailleurs contournerait le filtre sans que rien ne le signale.
        for chemin in SOURCES:
            if chemin.name == "lecture_seule.py":
                continue
            arbre = ast.parse(chemin.read_text(encoding="utf-8"))
            for noeud in ast.walk(arbre):
                if isinstance(noeud, ast.Attribute) and noeud.attr in ("environ", "getenv"):
                    self.fail(f"{chemin.name} lit l'environnement hors de lecture_seule.py")
                if isinstance(noeud, ast.ImportFrom) and noeud.module == "os":
                    noms = {alias.name for alias in noeud.names}
                    self.assertFalse(
                        noms & {"environ", "getenv"},
                        f"{chemin.name} importe l'environnement directement",
                    )

    def test_seul_le_point_d_entree_touche_a_sys_path(self):
        # Ajouter un chemin permettrait d'importer le code de NexusCrypto ou du
        # radar. On lit leurs fichiers ; on ne charge pas leur code.
        for chemin in SOURCES:
            if chemin.name in CHEMIN_AUTORISE:
                continue
            source = chemin.read_text(encoding="utf-8")
            with self.subTest(fichier=chemin.name):
                self.assertNotIn("sys.path", source)

    def test_aucune_ecriture_de_fichier_hors_du_point_d_entree(self):
        # `--sortie` est la seule écriture du module, et elle est explicite.
        for chemin in SOURCES:
            if chemin.name in CHEMIN_AUTORISE:
                continue
            arbre = ast.parse(chemin.read_text(encoding="utf-8"))
            for noeud in ast.walk(arbre):
                if isinstance(noeud, ast.Attribute) and noeud.attr in (
                    "write_text", "write_bytes", "mkdir", "unlink", "rmdir", "rename"
                ):
                    self.fail(f"{chemin.name} écrit sur le disque : {noeud.attr}")


if __name__ == "__main__":
    unittest.main()
