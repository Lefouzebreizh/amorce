#!/usr/bin/env python3
"""Ce que le fichier de rappels doit tenir.

Un `.ics` mal formé ne se plaint pas : l'agenda refuse de l'ouvrir, ou pire,
avale l'événement en coupant la consigne en deux. Les contrôles portent donc sur
le texte produit, ligne par ligne.
"""

import sys
import unittest
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.abonnements import alertes  # noqa: E402
from core.calendrier import echapper, evenements, plier, rendre  # noqa: E402
from core.config import charger  # noqa: E402
from core.modele import Alerte, StatutAlerte, TypeAlerte  # noqa: E402

EXEMPLE = Path(__file__).resolve().parents[1] / "admin_config.exemple.json"
LE_JOUR = date(2026, 8, 25)


def lu():
    return charger(EXEMPLE)


def fichier(configuration=None, le=LE_JOUR):
    configuration = configuration or lu()
    return rendre(evenements(configuration, alertes(configuration, le), le), le)


def lignes(texte: str) -> list[str]:
    """Les lignes dépliées, comme les lira l'agenda."""
    return texte.replace("\r\n ", "").split("\r\n")


class Echappement(unittest.TestCase):
    def test_les_signes_reserves_par_la_norme_sont_proteges(self):
        # Une virgule non protégée coupe la valeur en deux, et l'agenda affiche
        # la moitié d'une consigne.
        self.assertEqual(echapper("a, b; c"), "a\\, b\; c")

    def test_l_antislash_est_protege_en_premier(self):
        self.assertEqual(echapper("c:\\dossier"), "c:\\\\dossier")

    def test_un_retour_a_la_ligne_devient_sa_sequence(self):
        self.assertEqual(echapper("deux\nlignes"), "deux\\nlignes")


class Pliage(unittest.TestCase):
    def test_une_ligne_courte_ne_bouge_pas(self):
        self.assertEqual(plier("SUMMARY:court"), "SUMMARY:court")

    def test_une_ligne_longue_est_coupee_et_reprend_par_une_espace(self):
        plie = plier("X" * 200)
        for morceau in plie.split("\r\n")[1:]:
            self.assertTrue(morceau.startswith(" "))

    def test_aucune_ligne_ne_depasse_la_limite_en_octets(self):
        # Compter en caractères couperait au mauvais endroit dès le premier accent.
        plie = plier("é" * 200)
        for morceau in plie.split("\r\n"):
            self.assertLessEqual(len(morceau.encode("utf-8")), 75)

    def test_le_pliage_ne_coupe_jamais_un_caractere_en_deux(self):
        # Un caractère coupé produit un fichier que l'agenda refuse sans dire pourquoi.
        plie = plier("é" * 200)
        self.assertEqual(plie.replace("\r\n ", ""), "é" * 200)


class ChoixDesEvenements(unittest.TestCase):
    def test_chaque_alerte_a_venir_donne_un_evenement(self):
        self.assertEqual(len(evenements(lu(), alertes(lu(), LE_JOUR), LE_JOUR)), 4)

    def test_une_alerte_traitee_ne_va_pas_a_l_agenda(self):
        configuration = lu()
        traitees = [replace(a, statut=StatutAlerte.TRAITEE) for a in alertes(configuration, LE_JOUR)]
        self.assertEqual(evenements(configuration, traitees, LE_JOUR), [])

    def test_une_alerte_reportee_garde_sa_place(self):
        # La reporter, c'est demander à la revoir : sa date reste la bonne.
        configuration = lu()
        reportees = [replace(a, statut=StatutAlerte.REPORTEE) for a in alertes(configuration, LE_JOUR)]
        self.assertEqual(len(evenements(configuration, reportees, LE_JOUR)), 4)

    def test_une_echeance_passee_ne_va_pas_a_l_agenda(self):
        # Un événement daté d'hier ne prévient plus personne ; le tableau de bord
        # continue de l'afficher en retard.
        passee = Alerte(id="rate", type=TypeAlerte.PREAVIS, source="abonnement:edf-domicile",
                        echeance=date(2025, 9, 2), declenchement=date(2025, 7, 2))
        self.assertEqual(evenements(lu(), [passee], LE_JOUR), [])

    def test_le_titre_dit_l_action_et_le_contrat(self):
        premier = evenements(lu(), alertes(lu(), LE_JOUR), LE_JOUR)[0]
        self.assertEqual(premier.titre, "Résilier — Assurance habitation")

    def test_les_evenements_sortent_dans_l_ordre_des_dates(self):
        dates = [e.debut for e in evenements(lu(), alertes(lu(), LE_JOUR), LE_JOUR)]
        self.assertEqual(dates, sorted(dates))


