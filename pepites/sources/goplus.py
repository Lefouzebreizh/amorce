#!/usr/bin/env python3
"""GoPlus Security : l'analyse statique du contrat, EVM et Solana.

Deux points d'entrée pour deux modèles de jeton qui n'ont rien en commun. Sur
EVM, le danger est dans le code : une fonction de taxe, une liste noire, une
reprise de propriété. Sur Solana, le code du programme de jetons est le même
pour tout le monde — le danger est dans les **autorités** laissées ouvertes :
qui peut encore émettre, geler, fermer un compte.

Le service répond sans clé, à une trentaine de requêtes par minute. C'est peu,
et c'est pour cette raison que la note de convergence doit ramener neuf cents
candidats à vingt-cinq avant que le premier appel ne parte.

Ce module ne juge de rien : il traduit deux formes de JSON en `Constat`. Les
seuils sont dans `reglages.yaml`, la décision dans `skills/bouclier.py`.
"""

from __future__ import annotations

import logging

from core.modeles import Chaine, Constat
from core.reseau import ClientHttp

JOURNAL = logging.getLogger("pepites.goplus")

BASE = "https://api.gopluslabs.io/api/v1"
EVM = f"{BASE}/token_security/{{chaine}}"
SOLANA = f"{BASE}/solana/token_security"

DEBITS = {"goplus": 30.0}

# Adresses où l'on envoie ce qu'on veut détruire. Une liquidité qui y atterrit
# est hors d'atteinte pour de bon — c'est plus solide qu'un contrat de
# verrouillage, qui a une date d'expiration.
BRULEURS = {
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
    "11111111111111111111111111111111",
}


def _drapeau(valeur) -> bool | None:
    """GoPlus code ses booléens en chaînes « 0 » / « 1 », et **omet** le champ
    quand il ne sait pas. L'absence doit rester une absence : la confondre avec
    « 0 » délivrerait un quitus que personne n'a donné."""
    if valeur is None or valeur == "":
        return None
    return str(valeur) == "1"


def _fraction_en_pct(valeur) -> float | None:
    """Les taxes arrivent en fraction de 1 : « 0.05 » vaut 5 %."""
    if valeur is None or valeur == "":
        return None
    try:
        return float(valeur) * 100.0
    except (TypeError, ValueError):
        return None


def _statut(bloc) -> bool | None:
    """Côté Solana, chaque autorité est un objet `{"status": "0"|"1", ...}`."""
    if not isinstance(bloc, dict):
        return None
    return _drapeau(bloc.get("status"))


def _part_verrouillee(detenteurs) -> float | None:
    """Part de la liquidité hors d'atteinte : brûlée ou sous contrat de blocage."""
    if not isinstance(detenteurs, list) or not detenteurs:
        return None
    total = 0.0
    for detenteur in detenteurs:
        if not isinstance(detenteur, dict):
            continue
        adresse = str(detenteur.get("address") or detenteur.get("account") or "").lower()
        verrouille = _drapeau(detenteur.get("is_locked")) or adresse in BRULEURS
        if verrouille:
            try:
                total += float(detenteur.get("percent") or 0.0)
            except (TypeError, ValueError):
                continue
    return total * 100.0


def _concentration(detenteurs) -> float | None:
    """Part des dix premiers porteurs, pools et verrous exclus.

    Sans cette exclusion, tout jeton honnête serait rejeté : le pool d'échange
    détient mécaniquement une grosse part de l'offre, et un contrat de
    verrouillage aussi. Ce qu'on cherche, ce sont dix **personnes** capables de
    décider seules du cours.
    """
    if not isinstance(detenteurs, list) or not detenteurs:
        return None
    total = 0.0
    for detenteur in detenteurs[:10]:
        if not isinstance(detenteur, dict):
            continue
        adresse = str(detenteur.get("address") or detenteur.get("account") or "").lower()
        if adresse in BRULEURS or _drapeau(detenteur.get("is_locked")):
            continue
        if detenteur.get("tag"):        # GoPlus étiquette les contrats connus
            continue
        try:
            total += float(detenteur.get("percent") or 0.0)
        except (TypeError, ValueError):
            continue
    return total * 100.0


