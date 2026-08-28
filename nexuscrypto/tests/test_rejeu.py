#!/usr/bin/env python3
"""Le harnais de rejeu.

Le test qui compte est `TestAucunRegardVersLAvenir`. C'est le seul défaut d'un
backtest qui ne se voit pas : une courbe magnifique et un compte vide. Tous les
autres tests de ce fichier échoueraient bruyamment ; celui-là garde une
propriété qui, si elle sautait, rendrait *meilleurs* tous les chiffres.
"""

import csv
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from aides import config

from src.core.modeles import Bougie, SerieOHLCV
from src.rejeu import rapport as mise_en_forme
from src.rejeu.donnees import (
    DonneesIllisibles, lire_coinmetrics, lire_csv, lire_fear_greed, scenarios,
)
from src.rejeu.rejeu import Resultat, config_mono_actif, rejouer, rejouer_scenario

DEBUT = datetime(2025, 1, 1, tzinfo=timezone.utc)


def serie(prix: list[float], *, symbole: str = "TEST/USDT",
          ouvertures: list[float] | None = None) -> SerieOHLCV:
    bougies = []
    for i, p in enumerate(prix):
        ouverture = ouvertures[i] if ouvertures else (prix[i - 1] if i else p)
        bougies.append(
            Bougie(
                horodatage=DEBUT + timedelta(hours=4 * i),
                ouverture=ouverture,
                haut=max(ouverture, p) * 1.005,
                bas=min(ouverture, p) * 0.995,
                cloture=p,
                volume=1000.0 + (i % 7) * 30,
            )
        )
    return SerieOHLCV(symbole=symbole, intervalle="4h", bougies=tuple(bougies))


def descente(n: int = 320, depart: float = 300.0, pente: float = -0.5) -> list[float]:
    return [max(depart + pente * i, 1.0) for i in range(n)]


class TestAucunRegardVersLAvenir(unittest.TestCase):
    """Les deux garanties qui rendent un rejeu croyable."""

    def test_une_bougie_future_ne_change_rien_au_passe(self):
        """On remplace la toute dernière clôture par un pic absurde. Si une
        seule décision antérieure bouge, c'est que la stratégie a vu l'avenir."""

        prix = descente()
        normale = rejouer(config(), serie(prix))
        trafique = list(prix)
        trafique[-1] = 10_000.0
        avec_pic = rejouer(config(), serie(trafique))

        self.assertEqual(
            [(e.horodatage, round(e.prix_execute, 9), round(e.quantite_executee, 9))
             for e in normale.executions],
            [(e.horodatage, round(e.prix_execute, 9), round(e.quantite_executee, 9))
             for e in avec_pic.executions],
        )

    def test_l_execution_se_fait_a_l_ouverture_suivante(self):
        """La clôture de *i* n'est connue qu'à l'instant où elle a lieu :
        exécuter à ce prix reviendrait à passer un ordre dans le passé."""

        prix = descente(n=260)
        # Les ouvertures sont franchement décalées des clôtures : si le
        # harnais exécutait à la clôture, aucun prix d'exécution ne
        # correspondrait à une ouverture.
        ouvertures = [p * 1.5 for p in prix]
        resultat = rejouer(config(), serie(prix, ouvertures=ouvertures))
        self.assertTrue(resultat.executions, "le scénario doit produire des ordres")

        bougies = {b.horodatage: b for b in serie(prix, ouvertures=ouvertures).bougies}
        instants = sorted(bougies)
        for execution in resultat.executions:
            suivante = bougies[instants[instants.index(execution.horodatage) + 1]]
            # Le courtier papier applique son glissement par-dessus le prix de
            # référence : on vérifie la référence, pas le prix final.
            self.assertAlmostEqual(
                execution.prix_execute / suivante.ouverture, 1.0, places=2
            )

    def test_la_derniere_bougie_n_est_jamais_executee(self):
        prix = descente()
        resultat = rejouer(config(), serie(prix))
        dernier = DEBUT + timedelta(hours=4 * (len(prix) - 1))
        self.assertTrue(all(e.horodatage < dernier for e in resultat.executions))


