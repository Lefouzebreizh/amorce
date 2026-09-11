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
class LigneSurveillee:
    """Un actif que le moteur regarde à chaque passe, sans montant ni
    calendrier imposés — c'est le score qui décide, jamais le fichier.

    Jusqu'au 10/09/2026 cette ligne portait un `poids` d'allocation cible :
    retiré avec le DCA calendaire qui seul en avait besoin. Ce qui reste sert
    encore : `vente_sur_signal` protège un socle qu'on ne veut jamais voir
    sortir sur un simple stop, `chaine`/`adresse` arment le bouclier
    anti-rugpull quand l'actif en a un, `plafond_usd` borne une ligne
    spécifique — un jeton plus risqué qu'un LINK ou un BTC — sans attendre
    qu'elle soit découverte par le scanner.
    """

    symbole: str
    role: str = "watchlist"
    vente_sur_signal: bool = True
    plateforme: str | None = None
    # Chaîne et contrat, pour les jetons qu'on peut désigner sur une chaîne.
    # Absents sur un actif établi acheté sur une plateforme centralisée : LINK
    # n'a pas de contrat à auditer dans ce contexte, et exiger une adresse pour
    # lui ferait refuser un achat parfaitement légitime.
    chaine: str | None = None
    adresse: str | None = None
    # Plafond spécifique à cette ligne, tous renforcements compris. `None` :
    # seuls l'exposition maximale et la trésorerie bornent l'achat — c'est le
    # cas normal d'un actif établi (BTC, ETH...).
    plafond_usd: float | None = None


@dataclass(frozen=True, slots=True)
class ConfigPortefeuille:
    """Retiré le 10/09/2026, avec la logique DCA calendaire qui les
    utilisait : `enveloppe_dca_usd`, `cadence_dca`, `reserve_decouverte_poids`,
    `plafond_par_jeton_usd` (déplacé sur `ConfigPepites`, une notion propre
    aux jetons découverts par le scanner) et `tolerance_derive` (n'avait de
    sens que contre un poids cible, qui n'existe plus)."""

    capital_initial_usd: float
    watchlist: dict[str, LigneSurveillee]

    @property
    def symboles(self) -> tuple[str, ...]:
        return tuple(self.watchlist)


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
    # Noter l'écart à l'EMA longue par rapport à sa **propre distribution**
    # plutôt que sur des seuils absolus. Voir `cote_z_ecart_ema`.
    ecart_ema_relatif: bool = True


@dataclass(frozen=True, slots=True)
class ConfigPepites:
    croissance_volume_min: float = 3.0
    liquidite_min_usd: float = 250_000
    age_minimum_heures: float = 72
    variation_liquidite_24h_min: float = 0.15
    # Aligné le 11/09/2026 sur `pepites/config/reglages.yaml` (30 M$) : les deux
    # modules visaient le même mot « pépite » avec un plafond dix fois plus
    # large ici, trouvé en préparant le branchement du scanner dans la boucle
    # en direct. Au-delà, ce n'est plus une pépite, c'est un actif déjà établi.
    capitalisation_max_usd: float = 30_000_000
    score_minimum: float = 65
    candidats_max: int = 5
    # Ratio volume 24 h / capitalisation — un signal indépendant de
    # `croissance_volume` : celui-ci compare le jeton à lui-même, celui-là le
    # compare à sa propre taille. En dessous de `bas`, personne ne s'y
    # intéresse ; entre `bas` et `sain`, la note monte ; au-dessus de `haut`,
    # ce n'est plus un afflux d'intérêt mais une distribution en cours — la
    # totalité de la capitalisation qui s'échange en un jour est le signe
    # d'une sortie, pas d'une accumulation.
    ratio_volume_mcap_bas: float = 0.05
    ratio_volume_mcap_sain: float = 0.30
    ratio_volume_mcap_haut: float = 2.0
    # Plafond par jeton découvert, tous renforcements compris. Déplacé ici le
    # 10/09/2026 depuis `ConfigPortefeuille.plafond_par_jeton_usd` : c'est une
    # notion propre à un jeton que le scanner ramène, pas au portefeuille
    # cible qui n'existe plus.
    plafond_par_jeton_usd: float = 100.0
    # Décidé le 11/09/2026 : une pépite du scanner n'a pas de bougies, donc pas
    # d'ATR — son stop est un pourcentage fixe du prix d'entrée
    # (`risk_management.stops.stop_initial_pct`), jamais utilisé pour un actif
    # de la watchlist. 15 % est une proposition, pas une valeur mesurée : à
    # confirmer par le propriétaire avant toute fusion qui active ce chemin
    # (garde-fou permanent, seuil de décision).
    stop_pct: float = 0.15
    # Termes de recherche DexScreener (adresse de jeton de cotation, ou terme
    # libre) qui déclenchent la découverte. Vide par défaut, à dessein — même
    # décision que `TARIFS` vide dans generation-serveur/ : sans terme
    # configuré, `Orchestrateur._passe_pepites` ne fait aucun appel réseau, et
    # remplir cette liste de mémoire donnerait une découverte qui a l'air de
    # marcher sans jamais avoir été vérifiée à sa source.
    termes_recherche: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ConfigBouclier:
    """Ce qui interdit d'acheter une pépite, quelle que soit sa note.

    `acheter_si_inconnu` est le seul réglage qui mérite d'être discuté : à
    `false`, un service muet bloque l'achat. L'asymétrie le justifie — une
    occasion manquée coûte un gain, un jeton dont on ne peut pas sortir coûte
    la ligne entière.
    """

    actif: bool = True
    acheter_si_inconnu: bool = False
    taxe_achat_max_pct: float = 10.0
    taxe_vente_max_pct: float = 10.0
    lp_verrouillee_min_pct: float = 50.0
    top10_detenteurs_max_pct: float = 50.0
    delai_s: float = 8.0


