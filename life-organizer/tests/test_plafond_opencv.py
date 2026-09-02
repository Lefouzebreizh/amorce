"""Le plafond qui garde le garde-fou, tenu sur les quatre fichiers qui installent OpenCV.

OpenCV 5 a retiré `CascadeClassifier` des liaisons Python, et avec lui la
protection « ne pas écarter une photo où un visage est reconnu ». Le code sait
dégrader — il cherche le classifieur au lieu de le supposer, et la commande
avertit avant d'analyser — mais un avertissement n'aide que si quelqu'un lit la
sortie, or ces commandes tournent en lots de plus de mille fichiers. Mesuré le
02/09/2026 : 9 portraits de famille sur 10 marqués « flous » avaient un visage
détectable.

Le plafond est donc posé. Le problème d'un plafond, c'est qu'il s'enlève sans
bruit — une mise à jour de routine, une ligne recopiée d'un autre projet — et
que rien ne tombe : les tests passent, l'outil tourne, et seules les photos en
souffrent. D'où ce fichier, qui ne mesure rien d'autre que la présence de la
borne aux QUATRE endroits qui installent ce paquet.

Trois d'entre eux ne sont pas dans ce projet. C'est voulu et c'est le cœur du
sujet : un environnement n'installe QU'UNE version d'OpenCV. Une borne posée
ici que la chaîne KDP, la CI ou le hook de démarrage contredisent ne protège
rien du tout.
"""

import io
import re
import sys
from contextlib import redirect_stdout
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DEPOT = RACINE.parent
sys.path.insert(0, str(RACINE))

PAQUET = "opencv-python-headless"

# Les quatre endroits, et ce que chacun installe.
SITES = {
    "life-organizer/requirements.txt": "le projet que le plafond protège",
    "kdp/requirements.txt": "partage l'environnement, n'a pas besoin de la 5",
    ".github/requirements-tests.txt": "la CI, qui doit éprouver le même OpenCV",
    ".claude/hooks/session-start.sh": "chaque session distante réinstalle sans lire les requirements",
}

# `<5`, `< 5`, `<5.0`, `!=5.*` — on accepte toute borne qui exclut la 5, mais
# pas l'absence de borne.
BORNE = re.compile(r"<\s*5|!=\s*5")


class PlafondOpenCV(unittest.TestCase):

    def _lignes_opencv(self, relatif: str) -> list[str]:
        chemin = DEPOT / relatif
        self.assertTrue(chemin.is_file(), f"{relatif} a disparu — la liste des sites est périmée")
        return [ligne for ligne in chemin.read_text(encoding="utf-8").splitlines()
                if PAQUET in ligne and not ligne.lstrip().startswith("#")]

    def test_les_quatre_sites_plafonnent_sous_la_5(self):
        for relatif, pourquoi in SITES.items():
            with self.subTest(fichier=relatif):
                lignes = self._lignes_opencv(relatif)
                self.assertTrue(lignes, f"{relatif} n'installe plus {PAQUET} — {pourquoi}")
                for ligne in lignes:
                    self.assertRegex(
                        ligne, BORNE,
                        f"{relatif} installe {PAQUET} sans borne haute ({pourquoi}). "
                        "OpenCV 5 retire CascadeClassifier : le garde-fou « ne pas écarter "
                        "une photo où un visage est reconnu » disparaîtrait.")

    def test_aucun_autre_fichier_n_installe_opencv_sans_borne(self):
        """La liste ci-dessus doit rester complète.

        Un cinquième site apparaîtrait sans que rien ne le dise : c'est
        exactement ainsi que la borne de `life-organizer` s'est retrouvée
        contredite par un hook qui installait à la main.
        """
        connus = {DEPOT / relatif for relatif in SITES}
        oublis = []
        for motif in ("*.txt", "*.sh", "*.toml", "*.cfg"):
            for chemin in DEPOT.rglob(motif):
                if any(p in {"node_modules", ".git", "__pycache__", ".venv"} for p in chemin.parts):
                    continue
                if chemin in connus:
                    continue
                try:
                    contenu = chemin.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                for ligne in contenu.splitlines():
                    if PAQUET in ligne and not ligne.lstrip().startswith("#") and not BORNE.search(ligne):
                        oublis.append(f"{chemin.relative_to(DEPOT)} : {ligne.strip()}")
        self.assertEqual(oublis, [], "site(s) installant OpenCV sans borne haute")


