#!/usr/bin/env python3
"""Chargement et validation de la configuration.

Deux principes, et le second explique la longueur de ce fichier.

**Les secrets ne se mélangent pas aux réglages.** `config.yaml` est versionné
et se relit en revue ; `.env` ne l'est pas. Rien de ce qui vient du YAML n'est
un secret, et rien de ce qui vient de l'environnement n'est un réglage.

**On refuse de démarrer plutôt que de démarrer de travers.** Une allocation
qui somme à 97 %, des pondérations de score à 1.2, un mode réel sans clé : ce
sont des erreurs qui ne se voient pas à l'exécution, elles se voient sur le
relevé de compte trois semaines plus tard. Le chargeur les attrape toutes ici,
en une passe, et rend la liste complète — pas la première.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from .modeles import Mode

RACINE = Path(__file__).resolve().parents[2]
CONFIG_DEFAUT = RACINE / "config" / "config.yaml"


class ConfigurationInvalide(Exception):
    """Levée avec la liste *complète* des défauts, pas seulement le premier.

    Corriger un fichier de configuration en cinq relances parce qu'il ne
    signale qu'une erreur à la fois est un gaspillage de temps qu'on paie à
    chaque nouvelle installation.
    """

    def __init__(self, defauts: list[str]) -> None:
        self.defauts = defauts
        detail = "\n".join(f"  - {d}" for d in defauts)
        super().__init__(f"Configuration invalide ({len(defauts)} défaut(s)) :\n{detail}")


# --------------------------------------------------------------------------
# Sections
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LigneAllocation:
    symbole: str
    poids: float
    role: str = "croissance"
    vente_sur_signal: bool = True
    plateforme: str | None = None

    @property
    def fraction(self) -> float:
        return self.poids / 100.0


@dataclass(frozen=True, slots=True)
class ConfigPortefeuille:
    capital_initial_usd: float
    enveloppe_dca_usd: float
    cadence_dca: str
    allocation: dict[str, LigneAllocation]
    reserve_decouverte_poids: float
    plafond_par_jeton_usd: float
    tolerance_derive: float

    @property
    def symboles(self) -> tuple[str, ...]:
        return tuple(self.allocation)

    def poids_de(self, symbole: str) -> float:
        ligne = self.allocation.get(symbole)
        return ligne.fraction if ligne else 0.0


@dataclass(frozen=True, slots=True)
class ConfigReseau:
    delai_secondes: float = 15.0
    tentatives: int = 3
    attente_initiale_secondes: float = 1.0
    requetes_par_minute: int = 45
    agent_utilisateur: str = "NexusCrypto/1.0"


@dataclass(frozen=True, slots=True)
class ConfigTechnique:
    rsi_periode: int = 14
    rsi_survente: float = 30.0
    rsi_surachat: float = 70.0
    ema_courte: int = 21
    ema_moyenne: int = 50
    ema_longue: int = 200
    volume_periode: int = 20


@dataclass(frozen=True, slots=True)
class ConfigDCA:
    multiplicateurs_zone: dict[str, float]
    bonus_sous_ema_longue: float = 1.3
    bonus_sous_ema_moyenne: float = 1.1
    malus_au_dessus_ema_longue: float = 0.85
    influence_score: float = 0.4
    multiplicateur_min: float = 0.0
    multiplicateur_max: float = 2.5
    score_minimum_achat: float = 45.0
    montant_minimum_usd: float = 20.0


@dataclass(frozen=True, slots=True)
class ConfigPepites:
    croissance_volume_min: float = 3.0
    liquidite_min_usd: float = 250_000
    age_minimum_heures: float = 72
    variation_liquidite_24h_min: float = 0.15
    capitalisation_max_usd: float = 300_000_000
    score_minimum: float = 65
    candidats_max: int = 5


@dataclass(frozen=True, slots=True)
class ConfigStrategie:
    poids: dict[str, float]
    redistribuer_poids_absents: bool
    technique: ConfigTechnique
    dca: ConfigDCA
    pepites: ConfigPepites


@dataclass(frozen=True, slots=True)
class ConfigCoupeCircuit:
    drawdown_journalier_max: float = 0.07
    drawdown_total_max: float = 0.25
    chute_marche_1h: float = 0.12
    suspendre_sur_actualite_critique: bool = True
    echecs_reseau_max: int = 5
    refroidissement_minutes: float = 180


@dataclass(frozen=True, slots=True)
class ConfigRisque:
    risque_par_position: float = 0.01
    exposition_max_par_actif: float = 0.55
    atr_periode: int = 14
    atr_multiple_stop: float = 2.5
    trailing_activation: float = 0.20
    trailing_distance: float = 0.12
    coupe_circuit: ConfigCoupeCircuit = field(default_factory=ConfigCoupeCircuit)


@dataclass(frozen=True, slots=True)
class ConfigSimulation:
    frais_taker: float = 0.001
    frais_maker: float = 0.0002
    glissement_base: float = 0.0005
    part_carnet_max: float = 0.1


@dataclass(frozen=True, slots=True)
class ConfigExecution:
    plateforme: str = "binance"
    type_ordre: str = "marche"
    simulation: ConfigSimulation = field(default_factory=ConfigSimulation)
    glissement_max_tolere: float = 0.01


@dataclass(frozen=True, slots=True)
class ConfigNotifications:
    canaux: tuple[str, ...] = ("console",)
    alerter_sur: tuple[str, ...] = ("signal", "ordre", "coupe_circuit", "recapitulatif")
    heure_recapitulatif: int = 18


@dataclass(frozen=True, slots=True)
class ConfigGeneral:
    devise: str = "USDT"
    intervalle_bougies: str = "4h"
    profondeur_bougies: int = 300
    periode_boucle_secondes: float = 3600
    journal_niveau: str = "INFO"


@dataclass(frozen=True, slots=True)
class Secrets:
    """Ce qui vient de l'environnement. Jamais journalisé, jamais notifié.

    `__repr__` est réécrit exprès : un `logger.debug(config)` bien intentionné
    a déjà suffi, ailleurs, à publier un jeton dans un fichier de journal
    ensuite envoyé en pièce jointe.
    """

    valeurs: Mapping[str, str] = field(default_factory=dict)

    def __repr__(self) -> str:
        return f"Secrets({len(self.valeurs)} valeur(s) chargée(s), contenu masqué)"

    def get(self, cle: str) -> str | None:
        valeur = self.valeurs.get(cle) or os.environ.get(cle)
        return valeur or None

    def presents(self, *cles: str) -> bool:
        return all(self.get(c) for c in cles)


@dataclass(frozen=True, slots=True)
class Config:
    mode: Mode
    general: ConfigGeneral
    portefeuille: ConfigPortefeuille
    sources: dict[str, Any]
    reseau: ConfigReseau
    strategie: ConfigStrategie
    risque: ConfigRisque
    execution: ConfigExecution
    notifications: ConfigNotifications
    secrets: Secrets

    @property
    def simule(self) -> bool:
        return self.mode is Mode.SIMULATION


# --------------------------------------------------------------------------
# Lecture
# --------------------------------------------------------------------------


def _charger_yaml(chemin: Path) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as erreur:  # pragma: no cover - dépend de l'installation
        raise ConfigurationInvalide(
            ["PyYAML n'est pas installé : `pip install -r requirements.txt`."]
        ) from erreur

    if not chemin.exists():
        raise ConfigurationInvalide([f"Fichier de configuration introuvable : {chemin}"])

    contenu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    if not isinstance(contenu, dict):
        raise ConfigurationInvalide([f"{chemin} ne contient pas un dictionnaire."])
    return contenu


def _charger_env(chemin: Path | None) -> dict[str, str]:
    """Lecture d'un `.env` sans dépendance.

    `python-dotenv` fait la même chose, mais le faire ici évite qu'une absence
    de dépendance empêche de *lire* la configuration — or c'est exactement ce
    qu'on veut pouvoir faire pour diagnostiquer une installation cassée.
    """

    valeurs: dict[str, str] = {}
    if chemin is None or not chemin.exists():
        return valeurs
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, _, valeur = ligne.partition("=")
        valeurs[cle.strip()] = valeur.strip().strip('"').strip("'")
    return valeurs


def _depuis(classe, source: Mapping[str, Any], **forces: Any):
    """Construit une dataclasse de configuration à partir d'un dictionnaire YAML.

    Ne retient que les clés déclarées par la classe — une clé en trop dans le
    YAML est ignorée plutôt que fatale — et convertit chaque valeur d'après
    l'annotation. Écrire cette conversion à la main pour chaque section a été
    essayé : huit blocs de compréhension quasi identiques, et deux d'entre eux
    convertissaient déjà `int` en `float` par distraction.
    """

    conversions = {"int": int, "float": float, "bool": bool, "str": str}
    arguments: dict[str, Any] = {}
    for cle, annotation in classe.__annotations__.items():
        if cle in forces:
            arguments[cle] = forces[cle]
            continue
        if cle not in source:
            continue
        convertir = conversions.get(str(annotation))
        arguments[cle] = convertir(source[cle]) if convertir else source[cle]
    return classe(**arguments)


def _flottant(source: Mapping[str, Any], cle: str, defaut: float) -> float:
    valeur = source.get(cle, defaut)
    return float(valeur)


def _section(brut: Mapping[str, Any], nom: str) -> dict[str, Any]:
    valeur = brut.get(nom) or {}
    return dict(valeur) if isinstance(valeur, Mapping) else {}


def charger(
    chemin: Path | str | None = None,
    *,
    mode: Mode = Mode.SIMULATION,
    chemin_env: Path | str | None = None,
) -> Config:
    """Charge, valide, et rend une configuration utilisable — ou lève avec la
    liste complète de ce qui ne va pas."""

    chemin = Path(chemin) if chemin else CONFIG_DEFAUT
    brut = _charger_yaml(chemin)
    env = _charger_env(Path(chemin_env) if chemin_env else RACINE / ".env")
    defauts: list[str] = []

    general = _depuis(ConfigGeneral, _section(brut, "general"))

    # -- Portefeuille --------------------------------------------------------
    brut_pf = _section(brut, "portefeuille")
    brut_alloc = brut_pf.get("allocation") or {}
    lignes: dict[str, LigneAllocation] = {}
    for symbole, details in brut_alloc.items():
        if not isinstance(details, Mapping) or "poids" not in details:
            defauts.append(f"Allocation « {symbole} » : il manque un poids.")
            continue
        lignes[symbole] = LigneAllocation(
            symbole=symbole,
            poids=float(details["poids"]),
            role=str(details.get("role", "croissance")),
            vente_sur_signal=bool(details.get("vente_sur_signal", True)),
            plateforme=details.get("plateforme"),
        )

    reserve = _section(brut_pf, "reserve_decouverte")
    poids_reserve = _flottant(reserve, "poids", 0.0)
    somme = sum(l.poids for l in lignes.values()) + poids_reserve
    if lignes and abs(somme - 100.0) > 1e-6:
        defauts.append(
            f"L'allocation somme à {somme:g} % au lieu de 100 % — "
            f"{100 - somme:+g} % de capital ne serait réclamé par personne."
        )
    if not lignes:
        defauts.append("Aucune ligne d'allocation : le portefeuille cible est vide.")

    portefeuille = ConfigPortefeuille(
        capital_initial_usd=_flottant(brut_pf, "capital_initial_usd", 0.0),
        enveloppe_dca_usd=_flottant(brut_pf, "enveloppe_dca_usd", 0.0),
        cadence_dca=str(brut_pf.get("cadence_dca", "hebdomadaire")),
        allocation=lignes,
        reserve_decouverte_poids=poids_reserve,
        plafond_par_jeton_usd=_flottant(reserve, "plafond_par_jeton_usd", 0.0),
        tolerance_derive=_flottant(brut_pf, "tolerance_derive", 0.05),
    )
    if portefeuille.cadence_dca not in {"quotidienne", "hebdomadaire", "mensuelle"}:
        defauts.append(
            f"Cadence DCA inconnue : « {portefeuille.cadence_dca} » "
            "(quotidienne, hebdomadaire ou mensuelle)."
        )
    if portefeuille.capital_initial_usd <= 0:
        defauts.append("Le capital initial doit être strictement positif.")
    if portefeuille.enveloppe_dca_usd <= 0:
        defauts.append("L'enveloppe DCA doit être strictement positive.")

    # -- Stratégie -----------------------------------------------------------
    brut_strat = _section(brut, "strategie")
    poids = {k: float(v) for k, v in (brut_strat.get("poids") or {}).items()}
    attendus = {"technique", "sentiment", "onchain"}
    if set(poids) != attendus:
        manquants = attendus - set(poids)
        surplus = set(poids) - attendus
        if manquants:
            defauts.append(f"Poids de score manquants : {', '.join(sorted(manquants))}.")
        if surplus:
            defauts.append(f"Poids de score inconnus : {', '.join(sorted(surplus))}.")
    elif abs(sum(poids.values()) - 1.0) > 1e-6:
        defauts.append(
            f"Les poids du score somment à {sum(poids.values()):g} au lieu de 1.0."
        )

    brut_dca = _section(brut_strat, "dca")
    multiplicateurs = {
        str(k): float(v) for k, v in (brut_dca.get("multiplicateurs_zone") or {}).items()
    }
    zones_attendues = {"peur_extreme", "peur", "neutre", "avidite", "avidite_extreme"}
    if multiplicateurs and set(multiplicateurs) != zones_attendues:
        defauts.append(
            "Multiplicateurs DCA : il faut exactement les cinq zones "
            f"({', '.join(sorted(zones_attendues))})."
        )
    dca = _depuis(
        ConfigDCA,
        brut_dca,
        multiplicateurs_zone=multiplicateurs or {z: 1.0 for z in zones_attendues},
    )
    if dca.multiplicateur_min > dca.multiplicateur_max:
        defauts.append("DCA : le multiplicateur minimum dépasse le maximum.")
    if dca.influence_score >= 1 / 3:
        # Démonstration dans le bloc d'en-tête de `strategy/dca.py` : au-delà
        # d'un tiers, un bon score en zone neutre achète plus qu'un mauvais
        # score en peur extrême, et la zone de valorisation cesse d'être le
        # signal dominant du DCA.
        defauts.append(
            f"DCA : influence_score à {dca.influence_score:g} — au-delà de 0,333 le score "
            "domine la zone de valorisation, ce qu'un DCA doit refuser."
        )

    technique = _depuis(ConfigTechnique, _section(brut_strat, "technique"))
    if not technique.ema_courte < technique.ema_moyenne < technique.ema_longue:
        defauts.append(
            "Les trois EMA doivent être strictement croissantes "
            f"(reçu {technique.ema_courte}, {technique.ema_moyenne}, {technique.ema_longue})."
        )

    pepites = _depuis(ConfigPepites, _section(brut_strat, "pepites"))

    strategie = ConfigStrategie(
        poids=poids or {"technique": 0.5, "sentiment": 0.2, "onchain": 0.3},
        redistribuer_poids_absents=bool(brut_strat.get("redistribuer_poids_absents", True)),
        technique=technique,
        dca=dca,
        pepites=pepites,
    )

    # -- Risque --------------------------------------------------------------
    brut_risque = _section(brut, "risque")
    coupe = _depuis(ConfigCoupeCircuit, _section(brut_risque, "coupe_circuit"))
    risque = _depuis(ConfigRisque, brut_risque, coupe_circuit=coupe)
    if not 0 < risque.risque_par_position <= 0.1:
        defauts.append(
            f"Risque par position à {risque.risque_par_position:.1%} : "
            "au-delà de 10 %, une série de cinq pertes efface le compte."
        )
    if not 0 < coupe.drawdown_journalier_max < 1:
        defauts.append("Le drawdown journalier maximal doit être une fraction entre 0 et 1.")

    # -- Exécution -----------------------------------------------------------
    brut_exec = _section(brut, "execution")
    simulation = _depuis(ConfigSimulation, _section(brut_exec, "simulation"))
    execution = ConfigExecution(
        plateforme=str(brut_exec.get("plateforme", "binance")),
        type_ordre=str(brut_exec.get("type_ordre", "marche")),
        simulation=simulation,
        glissement_max_tolere=_flottant(brut_exec, "glissement_max_tolere", 0.01),
    )

    # -- Notifications -------------------------------------------------------
    brut_notif = _section(brut, "notifications")
    canaux = tuple(brut_notif.get("canaux") or ("console",))
    connus = {"console", "telegram", "discord"}
    for canal in canaux:
        if canal not in connus:
            defauts.append(f"Canal de notification inconnu : « {canal} ».")
    notifications = ConfigNotifications(
        canaux=canaux,
        alerter_sur=tuple(brut_notif.get("alerter_sur") or ()),
        heure_recapitulatif=int(brut_notif.get("heure_recapitulatif", 18)),
    )

    secrets = Secrets(valeurs=env)

    # -- Cohérence mode / secrets -------------------------------------------
    #
    # C'est la vérification la plus importante du fichier. Passer en réel sans
    # clé ne lève pas au démarrage si on ne le vérifie pas ici : ça lève au
    # premier ordre, c'est-à-dire après que la stratégie a déjà décidé.
    if mode is Mode.REEL:
        plateforme = execution.plateforme.upper()
        if not secrets.presents(f"{plateforme}_API_KEY", f"{plateforme}_API_SECRET"):
            defauts.append(
                f"Mode réel demandé mais {plateforme}_API_KEY / {plateforme}_API_SECRET "
                "sont absents du `.env`."
            )
    if "telegram" in canaux and not secrets.presents("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"):
        defauts.append("Canal Telegram activé mais TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID absents.")
    if "discord" in canaux and not secrets.presents("DISCORD_WEBHOOK_URL"):
        defauts.append("Canal Discord activé mais DISCORD_WEBHOOK_URL absent.")

    if defauts:
        raise ConfigurationInvalide(defauts)

    return Config(
        mode=mode,
        general=general,
        portefeuille=portefeuille,
        sources=_section(brut, "sources"),
        reseau=_depuis(ConfigReseau, _section(brut, "reseau")),
        strategie=strategie,
        risque=risque,
        execution=execution,
        notifications=notifications,
        secrets=secrets,
    )
