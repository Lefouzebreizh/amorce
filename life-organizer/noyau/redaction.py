"""Masquage de motifs sensibles avant qu'un texte ne quitte la machine.

Un seul appelant aujourd'hui : `modules.depot.traitement.preparer_contenu`,
avant l'envoi à l'API de vision — le seul appel réseau sortant du projet (voir
son préambule, et SECURITY.md pour le correctif de la faille 1 de AUDIT.md).
Volontairement dans `noyau` et non dans `modules/depot` : c'est une garantie
qui doit valoir pour tout futur appelant qui enverrait du texte à l'extérieur,
pas une règle propre au dépôt.

Détection par expression régulière, pas par une analyse du document : un IBAN
ou un numéro de sécurité sociale mal segmenté (une coupure de ligne au milieu,
un chiffre que l'OCR a mal lu) peut échapper au motif. C'est un filet, pas une
preuve d'absence — voir SECURITY.md pour ce que ça implique et comment le
vérifier.
"""

from __future__ import annotations

import re

# IBAN : deux lettres de pays, deux chiffres de contrôle, puis le BBAN par
# groupes de 4 caractères alphanumériques, espaces optionnels entre groupes
# comme dans la présentation usuelle (« FR76 3000 ... »). La longueur varie
# selon le pays (15 à 34 caractères) : le motif ne valide pas la longueur
# exacte par pays, il reconnaît la forme, volontairement plus large qu'un
# validateur strict — un faux positif masqué ne coûte rien, un IBAN qui
# passerait au travers coûterait tout.
_IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,3})?\b")

# NIR (numéro de sécurité sociale) : sexe (1 ou 2), année, mois (01-12 ou 20
# pour un mois inconnu), département (2 ou 3 chiffres, 2A/2B compris), commune,
# ordre, puis une clé de contrôle à 2 chiffres presque toujours séparée du
# reste par un espace, un point ou une barre (vu tel quel sur des documents
# réels de paie). Les séparateurs sont optionnels et indépendants les uns des
# autres : un NIR recopié sans aucun espace doit être reconnu aussi bien qu'un
# NIR entièrement espacé.
_NIR = re.compile(
    r"\b[12][ ./]?\d{2}[ ./]?(?:0[1-9]|1[0-2]|2[0AB])[ ./]?\d{2,3}[ ./]?\d{3}[ ./]?\d{3}"
    r"(?:[ ./]?\d{2})?\b"
)


def masquer(texte: str) -> str:
    """`texte`, avec tout IBAN ou NIR reconnu remplacé par un jeton neutre.

    Appliquer avant toute troncature (`texte[:n]`) : couper d'abord risquerait
    de laisser une moitié de motif, que la regex ne reconnaît plus.
    """
    texte = _IBAN.sub("[IBAN MASQUÉ]", texte)
    texte = _NIR.sub("[NUMÉRO DE SÉCURITÉ SOCIALE MASQUÉ]", texte)
    return texte
