#!/usr/bin/env python3
"""Répondre aux commentaires récents d'une page ou d'un groupe Facebook.

Cinq décisions tiennent ce fichier :

1. **Publier se demande.** Sans `--publier`, le script montre ce qu'il ferait
   et n'envoie rien. Un commentaire posté sous une publication vue par des
   dizaines de milliers de personnes ne se reprend pas : le mode qui engage la
   parole de quelqu'un ne peut pas être celui qu'on obtient en oubliant une
   option.
2. **En simulation, le journal ne bouge pas.** Un essai qui marquerait les
   commentaires comme traités les ferait disparaître de la vraie exécution
   suivante — sans qu'aucune réponse n'ait jamais été publiée.
3. **Presque chaque commentaire reçoit un « j'aime », la parole est
   l'exception.** C'est ce que fait une personne réelle : elle aime beaucoup,
   elle répond peu. Répondre à tout s'entend immédiatement comme un automate,
   et fait perdre leur valeur aux réponses qui comptent. La seule exception est
   `moderation` : sous une attaque ou une accusation, un pouce levé ne dit plus
   « j'ai lu », il dit « et ça me va » — devant toute la communauté.
4. **Le rythme est tenu ici**, pas dans les modules : plafonds, heures, pauses
   tirées au hasard et quota Facebook sont des décisions d'exécution.
5. **Un quota atteint arrête tout, tout de suite.** Facebook demande une pause ;
   la prendre coûte une exécution, insister coûte des heures de blocage.

Usage :
    python3 repondeur.py                  # montre ce qui serait fait
    python3 repondeur.py --publier        # agit pour de vrai
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import anthropic
import requests
from dotenv import load_dotenv

from core import redaction, rythme
from core.alerte import Sonnette, rediger_bilan
from core.facebook import ErreurGraph, ErreurQuota, Graph
from core.journal import Journal, retenir

ICI = Path(__file__).resolve().parent


def arguments() -> argparse.Namespace:
    analyseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    analyseur.add_argument('--publier', action='store_true',
                           help='agir réellement (sinon : simulation)')
    analyseur.add_argument('--publications', type=int, default=5,
                           help='nombre de publications récentes à examiner')
    analyseur.add_argument('--maximum', type=int, default=5,
                           help='nombre maximum de commentaires traités en une exécution')
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

    if options.publier and not rythme.heure_ouvrable(datetime.now()):
        # La nuit, on lit et on prépare ; on ne publie pas. Un compte qui répond
        # à quatre heures du matin, tous les jours, ne dort jamais.
        print(f'🌙 Hors des heures humaines ({rythme.HEURE_REVEIL} h – '
              f'{rythme.HEURE_COUCHER} h). Relance sans --publier pour préparer.')
        return 0

    budget = rythme.reste_a_faire(options.maximum, journal.compte_du_jour())
    if options.publier and budget == 0:
        print(f'🛑 Plafond du jour atteint ({rythme.PLAFOND_JOUR}). À demain.')
        return 0

    print('🔄 Récupération des commentaires…')
    try:
        commentaires = graph.commentaires(graph.identite(),
                                          publications=options.publications)
    except (ErreurGraph, OSError) as erreur:
        print(f'❌ Facebook : {erreur}')
        return 1

    a_traiter = retenir(commentaires, journal)
    print(f'✅ {len(commentaires)} commentaires lus, {len(a_traiter)} à traiter, '
          f'{budget if options.publier else options.maximum} traitables maintenant.')
    if not options.publier:
        print('🧪 Simulation : rien ne sera envoyé (ajouter --publier).')

    plafond = budget if options.publier else options.maximum
    publiees: list[tuple[str, str]] = []
    reactions: list[str] = []
    laissees: list[tuple[str, str]] = []
    echecs: list[tuple[str, str]] = []

    for commentaire in a_traiter[:plafond]:
        print(f'\n👉 {commentaire.auteur} : « {commentaire.texte[:120]} »')
        try:
            verdict = redaction.rediger(plume, commentaire.auteur, commentaire.texte)
        except anthropic.APIError as erreur:
            print(f'⚠️  Rédaction impossible : {erreur}')
            echecs.append((commentaire.auteur, f'rédaction : {erreur}'))
            continue

        if verdict.geste == redaction.MODERATION:
            print(f'🚫 À modérer, sans « j\'aime » — {verdict.raison}')
        elif verdict.a_laisser:
            print(f'✋ À toi de répondre — {verdict.raison}')
        elif verdict.a_ecrire:
            print(f'💬 {verdict.reponse}')
        else:
            print(f'👍 Réaction seule — {verdict.raison}')

        if not options.publier:
            _ranger(verdict, commentaire.auteur, publiees, reactions, laissees)
            continue

        # Inscrire d'abord : une coupure ici coûte une action manquante,
        # jamais une réponse en double (voir `journal.py`).
        journal.reserver(commentaire.id, verdict.geste)
        try:
            # Le « j'aime » d'abord : c'est le geste qui dit « j'ai lu », et il
            # vaut même sous un commentaire qu'on laisse à l'humain. Sauf sous
            # ce qui est à modérer, où il vaudrait approbation.
            if verdict.a_aimer:
                graph.aimer(commentaire.id)
            if verdict.a_ecrire:
                graph.repondre(commentaire.id, verdict.reponse)
            print('   ✔ fait')
            _ranger(verdict, commentaire.auteur, publiees, reactions, laissees)
        except ErreurQuota as erreur:
            print(f'   🛑 Quota Facebook atteint : {erreur}')
            echecs.append((commentaire.auteur, f'quota : {erreur}'))
            break
        except (ErreurGraph, OSError) as erreur:
            print(f'   ❌ refusé : {erreur}')
            echecs.append((commentaire.auteur, str(erreur)))
            continue

        if graph.quota >= rythme.QUOTA_MAX:
            print(f'   🛑 Quota Facebook à {graph.quota:.0f} %. On s’arrête avant le mur.')
            break

        attente = rythme.pause()
        print(f'   ⏳ pause de {attente:.0f} s')
        time.sleep(attente)

    prevenir(publiees, reactions, laissees, echecs, options.publier)
    return 0


def _ranger(verdict, auteur: str, publiees: list, reactions: list, laissees: list) -> None:
    """Classe le commentaire dans le bon seau du bilan."""
    if verdict.a_laisser:
        laissees.append((auteur, verdict.raison))
    elif verdict.a_ecrire:
        publiees.append((auteur, verdict.reponse))
    else:
        reactions.append(auteur)


def prevenir(publiees, reactions, laissees, echecs, publie: bool) -> None:
    """La notification de fin — sauf quand il n'y avait rien à faire.

    Le script est fait pour tourner régulièrement, et la plupart de ses
    exécutions ne trouveront rien de neuf : une notification « rien à
    signaler » plusieurs fois par jour finit par se balayer sans être lue,
    celle du jour où un commentaire attend une réponse avec.
    """
    sonnette = Sonnette.depuis_environnement()
    if sonnette is None or not (publiees or reactions or laissees or echecs):
        return
    titre, corps, prioritaire = rediger_bilan(publiees, reactions, laissees, echecs, publie)
    try:
        sonnette.envoyer(titre, corps, prioritaire)
        print(f'\n🔔 Notification envoyée ({titre}).')
    except (requests.RequestException, OSError) as erreur:
        print(f'\n⚠️  Notification non envoyée : {erreur}')


if __name__ == '__main__':
    sys.exit(main())
