#!/usr/bin/env python3
"""La sonde : séparer un marché calme d'un format qui a bougé.

**Trois situations très différentes produisent aujourd'hui le même rapport
vide**, et rien ne les distingue en le lisant :

1. le marché est réellement calme — aucun jeton ne mérite d'être retenu ;
2. un service ne répond plus ;
3. un service répond, et nous ne savons plus lire ce qu'il rend.

La première est une bonne nouvelle, les deux autres sont des pannes. La
troisième est la pire : tout a l'air de fonctionner, les appels partent, les
réponses arrivent, le compteur d'échecs reste à zéro — et le radar est aveugle.
`ClientHttp` n'attrape que le cas 2, et seulement dans sa forme massive (cinq
points d'entrée muets d'affilée). Une seule source dont le schéma a glissé
passe sous tous les filets.

Le code le sait déjà : `skills/radar.py` note qu'une casse d'adresse mal réglée
rend « la chaîne entière muette, et le rapport se lit comme un marché calme ».
La sonde est la réponse à cette phrase.

**Le principe tient en deux nombres par point d'entrée : reçus et lus.** Ce
qu'on peut mesurer sans rien décider — combien d'éléments le service a rendus,
et combien d'entre eux nos modèles savent encore traduire. Un service qui rend
trente éléments dont zéro lisible n'est pas calme, il a changé de forme, et
c'est le seul cas où la sonde crie.

**Les sujets de sondage sont les jetons de cotation de `config/chaines.yaml`**,
pas des adresses écrites ici. Deux raisons : ce sont les jetons les plus
permanents de chaque chaîne — si WETH disparaît de DexScreener, le problème
n'est pas notre analyseur —, et surtout une adresse écrite en dur dans ce
fichier vieillirait sans que personne ne la relise, ce qui ferait de la sonde
elle-même une source de fausses alertes.

La sonde n'écrit rien, ne note rien, n'alerte pas. Elle lit.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum

from core.modeles import Chaine
from core.reglages import Reglages
from core.reseau import ClientHttp, ReseauIndisponible
from skills import telegram
from sources import dexscreener, etherscan, goplus, honeypot_is, rugcheck, solana_rpc

JOURNAL = logging.getLogger("pepites.sonde")


class Etat(Enum):
    """Ce que la sonde a constaté. L'ordre est celui de la gravité croissante,
    et il sert au tri du rapport comme au code de sortie."""

    OK = "ok"
    SANS_CLE = "sans clé"          # capacité désactivée faute de configuration
    VIDE = "vide"                  # réponse valide, aucun élément — parfois normal
    NON_SONDE = "non sondé"        # la coupure est arrivée avant son tour
    MUET = "muet"                  # rien n'est revenu
    DERIVE = "dérive"              # des éléments sont revenus, aucun n'est lisible


# Ce qui doit faire échouer la sonde. `VIDE` n'en est pas : une vitrine sans
# nouveauté est un fait du marché, pas une panne. `SANS_CLE` non plus : le radar
# est conçu pour tourner sans Etherscan ni Helius, en moins bien.
GRAVES = (Etat.MUET, Etat.DERIVE)


@dataclass(frozen=True)
class Constat:
    """Le verdict d'un point d'entrée."""

    point: str                     # nom lisible, celui qu'on cherchera dans le journal
    etat: Etat
    recus: int = 0                 # éléments dans la réponse brute
    lus: int = 0                   # éléments que nos modèles ont su traduire
    detail: str = ""

    @property
    def grave(self) -> bool:
        return self.etat in GRAVES

    def ligne(self) -> str:
        compte = (f"{self.recus} reçu{'s' if self.recus > 1 else ''} / "
                  f"{self.lus} lu{'s' if self.lus > 1 else ''}") if self.recus else ""
        morceaux = [m for m in (compte, self.detail) if m]
        return f"{self.point:<34} {self.etat.value:<10} {' · '.join(morceaux)}"


def _juger(recus: int, lus: int, detail: str = "") -> tuple[Etat, str]:
    """La règle unique de la sonde, et la seule qui mérite d'être écrite une
    fois : reçu sans lu, c'est une dérive de format."""
    if recus and not lus:
        return Etat.DERIVE, detail or "des éléments arrivent, aucun ne se traduit"
    if not recus:
        return Etat.VIDE, detail
    return Etat.OK, detail


