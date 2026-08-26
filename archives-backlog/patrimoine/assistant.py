#!/usr/bin/env python3
"""Assistant personnel d'allocation d'actifs.

Suivre un patrimoine réparti entre bourse, crypto, immobilier et liquidités, le
comparer à une cible choisie à froid, et dire quoi faire du prochain apport.
Tout reste sur la machine : `config.json` ne sort jamais, et les seuls appels
réseau sont deux lectures de cours publics.

Cinq décisions tiennent ce fichier :

1. **L'immobilier compte en valeur nette.** Un bien à 148 000 € financé par
   76 500 € de crédit restant ne représente que 71 500 € de patrimoine. Le
   compter brut écrase mécaniquement les autres classes et rend le
   rééquilibrage illisible tant que le crédit court. Le capital restant dû
   reste affiché à part, pour ne pas perdre l'effet de levier de vue.
2. **Rien ne bouge à l'intérieur de la bande de tolérance.** Arbitrer sur un
   écart de un ou deux points coûte plus en frais et en impôt que la discipline
   ne rapporte. Sous `bande_tolerance_pct`, l'assistant ne propose rien — et le
   dit, pour qu'un écran sans action se lise comme un feu vert et non comme une
   panne.
3. **L'apport passe avant l'arbitrage.** Renforcer ce qui est sous-pondéré ne
   déclenche aucune imposition ; vendre ce qui est sur-pondéré en déclenche,
   hors PEA et assurance-vie. Le plan d'apport est donc calculé en premier, et
   les ventes ne sont proposées que pour ce qu'il ne rattrape pas.
4. **La cible est une donnée, pas un libellé.** `appetence_risque` n'est qu'une
   étiquette pour s'en souvenir ; ce sont les quatre pourcentages de
   `cibles_pct` qui pilotent tout. Un profil déduit d'un mot-clé finit toujours
   par ne plus décrire ce qu'on détient vraiment.
5. **Un prix manquant ne s'invente pas.** Une source indisponible n'arrête pas
   le programme : la ligne est marquée, elle ne compte pas pour zéro, et
   l'inventaire s'affiche quand même. Mais le conseil, lui, est retenu — une
   répartition calculée sur un total incomplet reste plausible à l'écran, et
   c'est ce qui la rend dangereuse. Mieux vaut pas de conseil qu'un arbitrage
   fondé sur un patrimoine faux.

Le réseau est confiné aux trois fonctions `cours_*` et `taux_vers_euro`. Tout
le reste est pur, donc vérifiable hors ligne (`patrimoine/tests/`).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from tabulate import tabulate

CHEMIN_DEFAUT = Path(__file__).resolve().parent / "config.json"

CLASSES = ("bourse", "crypto", "immobilier", "liquidites")
ETIQUETTES = {
    "bourse": "Bourse",
    "crypto": "Crypto",
    "immobilier": "Immobilier",
    "liquidites": "Liquidités",
}

# Au-delà, CoinGecko refuse l'appel suivant sur son offre publique sans clé.
LIMITE_CRYPTO_PAR_APPEL = 250


class ErreurConfiguration(Exception):
    """Le fichier de configuration est inutilisable en l'état."""


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Profil:
    appetence: str
    horizon_annees: int
    apport_mensuel: float
    cibles_pct: dict[str, float]
    bande_pct: float


@dataclass(frozen=True)
class Configuration:
    profil: Profil
    actifs: dict[str, list[dict]]


def _exiger(source: dict, cle: str, contexte: str) -> object:
    if cle not in source:
        raise ErreurConfiguration(f"{contexte} : champ « {cle} » manquant.")
    return source[cle]


def _nombre(source: dict, cle: str, contexte: str, defaut: float | None = None) -> float:
    if cle not in source and defaut is not None:
        return defaut
    valeur = _exiger(source, cle, contexte)
    if isinstance(valeur, bool) or not isinstance(valeur, (int, float)):
        raise ErreurConfiguration(f"{contexte} : « {cle} » doit être un nombre.")
    if valeur < 0:
        raise ErreurConfiguration(f"{contexte} : « {cle} » ne peut pas être négatif.")
    return float(valeur)


