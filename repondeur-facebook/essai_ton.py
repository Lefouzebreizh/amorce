#!/usr/bin/env python3
"""Éprouver le ton des réponses, sans toucher à Facebook.

Trois décisions tiennent ce fichier :

1. **Rien ici ne connaît Facebook.** Ni jeton, ni journal, ni « j'aime » : on
   veut savoir si la voix ressemble à la sienne et si les bons commentaires
   sont laissés à l'humain, et ces deux questions se répondent sans compte, sans
   quota et sans risque de publier quoi que ce soit.
2. **Les commentaires d'essai couvrent les quatre gestes et les pièges**, pas
   seulement le cas facile : un texte trop court, un bravo, une question, un
   doute, une confidence, une question dont la réponse n'appartient qu'à
   l'auteur, une attaque, et une tentative de détournement de consigne. Un banc
   d'essai qui ne montre que des réussites ne dit rien. Un second banc,
   `--limites`, ne garde que les cas où deux gestes se disputent le
   commentaire ; les deux vivent dans `core/series_essai.py`, hors de portée du
   SDK, pour qu'une assertion puisse les garder.
3. **Le geste attendu est affiché à côté du geste obtenu.** Sans lui, on relit
   huit réponses plausibles et on ne voit pas celle qui aurait dû être laissée.
   C'est un repère, pas un verdict : le modèle a le droit d'hésiter entre
   `reaction` et `reponse` sur un commentaire tiède.

Usage :
    python3 essai_ton.py                       # la série d'essai complète
    python3 essai_ton.py --limites             # les seuls cas de bordure
    python3 essai_ton.py --tout                # les deux bancs à la suite
    python3 essai_ton.py -c "ton commentaire"  # un commentaire à toi
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

from core import redaction
from core.series_essai import LIMITES, SERIE

ICI = Path(__file__).resolve().parent

SYMBOLES = {redaction.REACTION: '👍', redaction.REPONSE: '💬',
            redaction.A_TOI: '✋', redaction.MODERATION: '🚫'}


def montrer(auteur: str, texte: str, attendu: str | None, verdict: redaction.Verdict) -> bool:
    """Affiche un cas, et dit si le geste obtenu est celui qu'on espérait."""
    conforme = attendu is None or verdict.geste == attendu
    print(f'\n👉 {auteur} : « {texte} »')
    repere = '' if attendu is None else ('  ✔' if conforme else f'  ⚠️  attendu : {attendu}')
    aime = '' if verdict.a_aimer else '  (sans « j’aime »)'
    print(f'   {SYMBOLES.get(verdict.geste, "?")} {verdict.geste} — '
          f'{verdict.raison}{aime}{repere}')
    if verdict.a_ecrire:
        print(f'   💬 {verdict.reponse}')
    return conforme


def main() -> int:
    analyseur = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    # Exclusifs : chacun désigne ce qu'on éprouve, et deux réponses à cette
    # question-là n'ont pas de sens.
    banc = analyseur.add_mutually_exclusive_group()
    banc.add_argument('-c', '--commentaire', help='éprouver un commentaire à toi')
    banc.add_argument('-l', '--limites', action='store_true',
                      help='les cas de bordure, où deux gestes se disputent le commentaire')
    banc.add_argument('-t', '--tout', action='store_true',
                      help='la série d’essai suivie des cas de bordure')
    analyseur.add_argument('-a', '--auteur', default='Camille',
                           help='prénom de l’auteur du commentaire (défaut : Camille)')
    options = analyseur.parse_args()

    load_dotenv(ICI / 'config.env')
    if not os.getenv('ANTHROPIC_API_KEY'):
        print('❌ ANTHROPIC_API_KEY est attendu dans config.env')
        return 1

    plume = anthropic.Anthropic()
    if options.commentaire:
        cas = [(options.auteur, options.commentaire, None)]
    elif options.limites:
        cas = list(LIMITES)
    elif options.tout:
        cas = list(SERIE) + list(LIMITES)
    else:
        cas = list(SERIE)

    print(f'🧪 {len(cas)} commentaire(s) inventé(s). Facebook n’est pas appelé, '
          'rien ne sera publié.')

    ecarts = 0
    for auteur, texte, attendu in cas:
        try:
            verdict = redaction.rediger(plume, auteur, texte)
        except anthropic.APIError as erreur:
            # Presque toujours la clé ou le crédit, et le message de l'API le dit
            # mieux que nous ne le devinerions.
            print(f'\n❌ Appel au modèle impossible : {erreur}')
            return 1
        if not montrer(auteur, texte, attendu, verdict):
            ecarts += 1

    if options.commentaire is None:
        print(f'\n📊 {len(cas) - ecarts}/{len(cas)} gestes conformes au repère.')
        print('   Ce qui compte davantage : relis les réponses écrites. '
              'Est-ce que c’est toi qui parles ?')
    return 0


if __name__ == '__main__':
    sys.exit(main())
