#!/usr/bin/env python3
"""Répondre aux commentaires récents d'une page ou d'un groupe Facebook.

Trois décisions tiennent ce fichier :

1. **Publier se demande.** Sans `--publier`, le script montre ce qu'il
   publierait et n'envoie rien. Un commentaire posté sous une publication vue
   par des dizaines de milliers de personnes ne se reprend pas : le mode qui
   engage la parole de quelqu'un ne peut pas être celui qu'on obtient en
   oubliant une option.
2. **En simulation, le journal ne bouge pas.** Un essai qui marquerait les
   commentaires comme traités les ferait disparaître de la vraie exécution
   suivante — sans qu'aucune réponse n'ait jamais été publiée.
3. **Une exécution est bornée.** Un nombre maximum de réponses, une pause entre
   chacune : c'est ce qui distingue une aide d'un robot, aux yeux des membres
   comme à ceux de Facebook.

Usage :
    python3 repondeur.py                  # montre ce qui serait publié
    python3 repondeur.py --publier        # publie pour de vrai
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import anthropic
import requests
from dotenv import load_dotenv

from core import redaction
from core.alerte import Sonnette, rediger_bilan
from core.facebook import ErreurGraph, Graph
from core.journal import Journal, retenir

ICI = Path(__file__).resolve().parent
PAUSE_S = 3.0   # entre deux publications : une rafale se voit, et se signale


def arguments() -> argparse.Namespace:
    analyseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analyseur.add_argument('--publier', action='store_true',
                           help='envoyer réellement les réponses (sinon : simulation)')
    analyseur.add_argument('--publications', type=int, default=5,
                           help='nombre de publications récentes à examiner')
    analyseur.add_argument('--maximum', type=int, default=5,
                           help='nombre maximum de réponses publiées en une exécution')
    analyseur.add_argument('--journal', type=Path, default=ICI / 'journal.jsonl',
                           help='fichier des commentaires déjà traités')
    return analyseur.parse_args()


def main() -> int:
    options = arguments()
    load_dotenv(ICI / 'config.env')

    jeton = os.getenv('FB_ACCESS_TOKEN')
    id_source = os.getenv('FB_GROUP_ID')
    if not jeton or not id_source:
        print('❌ FB_ACCESS_TOKEN et FB_GROUP_ID sont attendus dans config.env')
        return 1
    if not os.getenv('ANTHROPIC_API_KEY'):
        print('❌ ANTHROPIC_API_KEY est attendu dans config.env')
        return 1

    graph = Graph(jeton, id_source, os.getenv('FB_API_VERSION') or 'v23.0')
    plume = anthropic.Anthropic()
    journal = Journal(options.journal)

    notre_id = graph.identite()
    if not notre_id:
        print("⚠️  Identité du compte introuvable : impossible d'écarter à coup sûr "
              'les commentaires déjà traités par toi-même.')

    print('🔄 Récupération des commentaires…')
    try:
        commentaires = graph.commentaires(notre_id, publications=options.publications)
    except (ErreurGraph, OSError) as erreur:
        print(f'❌ Facebook : {erreur}')
        return 1

    a_traiter = retenir(commentaires, journal)
    print(f'✅ {len(commentaires)} commentaires lus, {len(a_traiter)} à traiter.')
    if not options.publier:
        print('🧪 Simulation : rien ne sera publié (ajouter --publier).')

    publiees: list[tuple[str, str]] = []
    laissees: list[tuple[str, str]] = []
    echecs: list[tuple[str, str]] = []

    for commentaire in a_traiter[:options.maximum]:
        print(f'\n👉 {commentaire.auteur} : « {commentaire.texte[:120]} »')
        try:
            verdict = redaction.rediger(plume, commentaire.auteur, commentaire.texte)
        except anthropic.APIError as erreur:
            print(f'⚠️  Rédaction impossible : {erreur}')
            echecs.append((commentaire.auteur, f'rédaction : {erreur}'))
            continue

        if verdict.a_laisser:
            print(f'✋ À toi de répondre — {verdict.raison}')
            laissees.append((commentaire.auteur, verdict.raison))
            if options.publier:
                journal.reserver(commentaire.id, 'laissé à toi')
            continue

        print(f'💬 {verdict.reponse}')
        if not options.publier:
            publiees.append((commentaire.auteur, verdict.reponse))
            continue

        # Inscrire d'abord : une coupure ici coûte une réponse manquante,
        # jamais une réponse en double (voir `journal.py`).
        journal.reserver(commentaire.id, 'répondu')
        try:
            graph.repondre(commentaire.id, verdict.reponse)
            print('   ✔ publiée')
            publiees.append((commentaire.auteur, verdict.reponse))
        except (ErreurGraph, OSError) as erreur:
            print(f'   ❌ envoi refusé : {erreur}')
            echecs.append((commentaire.auteur, f'envoi : {erreur}'))
            continue

        try:
            graph.aimer(commentaire.id)
            print('   👍 aimé')
        except (ErreurGraph, OSError) as erreur:
            # Accessoire : la réponse est passée, c'est elle qui compte.
            print(f'   ⚠️  « j’aime » refusé : {erreur}')

        time.sleep(PAUSE_S)

    prevenir(publiees, laissees, echecs, options.publier)
    return 0


def prevenir(publiees, laissees, echecs, publie: bool) -> None:
    """La notification de fin — sauf quand il n'y avait rien à faire.

    Le script est fait pour tourner régulièrement, et la plupart de ses
    exécutions ne trouveront rien de neuf : une notification « rien à
    signaler » plusieurs fois par jour finit par se balayer sans être lue,
    celle du jour où un commentaire attend une réponse avec.
    """
    sonnette = Sonnette.depuis_environnement()
    if sonnette is None or not (publiees or laissees or echecs):
        return
    titre, corps, prioritaire = rediger_bilan(publiees, laissees, echecs, publie)
    try:
        sonnette.envoyer(titre, corps, prioritaire)
        print(f'\n🔔 Notification envoyée ({titre}).')
    except (requests.RequestException, OSError) as erreur:
        print(f'\n⚠️  Notification non envoyée : {erreur}')


if __name__ == '__main__':
    sys.exit(main())