class TestFideliteAuDirect(unittest.TestCase):
    def test_la_fenetre_est_celle_du_direct(self):
        """Le moteur en production reçoit `profondeur_bougies` bougies. Lui en
        donner plus ici mesurerait un moteur que personne ne fera tourner.

        L'invariant est vérifié directement — la longueur de la série vue par
        le moteur — et non par un effet de bord : sur une descente régulière,
        une fenêtre de 250 et une de 600 rendent le même nombre d'ordres, et le
        test passerait alors en ne mesurant rien.
        """

        from src.strategy.moteur import Moteur

        base = config()
        profondeur = 250
        courte = replace(base, general=replace(base.general, profondeur_bougies=profondeur))

        vues: list[int] = []
        origine = Moteur.analyser

        def espion(self, contexte, portefeuille, maintenant):
            vues.append(len(contexte.serie))
            return origine(self, contexte, portefeuille, maintenant)

        Moteur.analyser = espion
        try:
            rejouer(courte, serie(descente(n=620)))
        finally:
            Moteur.analyser = origine

        self.assertTrue(vues, "le rejeu doit avoir analysé au moins une bougie")
        self.assertEqual(max(vues), profondeur)

    def test_les_frais_sont_preleves(self):
        """Un rejeu sans frais est un rejeu flatteur."""

        resultat = rejouer(config(), serie(descente()))
        self.assertGreater(resultat.frais, 0.0)

    def test_config_mono_actif(self):
        """Sans elle, rejouer un symbole hors allocation donne un poids nul,
        donc un rejeu vide dont rien ne signale la cause."""

        seule = config_mono_actif(config(), "TEST/USDT")
        self.assertEqual(list(seule.portefeuille.allocation), ["TEST/USDT"])
        self.assertAlmostEqual(seule.portefeuille.poids_de("TEST/USDT"), 1.0)


class TestTemoin(unittest.TestCase):
    def test_le_temoin_achete_sans_rien_regarder(self):
        """Il n'a ni score, ni zone, ni stop : c'est ce qui en fait un étalon."""

        prix = descente()
        temoin = rejouer(config(), serie(prix), plat=True, nom="témoin")
        self.assertTrue(temoin.executions)
        self.assertTrue(all(e.ordre.motif == "DCA plat" for e in temoin.executions))

    def test_le_temoin_respecte_le_calendrier(self):
        """Une échéance hebdomadaire sur 320 bougies de 4 h — environ 53 jours —
        ne peut pas produire plus d'une dizaine d'achats."""

        temoin = rejouer(config(), serie(descente()), plat=True)
        self.assertLessEqual(len(temoin.executions), 12)

    def test_le_temoin_ne_declenche_aucune_coupure(self):
        temoin = rejouer(config(), serie(descente()), plat=True)
        self.assertEqual(temoin.declenchements, [])


class TestMesures(unittest.TestCase):
    def test_prix_moyen_pondere_par_les_quantites(self):
        resultat = rejouer(config(), serie(descente()))
        achats = resultat.achats
        attendu = (sum(e.prix_execute * e.quantite_executee for e in achats)
                   / sum(e.quantite_executee for e in achats))
        self.assertAlmostEqual(resultat.prix_moyen_achat, attendu)

    def test_sans_achat_le_prix_moyen_est_none(self):
        """`None` et non zéro : un zéro se lirait comme « acheté gratuitement »
        et remonterait dans le tableau comme la meilleure performance."""

        vide = Resultat(nom="x", symbole="X/USDT", capital_initial=1000.0,
                        portefeuille=None)  # type: ignore[arg-type]
        self.assertIsNone(vide.prix_moyen_achat)

    def test_le_recul_max_se_mesure_depuis_le_sommet(self):
        resultat = Resultat(nom="x", symbole="X/USDT", capital_initial=100.0,
                            portefeuille=None)  # type: ignore[arg-type]
        resultat.courbe = [(DEBUT, 100.0), (DEBUT, 150.0), (DEBUT, 90.0), (DEBUT, 120.0)]
        self.assertAlmostEqual(resultat.drawdown_max, 0.4)