def valider(brut: dict) -> Configuration:
    """Refuse tout ce qui donnerait un tableau silencieusement faux.

    La somme des cibles est vérifiée ici et nulle part ailleurs : une somme à
    97 % décalerait chaque écart de trois points sans que rien ne le signale.
    """
    profil_brut = _exiger(brut, "profil", "configuration")
    if not isinstance(profil_brut, dict):
        raise ErreurConfiguration("configuration : « profil » doit être un objet.")

    cibles_brutes = _exiger(profil_brut, "cibles_pct", "profil")
    if not isinstance(cibles_brutes, dict):
        raise ErreurConfiguration("profil : « cibles_pct » doit être un objet.")

    inconnues = set(cibles_brutes) - set(CLASSES)
    if inconnues:
        raise ErreurConfiguration(
            "profil : classe(s) inconnue(s) dans « cibles_pct » : "
            + ", ".join(sorted(inconnues))
            + f". Classes attendues : {', '.join(CLASSES)}."
        )

    cibles = {classe: _nombre(cibles_brutes, classe, "cibles_pct", 0.0) for classe in CLASSES}
    somme = sum(cibles.values())
    if abs(somme - 100.0) > 0.01:
        raise ErreurConfiguration(
            f"profil : les cibles totalisent {somme:g} % au lieu de 100 %."
        )

    profil = Profil(
        appetence=str(profil_brut.get("appetence_risque", "non précisé")),
        horizon_annees=int(_nombre(profil_brut, "horizon_annees", "profil", 0.0)),
        apport_mensuel=_nombre(profil_brut, "apport_mensuel", "profil", 0.0),
        cibles_pct=cibles,
        bande_pct=_nombre(profil_brut, "bande_tolerance_pct", "profil", 5.0),
    )

    actifs_bruts = _exiger(brut, "actifs", "configuration")
    if not isinstance(actifs_bruts, dict):
        raise ErreurConfiguration("configuration : « actifs » doit être un objet.")

    actifs: dict[str, list[dict]] = {}
    for classe in CLASSES:
        lignes = actifs_bruts.get(classe, [])
        if not isinstance(lignes, list):
            raise ErreurConfiguration(f"actifs : « {classe} » doit être une liste.")
        for ligne in lignes:
            if not isinstance(ligne, dict):
                raise ErreurConfiguration(f"actifs.{classe} : chaque entrée doit être un objet.")
            contexte = f"actifs.{classe}[{ligne.get('nom', '?')}]"
            _exiger(ligne, "nom", contexte)
            if classe == "bourse":
                _exiger(ligne, "ticker", contexte)
                _nombre(ligne, "quantite", contexte)
            elif classe == "crypto":
                _exiger(ligne, "id_coingecko", contexte)
                _nombre(ligne, "quantite", contexte)
            elif classe == "immobilier":
                _nombre(ligne, "valeur_estimee", contexte)
                _nombre(ligne, "capital_restant_du", contexte, 0.0)
            else:
                _nombre(ligne, "montant", contexte)
        actifs[classe] = lignes

    return Configuration(profil=profil, actifs=actifs)


def charger(chemin: Path) -> Configuration:
    if not chemin.exists():
        raise ErreurConfiguration(
            f"{chemin} est introuvable. Copiez « config.example.json » et "
            "remplacez les montants fictifs par les vôtres."
        )
    try:
        brut = json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erreur:
        raise ErreurConfiguration(f"{chemin} n'est pas un JSON valide : {erreur}") from erreur
    if not isinstance(brut, dict):
        raise ErreurConfiguration(f"{chemin} : la racine doit être un objet.")
    return valider(brut)


