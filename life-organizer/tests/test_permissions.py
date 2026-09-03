#!/usr/bin/env python3
"""Les droits POSIX de ce que l'outil crée — constat I-2 de `AUDIT.md`.

Bibliothèque, quarantaine et journal contiennent, par conception, ce que la
configuration livrée nomme elle-même : relevés de compte, RIB, avis
d'imposition, décomptes de mutuelle, ordonnances, baux, cartes grises. Sous
l'umask par défaut ils naissaient en `0o755`, lisibles par tout autre compte
local — poste familial, machine d'entreprise, session partagée.

Ces tests mesurent les droits **obtenus**, jamais les paramètres passés : c'est
la leçon du constat I-1, où quatre tests verts gardaient des fichiers de
déclaration pendant que la machine faisait autre chose.
"""

import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from noyau.fichiers import (  # noqa: E402
    MODE_DOSSIER_PRIVE, MODE_FICHIER_PRIVE, creer_dossier_prive,
    mettre_en_quarantaine, ouvrir_prive,
)

# Le mode POSIX n'existe pas sur Windows : ces tests y seraient faux, pas utiles.
SANS_DROITS_POSIX = sys.platform.startswith("win")


def droits(chemin: Path) -> int:
    return stat.S_IMODE(chemin.stat().st_mode)


@unittest.skipIf(SANS_DROITS_POSIX, "le mode POSIX est ignoré sur cette plateforme")
class DossiersPrives(unittest.TestCase):
    def test_les_parents_crees_le_sont_aussi(self):
        """Le piège que le helper existe pour éviter.

        `Path.mkdir(mode=…, parents=True)` **n'applique pas le mode aux
        parents** : la bibliothèque serait privée et son dossier parent ouvert,
        ce qui laisse voir les noms de dossiers — donc les thèmes traités.
        """
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            profond = creer_dossier_prive(base / "Bibliotheque" / "Documents" / "Impots")
            for dossier in (base / "Bibliotheque", base / "Bibliotheque" / "Documents", profond):
                with self.subTest(dossier=dossier.name):
                    self.assertEqual(droits(dossier), MODE_DOSSIER_PRIVE)

    def test_un_dossier_deja_ouvert_est_resserre(self):
        """`exist_ok=True` ne touche pas un dossier déjà là.

        Sans ce rattrapage, une bibliothèque créée avant cette version garderait
        ses droits ouverts pour toujours — et personne ne le saurait.
        """
        with tempfile.TemporaryDirectory() as tmp:
            ancien = Path(tmp) / "Bibliotheque"
            ancien.mkdir(mode=0o755)
            self.assertEqual(droits(ancien), 0o755)
            creer_dossier_prive(ancien)
            self.assertEqual(droits(ancien), MODE_DOSSIER_PRIVE)

    def test_un_parent_qui_existait_deja_n_est_pas_touche(self):
        """Resserrer ce qu'on n'a pas créé serait hors du rôle de cet outil.

        Le dossier personnel, un point de montage, un disque partagé : les
        toucher parce qu'on range dedans surprendrait, et casserait peut-être
        autre chose.
        """
        with tempfile.TemporaryDirectory() as tmp:
            partage = Path(tmp) / "Partage"
            partage.mkdir(mode=0o755)
            creer_dossier_prive(partage / "Bibliotheque")
            self.assertEqual(droits(partage), 0o755, "un parent existant a été modifié")


@unittest.skipIf(SANS_DROITS_POSIX, "le mode POSIX est ignoré sur cette plateforme")
class FichiersPrives(unittest.TestCase):
    def test_un_fichier_cree_n_est_lisible_que_par_son_proprietaire(self):
        with tempfile.TemporaryDirectory() as tmp:
            trace = Path(tmp) / "journal.log"
            with ouvrir_prive(trace, encoding="utf-8") as flux:
                flux.write("ligne\n")
            self.assertEqual(droits(trace), MODE_FICHIER_PRIVE)

    def test_le_manifeste_de_quarantaine_est_prive(self):
        """Le fichier qui aggravait le constat : il consigne le chemin d'origine
        complet de chaque document écarté, donc l'arborescence personnelle."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "releve-bancaire.pdf"
            source.write_text("contenu", encoding="utf-8")

            mettre_en_quarantaine(source, base / "Quarantaine", "essai")

            racine = base / "Quarantaine"
            jour = next(racine.iterdir())
            self.assertEqual(droits(racine), MODE_DOSSIER_PRIVE)
            self.assertEqual(droits(jour), MODE_DOSSIER_PRIVE)
            self.assertEqual(droits(jour / "origines.jsonl"), MODE_FICHIER_PRIVE)


if __name__ == "__main__":
    unittest.main()