def _chaine_evm(reglages: Reglages) -> Chaine | None:
    """Une chaîne EVM du périmètre, pour sonder ce qui ne connaît que l'EVM."""
    return next((c for c in reglages.chaines.values() if c.est_evm), None)


def _chaine_solana(reglages: Reglages) -> Chaine | None:
    return next((c for c in reglages.chaines.values() if c.est_solana), None)


def _quote(chaine: Chaine | None) -> str | None:
    """Un jeton de cotation de cette chaîne — le sujet de sondage le plus
    permanent qu'on ait sous la main. Trié pour que deux sondes consécutives
    interrogent le même, sans quoi comparer deux exécutions n'aurait pas de sens."""
    if chaine is None or not chaine.quotes:
        return None
    return sorted(chaine.quotes)[0]


# --- les points d'entrée, un par fonction -----------------------------------
#
# Chacune rend un `Constat` et n'en lève jamais : une sonde qui s'arrête au
# premier service en panne ne dit rien des cinq suivants, ce qui est exactement
# le service qu'on lui demande.


def _sonder_recherche(client, reglages: Reglages, moment: datetime) -> Constat:
    """Le point d'entrée le plus important : c'est lui qui découvre.

    On compte en trois temps, et le deuxième n'est pas décoratif. Une recherche
    par adresse de WETH rend des paires de toutes les chaînes, dont la plupart
    sont hors de notre périmètre : les compter comme illisibles ferait crier la
    sonde à chaque exécution. Seules les paires d'une chaîne que nous suivons
    ont vocation à se traduire.
    """
    chaine = _chaine_evm(reglages)
    terme = _quote(chaine)
    if terme is None:
        return Constat("dexscreener · recherche", Etat.VIDE,
                       detail="aucune chaîne EVM configurée")

    reponse = client.json("dexscreener.paires", dexscreener.RECHERCHE,
                          params={"q": terme})
    if not isinstance(reponse, dict):
        return Constat("dexscreener · recherche", Etat.MUET,
                       detail="pas de réponse exploitable")

    brutes = reponse.get("pairs")
    if not isinstance(brutes, list):
        # La réponse existe mais n'a plus la forme attendue : c'est une dérive,
        # pas un silence. Le distinguer évite de chercher du côté du réseau.
        return Constat("dexscreener · recherche", Etat.DERIVE,
                       detail="la réponse ne porte plus de liste « pairs »")

    dans_le_perimetre = [b for b in brutes
                         if isinstance(b, dict) and b.get("chainId") in reglages.chaines]
    lues = [p for p in (dexscreener.paire_depuis_json(b, reglages.chaines, moment)
                        for b in dans_le_perimetre) if p is not None]
    etat, detail = _juger(len(dans_le_perimetre), len(lues),
                          f"{len(brutes)} paires rendues, toutes chaînes confondues")
    return Constat("dexscreener · recherche", etat,
                   len(dans_le_perimetre), len(lues), detail)


def _sonder_vitrine(client, reglages: Reglages) -> Constat:
    """Fiches et mises en avant. Une vitrine vide arrive : c'est `VIDE`, pas une
    panne — d'où le fait qu'on ne juge la dérive que sur ce qui est revenu."""
    reponse = client.json("dexscreener.profils", dexscreener.PROFILS)
    if not isinstance(reponse, list):
        return Constat("dexscreener · vitrine", Etat.MUET,
                       detail="pas de liste en réponse")
    annonces = [e for e in reponse if isinstance(e, dict)]
    retenus = [e for e in annonces
               if e.get("chainId") in reglages.chaines and e.get("tokenAddress")]
    # Ici la dérive ne se lit pas sur « aucun retenu » — une vitrine peut
    # n'annoncer que des chaînes hors périmètre. Elle se lit sur des entrées qui
    # n'ont plus ni `chainId` ni `tokenAddress`.
    formees = [e for e in annonces if e.get("chainId") and e.get("tokenAddress")]
    etat, detail = _juger(len(annonces), len(formees),
                          f"{len(retenus)} dans le périmètre")
    return Constat("dexscreener · vitrine", etat, len(annonces), len(formees), detail)