class TestProtection(unittest.TestCase):
    """Ce que la stratégie fait subir, et le piège de cette famille."""

    def _resultat_courbe(self, valeurs: list[float], *, capital: float = 100.0) -> Resultat:
        r = Resultat(nom="x", symbole="X/USDT", capital_initial=capital,
                     portefeuille=None)  # type: ignore[arg-type]
        r.courbe = [(DEBUT + timedelta(days=i), v) for i, v in enumerate(valeurs)]
        return r

    def test_temps_sous_eau(self):
        """Le recul max dit à quel point ça a fait mal ; celui-ci dit combien
        de temps ça a duré, et c'est la durée qui fait abandonner."""

        r = self._resultat_courbe([100.0, 120.0, 90.0, 95.0, 130.0])
        # Deux points sur cinq sont sous le sommet précédent.
        self.assertAlmostEqual(r.temps_sous_eau, 0.4)

    def test_une_courbe_qui_ne_recule_jamais(self):
        self.assertEqual(self._resultat_courbe([100.0, 110.0, 120.0]).temps_sous_eau, 0.0)

    def test_pire_mois_calendaire(self):
        r = Resultat(nom="x", symbole="X/USDT", capital_initial=100.0,
                     portefeuille=None)  # type: ignore[arg-type]
        r.courbe = [
            (datetime(2025, 1, 1, tzinfo=timezone.utc), 100.0),
            (datetime(2025, 1, 31, tzinfo=timezone.utc), 110.0),
            (datetime(2025, 2, 1, tzinfo=timezone.utc), 110.0),
            (datetime(2025, 2, 28, tzinfo=timezone.utc), 88.0),
        ]
        self.assertAlmostEqual(r.pire_mois, -0.2)

    def test_un_recul_nul_ne_donne_pas_un_ratio_infini(self):
        """N'avoir rien risqué n'est pas une performance infinie — et c'est
        exactement ce qu'une stratégie qui n'investit rien produirait."""

        r = self._resultat_courbe([100.0, 110.0, 120.0])
        self.assertEqual(r.drawdown_max, 0.0)
        self.assertIsNone(r.rendement_par_douleur)

    def test_le_ratio_remet_deux_capitaux_differents_sur_la_meme_echelle(self):
        """Un recul brut ne se compare pas entre deux stratégies qui n'engagent
        pas le même capital : celle qui investit moins a mécaniquement moins
        mal, sans être meilleure."""

        petite = self._resultat_courbe([100.0, 105.0, 102.0, 110.0])   # +10 %, recul 2,7 %
        grosse = self._resultat_courbe([100.0, 150.0, 120.0, 200.0])   # +100 %, recul 20 %
        self.assertLess(petite.drawdown_max, grosse.drawdown_max)
        # Et pourtant la grosse rend bien plus par unité de douleur.
        self.assertGreater(grosse.rendement_par_douleur, petite.rendement_par_douleur)

    def test_le_verdict_de_protection_sait_dire_non(self):
        faible = self._resultat_courbe([100.0, 105.0, 98.0, 103.0])
        fort = self._resultat_courbe([100.0, 160.0, 130.0, 190.0])
        texte = mise_en_forme.verdict_protection([("réel", faible, fort)])
        self.assertIn("ne paie pas son prix", texte)
        self.assertIn("n'investit rien a un recul nul", texte)

    def test_le_verdict_signale_un_temps_sous_l_eau_identique(self):
        """Réduire l'amplitude de la douleur sans réduire sa durée n'est pas
        la protection qu'on croit avoir achetée."""

        a = self._resultat_courbe([100.0, 120.0, 90.0, 95.0, 130.0])
        b = self._resultat_courbe([100.0, 140.0, 80.0, 90.0, 180.0])
        texte = mise_en_forme.verdict_protection([("réel", a, b)])
        self.assertIn("pas sa durée", texte)


