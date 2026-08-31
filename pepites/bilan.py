#!/usr/bin/env python3
"""Ce que les pépites sont devenues — le bulletin du radar sur lui-même.

**Le radar n'avait jamais été noté sur ses résultats.** Il l'était sur le fait
qu'il ne plante pas et qu'il rend un entonnoir plausible ; jamais sur la seule
question qui compte, « est-ce que ce qu'il a désigné est monté ». La matière
était pourtant déjà là : `releves` garde `prix_usd` et `note` à chaque tour,
pour chaque jeton. Personne ne la relisait.

**Aucun appel réseau.** Tout se calcule sur la base locale, ce qui rend ce
module éprouvable partout — y compris depuis une session où les neuf hôtes de
marché rendent `000`.

**Les quatre refus de conclure, qui sont le vrai sujet de ce fichier.** Un
bulletin bâti sur rien rend le verdict le plus rassurant, et c'est le travers
que ce dépôt paie le plus souvent :

1. **Un seul relevé ne dit rien.** Afficher « 0 % » sur un jeton vu une fois
   inventerait une stabilité que personne n'a mesurée. Il sort `indécidable`.
2. **Deux relevés trop rapprochés ne disent rien non plus.** Une heure sur une
   pépite, c'est du bruit. En dessous de `HEURES_POUR_JUGER`, la variation est
   affichée mais marquée « trop tôt » — on la montre parce qu'elle est vraie,
   on refuse d'en tirer un verdict.
3. **Un prix de départ nul interdit le calcul.** Il n'arrive pas en pratique,
   et c'est justement pour ça qu'une division par zéro y passerait inaperçue.
4. **Une poignée de jetons ne juge pas un réglage.** Sous
   `JETONS_POUR_CONCLURE`, le taux de réussite global n'est pas affiché : sur
   cinq jetons, trois hausses font « 60 % » et ne veulent rien dire.

**Le dernier prix connu n'est pas le prix d'aujourd'hui.** Un jeton qui sort de
l'entonnoir cesse d'être relevé : son dernier relevé peut dater de trois
semaines. L'âge est donc affiché à côté de chaque ligne, sans quoi une hausse
ancienne se lit comme une hausse actuelle.

**Le symbole peut manquer**, et c'est normal sur les lignes anciennes : il n'a
été rangé dans `releves` qu'à partir de la migration qui l'a ajouté. Avant, seul
l'alerte le gardait — donc uniquement les jetons au-dessus du seuil. Une ligne
sans nom porte son adresse, qui est de toute façon le meilleur identifiant :
un symbole se copie à l'identique par n'importe qui, une adresse non.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from core.stockage import Memoire

# Ordre de grandeur assumé, pas un résultat mesuré : en dessous, l'écart entre
# deux relevés tient de la respiration du carnet d'ordres et non d'un mouvement.
# Le régler plus bas ferait apparaître des « hausses » à chaque scan.
HEURES_POUR_JUGER = 6.0

# Même statut : un ordre de grandeur, pas une puissance statistique. Sous ce
# nombre de jetons décidables, un taux de réussite se lit comme une opinion.
JETONS_POUR_CONCLURE = 20


@dataclass(frozen=True)
class Parcours:
    """Ce qu'un jeton est devenu entre son premier et son dernier relevé."""

    chaine: str
    adresse: str
    symbole: str            # vide quand la base est antérieure à la migration
    note_max: float
    releves: int
    premier_vu: datetime
    dernier_vu: datetime
    prix_premier: float
    prix_dernier: float

    @property
    def heures(self) -> float:
        return (self.dernier_vu - self.premier_vu).total_seconds() / 3600.0

    @property
    def decidable(self) -> bool:
        """Faux quand il n'y a rien à conclure — un seul relevé, ou un prix de
        départ nul. Le distinguer d'une variation de 0 % est tout l'objet de ce
        module : l'un veut dire « je ne sais pas », l'autre « ça n'a pas bougé ».
        """
        return self.releves >= 2 and self.prix_premier > 0

    @property
    def variation(self) -> float | None:
        """En pourcentage, ou `None` si rien ne permet de la calculer."""
        if not self.decidable:
            return None
        return 100.0 * (self.prix_dernier - self.prix_premier) / self.prix_premier

    @property
    def trop_tot(self) -> bool:
        return self.decidable and self.heures < HEURES_POUR_JUGER

    @property
    def nom(self) -> str:
        return self.symbole or "?"


