"""La décision « cette vidéo est abîmée », vérifiée sur des nombres.

Aucun fichier n'est décodé ici et ffmpeg n'est pas requis : c'est ce que la
séparation `regles.py` / `traitement.py` achète, et c'est ce qui permet de
vérifier un seuil sur une machine où ffmpeg n'est pas installé.

Les cas qui comptent ne sont pas « saine » et « tronquée » — ce sont les quatre
refus de trancher, parce qu'un faux positif met en quarantaine le seul
exemplaire d'un souvenir qu'on ne reverra pas avant trente jours.
"""

import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from modules.nettoyage import regles  # noqa: E402
from noyau.modele import ECARTER, GARDER, SIGNALER, Video  # noqa: E402

MAINTENANT = 1_800_000_000.0
MINUTE = regles.SECONDES_PAR_MINUTE

REGLAGES = {
    "verifier_integrite": True,
    "duree_minimale_secondes": 1.0,
    "taille_minimale_ko": 64,
    "signaler_sans_piste_video": True,
    "ignorer_si_modifiee_recemment_minutes": 5,
}


def video(
    poids=50_000_000,
    minutes_avant=1440,
    lisible=True,
    diagnostic="",
    duree=30.0,
    piste_video=True,
    erreur_de_fin=None,
    nom="vacances.mp4",
):
    return Video(
        chemin=Path(nom),
        poids_octets=poids,
        date_horodatage=MAINTENANT - minutes_avant * MINUTE,
        lisible=lisible,
        diagnostic=diagnostic,
        duree_secondes=duree,
        largeur=1920,
        hauteur=1080,
        piste_video=piste_video,
        erreur_de_fin=erreur_de_fin,
    )


class Durée(unittest.TestCase):
    def test_une_durée_non_mesurée_n_est_jamais_trop_courte(self):
        # Un MKV ou un flux enregistré n'annonce aucune durée et se lit très
        # bien : la compter pour zéro écarterait un format entier.
        self.assertFalse(regles.est_trop_courte(None, minimum=1.0))

    def test_sous_le_minimum_la_vidéo_est_trop_courte(self):
        self.assertTrue(regles.est_trop_courte(0.4, minimum=1.0))

    def test_au_minimum_exact_la_vidéo_est_gardée(self):
        self.assertFalse(regles.est_trop_courte(1.0, minimum=1.0))

    def test_une_durée_inconnue_ne_fait_pas_écarter_une_vidéo_par_ailleurs_saine(self):
        decision = regles.decider_video(video(duree=None), REGLAGES, MAINTENANT)
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("durée inconnue", decision.motif)


class FichierEnCoursDÉcriture(unittest.TestCase):
    def test_une_vidéo_tronquée_mais_modifiée_à_l_instant_est_gardée(self):
        # Un téléchargement en cours a exactement les symptômes d'un fichier
        # tronqué. L'écarter, c'est mettre en quarantaine ce que l'utilisateur
        # est en train de récupérer.
        decision = regles.decider_video(
            video(poids=1_000, minutes_avant=1, lisible=False), REGLAGES, MAINTENANT
        )
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("en cours d'écriture", decision.motif)

    def test_le_motif_du_constat_survit_au_garde_fou(self):
        # Sans lui, l'utilisateur lit « fichier peut-être en cours d'écriture »
        # sans savoir ce qui avait été constaté.
        decision = regles.decider_video(
            video(poids=1_000, minutes_avant=1, lisible=False), REGLAGES, MAINTENANT
        )
        self.assertIn("vide ou tronquée", decision.motif)

    def test_passé_le_délai_la_vidéo_tronquée_est_écartée(self):
        decision = regles.decider_video(
            video(poids=1_000, minutes_avant=30, lisible=False), REGLAGES, MAINTENANT
        )
        self.assertEqual(decision.geste, ECARTER)

    def test_un_délai_nul_désactive_la_protection(self):
        reglages = REGLAGES | {"ignorer_si_modifiee_recemment_minutes": 0}
        decision = regles.decider_video(
            video(poids=1_000, minutes_avant=0, lisible=False), reglages, MAINTENANT
        )
        self.assertEqual(decision.geste, ECARTER)

    def test_le_garde_fou_ne_retient_pas_une_vidéo_saine(self):
        # Il ne doit s'appliquer qu'à ce qui allait être écarté : sinon la
        # moitié d'un dossier fraîchement copié échapperait à l'inspection.
        decision = regles.decider_video(video(minutes_avant=1), REGLAGES, MAINTENANT)
        self.assertEqual(decision.geste, GARDER)
        self.assertNotIn("en cours d'écriture", decision.motif)