def _sonder_paires_du_jeton(client, reglages: Reglages, moment: datetime) -> Constat:
    chaine = _chaine_evm(reglages)
    adresse = _quote(chaine)
    if adresse is None:
        return Constat("dexscreener · pools d'un jeton", Etat.VIDE,
                       detail="aucune chaîne EVM configurée")
    reponse = client.json(
        "dexscreener.paires",
        dexscreener.PAIRES_DU_JETON.format(chaine=chaine.cle, adresse=adresse),
    )
    if not isinstance(reponse, list):
        return Constat("dexscreener · pools d'un jeton", Etat.MUET,
                       detail="pas de liste en réponse")
    brutes = [b for b in reponse if isinstance(b, dict)]
    lues = [p for p in (dexscreener.paire_depuis_json(b, {chaine.cle: chaine}, moment)
                        for b in brutes) if p is not None]
    etat, detail = _juger(len(brutes), len(lues), f"sur {chaine.nom}")
    return Constat("dexscreener · pools d'un jeton", etat, len(brutes), len(lues), detail)


def _sonder_goplus(client, reglages: Reglages) -> list[Constat]:
    """Deux points d'entrée distincts, et c'est voulu : l'EVM et Solana ne
    partagent ni l'URL ni la forme de la réponse. L'un peut glisser sans l'autre."""
    constats: list[Constat] = []
    for libelle, chaine in (("EVM", _chaine_evm(reglages)),
                            ("Solana", _chaine_solana(reglages))):
        point = f"goplus · {libelle}"
        adresse = _quote(chaine)
        if adresse is None:
            constats.append(Constat(point, Etat.VIDE, detail="chaîne non configurée"))
            continue
        constat = goplus.analyser(client, chaine, adresse)
        if constat is None:
            constats.append(Constat(point, Etat.MUET,
                                    detail="aucun constat sur un jeton de référence"))
        else:
            constats.append(Constat(point, Etat.OK, 1, 1, f"sujet : {chaine.nom}"))
    return constats


def _sonder_honeypot(client, reglages: Reglages) -> Constat:
    chaine = next((c for c in reglages.chaines.values() if c.honeypot_is is not None), None)
    adresse = _quote(chaine)
    if adresse is None:
        return Constat("honeypot.is", Etat.VIDE,
                       detail="aucune chaîne couverte configurée")
    constat = honeypot_is.analyser(client, chaine, adresse)
    if constat is None:
        return Constat("honeypot.is", Etat.MUET, detail="aucun constat rendu")
    return Constat("honeypot.is", Etat.OK, 1, 1, f"sujet : {chaine.nom}")


def _sonder_rugcheck(client, reglages: Reglages) -> Constat:
    adresse = _quote(_chaine_solana(reglages))
    if adresse is None:
        return Constat("rugcheck", Etat.VIDE, detail="Solana non configurée")
    constat = rugcheck.analyser(client, adresse)
    if constat is None:
        return Constat("rugcheck", Etat.MUET, detail="aucun constat rendu")
    return Constat("rugcheck", Etat.OK, 1, 1)


def _sonder_solana_rpc(client, reglages: Reglages) -> Constat:
    """Le RPC public est saturé en permanence : un silence ici est banal et ne
    coûte que le traqueur de portefeuilles sur Solana. Il est signalé, pas dramatisé."""
    adresse = _quote(_chaine_solana(reglages))
    if adresse is None:
        return Constat("solana · RPC", Etat.VIDE, detail="Solana non configurée")
    detenteurs = solana_rpc.principaux_detenteurs(client, adresse, 5)
    etat, detail = _juger(len(detenteurs), len(detenteurs))
    if etat is Etat.VIDE:
        detail = "aucun détenteur rendu — RPC public souvent saturé"
    return Constat("solana · RPC", etat, len(detenteurs), len(detenteurs), detail)


def _sonder_cles() -> list[Constat]:
    """Ce qui ne se sonde pas mais se constate : les capacités qu'une clé
    absente désactive en silence. Aucun appel réseau ici — vérifier une clé en
    l'utilisant coûterait un quota pour une information qu'on a déjà."""
    constats: list[Constat] = []

    if etherscan.cle():
        constats.append(Constat("etherscan · clé", Etat.OK, detail="présente"))
    else:
        constats.append(Constat("etherscan · clé", Etat.SANS_CLE,
                                detail="premiers acheteurs EVM désactivés"))

    messager = telegram.Messager()
    if messager.configure:
        constats.append(Constat("telegram", Etat.OK, detail="jeton et salon présents"))
    else:
        constats.append(Constat("telegram", Etat.SANS_CLE,
                                detail="le radar notera sans jamais prévenir"))
    return constats