# --------------------------------------------------------------------------
# Réseau — la seule partie qui sort de la machine
# --------------------------------------------------------------------------

def cours_bourse(tickers: list[str]) -> tuple[dict[str, tuple[float, str]], list[str]]:
    """Dernier cours et devise de chaque ticker, plus la liste des échecs.

    `yfinance` est importé ici et pas en tête de fichier : il tire pandas
    derrière lui, ce qui coûte plus d'une seconde au démarrage, et le calcul —
    donc les tests — n'en a aucun besoin.
    """
    import yfinance as yf  # noqa: PLC0415 — import tardif, voir ci-dessus

    cours: dict[str, tuple[float, str]] = {}
    echecs: list[str] = []
    for ticker in tickers:
        try:
            rapide = yf.Ticker(ticker).fast_info
            prix = float(rapide.last_price)
            devise = str(rapide.currency or "EUR").upper()
        except Exception:  # réseau coupé, ticker retiré de la cote, cours absent
            echecs.append(ticker)
            continue
        cours[ticker] = (prix, devise)
    return cours, echecs


def taux_vers_euro(devises: set[str]) -> dict[str, float]:
    """Combien d'euros vaut une unité de chaque devise étrangère.

    Yahoo cote directement la paire dans ce sens (`USDEUR=X`) : passer par
    `EURUSD=X` et inverser ferait porter l'écart entre cours acheteur et
    vendeur du mauvais côté.
    """
    import yfinance as yf  # noqa: PLC0415 — import tardif, voir `cours_bourse`

    taux = {"EUR": 1.0}
    for devise in sorted(devises - {"EUR"}):
        rapide = yf.Ticker(f"{devise}EUR=X").fast_info
        taux[devise] = float(rapide.last_price)
    return taux


def cours_crypto(identifiants: list[str]) -> tuple[dict[str, float], list[str]]:
    """Cours en euros des cryptos demandées, plus la liste des échecs.

    CoinGecko sait coter en euros : demander des dollars puis convertir
    ajouterait une conversion, donc une erreur, pour rien.
    """
    import requests  # noqa: PLC0415 — import tardif, voir `cours_bourse`

    if not identifiants:
        return {}, []
    if len(identifiants) > LIMITE_CRYPTO_PAR_APPEL:
        raise ErreurConfiguration(
            f"Plus de {LIMITE_CRYPTO_PAR_APPEL} cryptos en un appel : "
            "l'offre publique de CoinGecko refuserait la requête."
        )
    try:
        reponse = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": ",".join(identifiants), "vs_currencies": "eur"},
            timeout=15,
        )
        reponse.raise_for_status()
        donnees = reponse.json()
    except Exception:  # réseau coupé, quota dépassé, réponse illisible
        return {}, list(identifiants)

    cours: dict[str, float] = {}
    echecs: list[str] = []
    for identifiant in identifiants:
        prix = donnees.get(identifiant, {}).get("eur")
        if prix is None:
            echecs.append(identifiant)
        else:
            cours[identifiant] = float(prix)
    return cours, echecs


# --------------------------------------------------------------------------
# Valorisation — pur, testé
# --------------------------------------------------------------------------

@dataclass
class Ligne:
    classe: str
    nom: str
    detail: str
    quantite: float | None
    prix: float | None
    valeur: float | None
    plus_value: float | None = None
    rendement_pct: float | None = None


def rendement_net(bien: dict) -> float | None:
    """Loyers moins charges, rapportés au prix du bien.

    Rapporté à la valeur estimée et non à la valeur nette : c'est le rendement
    de l'actif, pas celui de l'apport. Divisé par la part non financée, un bien
    presque entièrement à crédit afficherait des rendements à trois chiffres
    qui ne veulent plus rien dire.
    """
    valeur = float(bien.get("valeur_estimee", 0.0))
    if valeur <= 0:
        return None
    loyers = float(bien.get("loyer_mensuel_brut", 0.0)) * 12
    charges = float(bien.get("charges_annuelles", 0.0))
    return (loyers - charges) / valeur * 100


