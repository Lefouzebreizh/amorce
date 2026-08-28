#!/usr/bin/env python3
"""Coupe-circuits : ce qui arrête tout.

Un bot autonome a besoin d'un endroit unique qui puisse dire « on ne passe plus
rien », et cet endroit doit être **consulté avant chaque ordre**, pas seulement
au démarrage de la boucle. Une chute de marché arrive entre deux passes.

Quatre déclencheurs, et chacun a sa raison d'être :

- **Drawdown journalier** — la protection contre la journée où la stratégie se
  trompe systématiquement. Sans elle, un réglage devenu faux fait vingt achats
  perdants avant qu'on ne s'en aperçoive.
- **Drawdown total** — la protection contre la stratégie qui n'est plus adaptée
  au régime de marché. Elle ne se réarme pas toute seule : on veut qu'un humain
  regarde.
- **Chute d'un actif sur une heure** — on ne rattrape pas un couteau qui tombe.
  Le DCA achète les creux, pas les effondrements en cours.
- **Perte de vue du marché** — cinq échecs réseau d'affilée veulent dire qu'on
  décide sur des données périmées. Acheter à l'aveugle est pire que ne pas
  acheter.

Le réarmement est **automatique après refroidissement** pour les trois premiers
et pour le réseau, sauf pour le drawdown total. Un système qui se coupe
définitivement à la première secousse ne sert à rien ; un système qui se réarme
après une perte de 25 % non plus.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from ..core.config import ConfigCoupeCircuit
from ..core.modeles import Gravite


class Etat(str, Enum):
    ARME = "arme"
    DECLENCHE = "declenche"


class Motif(str, Enum):
    DRAWDOWN_JOURNALIER = "drawdown_journalier"
    DRAWDOWN_TOTAL = "drawdown_total"
    CHUTE_MARCHE = "chute_marche"
    ACTUALITE_CRITIQUE = "actualite_critique"
    RESEAU = "reseau"


# Le seul motif qui ne se réarme pas seul : une perte de 25 % demande un regard
# humain, pas trois heures d'attente.
MOTIFS_MANUELS = frozenset({Motif.DRAWDOWN_TOTAL})


@dataclass(frozen=True, slots=True)
class Declenchement:
    motif: Motif
    message: str
    survenu_le: datetime
    actif: str | None = None


@dataclass
class CoupeCircuit:
    """Machine à états. Mutable, contrairement au reste du système : c'est un
    interrupteur, et un interrupteur qu'on remplace par un nouvel interrupteur
    à chaque bascule finit toujours par exister en deux exemplaires."""

    config: ConfigCoupeCircuit
    reference_journaliere: float
    plus_haut_portefeuille: float
    etat: Etat = Etat.ARME
    declenchement: Declenchement | None = None
    echecs_reseau: int = 0
    jour_courant: int = -1
    historique: list[Declenchement] = field(default_factory=list)

    def nouveau_jour(self, maintenant: datetime, valeur_portefeuille: float) -> None:
        """Remet la référence journalière. Appelée à chaque passe : c'est le
        changement de date qui déclenche, pas un appel explicite qu'on
        oublierait après un redémarrage."""

        if self.jour_courant != maintenant.toordinal():
            self.jour_courant = maintenant.toordinal()
            self.reference_journaliere = valeur_portefeuille

    def observer(
        self,
        *,
        maintenant: datetime,
        valeur_portefeuille: float,
        variations_1h: dict[str, float] | None = None,
        gravite_macro: Gravite = Gravite.INFO,
    ) -> Declenchement | None:
        """Regarde l'état du monde et bascule si nécessaire.

        Rend le déclenchement s'il vient d'avoir lieu, `None` sinon. L'appelant
        n'a pas à interroger `etat` ensuite : c'est ce retour qui part en
        notification, et une notification par déclenchement, pas une par passe.
        """

        self.nouveau_jour(maintenant, valeur_portefeuille)
        self.plus_haut_portefeuille = max(self.plus_haut_portefeuille, valeur_portefeuille)

        self._tenter_rearmement(maintenant)
        if self.etat is Etat.DECLENCHE:
            return None

        if self.reference_journaliere > 0:
            perte = (self.reference_journaliere - valeur_portefeuille) / self.reference_journaliere
            if perte >= self.config.drawdown_journalier_max:
                return self._declencher(
                    Motif.DRAWDOWN_JOURNALIER,
                    f"perte de {perte:.1%} sur la journée "
                    f"(seuil {self.config.drawdown_journalier_max:.1%})",
                    maintenant,
                )

        if self.plus_haut_portefeuille > 0:
            recul = (self.plus_haut_portefeuille - valeur_portefeuille) / self.plus_haut_portefeuille
            if recul >= self.config.drawdown_total_max:
                return self._declencher(
                    Motif.DRAWDOWN_TOTAL,
                    f"recul de {recul:.1%} depuis le plus haut du portefeuille "
                    f"(seuil {self.config.drawdown_total_max:.1%}) — réarmement manuel",
                    maintenant,
                )

        for actif, variation in (variations_1h or {}).items():
            if variation <= -self.config.chute_marche_1h:
                return self._declencher(
                    Motif.CHUTE_MARCHE,
                    f"{actif} perd {abs(variation):.1%} en une heure "
                    f"(seuil {self.config.chute_marche_1h:.1%})",
                    maintenant,
                    actif=actif,
                )

        if self.config.suspendre_sur_actualite_critique and gravite_macro is Gravite.CRITIQUE:
            return self._declencher(
                Motif.ACTUALITE_CRITIQUE,
                "actualité macro critique dans la fenêtre : entrées suspendues",
                maintenant,
            )

        if self.echecs_reseau >= self.config.echecs_reseau_max:
            return self._declencher(
                Motif.RESEAU,
                f"{self.echecs_reseau} échecs réseau consécutifs : "
                "le marché n'est plus visible, aucune décision fiable",
                maintenant,
            )

        return None

    def signaler_echec_reseau(self) -> None:
        self.echecs_reseau += 1

    def signaler_succes_reseau(self) -> None:
        self.echecs_reseau = 0

    @property
    def passe(self) -> bool:
        """Vrai quand les ordres sont autorisés. C'est ce que le gestionnaire
        d'ordres interroge, une fois par ordre."""

        return self.etat is Etat.ARME

    def rearmer(self, *, force: bool = False) -> bool:
        """Réarmement manuel. `force` est nécessaire pour le drawdown total —
        sans lui, la commande de réarmement rendrait `False` et le dirait."""

        if self.declenchement and self.declenchement.motif in MOTIFS_MANUELS and not force:
            return False
        self.etat = Etat.ARME
        self.declenchement = None
        self.echecs_reseau = 0
        return True

    def _tenter_rearmement(self, maintenant: datetime) -> None:
        if self.etat is not Etat.DECLENCHE or self.declenchement is None:
            return
        if self.declenchement.motif in MOTIFS_MANUELS:
            return
        repos = timedelta(minutes=self.config.refroidissement_minutes)
        if maintenant - self.declenchement.survenu_le >= repos:
            self.etat = Etat.ARME
            self.declenchement = None
            self.echecs_reseau = 0

    def _declencher(
        self, motif: Motif, message: str, maintenant: datetime, actif: str | None = None
    ) -> Declenchement:
        declenchement = Declenchement(
            motif=motif, message=message, survenu_le=maintenant, actif=actif
        )
        self.etat = Etat.DECLENCHE
        self.declenchement = declenchement
        self.historique.append(declenchement)
        return declenchement


def depuis_config(
    config: ConfigCoupeCircuit, capital_initial: float, maintenant: datetime
) -> CoupeCircuit:
    return CoupeCircuit(
        config=config,
        reference_journaliere=capital_initial,
        plus_haut_portefeuille=capital_initial,
        jour_courant=maintenant.toordinal(),
    )