class TestScenarios(unittest.TestCase):
    def test_deterministes(self):
        """Un profil qui bouge d'un lancement à l'autre ne mesure rien : on
        attribuerait à un réglage ce qui vient du hasard."""

        premiers = [s.serie.clotures for s in scenarios()]
        seconds = [s.serie.clotures for s in scenarios()]
        self.assertEqual(premiers, seconds)

    def test_les_six_marches_font_ce_qu_ils_annoncent(self):
        attendus = {
            "hausse continue": lambda r: r > 1.5,
            "effondrement sans reprise": lambda r: r < -0.8,
            "marché plat": lambda r: abs(r) < 0.1,
            "sommet puis effondrement": lambda r: r < -0.3,
        }
        for scenario in scenarios():
            if scenario.nom in attendus:
                self.assertTrue(
                    attendus[scenario.nom](scenario.rendement_marche),
                    f"{scenario.nom} : {scenario.rendement_marche:+.1%}",
                )

    def test_un_rejeu_de_scenario_rend_les_deux(self):
        dynamique, temoin = rejouer_scenario(config(), scenarios()[0])
        self.assertNotEqual(dynamique.nom, temoin.nom)
        self.assertTrue(temoin.executions)


class TestAucuneAbstention(unittest.TestCase):
    """Le garde-fou de la découverte du harnais.

    Sans plancher de discipline, la configuration livrée produisait **zéro
    ordre sur 398 échéances** dans une hausse continue. Ce test verrouille la
    correction : si un réglage futur ramène une abstention totale sur l'un des
    six marchés, il échoue ici et non trois mois plus tard sur un relevé.
    """

    def test_la_configuration_livree_achete_sur_les_six_marches(self):
        muets = []
        for scenario in scenarios():
            dynamique, temoin = rejouer_scenario(config(), scenario)
            if not dynamique.achats and temoin.achats:
                muets.append(scenario.nom)
        self.assertEqual(
            muets, [],
            "abstention totale — un DCA ne cesse jamais complètement d'acheter",
        )

    def test_le_plancher_livre_est_celui_qui_a_ete_mesure(self):
        """15 % est la plus petite valeur qui supprime l'abstention. La changer
        sans rejouer `profils.py`, c'est régler à l'aveugle."""

        self.assertAlmostEqual(config().strategie.dca.plancher_enveloppe, 0.15)


class TestLectureCSV(unittest.TestCase):
    def _ecrire(self, dossier: Path, lignes: list[list], entete: bool = True) -> Path:
        chemin = dossier / "donnees.csv"
        with chemin.open("w", encoding="utf-8", newline="") as f:
            ecrivain = csv.writer(f)
            if entete:
                ecrivain.writerow(["horodatage", "ouverture", "haut", "bas", "cloture", "volume"])
            ecrivain.writerows(lignes)
        return chemin

    def test_les_trois_formats_d_horodatage(self):
        """Millisecondes, secondes et ISO circulent tous les trois ; en refuser
        deux ferait convertir à la main un fichier sur deux."""

        for horodatage in (1735689600000, 1735689600, "2025-01-01T00:00:00Z"):
            with TemporaryDirectory() as dossier:
                chemin = self._ecrire(Path(dossier), [[horodatage, 1, 2, 0.5, 1.5, 10]])
                lue = lire_csv(chemin, symbole="X/USDT")
                self.assertEqual(lue.bougies[0].horodatage.year, 2025)
                self.assertEqual(lue.bougies[0].horodatage.tzinfo, timezone.utc)

    def test_sans_entete(self):
        with TemporaryDirectory() as dossier:
            chemin = self._ecrire(Path(dossier), [[1735689600000, 1, 2, 0.5, 1.5, 10]],
                                  entete=False)
            self.assertEqual(len(lire_csv(chemin, symbole="X/USDT")), 1)

    def test_une_ligne_mal_formee_arrete_la_lecture(self):
        """Une ligne avalée en silence décale tout ce qui suit et produit un
        rejeu qui a l'air juste."""

        with TemporaryDirectory() as dossier:
            chemin = self._ecrire(Path(dossier), [
                [1735689600000, 1, 2, 0.5, 1.5, 10],
                [1735704000000, 1, 2, 0.5],
            ])
            with self.assertRaises(DonneesIllisibles):
                lire_csv(chemin, symbole="X/USDT")

    def test_fichier_absent_et_fichier_vide(self):
        with TemporaryDirectory() as dossier:
            with self.assertRaises(DonneesIllisibles):
                lire_csv(Path(dossier) / "absent.csv", symbole="X/USDT")
            vide = Path(dossier) / "vide.csv"
            vide.write_text("", encoding="utf-8")
            with self.assertRaises(DonneesIllisibles):
                lire_csv(vide, symbole="X/USDT")

    def test_fear_greed_indexe_par_jour(self):
        with TemporaryDirectory() as dossier:
            chemin = Path(dossier) / "fng.csv"
            chemin.write_text("date,indice\n2025-01-01,18\n2025-01-02,55\n", encoding="utf-8")
            indices = lire_fear_greed(chemin)
            self.assertEqual(indices["2025-01-01"], 18)
            self.assertEqual(indices["2025-01-02"], 55)