class PisteVidéoAbsente(unittest.TestCase):
    def test_un_mp4_sans_image_est_signalé_et_non_écarté(self):
        decision = regles.decider_video(video(piste_video=False), REGLAGES, MAINTENANT)
        self.assertEqual(decision.geste, SIGNALER)

    def test_le_signalement_se_désactive_sans_faire_écarter(self):
        reglages = REGLAGES | {"signaler_sans_piste_video": False}
        decision = regles.decider_video(video(piste_video=False), reglages, MAINTENANT)
        self.assertEqual(decision.geste, GARDER)


class Constats(unittest.TestCase):
    def test_un_conteneur_illisible_est_écarté_avec_le_mot_de_l_outil(self):
        decision = regles.decider_video(
            video(lisible=False, diagnostic="moov atom not found"), REGLAGES, MAINTENANT
        )
        self.assertEqual(decision.geste, ECARTER)
        self.assertIn("moov atom not found", decision.motif)

    def test_un_conteneur_illisible_sans_diagnostic_reste_explicable(self):
        decision = regles.decider_video(video(lisible=False), REGLAGES, MAINTENANT)
        self.assertIn("aucun flux exploitable", decision.motif)

    def test_une_erreur_de_décodage_en_fin_de_fichier_écarte(self):
        # Le cas du transfert interrompu : l'en-tête est intact et continue
        # d'annoncer la durée d'origine, seule la fin manque.
        decision = regles.decider_video(
            video(erreur_de_fin="Invalid NAL unit size"), REGLAGES, MAINTENANT
        )
        self.assertEqual(decision.geste, ECARTER)
        self.assertIn("fin de fichier corrompue", decision.motif)

    def test_le_fichier_vide_est_dit_vide_avant_d_être_dit_illisible(self):
        # C'est « vide » qui dit à son propriétaire s'il doit chercher une
        # sauvegarde ; « illisible » le laisse devant une énigme.
        decision = regles.decider_video(
            video(poids=0, lisible=False, diagnostic="Invalid data found"),
            REGLAGES, MAINTENANT,
        )
        self.assertIn("vide ou tronquée", decision.motif)

    def test_une_vidéo_légère_mais_lisible_est_gardée(self):
        # Le défaut trouvé sur un vrai dossier : un MKV de quatre secondes en
        # 320×240 pèse 20 ko. Faire du poids un critère de plein droit le
        # mettait en quarantaine — et son motif masquait le vrai diagnostic des
        # fichiers réellement abîmés, tous plus petits que le seuil.
        decision = regles.decider_video(
            video(poids=20_618, duree=4.0), REGLAGES, MAINTENANT
        )
        self.assertEqual(decision.geste, GARDER)

    def test_le_poids_ne_fait_que_nommer_ce_qui_est_déjà_illisible(self):
        # Au-dessus du seuil, un conteneur mort reste « illisible » et garde le
        # mot de l'outil : c'est ce mot qui dit s'il y a quelque chose à sauver.
        decision = regles.decider_video(
            video(poids=50_000_000, lisible=False, diagnostic="moov atom not found"),
            REGLAGES, MAINTENANT,
        )
        self.assertIn("illisible", decision.motif)
        self.assertNotIn("vide", decision.motif)

    def test_une_vidéo_saine_est_gardée_avec_sa_durée(self):
        decision = regles.decider_video(video(), REGLAGES, MAINTENANT)
        self.assertEqual(decision.geste, GARDER)
        self.assertIn("30 s", decision.motif)


class Décompte(unittest.TestCase):
    def test_les_trois_gestes_se_comptent_séparément(self):
        # `compter` sert la ligne de résumé : un signalement noyé dans les
        # « gardées » ne serait jamais lu.
        decisions = [
            regles.decider_video(video(nom="a.mp4"), REGLAGES, MAINTENANT),
            regles.decider_video(video(nom="b.mp4", poids=10, lisible=False), REGLAGES, MAINTENANT),
            regles.decider_video(video(nom="c.mp4", piste_video=False), REGLAGES, MAINTENANT),
        ]
        self.assertEqual(
            regles.compter(decisions), {GARDER: 1, ECARTER: 1, SIGNALER: 1}
        )

    def test_seules_les_écartées_partent_en_quarantaine(self):
        decisions = [
            regles.decider_video(video(nom="a.mp4"), REGLAGES, MAINTENANT),
            regles.decider_video(video(nom="b.mp4", poids=10, lisible=False), REGLAGES, MAINTENANT),
            regles.decider_video(video(nom="c.mp4", piste_video=False), REGLAGES, MAINTENANT),
        ]
        self.assertEqual(regles.chemins_ecartes(decisions), {Path("b.mp4")})


if __name__ == "__main__":
    unittest.main()
