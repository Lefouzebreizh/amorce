#!/usr/bin/env python3
"""Le bouclier : ce qui interdit d'acheter, indépendamment de la note.

Le scanner de pépites repère une anomalie de volume. Son propre en-tête le dit
depuis le premier jour : *« il ne vérifie ni le contrat, ni la revente
possible, ni le verrouillage de la liquidité. Une pépite détectée ici est un
candidat à examiner, jamais un achat. »* Ce module est la moitié qui manquait.

**Le bouclier n'est pas une note, c'est un veto.** Un jeton dont la revente
échoue en simulation ne vaut pas « moins », il vaut zéro : la note mesure une
opportunité, le bouclier mesure la possibilité d'en sortir. Les mélanger
laisserait une note élevée compenser un contrat piégé, ce qui est exactement le
montage qu'on veut arrêter.

**Le silence n'est pas un quitus.** Un service qui ne répond pas rend `INCONNU`,
et `INCONNU` bloque par défaut. C'est l'inverse du réflexe habituel — on
préfère généralement ne pas rater une occasion — mais l'asymétrie est
écrasante : une occasion manquée coûte un gain, un jeton dont on ne peut pas
sortir coûte la ligne entière. `acheter_si_inconnu` permet d'en décider
autrement, en le sachant.

**Aucun appel réseau ici.** `juger` est une fonction pure de ses constats, donc
éprouvable sur des réponses rejouées — ce qui est la seule façon de tester un
garde-fou dont on ne peut pas fabriquer les conditions de déclenchement en
production. Les appels vivent dans `data_engine/securite.py`.

La logique de jugement est reprise du radar `pepites/` du dépôt, qui l'a
éprouvée sur les mêmes services. Les seuils sont recopiés dans la
configuration du bot plutôt qu'importés : les deux outils n'ont pas le même
appétit pour le risque, et les lier ferait qu'un réglage du radar déplacerait
en silence ce que le bot s'autorise à acheter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from ..core.config import ConfigBouclier


class Verdict(Enum):
    """Trois issues, et l'ordre est celui de la permissivité croissante."""

    REJETE = "rejeté"        # une règle dure a mordu
    INCONNU = "inconnu"      # aucune source n'a répondu
    SUR = "sûr"              # au moins une source a répondu, rien n'a mordu


@dataclass(frozen=True, slots=True)
class Constat:
    """Ce qu'une source dit d'un jeton. Tout est facultatif : une source qui
    ignore un champ le laisse à `None`, ce qui n'est pas la même chose que
    `False` et ne doit jamais être confondu avec lui."""

    source: str
    honeypot: bool | None = None
    taxe_achat_pct: float | None = None
    taxe_vente_pct: float | None = None
    emission_possible: bool | None = None
    gel_possible: bool | None = None
    lp_verrouillee_pct: float | None = None
    top10_detenteurs_pct: float | None = None
    remarques: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Securite:
    """Le verdict, et de quoi l'expliquer sans rouvrir le journal."""

    verdict: Verdict
    rejets: tuple[str, ...] = ()
    remarques: tuple[str, ...] = ()
    sources: tuple[str, ...] = field(default=())

    @property
    def achat_autorise_par_defaut(self) -> bool:
        return self.verdict is Verdict.SUR

    def resume(self) -> str:
        if self.rejets:
            return f"{self.verdict.value} — {' ; '.join(self.rejets)}"
        if self.verdict is Verdict.INCONNU:
            return "inconnu — aucune source n'a répondu"
        return f"sûr — {', '.join(self.sources)}"


def _alarmant(constats: list[Constat], champ: str) -> bool | None:
    """Vrai dès qu'**une** source s'alarme. Une source rassurante n'annule pas
    une source alarmée : sur un contrat, un seul avis négatif suffit."""

    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    if not valeurs:
        return None
    return any(valeurs)


def _maximum(constats: list[Constat], champ: str) -> float | None:
    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    return max(valeurs) if valeurs else None


def _minimum(constats: list[Constat], champ: str) -> float | None:
    valeurs = [getattr(c, champ) for c in constats if getattr(c, champ) is not None]
    return min(valeurs) if valeurs else None


def juger(constats: list[Constat], config: ConfigBouclier, *, est_evm: bool) -> Securite:
    """Croise les constats et rend un verdict. Aucun appel réseau."""

    constats = [c for c in constats if c is not None]
    if not constats:
        return Securite(verdict=Verdict.INCONNU)

    rejets: list[str] = []

    if _alarmant(constats, "honeypot"):
        rejets.append("la revente échoue en simulation")

    taxe_achat = _maximum(constats, "taxe_achat_pct")
    if taxe_achat is not None and taxe_achat > config.taxe_achat_max_pct:
        rejets.append(f"taxe à l'achat de {taxe_achat:.0f} %")

    taxe_vente = _maximum(constats, "taxe_vente_pct")
    if taxe_vente is not None and taxe_vente > config.taxe_vente_max_pct:
        rejets.append(f"taxe à la vente de {taxe_vente:.0f} %")

    if not est_evm:
        # Sur Solana, ces deux autorités sont tenues par une clé unique, sans
        # gouvernance ni délai : ouvertes, la porte est ouverte. Sur EVM,
        # `is_mintable` est trop répandu pour éliminer — il y reste une
        # remarque, pas un rejet.
        if _alarmant(constats, "emission_possible"):
            rejets.append("l'autorité d'émission est encore ouverte")
        if _alarmant(constats, "gel_possible"):
            rejets.append("les comptes peuvent être gelés")

    lp = _minimum(constats, "lp_verrouillee_pct")
    if lp is not None and lp < config.lp_verrouillee_min_pct:
        rejets.append(f"liquidité verrouillée à seulement {lp:.0f} %")

    top10 = _maximum(constats, "top10_detenteurs_pct")
    if top10 is not None and top10 > config.top10_detenteurs_max_pct:
        rejets.append(f"les dix premiers porteurs tiennent {top10:.0f} % de l'offre")

    remarques = tuple(r for c in constats for r in c.remarques)
    sources = tuple(dict.fromkeys(c.source for c in constats))

    if rejets:
        return Securite(Verdict.REJETE, tuple(rejets), remarques, sources)
    return Securite(Verdict.SUR, (), remarques, sources)


def achat_autorise(securite: Securite, config: ConfigBouclier) -> tuple[bool, str]:
    """La décision finale, et son motif en clair pour le journal et l'alerte.

    Séparée de `juger` à dessein : le verdict est un fait sur le jeton, la
    permission est une politique. Les mêmes constats peuvent autoriser un achat
    sur une configuration et le refuser sur une autre, et il faut pouvoir lire
    laquelle des deux a parlé.
    """

    if securite.verdict is Verdict.REJETE:
        return False, f"bouclier : {' ; '.join(securite.rejets)}"
    if securite.verdict is Verdict.INCONNU:
        if config.acheter_si_inconnu:
            return True, "bouclier muet, achat autorisé par configuration"
        return False, "bouclier : aucune source n'a répondu, achat refusé par prudence"
    return True, f"bouclier : {securite.resume()}"
