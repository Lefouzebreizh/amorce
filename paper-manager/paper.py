#!/usr/bin/env python3
"""Point d'entrée unique de Paper-Manager.

Un seul script pour les quatre modules, comme `kdp/kdp.py` : quatre commandes
séparées obligeraient à retenir quatre noms, et l'assistant existe précisément
pour ne rien avoir à retenir.

Sous-commandes écrites :

    etat      le tableau de bord : ce que je paie, ce qui arrive, ce qu'il faut faire
    agenda    les échéances vers un fichier .ics repris par l'agenda du téléphone
    champs    ce qu'un PDF déclare, et le squelette de plan qui va avec
    remplir   un formulaire rempli à partir d'un plan et de mes données
    resilier  le courrier de résiliation, prêt à relire et à signer
    classer   lire ce qui a été déposé, le nommer, et le ranger sur demande

Règle commune : **rien n'est écrasé sans le dire.** Une commande qui déplace ou
renomme simule par défaut et n'agit qu'avec `--appliquer` ; une commande qui
produit un fichier neuf refuse d'écraser un fichier existant sans `--ecraser`.
Seule exception, assumée : le fichier de rappels, qui n'est qu'un produit
dérivé des alertes et se réécrit à chaque passage — le protéger obligerait à
passer `--ecraser` chaque fois, ce qui reviendrait à ne plus rien protéger.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from dataclasses import replace

from core.abonnements import Tableau, alertes, euros, tableau
from core.calendrier import evenements, rendre
from core.config import ErreurConfiguration, charger, enregistrer_alertes
from core.formulaires import ErreurFormulaire, charger_plan, lire_champs, remplir, resoudre
from core.extraction import ErreurVision, Vision, a_relire, extraire
from core.journal import charger as charger_journal, enregistrer as enregistrer_journal
from core.modele import StatutAlerte
from core.nommage import ErreurNommage, destination, libre
from core.scan import ErreurLecture, lire
from core.resiliation import ErreurCourrier, composer, rendre_pdf

RACINE = Path(__file__).resolve().parent


def commande_etat(arguments: argparse.Namespace) -> int:
    configuration = charger(arguments.config)
    # Le journal débloque deux types d'alerte ; son absence n'est pas une erreur,
    # c'est un coffre qu'on n'a pas encore rempli.
    journal = charger_journal(configuration.classement.racine / "documents.json")
    etat = tableau(configuration, journal=journal)

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


def commande_agenda(arguments: argparse.Namespace) -> int:
    configuration = charger(arguments.config)
    aujourdhui = date.today()
    journal = charger_journal(configuration.classement.racine / "documents.json")
    ouvertes = alertes(configuration, aujourdhui, journal=journal)
    liste = evenements(configuration, ouvertes, aujourdhui)

    sortie = Path(arguments.vers) if arguments.vers else configuration.rappels.sortie_ics
    sortie.parent.mkdir(parents=True, exist_ok=True)
    # `newline=""` : sans lui, Python retraduirait les fins de ligne du texte et
    # produirait des CRCRLF sur une machine Windows. La norme veut des CRLF.
    sortie.write_text(rendre(liste, aujourdhui), encoding="utf-8", newline="")

    print(f"{sortie} — {len(liste)} rappel(s).")
    laissees = len(ouvertes) - len(liste)
    if laissees:
        print(f"{laissees} échéance(s) passée(s) ou traitée(s) laissée(s) de côté : "
              "voir « paper.py etat ».")
    return 0


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


def commande_resilier(arguments: argparse.Namespace) -> int:
    configuration = charger(arguments.config)
    abonnement = configuration.abonnement(arguments.abonnement)
    aujourdhui = date.today()
    courrier = composer(configuration, abonnement, aujourdhui,
                        gabarit=arguments.gabarit, motif=arguments.motif or "")

    extension = "txt" if arguments.texte else "pdf"
    sortie = Path(arguments.vers) if arguments.vers else (
        configuration.classement.courriers
        / f"{aujourdhui:%Y-%m-%d}_resiliation_{abonnement.id}.{extension}")
    if sortie.exists() and not arguments.ecraser:
        raise ErreurCourrier(f"{sortie} existe déjà — passer --ecraser pour le remplacer")

    if arguments.texte:
        sortie.parent.mkdir(parents=True, exist_ok=True)
        sortie.write_text(f"Objet : {courrier.objet}\n\n{courrier.corps}\n", encoding="utf-8")
    else:
        rendre_pdf(courrier, configuration.identite, sortie)

    print(f"{sortie}\n  gabarit « {courrier.gabarit} », effet demandé au "
          f"{courrier.date_effet:%d/%m/%Y}.")
    if courrier.recommande:
        print("  À envoyer en recommandé avec accusé de réception : en cas de litige, "
              "c'est la preuve de l'envoi qui fait foi.")
    if abonnement.resiliable_en_ligne and abonnement.adresse_resiliation:
        print(f"  Ce contrat se résilie aussi en ligne : {abonnement.adresse_resiliation}"
              " — le courrier reste utile comme preuve (--texte pour le coller dans un formulaire).")
    print("  Rien n'a été envoyé : relire, signer, poster.")
    return 0


def commande_classer(arguments: argparse.Namespace) -> int:
    """Lit ce qui a été déposé, le nomme, et — seulement si on le demande — le range.

    Simule par défaut : un classement automatique dont on n'a pas vu la sortie
    une première fois est un classement qu'on refait à la main.
    """
    configuration = charger(arguments.config)
    classement = configuration.classement
    entree = Path(arguments.source) if arguments.source else classement.entree
    if not entree.is_dir():
        raise ErreurConfiguration(f"{entree} n'est pas un dossier où déposer des documents")

    journal = charger_journal(classement.racine / "documents.json")
    aujourdhui = date.today()
    # Le chemin par modèle n'existe que si la configuration l'autorise. Sans
    # clé, `cle_api()` rend None et le SDK cherche ailleurs — un jeton, un
    # profil ouvert — plutôt que de conclure à sa place.
    vision = Vision(modele=configuration.extraction.modele,
                    cle=configuration.extraction.cle_api()) \
        if configuration.extraction.active and configuration.extraction.modele else None
    ranges: list[tuple[Path, Path]] = []
    a_revoir: list[tuple[Path, list[str]]] = []
    # Deux raisons très différentes de ne pas classer un fichier, et les
    # confondre inquiète : « déjà rangé la semaine dernière » est une bonne
    # nouvelle, « deux copies dans le même dépôt » demande de choisir.
    deja_classes: list[Path] = []
    doublons_du_lot: list[Path] = []
    connues = set(journal.documents)

    for fichier in sorted(p for p in entree.iterdir() if p.is_file()):
        try:
            lecture = lire(fichier, dossier_images=classement.racine / "rendus")
        except (ErreurLecture, ErreurVision) as erreur:
            # Un fichier illisible n'arrête pas le lot : les autres sont déposés
            # en même temps, et les traiter vaut mieux que de tout suspendre.
            a_revoir.append((fichier, [str(erreur)]))
            continue

        if lecture.empreinte in connues:
            deja_classes.append(fichier)
            continue
        if journal.connu(lecture.empreinte):
            doublons_du_lot.append(fichier)
            continue

        try:
            document = extraire(lecture, configuration.extraction.emetteurs_connus, aujourdhui,
                                vision=vision, seuil=configuration.extraction.confiance_minimale)
        except ErreurVision as erreur:
            a_revoir.append((fichier, [str(erreur)]))
            continue
        manques = a_relire(document, configuration.extraction.confiance_minimale)
        if manques:
            a_revoir.append((fichier, manques))
            continue
        try:
            vers = libre(destination(document, classement.classes, classement.modele_dossier,
                                     classement.modele_nom, fichier.suffix or ".pdf"))
        except ErreurNommage as erreur:
            a_revoir.append((fichier, [str(erreur)]))
            continue
        ranges.append((fichier, vers))
        journal.inscrire(replace(document, id=vers.stem, chemin=str(vers)))

    _rendre_compte(ranges, a_revoir, deja_classes, doublons_du_lot, entree)

    if arguments.appliquer and ranges:
        for depuis, vers in ranges:
            vers.parent.mkdir(parents=True, exist_ok=True)
            depuis.rename(vers)
        enregistrer_journal(journal)
        print(f"\n{len(ranges)} document(s) rangé(s), journal à jour.")
    elif ranges:
        print("\nSimulation : rien n'a bougé. « --appliquer » pour ranger pour de bon.")
    return 0


def _rendre_compte(ranges, a_revoir, deja_classes, doublons_du_lot, entree) -> None:
    print(f"Dépôt : {entree}\n")
    if not (ranges or a_revoir or deja_classes or doublons_du_lot):
        print("  Rien à classer.")
        return
    for depuis, vers in ranges:
        print(f"  → {depuis.name}\n      {vers}")
    if deja_classes:
        print(f"\n  {len(deja_classes)} déjà rangé(s) lors d'un passage précédent : "
              + ", ".join(f.name for f in deja_classes))
    if doublons_du_lot:
        print(f"\n  {len(doublons_du_lot)} copie(s) d'un fichier du même dépôt, "
              "laissée(s) de côté : " + ", ".join(f.name for f in doublons_du_lot))
    if a_revoir:
        print(f"\n  À RELIRE ({len(a_revoir)}) — laissés dans le dépôt")
        for fichier, raisons in a_revoir:
            print(f"  ? {fichier.name}")
            for raison in raisons:
                print(f"      {raison}")


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

    agenda = commandes.add_parser("agenda", help="écrire les rappels dans un fichier .ics")
    agenda.add_argument("--vers", help="fichier de sortie (défaut : rappels.sortie_ics)")
    agenda.add_argument("--config", default=str(RACINE / "admin_config.json"))
    agenda.set_defaults(fonction=commande_agenda)

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

    resilier = commandes.add_parser("resilier", help="produire le courrier de résiliation")
    resilier.add_argument("abonnement", help="identifiant du contrat à résilier")
    resilier.add_argument("--gabarit", help="forcer un gabarit de modeles/ (sans l'extension)")
    resilier.add_argument("--motif", help="motif à citer, si on souhaite en donner un")
    resilier.add_argument("--texte", action="store_true",
                          help="sortir en texte, pour coller dans un formulaire en ligne")
    resilier.add_argument("--vers", help="fichier de sortie")
    resilier.add_argument("--ecraser", action="store_true", help="remplacer la sortie existante")
    resilier.add_argument("--config", default=str(RACINE / "admin_config.json"))
    resilier.set_defaults(fonction=commande_resilier)

    classer = commandes.add_parser("classer", help="lire, nommer et ranger ce qui a été déposé")
    classer.add_argument("--source", help="dossier de dépôt (défaut : classement.entree)")
    classer.add_argument("--appliquer", action="store_true",
                         help="déplacer pour de bon, au lieu de simuler")
    classer.add_argument("--config", default=str(RACINE / "admin_config.json"))
    classer.set_defaults(fonction=commande_classer)

    return analyseur.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    arguments = analyser(argv)
    try:
        return arguments.fonction(arguments)
    except (ErreurConfiguration, ErreurFormulaire, ErreurCourrier,
            ErreurLecture, ErreurNommage, ErreurVision) as erreur:
        print(f"paper.py : {erreur}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