COINMETRICS = (
    "time,PriceUSD,FlowInExUSD,FlowOutExUSD,SplyExUSD,volume_reported_spot_usd_1d\n"
    "2010-07-17 00:00:00,,,,,\n"                       # avant le premier prix
    "2013-01-01 00:00:00,13.5,1000,2500,50000,900\n"
    "2013-01-02 00:00:00,14.2,3000,1000,51000,1100\n"
    "2013-01-03 00:00:00,13.9,,,52000,1200\n"          # flux absents ce jour-là
)


class TestCoinMetrics(unittest.TestCase):
    """Le seul jeu de données de marché réel atteignable depuis une session
    distante — voir la section anti-blocage de `CLAUDE.md`."""

    def _fichier(self, dossier: Path, contenu: str = COINMETRICS) -> Path:
        chemin = dossier / "btc.csv"
        chemin.write_text(contenu, encoding="utf-8")
        return chemin

    def test_les_lignes_sans_prix_sont_ecartees(self):
        """Les premières années du jeu n'ont pas de prix. Les garder
        fabriquerait des bougies à zéro, que `Bougie` refuse."""

        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            self.assertEqual(len(reelle.serie), 3)
            self.assertEqual(reelle.serie.bougies[0].horodatage.date().isoformat(), "2013-01-01")

    def test_le_signe_du_flux_suit_la_convention_du_systeme(self):
        """Positif = les jetons arrivent sur les plateformes = pression
        vendeuse. C'est la première fois que cette convention se confronte à
        des flux mesurés plutôt qu'approximés par la TVL."""

        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            # Jour 1 : 1000 entrent, 2500 sortent → sortie nette, donc négatif.
            self.assertAlmostEqual(
                reelle.onchain["2013-01-01"].flux_reserves_exchanges_usd, -1500.0
            )
            # Jour 2 : 3000 entrent, 1000 sortent → entrée nette, donc positif.
            self.assertAlmostEqual(
                reelle.onchain["2013-01-02"].flux_reserves_exchanges_usd, +2000.0
            )

    def test_les_reserves_servent_de_denominateur(self):
        """Rapporter un flux à la TVL d'un protocole DeFi n'aurait aucun sens
        pour Bitcoin : c'est le montant détenu sur les plateformes qui donne
        l'échelle."""

        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            self.assertAlmostEqual(reelle.onchain["2013-01-01"].tvl_usd, 50000.0)

    def test_un_jour_sans_flux_n_a_pas_de_metrique(self):
        """Et le scoring redistribue alors le poids de la famille absente,
        exactement comme en direct."""

        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            self.assertNotIn("2013-01-03", reelle.onchain)

    def test_les_bornes_de_fenetre(self):
        with TemporaryDirectory() as dossier:
            chemin = self._fichier(Path(dossier))
            self.assertEqual(len(lire_coinmetrics(chemin, depuis="2013-01-02").serie), 2)
            self.assertEqual(len(lire_coinmetrics(chemin, jusqu_a="2013-01-01").serie), 1)
            with self.assertRaises(DonneesIllisibles):
                lire_coinmetrics(chemin, depuis="2030-01-01")

    def test_un_csv_qui_n_est_pas_du_coinmetrics_est_refuse(self):
        with TemporaryDirectory() as dossier:
            chemin = self._fichier(Path(dossier), "a,b\n1,2\n")
            with self.assertRaises(DonneesIllisibles) as capture:
                lire_coinmetrics(chemin)
            self.assertIn("PriceUSD", str(capture.exception))

    def test_l_ouverture_reprend_la_cloture_de_la_veille(self):
        """La source n'a ni haut, ni bas, ni ouverture. Chaîner les clôtures
        est la seule reconstruction qui ne fabrique pas de prix."""

        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            self.assertAlmostEqual(reelle.serie.bougies[1].ouverture, 13.5)
            self.assertAlmostEqual(reelle.serie.bougies[1].cloture, 14.2)

    def test_le_rejeu_consomme_l_onchain_du_jour(self):
        with TemporaryDirectory() as dossier:
            reelle = lire_coinmetrics(self._fichier(Path(dossier)))
            resultat = rejouer(config(), reelle.serie, onchain=reelle.onchain)
            self.assertEqual(resultat.executions, [])  # trois bougies : rien d'exploitable