class FichierProduit(unittest.TestCase):
    def test_les_fins_de_ligne_sont_celles_qu_exige_la_norme(self):
        texte = fichier()
        self.assertTrue(texte.endswith("\r\n"))
        self.assertNotIn("\n", texte.replace("\r\n", ""))

    def test_le_fichier_s_ouvre_et_se_ferme_comme_un_calendrier(self):
        decoupe = lignes(fichier())
        self.assertEqual(decoupe[0], "BEGIN:VCALENDAR")
        self.assertEqual(decoupe[-2], "END:VCALENDAR")
        self.assertEqual(decoupe.count("BEGIN:VEVENT"), decoupe.count("END:VEVENT"))

    def test_l_heure_est_flottante_sans_z_ni_fuseau(self):
        # « 8 h là où se trouve l'appareil » : c'est ce qu'on veut d'un rappel
        # personnel, et cela évite d'embarquer un bloc VTIMEZONE.
        debuts = [ligne for ligne in lignes(fichier()) if ligne.startswith("DTSTART")]
        self.assertEqual(debuts[0], "DTSTART:20260902T080000")

    def test_un_seul_evenement_par_echeance_mais_trois_sonneries(self):
        decoupe = lignes(fichier())
        self.assertEqual(decoupe.count("BEGIN:VEVENT"), 4)
        self.assertEqual(decoupe.count("BEGIN:VALARM"), 12)
        self.assertEqual([l for l in decoupe if l.startswith("TRIGGER")][:3],
                         ["TRIGGER:-P30D", "TRIGGER:-P7D", "TRIGGER:-P1D"])

    def test_la_consigne_complete_est_dans_la_description(self):
        depliees = lignes(fichier())
        description = [l for l in depliees if l.startswith("DESCRIPTION:Résilier Assurance")][0]
        self.assertIn("01/11/2026", description)
        self.assertIn("Lettre recommandée", description)

    def test_l_identifiant_est_stable_donc_une_relecture_met_a_jour(self):
        # Sans identifiant stable, chaque import ajouterait des doublons.
        identifiants = [l for l in lignes(fichier()) if l.startswith("UID:")]
        self.assertIn("UID:maif-habitation-preavis-2026-09-02@paper-manager", identifiants)

    def test_deux_generations_du_meme_jour_donnent_le_meme_fichier(self):
        # Déterminisme : on peut comparer le fichier au précédent pour voir ce
        # qui a changé, ce qu'un horodatage pris à l'heure courante interdirait.
        self.assertEqual(fichier(), fichier())

    def test_un_rappel_le_jour_meme_s_ecrit_autrement(self):
        configuration = lu()
        configuration.rappels = replace(configuration.rappels, avant_echeance_jours=[0])
        self.assertIn("TRIGGER:PT0S", lignes(fichier(configuration)))

    def test_un_calendrier_vide_reste_un_calendrier_valable(self):
        decoupe = lignes(rendre([], LE_JOUR))
        self.assertEqual(decoupe[0], "BEGIN:VCALENDAR")
        self.assertEqual(decoupe[-2], "END:VCALENDAR")
        self.assertNotIn("BEGIN:VEVENT", decoupe)


if __name__ == "__main__":
    unittest.main()
