#!/usr/bin/env python3
"""Skill 5 — l'alerte sur le téléphone.

Le vrai sujet de ce fichier n'est pas l'envoi, qui tient en dix lignes : c'est
**le silence**. Un radar qui prévient trois fois par heure du même jeton finit
en sourdine, et c'est ce jour-là qu'il a raison. Trois garde-fous, donc :

- un **délai de silence** par jeton, sauf progression franche de la note ;
- un **plafond par scan**, parce que dix alertes d'un coup ne se lisent pas ;
- l'alerte **dit ce qu'elle ne sait pas** : quelles sources ont répondu, et ce
  que le bouclier a laissé passer avec réserve. Une alerte qui n'affiche que le
  bon côté finit par être crue.

Le texte du jeton — nom, symbole — vient d'un contrat que n'importe qui a pu
déployer. Il est échappé avant d'entrer dans un message en HTML : un jeton
nommé `<b>` casserait la mise en forme, et le nom d'un jeton n'a aucune raison
d'être du balisage.
"""

from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone

from core.modeles import Pepite
from core.reglages import ReglagesAlertes
from core.reseau import ClientHttp
from core.stockage import Memoire

JOURNAL = logging.getLogger("pepites.telegram")

URL = "https://api.telegram.org/bot{jeton}/sendMessage"
DEBITS = {"telegram": 20.0}

HEURE = 3600.0


def doit_alerter(derniere: tuple[datetime, float] | None, note: float,
                 reglages: ReglagesAlertes, maintenant: datetime) -> tuple[bool, str]:
    """Faut-il déranger pour ce jeton ? Pur, donc testable sans réseau."""
    if note < reglages.note_minimale:
        return False, f"note de {note:.0f} sous le seuil d'alerte"
    if derniere is None:
        return True, "première alerte sur ce jeton"

    envoyee_le, note_precedente = derniere
    heures = (maintenant - envoyee_le).total_seconds() / HEURE
    if heures >= reglages.silence_heures:
        return True, f"dernière alerte il y a {heures:.0f} h"
    if note - note_precedente >= reglages.progression_pour_relancer:
        # Le signal s'est nettement renforcé : ce n'est plus la même nouvelle.
        return True, f"note passée de {note_precedente:.0f} à {note:.0f}"
    return False, f"déjà alerté il y a {heures:.0f} h (silence de {reglages.silence_heures:.0f} h)"


def formater(pepite: Pepite) -> str:
    """Le message, en HTML Telegram. Les métriques d'abord, le lien en dernier."""
    candidat = pepite.candidat
    metriques = pepite.metriques
    securite = pepite.securite
    symbole = html.escape(candidat.jeton.symbole)
    nom = html.escape(candidat.jeton.nom)

    lignes = [
        f"🔎 <b>{symbole}</b> — {nom}",
        f"<i>{html.escape(candidat.jeton.chaine.nom)}</i> · "
        f"<b>{pepite.note_finale:.0f}/100</b>",
        "",
        f"Cap. <b>{candidat.market_cap / 1_000_000:.2f} M$</b> · "
        f"liquidité {candidat.liquidite_usd / 1_000:.0f} k$",
        f"Volume 1 h {candidat.volume_h1 / 1_000:.0f} k$ — "
        f"<b>×{metriques.acceleration:.1f}</b> le rythme moyen",
        f"Cours {candidat.variation_h1:+.1f} % (1 h) · "
        f"{metriques.desequilibre:.0%} d'achats · âge {metriques.age_heures / 24:.0f} j",
        "",
        f"Sécurité : <b>{securite.verdict.value}</b>"
        + (f" — {', '.join(securite.sources)}" if securite.sources else " — aucune source"),
    ]
    if securite.avertissements:
        lignes.append("⚠️ " + html.escape(" ; ".join(securite.avertissements[:3])))
    if pepite.smart_money.portefeuilles:
        lignes.append(
            f"👛 {len(pepite.smart_money.portefeuilles)} portefeuille(s) déjà "
            "précoce(s) ailleurs"
        )
    lignes += [
        "",
        f'<a href="{pepite.lien_dexscreener}">DexScreener</a> · '
        f'<a href="{pepite.lien_explorateur}">Contrat</a>',
        f"<code>{html.escape(candidat.jeton.adresse)}</code>",
    ]
    return "\n".join(lignes)


class Messager:
    """L'envoi proprement dit. Sans jeton configuré, il ne fait rien et le dit."""

    def __init__(self, jeton: str | None = None, salon: str | None = None,
                 client: ClientHttp | None = None) -> None:
        self.jeton = jeton if jeton is not None else os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.salon = salon if salon is not None else os.environ.get("TELEGRAM_CHAT_ID", "")
        self.client = client or ClientHttp(DEBITS)

    @property
    def configure(self) -> bool:
        return bool(self.jeton and self.salon)

    def envoyer(self, texte: str) -> bool:
        if not self.configure:
            return False
        reponse = self.client.poster(
            "telegram", URL.format(jeton=self.jeton),
            {"chat_id": self.salon, "text": texte, "parse_mode": "HTML",
             "disable_web_page_preview": True},
        )
        return bool(reponse and reponse.get("ok"))


def alerter(pepites: list[Pepite], memoire: Memoire, reglages: ReglagesAlertes,
            messager: Messager, maintenant: datetime | None = None) -> list[Pepite]:
    """Envoie ce qui mérite de déranger, et note ce qui a été envoyé.

    L'alerte n'est inscrite dans la mémoire que si elle est **partie** : sinon
    une panne de Telegram imposerait douze heures de silence sur un jeton dont
    on n'a jamais été prévenu.
    """
    maintenant = maintenant or datetime.now(timezone.utc)
    envoyees: list[Pepite] = []

    for pepite in pepites:
        if len(envoyees) >= reglages.max_par_scan:
            JOURNAL.info("plafond de %d alertes atteint pour ce scan", reglages.max_par_scan)
            break
        identite = pepite.candidat.jeton.identite
        permis, raison = doit_alerter(
            memoire.derniere_alerte(identite), pepite.note_finale, reglages, maintenant
        )
        if not permis:
            JOURNAL.debug("%s : pas d'alerte — %s", pepite.candidat.jeton.symbole, raison)
            continue
        if not messager.configure:
            JOURNAL.warning("Telegram non configuré : alerte non envoyée pour %s",
                            pepite.candidat.jeton.symbole)
            continue
        if messager.envoyer(formater(pepite)):
            memoire.noter_alerte(identite, pepite.candidat.jeton.symbole,
                                 pepite.note_finale, maintenant)
            envoyees.append(pepite)
            JOURNAL.info("alerte envoyée : %s (%s)", pepite.candidat.jeton.symbole, raison)

    return envoyees
