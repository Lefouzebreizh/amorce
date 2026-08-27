#!/usr/bin/env python3
"""Le chemin par modèle de vision, éprouvé sans réseau.

Un client de substitution enregistre ce qui lui est demandé : cela vérifie la
requête construite, la validation de ce qui revient et la fusion avec ce que les
motifs avaient trouvé. Ce qui n'est **pas** vérifié ici est dit dans le README :
qu'un vrai appel à l'API rende bien cette forme-là.
"""

import base64
import sys
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.extraction import (  # noqa: E402
    ErreurVision, Vision, champs_de, champs_de_modele, completer, extraire,
    lire_par_modele, _bloc_image,
)
from core.modele import Nature  # noqa: E402
from core.scan import Lecture  # noqa: E402

LE_JOUR = date(2026, 8, 27)
CONNUS = {"EDF": {"categorie": "energie", "motif": r"(?i)\bEDF\b"}}


class FauxClient:
    """Retient ce qu'on lui demande, et rend ce qu'on lui a dit de rendre."""

    def __init__(self, rendu=None, erreur=None):
        self.rendu = rendu or {}
        self.erreur = erreur
        self.appels = []

    @property
    def messages(self):
        return self

    def parse(self, **arguments):
        self.appels.append(arguments)
        if self.erreur is not None:
            raise self.erreur
        return SimpleNamespace(parsed_output=SimpleNamespace(**self.rendu))


def image(dossier: Path, nom: str = "page-1.png") -> Path:
    chemin = dossier / nom
    document = pymupdf.open()
    document.new_page(width=200, height=200).get_pixmap().save(chemin)
    document.close()
    return chemin


class RequeteConstruite(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name)

    def test_une_page_devient_un_bloc_image_avec_son_type(self):
        bloc = _bloc_image(image(self.chemin))
        self.assertEqual(bloc["type"], "image")
        self.assertEqual(bloc["source"]["media_type"], "image/png")
        self.assertTrue(base64.standard_b64decode(bloc["source"]["data"]).startswith(b"\x89PNG"))

    def test_un_format_que_le_modele_n_accepte_pas_est_refuse_avant_l_envoi(self):
        # Mieux vaut le dire ici qu'après un aller-retour payant.
        exotique = self.chemin / "page.tiff"
        exotique.write_bytes(b"II*\x00")
        with self.assertRaises(ErreurVision) as leve:
            _bloc_image(exotique)
        self.assertIn(".png", str(leve.exception))

    def test_chaque_page_est_jointe_et_l_invite_vient_en_dernier(self):
        client = FauxClient({"emetteur": "EDF"})
        lire_par_modele([image(self.chemin, "p1.png"), image(self.chemin, "p2.png")],
                        client=client)
        contenu = client.appels[0]["messages"][0]["content"]
        self.assertEqual([bloc["type"] for bloc in contenu], ["image", "image", "text"])
        self.assertIn("document administratif français", contenu[-1]["text"])

    def test_le_modele_demande_est_celui_de_la_configuration(self):
        client = FauxClient({})
        lire_par_modele([image(self.chemin)], modele="claude-opus-5", client=client)
        self.assertEqual(client.appels[0]["model"], "claude-opus-5")

    def test_sans_page_rendue_il_n_y_a_rien_a_montrer(self):
        with self.assertRaises(ErreurVision):
            lire_par_modele([], client=FauxClient({}))

    def test_une_panne_de_l_api_devient_une_erreur_qui_dit_la_cause(self):
        # Clé absente, quota, réseau coupé : la cause change, la conduite non.
        client = FauxClient(erreur=RuntimeError("authentication_error: invalid x-api-key"))
        with self.assertRaises(ErreurVision) as leve:
            lire_par_modele([image(self.chemin)], client=client)
        self.assertIn("invalid x-api-key", str(leve.exception))


class ValidationDeCeQuiRevient(unittest.TestCase):
    """Ce que le modèle rend traverse les mêmes contrôles que les motifs."""

    def champs(self, **bruts):
        complet = {"emetteur": "", "nature": "", "montant": "",
                   "date_emission": "", "date_limite": "", "reference": ""}
        return champs_de_modele({**complet, **bruts}, CONNUS, LE_JOUR)

    def test_un_emetteur_connu_recupere_sa_categorie(self):
        champs = self.champs(emetteur="EDF")
        self.assertEqual(champs.emetteur, "EDF")
        self.assertEqual(champs.categorie, "energie")

    def test_un_emetteur_inconnu_est_garde_mais_sans_categorie(self):
        champs = self.champs(emetteur="Société Truc")
        self.assertEqual(champs.emetteur, "Société Truc")
        self.assertEqual(champs.categorie, "divers")

    def test_un_montant_est_relu_par_notre_analyseur_et_non_pris_tel_quel(self):
        self.assertEqual(self.champs(montant="1 234,56").montant, Decimal("1234.56"))

    def test_un_montant_absurde_devient_une_absence(self):
        # Ce qui ne passe pas la validation ne devient pas un champ.
        self.assertIsNone(self.champs(montant="12345678,90").montant)

    def test_une_date_dans_le_futur_est_ecartee_comme_ailleurs(self):
        self.assertIsNone(self.champs(date_emission="2030-01-01").date_emission)

    def test_une_nature_hors_de_la_liste_ne_passe_pas(self):
        self.assertIs(self.champs(nature="bon de commande").nature, Nature.INCONNUE)

    def test_une_nature_de_la_liste_passe(self):
        self.assertIs(self.champs(nature="facture").nature, Nature.FACTURE)


