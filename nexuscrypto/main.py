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
        for pepite in retenues:
            print(messages.pepite_detectee(pepite), "\n")
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