class VersionReellementInstallee(unittest.TestCase):
    """Ce que la machine fait, et non ce que les fichiers déclarent.

    Les tests de `PlafondOpenCV` tiennent la borne sur les quatre fichiers qui
    installent OpenCV. Ils passaient tous les quatre le 02/09/2026 sur une
    machine portant la **5.0.0**, sans `CascadeClassifier` : la protection
    « ne pas écarter une photo où un visage est reconnu » était inerte, et rien
    ne le disait. C'est l'écart exact entre ce que le dépôt affirme et ce que
    l'environnement exécute — l'audit l'a nommé I-1.

    La cause tenait en un `pip install opencv-python-headless` sans borne, tapé
    par une session pour tout autre chose. Le hook, lui, pose bien la borne.
    """

    def test_l_opencv_importe_livre_le_detecteur_de_visages(self):
        try:
            import cv2
        except ImportError:
            self.skipTest("OpenCV n'est pas installé : rien à vérifier ici")
        majeure = int(cv2.__version__.split(".")[0])
        self.assertLess(
            majeure, 5,
            f"OpenCV {cv2.__version__} est installé : la branche 5 a retiré "
            "`CascadeClassifier`, donc le garde-fou « visage » ne peut pas "
            "s'appliquer. Réinstaller avec « pip install 'opencv-python-headless<5' ».",
        )
        self.assertTrue(
            hasattr(cv2, "CascadeClassifier"),
            f"OpenCV {cv2.__version__} ne livre pas `CascadeClassifier` : les "
            "portraits nets marqués flous partiraient en quarantaine.",
        )


class DegradationBruyante(unittest.TestCase):
    """Le plafond est la ceinture ; l'avertissement reste les bretelles.

    Les deux tiennent ensemble : si quelqu'un retire un jour le plafond en
    connaissance de cause, la dégradation doit rester annoncée AVANT l'analyse
    — découvrir après coup qu'une protection promise n'a pas tourné, c'est
    l'apprendre une fois les photos déjà déplacées.
    """

    def test_la_commande_annonce_l_absence_du_detecteur(self):
        source = (RACINE / "modules" / "nettoyage" / "commande.py").read_text(encoding="utf-8")
        self.assertIn("detection_de_visages_disponible()", source)
        self.assertIn("ne fournit pas de détecteur de visages", source)

    def test_le_classifieur_est_cherche_et_jamais_suppose(self):
        source = (RACINE / "modules" / "nettoyage" / "traitement.py").read_text(encoding="utf-8")
        self.assertIn('getattr(cv2, "CascadeClassifier", None)', source)


class PasseSauteeSansDetecteur(unittest.TestCase):
    """Le correctif du constat I-1, éprouvé sur le comportement et non sur le source.

    Annoncer ne suffisait pas. L'avertissement s'imprimait une fois, en tête
    d'un traitement qui défile sur des milliers de fichiers, **puis l'analyse
    écartait quand même** — et 9 portraits de famille sur 10 marqués « flous »
    ont un visage détectable. Ils partaient en quarantaine, puis
    `purger_quarantaine()` les effaçait.

    La passe entière est donc abandonnée quand la protection est demandée et
    indisponible : ne rien écarter vaut mieux qu'écarter les portraits.
    """

    def _passe(self, disponible, protection):
        from modules.nettoyage import commande, traitement

        chemins = [Path("/photos/mariage.jpg"), Path("/photos/enfance.jpg")]
        vrai = traitement.detection_de_visages_disponible
        mesure_appelee = []
        vraie_mesure = traitement.mesurer_nettete
        traitement.detection_de_visages_disponible = lambda: disponible
        traitement.mesurer_nettete = lambda *a, **k: mesure_appelee.append(1) or []
        # La passe parle à l'écran : capté ici, sinon la sortie des tests se lit
        # comme un incident alors que c'est le message qu'on vérifie.
        try:
            with redirect_stdout(io.StringIO()):
                restants, octets, netteté = commande._passe_nettete(
                    chemins,
                    {"ignorer_si_visage_detecte": protection},
                    quarantaine=Path("/quarantaine"),
                    journal=_JournalMuet(),
                )
        finally:
            traitement.detection_de_visages_disponible = vrai
            traitement.mesurer_nettete = vraie_mesure
        return restants, bool(mesure_appelee)

    def test_sans_detecteur_aucune_photo_n_est_analysee_ni_ecartee(self):
        restants, mesuree = self._passe(disponible=False, protection=True)
        self.assertFalse(mesuree, "l'analyse a tourné alors que le garde-fou manquait")
        self.assertEqual(len(restants), 2, "les photos doivent toutes rester")

    def test_qui_refuse_la_protection_garde_son_analyse(self):
        """`ignorer_si_visage_detecte: false` dit explicitement de ne pas protéger."""
        _, mesuree = self._passe(disponible=False, protection=False)
        self.assertTrue(mesuree, "la passe ne doit pas être sautée sans qu'on l'ait demandée")

    def test_avec_detecteur_la_passe_tourne_normalement(self):
        _, mesuree = self._passe(disponible=True, protection=True)
        self.assertTrue(mesuree)


class _JournalMuet:
    """Le strict nécessaire : la passe ne consigne qu'en cas d'incident de lecture."""

    def incident(self, *_a, **_k):
        pass


if __name__ == "__main__":
    unittest.main()
