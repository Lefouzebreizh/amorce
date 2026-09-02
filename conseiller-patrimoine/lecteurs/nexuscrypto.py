#!/usr/bin/env python3
"""Ce que NexusCrypto laisse lire — et l'important est ce qu'il ne laisse pas.

**Mesuré avant d'écrire une ligne : NexusCrypto ne persiste aucune position.**
Son portefeuille naît en mémoire au démarrage, à `capital_initial_usd`, dans
`Orchestrateur.__init__`, et meurt avec le processus. Il n'existe ni instantané
JSON, ni base, ni état sur le disque. Ce lecteur ne peut donc **pas** dire ce
qui est détenu, et il ne le fera pas croire.

Ce qui se lit vraiment, et rien d'autre :

- `config/config.yaml` — l'allocation **cible**, versionnée et statique. C'est
  une intention d'investissement, pas un relevé de compte.
- `logs/` — le journal tournant, qui dit **quand le moteur a tourné pour la
  dernière fois**. Il ne dit pas ce qu'il détient ; il dit s'il est vivant.

Cette distinction est toute la valeur du fichier. Un conseiller qui présenterait
50 % de BTC comme une détention alors que c'est une cible afficherait un
patrimoine imaginaire — et personne ne le verrait, puisque le chiffre serait
parfaitement plausible.

La poche crypto réellement détenue se saisit donc à la main, comme le reste,
dans le bloc « actifs » du fichier de patrimoine.

**Aucun import de NexusCrypto.** On lit son YAML, on ne charge pas son code :
c'est ce qui garantit que le chemin d'ordre du moteur n'est jamais chargé dans
ce processus-ci.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from core.modeles import Disponibilite, EtatSource
from lecteurs import Lecture

# Le journal peut peser plusieurs mégaoctets — il est tournant. On n'en lit que
# la queue : la seule question posée est « à quand remonte la dernière passe ».
QUEUE_JOURNAL_OCTETS = 8192


def _lire_allocation(config: Path) -> tuple[dict, str]:
    """Rend le bloc `portefeuille` de NexusCrypto, ou un motif d'échec."""
    try:
        import yaml  # noqa: PLC0415 — import tardif : le cœur s'importe sans
    except ImportError:  # pragma: no cover — dépend de l'installation
        return {}, "PyYAML absent : impossible de lire config.yaml"
    try:
        brut = yaml.safe_load(config.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as erreur:
        return {}, f"config.yaml illisible : {erreur}"
    portefeuille = brut.get("portefeuille")
    if not isinstance(portefeuille, dict):
        return {}, "config.yaml ne porte pas de bloc « portefeuille »"
    return portefeuille, ""


def _derniere_passe(dossier_logs: Path) -> str | None:
    """Quand le moteur a écrit pour la dernière fois, en ISO et en UTC.

    On date le **fichier**, pas la dernière ligne : les formats de journal
    changent, une date de modification non. Ce qu'on cherche ici est un signe de
    vie, pas un horodatage à la seconde.
    """
    if not dossier_logs.is_dir():
        return None
    journaux = [chemin for chemin in dossier_logs.glob("*.log") if chemin.is_file()]
    if not journaux:
        return None
    recent = max(journaux, key=lambda chemin: chemin.stat().st_mtime)
    instant = datetime.fromtimestamp(recent.stat().st_mtime, tz=timezone.utc)
    return instant.isoformat(timespec="minutes")


def lire(racine: Path | None) -> Lecture:
    """Lit la cible et le signe de vie. Ne rend jamais de ligne de patrimoine."""
    if racine is None:
        return Lecture(etat=EtatSource(
            nom="nexuscrypto",
            disponibilite=Disponibilite.NON_BRANCHEE,
            motif="aucun chemin « sources.nexuscrypto » dans la configuration",
        ))

    config = racine / "config" / "config.yaml"
    if not config.exists():
        return Lecture(etat=EtatSource(
            nom="nexuscrypto",
            disponibilite=Disponibilite.ABSENTE,
            chemin=str(config),
            motif=f"{config} est introuvable",
        ))

    portefeuille, erreur = _lire_allocation(config)
    if erreur:
        return Lecture(etat=EtatSource(
            nom="nexuscrypto",
            disponibilite=Disponibilite.ILLISIBLE,
            chemin=str(config),
            motif=erreur,
        ))

    allocation = portefeuille.get("allocation") or {}
    notes: list[str] = []

    if allocation:
        parts = ", ".join(
            f"{symbole.split('/')[0]} {ligne.get('poids', '?')} %"
            for symbole, ligne in allocation.items()
            if isinstance(ligne, dict)
        )
        notes.append(f"allocation cible du moteur : {parts}")

    enveloppe = portefeuille.get("enveloppe_dca_usd")
    cadence = portefeuille.get("cadence_dca")
    if enveloppe and cadence:
        notes.append(f"enveloppe DCA de référence : {enveloppe} $ par passage {cadence}")

    passe = _derniere_passe(racine / "logs")
    notes.append(
        f"dernière passe du moteur : {passe} (UTC)" if passe
        else "aucun journal : le moteur n'a jamais tourné sur cette machine"
    )

    # La phrase qui empêche de lire tout ce qui précède comme une détention.
    # Elle est ajoutée en dernier parce que c'est la dernière lue.
    notes.append(
        "positions réellement détenues : non disponibles — NexusCrypto garde son "
        "portefeuille en mémoire et ne l'écrit nulle part. Les montants crypto du "
        "bilan viennent de la saisie manuelle, pas de lui."
    )

    return Lecture(
        etat=EtatSource(
            nom="nexuscrypto",
            disponibilite=Disponibilite.LUE if allocation else Disponibilite.VIDE,
            chemin=str(config),
            motif="" if allocation else "config.yaml lu, allocation vide",
        ),
        notes=tuple(notes),
    )