@dataclass(frozen=True, slots=True)
class ConfigStrategie:
    poids: dict[str, float]
    redistribuer_poids_absents: bool
    technique: ConfigTechnique
    pepites: ConfigPepites
    bouclier: ConfigBouclier
    # Score de confiance à partir duquel le moteur achète ou renforce. Seul
    # signal d'entrée depuis le retrait du DCA calendaire le 10/09/2026 : plus
    # de calendrier à satisfaire, plus de montant nominal à moduler — une
    # opportunité ou rien.
    seuil_achat: float = 60.0


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
    exposition_max_par_actif: float = 0.75
    atr_periode: int = 14
    atr_multiple_stop: float = 4.0
    trailing_activation: float = 0.20
    trailing_distance: float = 0.12
    # Un achat sous ce montant coûte plus en frais qu'il n'apporte. Vivait sur
    # `ConfigDCA` avant le 10/09/2026 ; c'est une règle de dimensionnement, pas
    # une règle de calendrier, donc elle vit ici désormais.
    montant_minimum_usd: float = 20.0
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

    # -- Portefeuille (liste de surveillance) --------------------------------
    brut_pf = _section(brut, "portefeuille")
    brut_watchlist = brut_pf.get("watchlist") or {}
    lignes: dict[str, LigneSurveillee] = {}
    for symbole, details in brut_watchlist.items():
        details = details or {}
        if not isinstance(details, Mapping):
            defauts.append(f"Watchlist « {symbole} » : entrée illisible.")
            continue
        lignes[symbole] = LigneSurveillee(
            symbole=symbole,
            role=str(details.get("role", "watchlist")),
            vente_sur_signal=bool(details.get("vente_sur_signal", True)),
            plateforme=details.get("plateforme"),
            chaine=details.get("chaine"),
            adresse=details.get("adresse"),
            plafond_usd=(
                float(details["plafond_usd"]) if details.get("plafond_usd") is not None else None
            ),
        )

    if not lignes:
        defauts.append("Watchlist vide : aucun actif à surveiller.")

    portefeuille = ConfigPortefeuille(
        capital_initial_usd=_flottant(brut_pf, "capital_initial_usd", 0.0),
        watchlist=lignes,
    )
    if portefeuille.capital_initial_usd <= 0:
        defauts.append("Le capital initial doit être strictement positif.")

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

    seuil_achat = _flottant(brut_strat, "seuil_achat", 60.0)
    if not 0.0 <= seuil_achat <= 100.0:
        defauts.append(f"seuil_achat à {seuil_achat:g} — un score vit entre 0 et 100.")

    technique = _depuis(ConfigTechnique, _section(brut_strat, "technique"))
    if not technique.ema_courte < technique.ema_moyenne < technique.ema_longue:
        defauts.append(
            "Les trois EMA doivent être strictement croissantes "
            f"(reçu {technique.ema_courte}, {technique.ema_moyenne}, {technique.ema_longue})."
        )

    brut_pepites = _section(brut_strat, "pepites")
    pepites = _depuis(
        ConfigPepites, brut_pepites,
        termes_recherche=tuple(brut_pepites.get("termes_recherche") or ()),
    )
    if not 0.0 < pepites.stop_pct < 1.0:
        defauts.append(
            f"strategie.pepites.stop_pct à {pepites.stop_pct:g} — attendu entre 0 et 1."
        )
    bouclier = _depuis(ConfigBouclier, _section(brut_strat, "bouclier"))

    strategie = ConfigStrategie(
        poids=poids or {"technique": 0.5, "sentiment": 0.2, "onchain": 0.3},
        redistribuer_poids_absents=bool(brut_strat.get("redistribuer_poids_absents", True)),
        technique=technique,
        pepites=pepites,
        bouclier=bouclier,
        seuil_achat=seuil_achat,
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
    connus = {"console", "discord"}
    for canal in canaux:
        if canal == "telegram":
            # Retiré le 10/09/2026 : les résultats se lisent désormais dans
            # une session Claude, pas dans une application tierce. Un message
            # dédié plutôt que le « canal inconnu » générique, pour dire
            # pourquoi plutôt que de laisser croire à une faute de frappe.
            defauts.append(
                "Canal « telegram » retiré du système le 10/09/2026 : les "
                "résultats se lisent désormais dans une session Claude. "
                "Retirer la ligne de `config.yaml`."
            )
        elif canal not in connus:
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