def valoriser(
    config: Configuration,
    cours_actions_eur: dict[str, float],
    cours_cryptos_eur: dict[str, float],
) -> list[Ligne]:
    """Une ligne par position, valeur en euros. `None` = prix indisponible."""
    lignes: list[Ligne] = []

    for actif in config.actifs["bourse"]:
        ticker = actif["ticker"]
        quantite = float(actif["quantite"])
        prix = cours_actions_eur.get(ticker)
        pru = actif.get("pru")
        lignes.append(Ligne(
            classe="bourse",
            nom=actif["nom"],
            detail=f"{ticker} · {actif.get('enveloppe', 'sans enveloppe')}",
            quantite=quantite,
            prix=prix,
            valeur=None if prix is None else prix * quantite,
            plus_value=None if prix is None or pru is None else (prix - float(pru)) * quantite,
        ))

    for actif in config.actifs["crypto"]:
        identifiant = actif["id_coingecko"]
        quantite = float(actif["quantite"])
        prix = cours_cryptos_eur.get(identifiant)
        pru = actif.get("pru")
        lignes.append(Ligne(
            classe="crypto",
            nom=actif["nom"],
            detail=f"{identifiant} · {actif.get('conservation', 'conservation non précisée')}",
            quantite=quantite,
            prix=prix,
            valeur=None if prix is None else prix * quantite,
            plus_value=None if prix is None or pru is None else (prix - float(pru)) * quantite,
        ))

    for bien in config.actifs["immobilier"]:
        estimee = float(bien["valeur_estimee"])
        credit = float(bien.get("capital_restant_du", 0.0))
        detail = f"estimé {euros(estimee)}"
        if credit > 0:
            detail += f" − {euros(credit)} de crédit"
        lignes.append(Ligne(
            classe="immobilier",
            nom=bien["nom"],
            detail=detail,
            quantite=None,
            prix=None,
            valeur=estimee - credit,
            rendement_pct=rendement_net(bien),
        ))

    for poche in config.actifs["liquidites"]:
        taux = poche.get("taux_annuel_pct")
        lignes.append(Ligne(
            classe="liquidites",
            nom=poche["nom"],
            detail="disponible",
            quantite=None,
            prix=None,
            valeur=float(poche["montant"]),
            rendement_pct=None if taux is None else float(taux),
        ))

    return lignes


def totaux_par_classe(lignes: list[Ligne]) -> dict[str, float]:
    totaux = {classe: 0.0 for classe in CLASSES}
    for ligne in lignes:
        if ligne.valeur is not None:
            totaux[ligne.classe] += ligne.valeur
    return totaux


# --------------------------------------------------------------------------
# Écarts et rééquilibrage — pur, testé
# --------------------------------------------------------------------------

@dataclass
class Ecart:
    classe: str
    valeur: float
    part_pct: float
    cible_pct: float
    ecart_pts: float
    ecart_eur: float      # négatif = sous-pondéré, positif = sur-pondéré
    hors_bande: bool


def analyser(totaux: dict[str, float], profil: Profil) -> list[Ecart]:
    total = sum(totaux.values())
    ecarts: list[Ecart] = []
    for classe in CLASSES:
        valeur = totaux[classe]
        cible_pct = profil.cibles_pct[classe]
        part_pct = 0.0 if total <= 0 else valeur / total * 100
        ecarts.append(Ecart(
            classe=classe,
            valeur=valeur,
            part_pct=part_pct,
            cible_pct=cible_pct,
            ecart_pts=part_pct - cible_pct,
            ecart_eur=valeur - total * cible_pct / 100,
            hors_bande=abs(part_pct - cible_pct) >= profil.bande_pct,
        ))
    return ecarts