def constat_evm(brut: dict) -> Constat:
    # Champ absent = GoPlus ne sait pas, et surtout pas « pas de propriétaire ».
    proprietaire = brut.get("owner_address")
    if proprietaire is None:
        renonce = None
    else:
        proprietaire = str(proprietaire).lower()
        renonce = proprietaire == "" or proprietaire in BRULEURS
    # Une reprise de propriété possible annule la renonciation : le contrat a
    # bien un propriétaire, il attend juste d'être réveillé.
    if _drapeau(brut.get("can_take_back_ownership")) or _drapeau(brut.get("hidden_owner")):
        renonce = False

    remarques = []
    if _drapeau(brut.get("is_blacklisted")):
        remarques.append("le contrat peut inscrire une adresse sur liste noire")
    if _drapeau(brut.get("trading_cooldown")):
        remarques.append("délai imposé entre deux transactions")
    if _drapeau(brut.get("cannot_sell_all")):
        remarques.append("impossible de tout revendre en une fois")

    return Constat(
        source="GoPlus",
        honeypot=_drapeau(brut.get("is_honeypot")),
        taxe_achat_pct=_fraction_en_pct(brut.get("buy_tax")),
        taxe_vente_pct=_fraction_en_pct(brut.get("sell_tax")),
        contrat_verifie=_drapeau(brut.get("is_open_source")),
        proprietaire_renonce=renonce,
        emission_possible=_drapeau(brut.get("is_mintable")),
        echange_pausable=_drapeau(brut.get("transfer_pausable")),
        lp_verrouillee_pct=_part_verrouillee(brut.get("lp_holders")),
        top10_detenteurs_pct=_concentration(brut.get("holders")),
        remarques=tuple(remarques),
    )


def constat_solana(brut: dict) -> Constat:
    remarques = []
    if _statut(brut.get("closable")):
        remarques.append("le compte du jeton peut être fermé par son autorité")
    if _statut(brut.get("balance_mutable_authority")):
        remarques.append("un solde peut être modifié par une autorité")
    if _statut(brut.get("transfer_fee_upgradable")):
        remarques.append("les frais de transfert peuvent être relevés après coup")

    frais = brut.get("transfer_fee")
    taxe = None
    if isinstance(frais, dict):
        taxe = _fraction_en_pct(frais.get("fee_rate"))

    return Constat(
        source="GoPlus Solana",
        emission_possible=_statut(brut.get("mintable")),
        gel_possible=_statut(brut.get("freezable")),
        metadonnees_modifiables=_statut(brut.get("metadata_mutable")),
        taxe_vente_pct=taxe,
        taxe_achat_pct=taxe,
        lp_verrouillee_pct=_part_verrouillee(brut.get("lp_holders")),
        top10_detenteurs_pct=_concentration(brut.get("holders")),
        remarques=tuple(remarques),
    )


def _extraire(reponse, adresse: str) -> dict | None:
    """La réponse est un dictionnaire indexé par adresse — dont la casse ne
    correspond pas toujours à celle qu'on a envoyée."""
    if not isinstance(reponse, dict):
        return None
    resultat = reponse.get("result")
    if not isinstance(resultat, dict) or not resultat:
        return None
    for cle, valeur in resultat.items():
        if cle.lower() == adresse.lower() and isinstance(valeur, dict):
            return valeur
    premier = next(iter(resultat.values()), None)
    return premier if isinstance(premier, dict) else None


def analyser(client: ClientHttp, chaine: Chaine, adresse: str) -> Constat | None:
    """Rend le constat de GoPlus, ou `None` si le service n'a rien dit."""
    if chaine.est_evm:
        reponse = client.json(
            "goplus", EVM.format(chaine=chaine.goplus),
            params={"contract_addresses": adresse},
        )
        brut = _extraire(reponse, adresse)
        return constat_evm(brut) if brut else None

    reponse = client.json("goplus", SOLANA, params={"contract_addresses": adresse})
    brut = _extraire(reponse, adresse)
    return constat_solana(brut) if brut else None