class FusionAvecLesMotifs(unittest.TestCase):
    def test_le_modele_comble_les_trous(self):
        motifs = champs_de("Net à payer 78,42 €", CONNUS, LE_JOUR)
        self.assertNotIn("emetteur", motifs.trouvailles)
        fondu = completer(motifs, champs_de_modele(
            {"emetteur": "EDF", "reference": "ABC123"}, CONNUS, LE_JOUR))
        self.assertEqual(fondu.emetteur, "EDF")
        self.assertEqual(fondu.categorie, "energie")

    def test_le_modele_n_ecrase_jamais_un_champ_etiquete(self):
        # Un champ lu derrière son étiquette se retrouve en rouvrant le document ;
        # un champ rendu par un modèle, non. Échanger le premier contre le second
        # serait troquer du sûr contre du probable.
        motifs = champs_de("Net à payer 78,42 €", CONNUS, LE_JOUR)
        self.assertEqual(motifs.montant, Decimal("78.42"))
        fondu = completer(motifs, champs_de_modele({"montant": "999,00"}, CONNUS, LE_JOUR))
        self.assertEqual(fondu.montant, Decimal("78.42"))
        self.assertEqual(fondu.trouvailles["montant"], "etiquete")

    def test_un_champ_du_modele_pese_moins_qu_un_champ_etiquete(self):
        etiquete = champs_de(
            "EDF\nDate de facture : 14/03/2026\nNet à payer 78,42 €", CONNUS, LE_JOUR)
        par_modele = champs_de_modele(
            {"emetteur": "EDF", "date_emission": "2026-03-14", "montant": "78,42"},
            CONNUS, LE_JOUR)
        self.assertGreater(etiquete.confiance, par_modele.confiance)

    def test_un_champ_du_modele_pese_plus_qu_un_champ_ramasse_au_hasard(self):
        ramasse = champs_de("78,42 € quelque part", CONNUS, LE_JOUR)
        par_modele = champs_de_modele({"montant": "78,42"}, CONNUS, LE_JOUR)
        self.assertGreater(par_modele.confiance, ramasse.confiance)


class QuandLeModelePart(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.addCleanup(self.dossier.cleanup)
        self.chemin = Path(self.dossier.name)

    def lecture(self, texte="", images=()):
        return Lecture(chemin=Path("f.pdf"), format="pdf", empreinte="abc", pages=1,
                       texte=texte, images=list(images))

    def test_un_document_dont_le_texte_a_tout_donne_n_appelle_pas_le_modele(self):
        # Un aller-retour payant pour rien.
        client = FauxClient({"emetteur": "EDF"})
        complet = ("EDF\nRéférence client : 012345678\nDate de facture : 14/03/2026\n"
                   "Net à payer 78,42 €\nDate limite de paiement : 05/04/2026\n")
        extraire(self.lecture(complet, [image(self.chemin)]), CONNUS, LE_JOUR,
                 vision=Vision(client=client), seuil=0.75)
        self.assertEqual(client.appels, [])

    def test_un_scan_sans_texte_fait_partir_le_modele(self):
        client = FauxClient({"emetteur": "EDF", "montant": "78,42",
                             "date_emission": "2026-03-14", "nature": "facture"})
        document = extraire(self.lecture("", [image(self.chemin)]), CONNUS, LE_JOUR,
                            vision=Vision(client=client), seuil=0.75)
        self.assertEqual(len(client.appels), 1)
        self.assertEqual(document.emetteur, "EDF")
        self.assertEqual(document.montant, Decimal("78.42"))
        self.assertEqual(document.categorie, "energie")

    def test_sans_page_rendue_le_modele_ne_part_pas(self):
        # `scan.py` ne rend les pages que faute de texte utile : pas d'image
        # veut dire qu'il y avait du texte, et les motifs ont eu leur chance.
        client = FauxClient({})
        extraire(self.lecture("trop court"), CONNUS, LE_JOUR,
                 vision=Vision(client=client), seuil=0.75)
        self.assertEqual(client.appels, [])

    def test_sans_vision_configuree_rien_ne_part(self):
        document = extraire(self.lecture("", [image(self.chemin)]), CONNUS, LE_JOUR)
        self.assertEqual(document.confiance, 0.0)

    def test_une_panne_du_modele_remonte_plutot_que_de_ranger_a_moitie(self):
        # Le modèle n'a été appelé que parce que les motifs ne suffisaient pas :
        # le document part à relire de toute façon, autant dire pourquoi.
        client = FauxClient(erreur=RuntimeError("rate_limit_error"))
        with self.assertRaises(ErreurVision):
            extraire(self.lecture("", [image(self.chemin)]), CONNUS, LE_JOUR,
                     vision=Vision(client=client), seuil=0.75)


if __name__ == "__main__":
    unittest.main()