def affecter_apport(apport: float, ecarts: list[Ecart]) -> dict[str, float]:
    """Répartit le prochain versement sur ce qui manque le plus, en euros.

    Le manque se mesure sur le patrimoine **après** versement, pas avant : les
    cibles étant des pourcentages, verser mille euros relève aussi la cible en
    euros de chaque classe. Rattraper l'écart d'avant laissait un résidu — un
    apport de cent mille euros sur un portefeuille déséquilibré retombait à
    49,98 % au lieu de 50 %.

    Proportionnel au manque et non à parts égales : une classe à dix mille
    euros de sa cible et une autre à cinq cents doivent être rattrapées dans ce
    rapport-là. Une classe déjà sur-pondérée ne reçoit rien — c'est la dilution
    par l'apport, qui corrige sans vendre, donc sans impôt.
    """
    if apport <= 0:
        return {ecart.classe: 0.0 for ecart in ecarts}

    total_apres = sum(ecart.valeur for ecart in ecarts) + apport
    besoins = {
        ecart.classe: max(0.0, total_apres * ecart.cible_pct / 100 - ecart.valeur)
        for ecart in ecarts
    }
    # Somme des besoins ≥ apport, avec égalité quand aucune classe n'est
    # sur-pondérée : la répartition tombe alors pile sur les cibles.
    total_besoins = sum(besoins.values())
    return {classe: apport * besoin / total_besoins for classe, besoin in besoins.items()}


MOIS_DE_PATIENCE = 12   # au-delà, l'écart n'est plus un accident de marché

# Alléger n'a pas le même sens selon la classe : ces phrases sont la différence
# entre un conseil applicable et un conseil qui fait perdre de l'argent.
CONSEIL_ALLEGEMENT = {
    "bourse": "à vendre d'abord dans le PEA ou l'assurance-vie, où l'arbitrage "
              "n'est pas imposé ; sur un compte-titres il l'est à 30 %",
    "crypto": "toute cession vers l'euro est imposée à 30 % : n'alléger que ce "
              "qui dépasse vraiment, et garder la trace des prix de revient",
    "immobilier": "un bien ne se vend pas par tranches ; cette sur-pondération "
                  "se corrige en renforçant les autres classes plutôt qu'en "
                  "touchant à celle-ci, sauf à vendre",
    "liquidites": "rien à vendre, seulement à placer : ce surplus dort",
}


def ventes_restantes(
    ecarts: list[Ecart], affectation: dict[str, float], bande_pct: float
) -> dict[str, float]:
    """Ce qu'il resterait à alléger après un an d'apports — décision 3 du fichier.

    Un versement mensuel ne rattrape presque jamais un gros écart d'un coup,
    mais douze y suffisent souvent. Ne proposer une vente qu'après les avoir
    simulés évite de conseiller chaque mois de vendre ce que l'apport corrigera
    de lui-même, sans impôt.
    """
    verse = {classe: montant * MOIS_DE_PATIENCE for classe, montant in affectation.items()}
    total_apres = sum(ecart.valeur for ecart in ecarts) + sum(verse.values())
    if total_apres <= 0:
        return {}

    ventes: dict[str, float] = {}
    for ecart in ecarts:
        valeur_apres = ecart.valeur + verse.get(ecart.classe, 0.0)
        part_apres = valeur_apres / total_apres * 100
        if part_apres - ecart.cible_pct >= bande_pct:
            ventes[ecart.classe] = valeur_apres - total_apres * ecart.cible_pct / 100
    return ventes


# --------------------------------------------------------------------------
# Affichage
# --------------------------------------------------------------------------

def euros(montant: float, decimales: int = 0) -> str:
    texte = f"{montant:,.{decimales}f}".replace(",", " ").replace(".", ",")
    return f"{texte} €"


def pourcent(valeur: float, decimales: int = 1) -> str:
    return f"{valeur:.{decimales}f}".replace(".", ",") + " %"


