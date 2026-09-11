#!/usr/bin/env python3
"""L'état de validation : ce qui doit être vrai avant qu'un centime réel bouge.

**`--je-confirme` prouve une intention, pas une preuve.** Le drapeau dit
« je veux démarrer en réel maintenant » ; il ne dit rien sur le fait qu'un
backtest a été conduit, ni qu'une période de paper trading a été observée. Un
opérateur pressé — ou un service qui redémarre avec le mauvais argument — peut
cocher l'intention sans que rien n'ait été vérifié.

Posé le 10/09/2026, après la décision du propriétaire : deux étapes,
documentées et concluantes, avant tout argent réel. Ce fichier lit l'état
qu'un opérateur humain a écrit dans `config/validation.yaml` et le confronte
aux exigences. Rien ici n'automatise le jugement de « concluant » — c'est
un humain qui coche `paper_trading_concluant: true`, jamais un calcul. Ce
module ne fait qu'empêcher de démarrer tant que la case n'est pas cochée.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

RACINE = Path(__file__).resolve().parents[2]
VALIDATION_DEFAUT = RACINE / "config" / "validation.yaml"

# En dessous de ce nombre de jours de paper trading, aucune conclusion n'est
# fiable — un marché calme de trois jours ne prouve rien sur un coupe-circuit
# de drawdown journalier. Le nombre est discutable ; l'absence de plancher ne
# l'est pas.
PAPER_TRADING_JOURS_MINIMUM = 14.0


@dataclass(frozen=True, slots=True)
class EtatValidation:
    """Ce qu'un humain a constaté et signé, pas ce que le code a mesuré."""

    backtest_multi_regimes_fait: bool = False
    backtest_note: str = ""
    paper_trading_jours: float = 0.0
    paper_trading_concluant: bool = False
    paper_trading_note: str = ""
    valide_par: str = ""
    valide_le: str = ""


def charger(chemin: Path | str | None = None) -> EtatValidation:
    """Lit l'état de validation. Un fichier absent ou vide vaut « rien n'est
    validé » — jamais une exception qui laisserait le mode réel se demander
    quoi faire d'une donnée manquante."""

    chemin = Path(chemin) if chemin else VALIDATION_DEFAUT
    if not chemin.exists():
        return EtatValidation()

    try:
        import yaml
    except ImportError:
        # PyYAML manque déjà au chargement de la configuration principale, qui
        # l'aura signalé le premier. Ici, on refuse prudemment plutôt que de
        # supposer une validation qu'on ne peut pas lire.
        return EtatValidation()

    brut = yaml.safe_load(chemin.read_text(encoding="utf-8")) or {}
    if not isinstance(brut, Mapping):
        return EtatValidation()

    def _bool(cle: str, defaut: bool = False) -> bool:
        return bool(brut.get(cle, defaut))

    def _flottant(cle: str, defaut: float = 0.0) -> float:
        try:
            return float(brut.get(cle, defaut))
        except (TypeError, ValueError):
            return defaut

    def _texte(cle: str) -> str:
        return str(brut.get(cle, "") or "")

    return EtatValidation(
        backtest_multi_regimes_fait=_bool("backtest_multi_regimes_fait"),
        backtest_note=_texte("backtest_note"),
        paper_trading_jours=_flottant("paper_trading_jours"),
        paper_trading_concluant=_bool("paper_trading_concluant"),
        paper_trading_note=_texte("paper_trading_note"),
        valide_par=_texte("valide_par"),
        valide_le=_texte("valide_le"),
    )


def pret_pour_production(
    etat: EtatValidation, *, jours_minimum: float = PAPER_TRADING_JOURS_MINIMUM
) -> tuple[bool, list[str]]:
    """Rend (prêt, motifs de refus). Toujours la liste complète des manques,
    jamais le premier seulement — même raison que `ConfigurationInvalide`."""

    manques: list[str] = []

    if not etat.backtest_multi_regimes_fait:
        manques.append(
            "aucun backtest multi-régimes déclaré fait "
            "(`backtest_multi_regimes_fait: true` dans config/validation.yaml, "
            "avec la note qui dit sur quels régimes)"
        )
    if etat.paper_trading_jours < jours_minimum:
        manques.append(
            f"paper trading de {etat.paper_trading_jours:g} jour(s) déclaré(s), "
            f"sous le plancher de {jours_minimum:g} — une période trop courte ne "
            "traverse aucun régime de marché"
        )
    if not etat.paper_trading_concluant:
        manques.append(
            "le paper trading n'est pas déclaré concluant "
            "(`paper_trading_concluant: true`, avec la note qui dit pourquoi)"
        )
    if not etat.valide_par:
        manques.append(
            "aucun nom dans `valide_par` : cet état doit être signé par la "
            "personne qui a regardé les résultats, pas généré seul"
        )

    return not manques, manques