class TestVerdict(unittest.TestCase):
    def _resultat(self, *, achats: bool, prix: float) -> Resultat:
        from src.core.modeles import Execution, Ordre, Sens, TypeOrdre

        resultat = Resultat(nom="x", symbole="X/USDT", capital_initial=1000.0,
                            portefeuille=None)  # type: ignore[arg-type]
        if achats:
            resultat.executions.append(
                Execution(
                    ordre=Ordre("i", "X/USDT", Sens.ACHAT, TypeOrdre.MARCHE, 1.0),
                    prix_execute=prix, quantite_executee=1.0, frais_usd=0.1,
                    horodatage=DEBUT,
                )
            )
        return resultat

    def test_une_abstention_est_un_echec_pas_un_match_nul(self):
        """C'est le pire résultat possible pour un DCA, et la première version
        de cette fonction le rangeait avec les cas sans opinion."""

        texte = mise_en_forme.verdict([
            ("hausse", self._resultat(achats=False, prix=0),
             self._resultat(achats=True, prix=100.0)),
        ])
        self.assertIn("n'achète **rien**", texte)
        self.assertIn("panne de discipline", texte)

    def test_le_verdict_signale_un_meilleur_prix_qui_gagne_moins(self):
        """Mesuré sur BTC 2022-2023 : prix 7,2 % meilleur, PnL deux fois plus
        faible, parce qu'elle engage moins. Le verdict annonçait la victoire."""

        dyn = self._resultat(achats=True, prix=80.0)
        dyn.courbe = [(DEBUT, 1000.0), (DEBUT, 1100.0)]
        tem = self._resultat(achats=True, prix=100.0)
        tem.courbe = [(DEBUT, 1000.0), (DEBUT, 1400.0)]
        texte = mise_en_forme.verdict([("2022", dyn, tem)])
        self.assertIn("gagne moins", texte)
        self.assertIn("acheter moins cher en achetant moins", texte)

    def test_le_verdict_sait_dire_que_c_est_moins_bon(self):
        texte = mise_en_forme.verdict([
            ("a", self._resultat(achats=True, prix=120.0),
             self._resultat(achats=True, prix=100.0)),
        ])
        self.assertIn("plus cher sur 1", texte)

    def test_le_verdict_sait_dire_que_c_est_meilleur(self):
        texte = mise_en_forme.verdict([
            ("a", self._resultat(achats=True, prix=80.0),
             self._resultat(achats=True, prix=100.0)),
        ])
        self.assertIn("moins cher", texte)


class TestTableau(unittest.TestCase):
    def test_colonnes_alignees_et_lisibles(self):
        dynamique, temoin = rejouer_scenario(config(), scenarios()[3])
        ligne = mise_en_forme.ligne_comparaison(dynamique, temoin, 100.0)
        rendu = mise_en_forme.tableau([("marché plat", ligne)])
        lignes = rendu.splitlines()
        self.assertEqual(len(lignes), 3)
        self.assertEqual(len(set(len(l) for l in lignes)), 1)

    def test_tableau_vide(self):
        self.assertIn("aucun", mise_en_forme.tableau([]))


if __name__ == "__main__":
    unittest.main()