def points(valeur: float) -> str:
    """Un écart entre deux pourcentages se compte en points, pas en pourcent."""
    return f"{valeur:+.1f}".replace(".", ",") + " pts"


def _table_positions(lignes: list[Ligne]) -> str:
    rangs = []
    for ligne in sorted(lignes, key=lambda ligne: (CLASSES.index(ligne.classe), -(ligne.valeur or 0))):
        if ligne.plus_value is not None:
            info = f"{'+' if ligne.plus_value >= 0 else ''}{euros(ligne.plus_value)} latents"
        elif ligne.rendement_pct is not None:
            info = f"rendement {pourcent(ligne.rendement_pct)}"
        else:
            info = "—"
        rangs.append([
            ETIQUETTES[ligne.classe],
            ligne.nom,
            ligne.detail,
            "—" if ligne.quantite is None else f"{ligne.quantite:g}".replace(".", ","),
            "—" if ligne.prix is None else euros(ligne.prix, 2),
            "prix indisponible" if ligne.valeur is None else euros(ligne.valeur),
            info,
        ])
    return tabulate(
        rangs,
        headers=["Classe", "Actif", "Détail", "Qté", "Cours", "Valeur", "Suivi"],
        tablefmt="rounded_outline",
        colalign=("left", "left", "left", "right", "right", "right", "right"),
    )


def _table_repartition(ecarts: list[Ecart], bande_pct: float) -> str:
    rangs = []
    for ecart in ecarts:
        if not ecart.hors_bande:
            statut = "dans la bande"
        elif ecart.ecart_pts > 0:
            statut = "à alléger"
        else:
            statut = "à renforcer"
        rangs.append([
            ETIQUETTES[ecart.classe],
            euros(ecart.valeur),
            pourcent(ecart.part_pct),
            pourcent(ecart.cible_pct, 0),
            points(ecart.ecart_pts),
            statut,
        ])
    total = sum(ecart.valeur for ecart in ecarts)
    rangs.append(["Total", euros(total), pourcent(100 if total else 0), "100 %", "", ""])
    return tabulate(
        rangs,
        headers=["Classe", "Valeur nette", "Part", "Cible", f"Écart (bande ±{bande_pct:g} pts)", "Statut"],
        tablefmt="rounded_outline",
        colalign=("left", "right", "right", "right", "right", "left"),
    )


def _table_apport(affectation: dict[str, float], apport: float) -> str:
    rangs = [
        [ETIQUETTES[classe], euros(montant), pourcent(montant / apport * 100 if apport else 0)]
        for classe, montant in affectation.items()
        if montant >= 1
    ]
    return tabulate(
        rangs,
        headers=[f"Prochain apport ({euros(apport)})", "Montant", "Part"],
        tablefmt="rounded_outline",
        colalign=("left", "right", "right"),
    )