def parcours(memoire: Memoire, note_minimale: float = 0.0) -> list[Parcours]:
    """Un `Parcours` par jeton relevé, du mieux noté au moins bien.

    La lecture se fait en un seul passage trié plutôt qu'en une requête par
    jeton : le premier et le dernier relevé se prennent alors aux extrémités de
    chaque groupe, sans rouvrir la table. C'est aussi ce qui rend la fonction
    lisible — le regroupement est visible, il n'est pas caché dans du SQL.
    """
    lignes = memoire.connexion.execute(
        "SELECT chaine, adresse, symbole, vu_le, prix_usd, note "
        "FROM releves ORDER BY chaine, adresse, vu_le"
    ).fetchall()

    groupes: dict[tuple[str, str], list] = {}
    for ligne in lignes:
        groupes.setdefault((ligne["chaine"], ligne["adresse"]), []).append(ligne)

    resultats: list[Parcours] = []
    for (chaine, adresse), suite in groupes.items():
        note_max = max(l["note"] for l in suite)
        if note_max < note_minimale:
            continue
        # Le symbole peut manquer sur les relevés anciens : on garde le premier
        # non vide rencontré plutôt que celui du dernier relevé, qui serait vide
        # sur une base migrée mais plus scannée.
        symbole = next((l["symbole"] for l in suite if l["symbole"]), "")
        resultats.append(Parcours(
            chaine=chaine, adresse=adresse, symbole=symbole,
            note_max=note_max, releves=len(suite),
            premier_vu=_instant(suite[0]["vu_le"]),
            dernier_vu=_instant(suite[-1]["vu_le"]),
            prix_premier=suite[0]["prix_usd"],
            prix_dernier=suite[-1]["prix_usd"],
        ))

    resultats.sort(key=lambda p: p.note_max, reverse=True)
    return resultats


def _instant(texte: str) -> datetime:
    return datetime.fromisoformat(texte)


@dataclass(frozen=True)
class Verdict:
    """Le taux de réussite, ou l'aveu qu'on ne peut pas le calculer."""

    decidables: int
    hausses: int
    mediane: float | None

    @property
    def concluant(self) -> bool:
        return self.decidables >= JETONS_POUR_CONCLURE

    @property
    def taux(self) -> float | None:
        if not self.concluant or self.decidables == 0:
            return None
        return 100.0 * self.hausses / self.decidables


def juger(liste: list[Parcours]) -> Verdict:
    """Agrège, et refuse de conclure sur trop peu.

    La médiane plutôt que la moyenne : un seul jeton multiplié par cinquante
    tirerait une moyenne vers le haut et donnerait au radar un bulletin
    flatteur que quarante-neuf lignes perdantes ne corrigeraient pas.
    """
    mesurables = [p for p in liste if p.decidable and not p.trop_tot]
    if not mesurables:
        return Verdict(decidables=0, hausses=0, mediane=None)
    variations = sorted(p.variation for p in mesurables)  # type: ignore[misc]
    milieu = len(variations) // 2
    mediane = (variations[milieu] if len(variations) % 2
               else (variations[milieu - 1] + variations[milieu]) / 2)
    return Verdict(
        decidables=len(mesurables),
        hausses=sum(1 for v in variations if v > 0),
        mediane=mediane,
    )


def _age(dernier: datetime, maintenant: datetime) -> str:
    heures = (maintenant - dernier).total_seconds() / 3600.0
    if heures < 1:
        return "à l'instant"
    if heures < 48:
        return f"il y a {heures:.0f} h"
    return f"il y a {heures / 24:.0f} j"


def tableau(liste: list[Parcours], verdict: Verdict,
            maintenant: datetime | None = None) -> str:
    """Le bulletin, en texte. Rend toujours quelque chose de lisible, même vide."""
    maintenant = maintenant or datetime.now(timezone.utc)

    if not liste:
        return ("Aucun relevé en base. Lance au moins deux scans espacés de "
                "quelques heures : le premier remplit la mémoire, les suivants "
                "s'en servent.")

    lignes = ["| Jeton | Note | Devenu | Sur | Relevés | Dernier |",
              "| --- | ---: | ---: | ---: | ---: | --- |"]
    for p in liste:
        if not p.decidable:
            devenu, duree = "indécidable", "—"
        else:
            devenu = f"{p.variation:+.1f} %"
            duree = f"{p.heures:.0f} h" if p.heures < 48 else f"{p.heures / 24:.0f} j"
            if p.trop_tot:
                devenu += " (trop tôt)"
        lignes.append(
            f"| `{p.nom}` {p.adresse[:10]}… | {p.note_max:.0f} | {devenu} | "
            f"{duree} | {p.releves} | {_age(p.dernier_vu, maintenant)} |"
        )

    lignes.append("")
    if verdict.concluant:
        lignes.append(
            f"**{verdict.taux:.0f} % de hausses** sur {verdict.decidables} jetons "
            f"jugeables, médiane {verdict.mediane:+.1f} %."
        )
    else:
        n = verdict.decidables
        compte = "aucun jeton jugeable" if n == 0 else (
            "un seul jeton jugeable" if n == 1 else f"{n} jetons jugeables")
        lignes.append(
            f"**Trop peu pour juger le radar** : {compte}, il en faut "
            f"{JETONS_POUR_CONCLURE}. Un taux calculé sur moins ne dirait rien "
            f"du réglage, seulement du marché de la semaine."
        )
    lignes.append(
        f"\n*Jugeable = au moins deux relevés espacés de {HEURES_POUR_JUGER:.0f} h. "
        f"Le dernier prix connu n'est pas le prix d'aujourd'hui : un jeton sorti "
        f"de l'entonnoir cesse d'être relevé.*"
    )
    return "\n".join(lignes)