def sonder(reglages: Reglages, client: ClientHttp | None = None,
           moment: datetime | None = None) -> list[Constat]:
    """Un passage sur tous les points d'entrée, dans l'ordre du pipeline.

    L'ordre compte pour la lecture : ce qui découvre d'abord, ce qui protège
    ensuite, ce qui enrichit à la fin. Un défaut en tête explique les suivants,
    l'inverse n'est pas vrai.
    """
    moment = moment or datetime.now(timezone.utc)
    client = client or ClientHttp({
        **dexscreener.DEBITS, **goplus.DEBITS, **honeypot_is.DEBITS,
        **rugcheck.DEBITS, **solana_rpc.DEBITS, **etherscan.DEBITS,
        **telegram.DEBITS,
    })

    # Chaque épreuve déclare les points qu'elle couvre, et c'est ce qui permet
    # de nommer ceux qu'une coupure a empêché d'atteindre. Sans cette liste, un
    # point jamais sondé disparaît simplement du tableau — indiscernable d'un
    # point sain, ce qui est très exactement l'ambiguïté que la sonde combat.
    epreuves: list[tuple[tuple[str, ...], object]] = [
        (("dexscreener · recherche",),
         lambda: [_sonder_recherche(client, reglages, moment)]),
        (("dexscreener · vitrine",),
         lambda: [_sonder_vitrine(client, reglages)]),
        (("dexscreener · pools d'un jeton",),
         lambda: [_sonder_paires_du_jeton(client, reglages, moment)]),
        (("goplus · EVM", "goplus · Solana"),
         lambda: _sonder_goplus(client, reglages)),
        (("honeypot.is",), lambda: [_sonder_honeypot(client, reglages)]),
        (("rugcheck",), lambda: [_sonder_rugcheck(client, reglages)]),
        (("solana · RPC",), lambda: [_sonder_solana_rpc(client, reglages)]),
    ]

    constats: list[Constat] = []
    for rang, (points, epreuve) in enumerate(epreuves):
        try:
            constats.extend(epreuve())
        except ReseauIndisponible as erreur:
            # Le client abandonne après cinq points d'entrée muets d'affilée. Ce
            # n'est pas un échec de la sonde : c'est son diagnostic le plus net,
            # et ce qui a déjà été constaté garde toute sa valeur. Le reste est
            # déclaré non sondé plutôt que passé sous silence.
            for point in points:
                constats.append(Constat(point, Etat.NON_SONDE,
                                        detail="coupure pendant cette épreuve"))
            for suivants, _ in epreuves[rang + 1:]:
                for point in suivants:
                    constats.append(Constat(point, Etat.NON_SONDE,
                                            detail="jamais atteint"))
            constats.append(Constat("réseau", Etat.MUET, detail=str(erreur)))
            break
    constats.extend(_sonder_cles())
    return constats


def resumer(constats: list[Constat]) -> str:
    """Le tableau, et une conclusion en une phrase.

    La conclusion est écrite pour être lue seule : c'est elle qu'on regarde à
    six heures du matin, et le tableau qu'on déroule seulement si elle alarme.
    """
    lignes = [c.ligne() for c in constats]
    graves = [c for c in constats if c.grave]
    derives = [c for c in graves if c.etat is Etat.DERIVE]
    non_sondes = [c for c in constats if c.etat is Etat.NON_SONDE]

    if derives:
        verdict = ("DÉRIVE DE FORMAT — " + ", ".join(c.point for c in derives) +
                   (" répondent" if len(derives) > 1 else " répond") +
                   " sans que nous sachions les lire. "
                   "Un scan rendrait un rapport vide qui se lirait comme un marché calme.")
    elif graves:
        verdict = ("SOURCES MUETTES — " + ", ".join(c.point for c in graves) +
                   ". Le scan tournera en moins bien, sans le dire.")
    else:
        verdict = "Toutes les sources répondent et se lisent."

    if non_sondes:
        # Une sonde interrompue ne dit rien des points qu'elle n'a pas atteints,
        # et doit le dire : « rien à signaler » sur une épreuve jamais lancée
        # serait le mensonge que ce module existe pour empêcher.
        verdict += (f"\n{len(non_sondes)} point(s) d'entrée non sondé(s) : "
                    "ce verdict ne dit rien d'eux.")

    return "\n".join([*lignes, "", verdict])
