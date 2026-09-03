#!/usr/bin/env python3
"""La porte unique vers le réseau, et le seul test qui couvre le code pas écrit.

Recopié du modèle éprouvé de `conseiller-patrimoine/tests/test_lecture_seule.py`,
que l'audit désignait nommément — il y avait un modèle à reprendre, pas à
inventer. Ce qui change ici : Life-Organizer **écrit** sur le disque, c'est son
métier, donc seuls les volets réseau du modèle sont repris.

Ce que le constat I-3 disait le 02/09/2026 : « la promesse est vraie
aujourd'hui, et tenue uniquement par l'absence de code. Rien ne l'empêche de
devenir fausse. » Elle l'est devenue **le lendemain** — `modules/depot/` est
arrivé avec `requests`, et l'audit n'avait pas tort d'un mot.

Ce qui a bien été fait au passage, et qui explique pourquoi ce test autorise au
lieu d'interdire : la promesse de `organizer.py` a été **bornée** en même temps,
pas laissée fausse. Elle dit désormais « aucun fichier ne quitte la machine,
sauf `deposer` si `depot.actif` est vrai ». Le garde-fou doit donc tenir cette
frontière-là — une porte, pas un mur.
"""

import ast
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]

# Les fichiers du paquet. Les tests sont exclus : ils citent légitimement les
# noms bannis pour vérifier qu'ils sont bannis.
SOURCES = sorted(
    chemin for chemin in RACINE.rglob("*.py")
    if "tests" not in chemin.relative_to(RACINE).parts
)

# La porte unique. `deposer` envoie une image ou un texte extrait à un modèle de
# vision, jamais le fichier entier, et seulement si `depot.actif` est vrai et
# qu'une clé est posée. C'est écrit dans l'aide de la commande, et c'est la
# seule sortie que l'outil s'autorise.
PORTE_RESEAU = {"modules/depot/traitement.py"}

# Ce qui ouvrirait une seconde sortie. `socket` est là parce qu'il passe sous le
# radar d'une relecture qui ne cherche que des noms de bibliothèques HTTP.
CLIENTS_RESEAU = (
    "requests", "aiohttp", "httpx", "urllib.request", "urllib3",
    "http.client", "socket", "websocket", "websockets", "ftplib",
    "smtplib", "telnetlib", "paramiko",
)


def _modules_importes(arbre: ast.AST) -> set[str]:
    modules: set[str] = set()
    for noeud in ast.walk(arbre):
        if isinstance(noeud, ast.Import):
            modules.update(alias.name for alias in noeud.names)
        elif isinstance(noeud, ast.ImportFrom) and noeud.module:
            modules.add(noeud.module)
    return modules


def _relatif(chemin: Path) -> str:
    return chemin.relative_to(RACINE).as_posix()


class FrontiereReseau(unittest.TestCase):
    def test_le_paquet_a_bien_ete_trouve(self):
        """Sans ce garde-fou, un `rglob` vide ferait passer toute la classe au vert."""
        self.assertGreaterEqual(len(SOURCES), 20)

    def test_la_porte_existe_toujours_a_l_endroit_declare(self):
        """Un fichier déplacé rendrait l'autorisation muette, et le test permissif.

        Si `modules/depot/traitement.py` est renommé, l'exception ci-dessous ne
        s'applique plus à rien — et le test suivant continuerait de passer en
        n'ayant plus rien à autoriser. Ce serait vert et faux.
        """
        for porte in PORTE_RESEAU:
            self.assertTrue((RACINE / porte).is_file(),
                            f"la porte réseau déclarée n'existe plus : {porte}")

    def test_aucun_client_reseau_hors_de_la_porte(self):
        """Le verrou qui couvre le code pas encore écrit.

        Un module ajouté demain qui importerait `requests` ouvrirait une seconde
        sortie sans que personne l'ait décidé — et l'aide de la commande
        continuerait d'annoncer une frontière qui n'existe plus.
        """
        for chemin in SOURCES:
            if _relatif(chemin) in PORTE_RESEAU:
                continue
            arbre = ast.parse(chemin.read_text(encoding="utf-8"))
            for module in _modules_importes(arbre):
                racine_module = module.split(".")[0]
                for interdit in CLIENTS_RESEAU:
                    with self.subTest(fichier=_relatif(chemin), module=module):
                        self.assertNotEqual(module, interdit)
                        self.assertNotEqual(racine_module, interdit.split(".")[0])

    def test_la_porte_reste_bornee_a_son_role(self):
        """La porte elle-même n'a le droit qu'à ce qu'elle annonce.

        `deposer` envoie une image ou un texte extrait. Un `open` en binaire sur
        le fichier d'origine suivi d'un envoi serait le contraire de la
        promesse, et ne se verrait dans aucun test de comportement.
        """
        source = (RACINE / "modules" / "depot" / "traitement.py").read_text(encoding="utf-8")
        self.assertIn("preparer_contenu", source,
                      "la porte doit passer par la préparation, jamais envoyer le fichier brut")


if __name__ == "__main__":
    unittest.main()