def rapport(config: Configuration, lignes: list[Ligne], avertissements: list[str]) -> str:
    """Le tableau complet, ou l'inventaire seul si un cours manque.

    Le conseil est retenu dès qu'une ligne n'a pas de prix : une répartition
    calculée sur un total incomplet reste plausible à l'écran, et c'est
    justement ce qui la rend dangereuse. L'inventaire, lui, garde sa valeur —
    il montre laquelle des sources n'a pas répondu.
    """
    profil = config.profil
    ecarts = analyser(totaux_par_classe(lignes), profil)
    total = sum(ecart.valeur for ecart in ecarts)
    partiel = any(ligne.valeur is None for ligne in lignes) or bool(avertissements)

    blocs = []
    if partiel:
        blocs += [
            "Total partiel — " + " ; ".join(avertissements or ["cours manquant"]) + ".",
            "",
        ]

    blocs += [
        f"Patrimoine {'partiel' if partiel else 'net'} : {euros(total)}"
        f"   ·   profil « {profil.appetence} »"
        f"   ·   horizon {profil.horizon_annees} ans",
        "",
        _table_positions(lignes),
        "",
        _table_repartition(ecarts, profil.bande_pct),
        "",
    ]

    if partiel:
        blocs.append(
            "Aucun conseil de rééquilibrage sur un total incomplet : les écarts "
            "ci-dessus sont faux tant qu'un cours manque. Relancer plus tard."
        )
        return "\n".join(blocs)

    affectation = affecter_apport(profil.apport_mensuel, ecarts)
    hors_bande = [ecart for ecart in ecarts if ecart.hors_bande]
    if not hors_bande:
        blocs.append(
            f"Aucun rééquilibrage : tout tient dans la bande de ±{profil.bande_pct:g} points. "
            "Ne rien faire est la bonne décision."
        )
    else:
        resume = ", ".join(
            f"{ETIQUETTES[e.classe]} {points(e.ecart_pts)} ({euros(abs(e.ecart_eur))})"
            for e in hors_bande
        )
        blocs.append(f"Hors bande : {resume}.")
        a_vendre = ventes_restantes(ecarts, affectation, profil.bande_pct)
        if a_vendre:
            blocs.append(
                f"Même après {MOIS_DE_PATIENCE} mois d'apport, il resterait à alléger :")
            blocs += [
                f"  · {ETIQUETTES[classe]} de {euros(montant)} — {CONSEIL_ALLEGEMENT[classe]}."
                for classe, montant in a_vendre.items()
            ]
        else:
            blocs.append(
                f"Aucune vente à prévoir : {MOIS_DE_PATIENCE} mois d'apport suffisent "
                "à ramener la répartition dans la bande, sans impôt."
            )

    if profil.apport_mensuel > 0:
        blocs += ["", _table_apport(affectation, profil.apport_mensuel)]
        if affectation.get("immobilier", 0) >= 1:
            blocs.append(
                "La part immobilière d'un apport mensuel se place en parts de SCPI "
                "ou en remboursement anticipé : elle ne s'achète pas au mètre carré."
            )

    return "\n".join(blocs)


# --------------------------------------------------------------------------
# Point d'entrée
# --------------------------------------------------------------------------

def relever_les_cours(config: Configuration) -> tuple[dict[str, float], dict[str, float], list[str]]:
    """Cours convertis en euros, et ce qui n'a pas pu être relevé."""
    avertissements: list[str] = []

    tickers = [actif["ticker"] for actif in config.actifs["bourse"]]
    bruts, echecs = cours_bourse(tickers)
    if echecs:
        avertissements.append("cours introuvable pour " + ", ".join(echecs))

    devises = {devise for _, devise in bruts.values()}
    taux = taux_vers_euro(devises) if devises - {"EUR"} else {"EUR": 1.0}
    actions_eur = {
        ticker: prix * taux[devise] for ticker, (prix, devise) in bruts.items()
    }

    identifiants = [actif["id_coingecko"] for actif in config.actifs["crypto"]]
    cryptos_eur, echecs_crypto = cours_crypto(identifiants)
    if echecs_crypto:
        avertissements.append("cours introuvable pour " + ", ".join(echecs_crypto))

    return actions_eur, cryptos_eur, avertissements


def main(argv: list[str] | None = None) -> int:
    analyseur = argparse.ArgumentParser(
        description="Suivi et rééquilibrage d'un patrimoine bourse / crypto / immobilier."
    )
    analyseur.add_argument(
        "--config", type=Path, default=CHEMIN_DEFAUT,
        help=f"fichier de configuration (défaut : {CHEMIN_DEFAUT.name} à côté du script)",
    )
    arguments = analyseur.parse_args(argv)

    try:
        config = charger(arguments.config)
    except ErreurConfiguration as erreur:
        print(f"Configuration : {erreur}", file=sys.stderr)
        return 2

    actions_eur, cryptos_eur, avertissements = relever_les_cours(config)
    lignes = valoriser(config, actions_eur, cryptos_eur)
    print(rapport(config, lignes, avertissements))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
