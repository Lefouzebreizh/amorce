#!/usr/bin/env python3
"""NexusCrypto — point d'entrée.

    python3 main.py simulation                  # boucle en mode papier (défaut)
    python3 main.py simulation --une-passe      # une seule passe, puis on sort
    python3 main.py analyser                    # décide et affiche, sans exécuter
    python3 main.py pepites --requete solana    # scan d'opportunités
    python3 main.py verifier                    # valide la configuration et sort
    python3 main.py production --je-confirme    # argent réel

**Le mode réel demande deux gestes, pas un.** La sous-commande `production`
*et* le drapeau `--je-confirme`. Un seul geste serait franchissable par une
faute de frappe dans un fichier de service systemd, et ce système passe des
ordres. Le second geste n'est pas de la cérémonie : c'est la seule barrière
entre un `docker run` recopié et un compte vidé.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))

from src.core import journal as journal_module  # noqa: E402
from src.core.config import ConfigurationInvalide, charger  # noqa: E402
from src.core.modeles import Mode, maintenant  # noqa: E402
from src.core.reseau import ErreurReseau  # noqa: E402


def _arguments() -> argparse.ArgumentParser:
    analyseur = argparse.ArgumentParser(
        prog="nexuscrypto",
        description="Moteur d'investissement autonome à DCA dynamique.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    analyseur.add_argument(
        "--config", default=None, help="chemin d'un config.yaml (défaut : config/config.yaml)"
    )
    analyseur.add_argument("--env", default=None, help="chemin d'un .env")
    analyseur.add_argument(
        "--journal", default=None, help="niveau de journal (DEBUG, INFO, WARNING…)"
    )

    commandes = analyseur.add_subparsers(dest="commande", required=True)

    simulation = commandes.add_parser("simulation", help="mode papier (défaut)")
    simulation.add_argument("--une-passe", action="store_true", help="une seule passe puis sortie")
    simulation.add_argument("--passes", type=int, default=None, help="nombre de passes")

    production = commandes.add_parser("production", help="argent réel")
    production.add_argument(
        "--je-confirme",
        action="store_true",
        help="obligatoire : sans lui, la commande refuse de démarrer",
    )
    production.add_argument("--une-passe", action="store_true")
    production.add_argument("--passes", type=int, default=None)

    commandes.add_parser("verifier", help="valider la configuration et sortir")

    analyse = commandes.add_parser("analyser", help="décider et afficher, sans exécuter")
    analyse.add_argument("--json", action="store_true", help="sortie machine")

    pepites = commandes.add_parser("pepites", help="scanner d'opportunités")
    pepites.add_argument("--requete", default="solana", help="requête DexScreener")

    rejeu = commandes.add_parser(
        "rejeu", help="rejouer la stratégie sur des données passées"
    )
    rejeu.add_argument("--csv", help="fichier OHLCV (horodatage,o,h,b,c,volume)")
    rejeu.add_argument("--symbole", default="BTC/USDT", help="symbole du fichier CSV")
    rejeu.add_argument("--fear-greed", default=None, help="CSV date,indice (facultatif)")
    rejeu.add_argument(
        "--profils", action="store_true",
        help="rejouer les six marchés fabriqués au lieu d'un CSV",
    )
    rejeu.add_argument("--sortie", default=None, help="écrire un rapport Markdown")
    rejeu.add_argument(
        "--leviers", default=None,
        help="compter les liquidations qu'auraient subies ces leviers, ex. « 1,2,3,5,10 ». "
             "Mesure seulement : aucun ordre n'est jamais passé à levier.",
    )

    return analyseur


async def _lancer(config, passes: int | None) -> int:
    from src.orchestrateur import construire

    orchestrateur = await construire(config)
    try:
        await orchestrateur.boucler(passes_max=passes)
    except KeyboardInterrupt:
        print("\nArrêt demandé.")
    finally:
        await orchestrateur.fermer()
    return 0


async def _analyser(config) -> int:
    """Une passe d'analyse, sans exécution : c'est la commande qu'on lance pour
    comprendre ce que le moteur ferait avant de le laisser le faire."""

    from src.notifications import messages
    from src.orchestrateur import construire

    orchestrateur = await construire(config)
    try:
        contextes = await orchestrateur.agregateur.tous(
            config.portefeuille.symboles,
            intervalle=config.general.intervalle_bougies,
            profondeur=config.general.profondeur_bougies,
            maintenant=maintenant(),
            plateformes={
                s: l.plateforme for s, l in config.portefeuille.allocation.items()
            },
        )
        if not contextes:
            print("Aucune donnée : vérifier le réseau et les plateformes configurées.")
            return 1
        for symbole, contexte in contextes.items():
            analyse = orchestrateur.moteur.analyser(
                contexte, orchestrateur.etat.portefeuille, maintenant()
            )
            print(messages.signal(analyse.decision))
            if contexte.sources_en_panne:
                print(f"   ⚠ sources muettes : {', '.join(contexte.sources_en_panne)}")
    finally:
        await orchestrateur.fermer()
    return 0


async def _pepites(config, requete: str) -> int:
    from src.core.reseau import ClientHTTP
    from src.data_engine.onchain import SourceDexScreener, candidat_depuis_paire
    from src.notifications import messages
    from src.strategy.pepites import scanner

    client = ClientHTTP(config.reseau)
    try:
        source = SourceDexScreener(
            client,
            base=(config.sources.get("onchain") or {}).get(
                "dexscreener_api", "https://api.dexscreener.com/latest/dex"
            ),
        )
        paires = await source.rechercher(requete)
        candidats = [c for c in (candidat_depuis_paire(p) for p in paires) if c]
        retenues, rejets = scanner(candidats, config.strategie.pepites, maintenant())
        print(f"{len(candidats)} paire(s) examinée(s), {len(retenues)} retenue(s).\n")

        # Le bouclier passe sur les retenues seulement : trois appels par jeton,
        # sur trois cents candidats ce serait neuf cents requêtes pour rien. Le
        # scanner ramène déjà la liste à quelques unités, et c'est l'ordre des
        # filtres que tout ce projet respecte — le gratuit avant le payé.
        verdicts = {}
        if config.strategie.bouclier.actif:
            from src.data_engine import securite as sources
            from src.strategy import bouclier as veto
            for pepite in retenues:
                candidat = pepite.candidat
                constats = await sources.constats(
                    client, candidat.chaine, candidat.adresse,
                    delai_s=config.strategie.bouclier.delai_s,
                )
                verdicts[candidat.symbole] = veto.juger(
                    constats, config.strategie.bouclier,
                    est_evm=sources.est_evm(candidat.chaine),
                )

        for pepite in retenues:
            print(messages.pepite_detectee(pepite))
            verdict = verdicts.get(pepite.candidat.symbole)
            if verdict is not None:
                autorise, motif = veto.achat_autorise(verdict, config.strategie.bouclier)
                # Le verdict est affiché même quand il autorise : savoir qu'un
                # jeton a *passé* le bouclier vaut autant que savoir qu'il l'a
                # heurté, et une ligne absente se lirait comme un contrôle sauté.
                print(f"  {'✅' if autorise else '⛔'} {motif}")
            print()
        if not retenues:
            # Le journal des rejets est ce qui permet de régler les seuils :
            # un scanner qui rend une liste vide sans dire pourquoi se règle à
            # l'aveugle, et on finit par ouvrir les vannes en grand.
            print("Motifs de rejet les plus fréquents :")
            for symbole, motif in list(rejets.items())[:10]:
                print(f"  {symbole:<12} {motif}")
    finally:
        await client.fermer()
    return 0


def _synthese_levier(mesure, leviers, series) -> str:
    """Un scénario par ligne, et le levier maximal qu'il aurait laissé passer.

    Le tableau détaillé n'a de sens que sur une série réelle. Sur six marchés
    fabriqués, ce qu'on veut lire est le **pire** d'entre eux : un levier ne se
    choisit pas sur le marché qui l'arrange, il se choisit sur celui qui le tue.
    """

    lignes = ["### Levier — six marchés fabriqués", "",
              "| marché | levier maximal sans liquidation | pire excursion d'une position |",
              "|---|---|---|"]
    maximums = []
    for nom, resultat, serie in series:
        verdicts = mesure.analyser(resultat, serie, leviers)
        if mesure.sans_matiere(verdicts):
            lignes.append(f"| {nom} | *aucune position — rien mesuré* | — |")
            continue
        maximum = mesure.levier_maximal(verdicts)
        maximums.append(maximum if maximum is not None else 0.0)
        lots = mesure.positions(resultat, serie)
        pire = max((p.excursion for p in lots), default=0.0)
        libelle = f"{maximum:g}x" if maximum else "aucun"
        lignes.append(f"| {nom} | {libelle} | −{pire * 100:.1f} % |")

    lignes.append("")
    if not maximums:
        lignes.append("**Aucun marché n'a ouvert de position — ce tableau ne dit rien du levier.**")
        return "\n".join(lignes)
    pire = min(maximums)
    if pire <= 1.0:
        lignes.append("**Le pire de ces marchés ne laisse passer aucun levier.** "
                      "Un levier réglé sur la moyenne des six serait liquidé par le septième.")
    else:
        lignes.append(f"**Le pire de ces marchés plafonne à {pire:g}x.** "
                      "C'est ce nombre-là qui compte, pas la moyenne : on ne choisit pas "
                      "le marché dans lequel on se trouvera.")
    return "\n".join(lignes)


def _rejeu(config, arguments) -> int:
    """Rejeu sur données passées. **Aucun réseau** : c'est ce qui permet de
    régler la stratégie sur une machine hors ligne, et de le faire vite."""

    from src.rejeu import levier as mesure_levier
    from src.rejeu import rapport as mise_en_forme
    from src.rejeu.donnees import DonneesIllisibles, lire_csv, lire_fear_greed, scenarios
    from src.rejeu.rejeu import rejouer, rejouer_scenario

    leviers = None
    if arguments.leviers:
        try:
            leviers = tuple(sorted(float(x) for x in arguments.leviers.split(",") if x.strip()))
        except ValueError:
            print("❌ --leviers attend des nombres séparés par des virgules, ex. 1,2,3,5,10",
                  file=sys.stderr)
            return 2
        if not leviers:
            leviers = mesure_levier.LEVIERS_PAR_DEFAUT

    if arguments.profils or not arguments.csv:
        lignes, details, comparaisons, series = [], [], [], []
        for scenario in scenarios():
            dynamique, temoin = rejouer_scenario(config, scenario)
            lignes.append((
                scenario.nom,
                mise_en_forme.ligne_comparaison(
                    dynamique, temoin, scenario.prix_moyen_marche
                ),
            ))
            details.append(mise_en_forme.rapport_scenario(scenario, dynamique, temoin))
            comparaisons.append((scenario.nom, dynamique, temoin))
            series.append((scenario.nom, dynamique, scenario.serie))
        print(mise_en_forme.tableau(lignes))
        print()
        print(mise_en_forme.verdict(comparaisons))
        if leviers:
            print()
            print(_synthese_levier(mesure_levier, leviers, series))
        if not arguments.csv:
            print("\n(marchés fabriqués — `--csv` pour rejouer des données réelles)")
        contenu = "\n\n".join(details)
    else:
        try:
            serie = lire_csv(arguments.csv, symbole=arguments.symbole)
            indices = lire_fear_greed(arguments.fear_greed) if arguments.fear_greed else {}
        except DonneesIllisibles as erreur:
            print(f"❌ {erreur}", file=sys.stderr)
            return 2
        dynamique = rejouer(config, serie, fear_greed=indices, nom="DCA dynamique")
        temoin = rejouer(config, serie, fear_greed=indices,
                         nom="DCA plat (témoin)", plat=True)
        moyen_marche = sum(serie.clotures) / len(serie.clotures)
        ligne = mise_en_forme.ligne_comparaison(dynamique, temoin, moyen_marche)
        print(mise_en_forme.tableau([(arguments.symbole, ligne)]))
        print()
        if leviers:
            print()
            print(mesure_levier.tableau(
                mesure_levier.analyser(dynamique, serie, leviers), arguments.symbole
            ))
            print()
        if not indices:
            # Sans historique d'indice, la famille sentiment est absente et le
            # scoring redistribue son poids. Le résultat reste lisible, mais il
            # ne mesure alors que le technique — le dire évite de conclure trop.
            print("⚠ sans `--fear-greed`, la famille sentiment est absente : "
                  "seul le technique est mesuré.")
        contenu = ""
    if arguments.sortie:
        from pathlib import Path as _Path

        _Path(arguments.sortie).write_text(contenu + "\n", encoding="utf-8")
        print(f"Rapport écrit : {arguments.sortie}")
    return 0


def main(argv: list[str] | None = None) -> int:
    arguments = _arguments().parse_args(argv)
    mode = Mode.REEL if arguments.commande == "production" else Mode.SIMULATION

    # Contrôlé avant le chargement de la configuration : sinon l'absence de clé
    # d'API masque le vrai défaut, qui est le drapeau manquant, et l'utilisateur
    # part remplir un `.env` alors qu'il lui manquait sept caractères.
    if mode is Mode.REEL and not arguments.je_confirme:
        print(
            "❌ Le mode production exige `--je-confirme`.\n"
            "   Ce second geste est délibéré : il sépare un lancement voulu d'une\n"
            "   ligne de commande recopiée. Le mode simulation, lui, ne demande rien.",
            file=sys.stderr,
        )
        return 2

    try:
        config = charger(arguments.config, mode=mode, chemin_env=arguments.env)
    except ConfigurationInvalide as erreur:
        print(f"❌ {erreur}", file=sys.stderr)
        return 2

    journal_module.installer(arguments.journal or config.general.journal_niveau)

    if arguments.commande == "verifier":
        print("✅ Configuration valide.")
        print(f"   Mode           : {config.mode.value}")
        print(f"   Actifs         : {', '.join(config.portefeuille.symboles)}")
        print(f"   Capital        : {config.portefeuille.capital_initial_usd:,.0f} $")
        print(f"   Enveloppe DCA  : {config.portefeuille.enveloppe_dca_usd:,.0f} $ "
              f"({config.portefeuille.cadence_dca})")
        print(f"   Canaux         : {', '.join(config.notifications.canaux)}")
        return 0

    # Une dépendance absente ou un hôte injoignable se dit en une phrase.
    # Laisser remonter la trace ferait chercher la cause dans le code alors
    # qu'elle tient dans une ligne de `pip install`.
    def _executer(coroutine) -> int:
        try:
            return asyncio.run(coroutine)
        except ErreurReseau as erreur:
            print(f"❌ {erreur}", file=sys.stderr)
            return 3
        except KeyboardInterrupt:
            print("\nArrêt demandé.")
            return 0

    if arguments.commande == "rejeu":
        return _rejeu(config, arguments)
    if arguments.commande == "pepites":
        return _executer(_pepites(config, arguments.requete))
    if arguments.commande == "analyser":
        return _executer(_analyser(config))

    passes = 1 if getattr(arguments, "une_passe", False) else getattr(arguments, "passes", None)
    if config.mode is Mode.REEL:
        print("⚠️  MODE RÉEL — les ordres seront passés sur la plateforme "
              f"{config.execution.plateforme}.")
    else:
        print("🧪 Mode simulation — aucun ordre réel ne sera passé.")
    return _executer(_lancer(config, passes))


if __name__ == "__main__":
    raise SystemExit(main())
