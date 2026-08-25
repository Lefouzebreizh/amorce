#!/usr/bin/env python3
"""Point d'entrée unique de Paper-Manager.

Un seul script pour les quatre modules, comme `kdp/kdp.py` : quatre commandes
séparées obligeraient à retenir quatre noms, et l'assistant existe précisément
pour ne rien avoir à retenir.

Sous-commandes écrites :

    etat      le tableau de bord : ce que je paie, ce qui arrive, ce qu'il faut faire
    champs    ce qu'un PDF déclare, et le squelette de plan qui va avec
    remplir   un formulaire rempli à partir d'un plan et de mes données

Sous-commandes prévues : `classer` (module 1), `agenda` (module 2),
`resilier` (module 4).

Règle commune : **rien n'est écrasé sans le dire.** Une commande qui déplace ou
renomme simule par défaut et n'agit qu'avec `--appliquer` ; une commande qui
produit un fichier neuf refuse d'écraser un fichier existant sans `--ecraser`.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from dataclasses import replace

from core.abonnements import Tableau, euros, tableau
from core.config import ErreurConfiguration, charger, enregistrer_alertes
from core.formulaires import ErreurFormulaire, charger_plan, lire_champs, remplir, resoudre
from core.modele import StatutAlerte

RACINE = Path(__file__).resolve().parent


def commande_etat(arguments: argparse.Namespace) -> int:
    configuration = charger(arguments.config)
    etat = tableau(configuration)

    if arguments.traiter or arguments.reporter:
        etat = _changer_statut(configuration, etat, arguments)

    _afficher(etat)

    if arguments.enregistrer:
        enregistrer_alertes(configuration, etat.alertes)
        print(f"\nAlertes enregistrées dans {configuration.chemin}.")
    return 0


def _changer_statut(configuration, etat: Tableau, arguments: argparse.Namespace) -> Tableau:
    """Marque une alerte traitée ou reportée, et l'enregistre aussitôt.

    Le statut est la seule chose que le programme ne calcule pas : la perdre
    ferait revenir demain ce dont on s'est occupé aujourd'hui.
    """
    identifiant = arguments.traiter or arguments.reporter
    statut = StatutAlerte.TRAITEE if arguments.traiter else StatutAlerte.REPORTEE
    visees = [alerte for alerte in etat.alertes if alerte.id == identifiant]
    if not visees:
        ouvertes = ", ".join(a.id for a in etat.alertes if a.visible(etat.le)) or "aucune"
        raise ErreurConfiguration(f"alerte « {identifiant} » inconnue (ouvertes : {ouvertes})")

    fondues = [replace(a, statut=statut) if a.id == identifiant else a for a in etat.alertes]
    enregistrer_alertes(configuration, fondues)
    print(f"{identifiant} : {statut.value}.\n")
    return replace(etat, alertes=fondues)


def _afficher(etat: Tableau) -> None:
    print(f"Tableau de bord — {etat.le:%d/%m/%Y}\n")
    print(f"  {euros(etat.total_mensuel)} par mois, {euros(etat.total_annuel)} par an")
    print("  " + "   ".join(f"{cle} {euros(montant)}" for cle, montant in etat.par_categorie.items()))

    visibles = [alerte for alerte in etat.alertes if alerte.visible(etat.le)]
    if visibles:
        print(f"\n  À FAIRE ({len(visibles)})")
        for alerte in visibles:
            retard = (etat.le - alerte.echeance).days
            delai = f"en retard de {retard} jours" if retard > 0 else f"dans {-retard} jours"
            print(f"  ! {alerte.echeance:%d/%m/%Y}  {alerte.action}")
            print(f"      {delai} · {alerte.id}")
    sommeil = len(etat.alertes) - len(visibles)
    if sommeil:
        print(f"\n  {sommeil} alerte(s) en sommeil (reportée, traitée, ou pas encore d'actualité).")

    print(f"\n  CONTRATS ({len(etat.lignes)})")
    largeur = max((len(ligne.abonnement.libelle) for ligne in etat.lignes), default=0)
    for ligne in etat.lignes:
        preavis = f"{ligne.preavis:%d/%m/%Y}" if ligne.preavis else "     —    "
        note = ""
        if ligne.mois_restants:
            note = (f"  engagement : {ligne.mois_restants} mois, "
                    f"partir maintenant coûte {euros(ligne.cout_sortie)}")
        print(f"  {preavis}  {ligne.abonnement.libelle:<{largeur}}  "
              f"{euros(ligne.mensuel):>10}/mois{note}")


def commande_champs(arguments: argparse.Namespace) -> int:
    champs = lire_champs(arguments.pdf)
    if not champs:
        print(f"{arguments.pdf} ne déclare aucun champ : c'est un PDF plat.")
        print("Le plan devra porter une section « positions » — voir modeles/formulaires/.")
        return 0

    if arguments.gabarit:
        # Recopier quarante noms de champs à la main est la corvée qui fait
        # abandonner l'outil avant le premier formulaire rempli.
        plan = {
            "nom": Path(arguments.pdf).stem,
            "titre": "",
            "source": str(arguments.pdf),
            "champs": {champ.nom: (False if champ.type == "case" else "") for champ in champs},
        }
        print(json.dumps(plan, indent=2, ensure_ascii=False))
        return 0

    largeur = max(len(champ.nom) for champ in champs)
    for champ in champs:
        valeurs = f"  [{', '.join(champ.valeurs)}]" if champ.valeurs else ""
        print(f"page {champ.page}  {champ.nom:<{largeur}}  {champ.type}{valeurs}")
    print(f"\n{len(champs)} champs.")
    return 0


def commande_remplir(arguments: argparse.Namespace) -> int:
    configuration = charger(arguments.config)
    plan = charger_plan(arguments.plan)

    contexte: dict[str, object] = {"identite": configuration.identite}
    if arguments.abonnement:
        contexte["abonnement"] = configuration.abonnement(arguments.abonnement)

    source = Path(arguments.source) if arguments.source else plan.source
    if not source or not Path(source).exists():
        raise ErreurFormulaire(
            f"formulaire vierge introuvable : {source or '« source » absent du plan'}. "
            "Les PDF vierges vivent dans coffre/formulaires/ (ils ne sont pas versionnés)."
        )

    if arguments.vers:
        sortie = Path(arguments.vers)
    else:
        suffixe = f"_{arguments.abonnement}" if arguments.abonnement else ""
        sortie = configuration.classement.courriers / f"{date.today():%Y-%m-%d}_{plan.nom}{suffixe}.pdf"
    if sortie.exists() and not arguments.ecraser:
        raise ErreurFormulaire(f"{sortie} existe déjà — passer --ecraser pour le remplacer")

    valeurs = resoudre(plan.champs, contexte)
    ecrits = remplir(source, valeurs, sortie, positions=plan.positions, aplatir=not arguments.modifiable)
    print(f"{sortie} — {len(ecrits)} champs remplis.")
    if arguments.modifiable:
        print("Champs laissés modifiables : certains lecteurs les impriment vierges.")
    return 0


def analyser(argv: list[str] | None = None) -> argparse.Namespace:
    analyseur = argparse.ArgumentParser(prog="paper.py", description=__doc__.splitlines()[0])
    commandes = analyseur.add_subparsers(dest="commande", required=True)

    etat = commandes.add_parser("etat", help="le tableau de bord et les alertes")
    etat.add_argument("--traiter", metavar="ID", help="marquer une alerte comme traitée")
    etat.add_argument("--reporter", metavar="ID",
                      help="masquer une alerte jusqu'à son échéance")
    etat.add_argument("--enregistrer", action="store_true",
                      help="écrire les alertes recalculées dans la configuration")
    etat.add_argument("--config", default=str(RACINE / "admin_config.json"))
    etat.set_defaults(fonction=commande_etat)

    champs = commandes.add_parser("champs", help="lister les champs d'un PDF")
    champs.add_argument("pdf", help="le formulaire vierge")
    champs.add_argument("--gabarit", action="store_true",
                        help="sortir un squelette de plan à compléter")
    champs.set_defaults(fonction=commande_champs)

    remplir_ = commandes.add_parser("remplir", help="remplir un formulaire à partir d'un plan")
    remplir_.add_argument("plan", help="modeles/formulaires/<nom>.json")
    remplir_.add_argument("--abonnement", help="identifiant du contrat concerné")
    remplir_.add_argument("--source", help="le PDF vierge, si le plan n'en donne pas")
    remplir_.add_argument("--vers", help="fichier de sortie")
    remplir_.add_argument("--ecraser", action="store_true", help="remplacer la sortie existante")
    remplir_.add_argument("--modifiable", action="store_true",
                          help="laisser les champs modifiables au lieu de les graver")
    remplir_.add_argument("--config", default=str(RACINE / "admin_config.json"))
    remplir_.set_defaults(fonction=commande_remplir)

    return analyseur.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    arguments = analyser(argv)
    try:
        return arguments.fonction(arguments)
    except (ErreurConfiguration, ErreurFormulaire) as erreur:
        print(f"paper.py : {erreur}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
