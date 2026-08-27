#!/usr/bin/env python3
"""L'écran du tableau de bord — ce qu'on regarde depuis le téléphone.

Ce fichier **n'a le droit de rien calculer**. Il appelle
`core.abonnements.tableau()`, qui rend déjà le total mensuel, la répartition
par catégorie, les alertes et les contrats classés par urgence de préavis ; il
les met en forme, et c'est tout. La règle vaut dans les deux sens, comme dans
`archives-backlog/mon-app-audio/` : rien de `core/` ne connaît Streamlit.

Elle n'est pas de confort. Un total réécrit ici divergerait un jour du total de
`paper.py etat`, sans que rien ne le signale — et c'est l'écran qu'on croirait,
parce que c'est l'écran qu'on regarde. Tout ce qui ressemble à une décision
métier (quelle date afficher, quel contrat compte au budget, quelle alerte se
tait faute de journal) est déjà tranché dans `core/`, et vérifié par les tests.
Ce qui reste ici — une largeur de barre en pourcentage, un libellé de
catégorie, un nombre de jours entre deux dates déjà rendues — est de la mise en
page.

Les décisions de ce fichier :

1. **Lecture seule.** Aucun bouton, aucune écriture. `paper.py etat --traiter`
   reste le seul chemin qui change un statut : une alerte qu'on marque traitée
   d'un pouce distrait dans un couloir, c'est une échéance perdue. Le geste
   viendra, mais après que l'affichage aura fait ses preuves.
2. **Aucun cache.** Streamlit rejoue le script entier à chaque interaction :
   c'est ici une qualité, la configuration est relue à chaque passage et
   l'écran ne ment jamais d'une version. Les fichiers en jeu sont deux JSON de
   quelques kilo-octets, pas trois minutes de MP3 à redécoder.
3. **Le fichier de configuration manquant n'est pas une panne.**
   `admin_config.json` est personnel et ignoré par git : sur une machine neuve
   il n'existe pas, et c'est normal. L'écran dit alors la commande à taper.
4. **Les jauges sont deux barres horizontales**, jamais un cercle et jamais une
   bibliothèque — `CLAUDE.md` §2 et `/tailwind-mobile-ux`. La fenêtre courte
   dit ce qu'on peut faire maintenant, la longue ce qui arrive ; on ne voit
   jamais venir la seconde en ne regardant que la première.
5. **Ce qui se teste est dans `rendu.py`.** Ce fichier-ci importe Streamlit,
   que la CI n'installe pas exprès ; `rendu.py` n'importe que `core/` et se
   vérifie donc avec le reste, en quinze secondes et sans navigateur.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import streamlit as st

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

from core.abonnements import Tableau, euros, tableau  # noqa: E402
from core.config import Configuration, ErreurConfiguration, charger  # noqa: E402
from core.journal import ErreurJournal, charger as charger_journal  # noqa: E402
from interface.rendu import barre, delai, fraction, libelles  # noqa: E402

# La fenêtre longue de la jauge. Trois mois parce que c'est le plus long préavis
# qu'on rencontre en pratique : en deçà, un contrat entré dans la fenêtre est
# encore résiliable, et c'est précisément ce qu'on veut voir venir. Purement un
# cadrage d'affichage — le calcul des dates, lui, est dans `core/`.
HORIZON_JOURS = 90

# `PAPER_CONFIG` permet de pointer l'exemple versionné sans toucher au fichier
# personnel — c'est ainsi que cet écran se regarde sur une machine de passage.
CONFIG = Path(os.environ.get("PAPER_CONFIG") or RACINE / "admin_config.json")

FEUILLE = """
<style>
  /* 18 px minimum, `100dvh` et non `100vh` : la barre d'adresse de Chrome
     Android ampute la seconde d'une centaine de pixels. CLAUDE.md §2. */
  .stApp { min-height: 100dvh; }
  /* La barre d'outils de Streamlit et le bandeau de haut de page mangent un
     sixième d'un écran 20:9 pour deux boutons qui ne servent qu'au déploiement.
     Sur un téléphone, cette place est celle du premier contrat. */
  [data-testid="stHeader"] { display: none; }
  [data-testid="stMainBlockContainer"] { padding-top: 1.75rem; padding-bottom: 3rem; }
  html, body, [class*="st-"] { font-size: 18px; }
  .pm-titre { font-size: 1.7rem; font-weight: 700; margin: 0 0 .2rem 0; }
  .pm-jour { font-size: 1.1rem; opacity: .75; margin: 0 0 1.4rem 0; }
  .pm-section { font-size: 1.25rem; font-weight: 700; letter-spacing: .04em;
                text-transform: uppercase; margin: 2rem 0 .8rem 0; opacity: .8; }
  .pm-somme { font-size: 2.2rem; font-weight: 700; line-height: 1.2; }
  .pm-somme small { font-size: 1.1rem; font-weight: 400; opacity: .75; }
  /* Une barre de 24 px : en dessous, le pouce couvre la mesure qu'il vient
     lire. La piste et le remplissage partagent la hauteur, sans quoi la barre
     vide n'occupe aucune place et la liste tressaute. */
  .pm-mesure { display: flex; justify-content: space-between; gap: 1rem;
               font-size: 1.15rem; margin-bottom: .3rem; }
  .pm-mesure span:last-child { opacity: .75; white-space: nowrap; }
  .pm-piste { width: 100%; height: 24px; border-radius: 12px;
              background: rgba(128, 128, 128, .22); overflow: hidden; }
  .pm-part { height: 24px; border-radius: 12px; background: #2f6f4f; }
  .pm-part.pm-chaud { background: #a4442c; }
  .pm-barre { margin-bottom: 1.1rem; }
  .pm-ligne { display: flex; justify-content: space-between; gap: 1rem;
              padding: .55rem 0; border-bottom: 1px solid rgba(128,128,128,.2);
              font-size: 1.1rem; }
  .pm-ligne .pm-quand { white-space: nowrap; opacity: .8; }
  .pm-note { font-size: 1rem; opacity: .7; margin: .1rem 0 .7rem 0; }
  .pm-vide { font-size: 1.15rem; opacity: .75; padding: .6rem 0; }
</style>
"""


def entete(etat: Tableau) -> None:
    st.markdown('<div class="pm-titre">Tableau de bord</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="pm-jour">{etat.le:%d/%m/%Y}</div>', unsafe_allow_html=True)


def jauge(etat: Tableau) -> None:
    """Les deux barres : ce qui se fait aujourd'hui, ce qui arrive d'ici trois mois.

    Deux et non une, pour la raison de `/tailwind-mobile-ux` : la fenêtre courte
    dit ce qu'on peut traiter maintenant, la longue ce vers quoi on va. Regarder
    la première seule, c'est découvrir la seconde le jour où il est trop tard.
    """
    visibles = [alerte for alerte in etat.alertes if alerte.visible(etat.le)]
    a_venir = [ligne for ligne in etat.lignes
               if ligne.jours_avant_preavis is not None
               and 0 <= ligne.jours_avant_preavis <= HORIZON_JOURS]
    en_retard = any(alerte.echeance < etat.le for alerte in visibles)

    st.markdown(
        barre("À faire aujourd'hui", f"{len(visibles)} sur {len(etat.alertes)}",
              fraction(len(visibles), len(etat.alertes)), chaud=en_retard)
        + barre(f"Préavis dans les {HORIZON_JOURS} jours",
                f"{len(a_venir)} sur {len(etat.lignes)} contrats",
                fraction(len(a_venir), len(etat.lignes))),
        unsafe_allow_html=True,
    )


def budget(etat: Tableau, noms: dict[str, str]) -> None:
    st.markdown('<div class="pm-section">Ce que je paie</div>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="pm-somme">{euros(etat.total_mensuel)} '
        f'<small>par mois</small><br>{euros(etat.total_annuel)} '
        f'<small>par an</small></div>',
        unsafe_allow_html=True,
    )

    repartition = etat.par_categorie
    if not repartition:
        return
    # Rapportées à la plus chère et non au total : sur huit catégories, huit
    # barres à 12 % se ressemblent toutes, et on cherche justement laquelle
    # dépasse. Le montant écrit à côté reste la valeur absolue.
    plafond = max(repartition.values())
    st.markdown('<div class="pm-section">Par catégorie</div>', unsafe_allow_html=True)
    st.markdown(
        "".join(
            barre(noms.get(cle, cle), euros(montant), float(montant / plafond))
            for cle, montant in repartition.items()
        ),
        unsafe_allow_html=True,
    )


def alertes_du_jour(etat: Tableau) -> None:
    st.markdown('<div class="pm-section">À faire</div>', unsafe_allow_html=True)
    visibles = [alerte for alerte in etat.alertes if alerte.visible(etat.le)]
    if not visibles:
        st.markdown('<div class="pm-vide">Rien aujourd\'hui.</div>', unsafe_allow_html=True)
    for alerte in visibles:
        st.markdown(
            f'<div class="pm-ligne"><span>{alerte.action}</span>'
            f'<span class="pm-quand">{alerte.echeance:%d/%m/%Y}</span></div>'
            f'<div class="pm-note">{delai(alerte, etat.le)} · {alerte.id}</div>',
            unsafe_allow_html=True,
        )

    sommeil = len(etat.alertes) - len(visibles)
    if sommeil:
        st.markdown(
            f'<div class="pm-note">{sommeil} alerte(s) en sommeil — reportée, '
            f'traitée, ou pas encore d\'actualité.</div>',
            unsafe_allow_html=True,
        )


def contrats(etat: Tableau) -> None:
    st.markdown(
        f'<div class="pm-section">Contrats ({len(etat.lignes)})</div>',
        unsafe_allow_html=True,
    )
    if not etat.lignes:
        st.markdown(
            '<div class="pm-vide">Aucun contrat actif dans la configuration.</div>',
            unsafe_allow_html=True,
        )
    for ligne in etat.lignes:
        # `tableau()` a déjà trié par urgence de préavis et calculé la date à
        # afficher : celle du préavis, pas celle du terme.
        quand = f"{ligne.preavis:%d/%m/%Y}" if ligne.preavis else "sans échéance"
        st.markdown(
            f'<div class="pm-ligne"><span>{ligne.abonnement.libelle}</span>'
            f'<span class="pm-quand">{euros(ligne.mensuel)}/mois</span></div>',
            unsafe_allow_html=True,
        )
        note = f"préavis {quand}"
        if ligne.jours_avant_preavis is not None:
            note += f" · dans {ligne.jours_avant_preavis} j"
        if ligne.mois_restants:
            note += (f" · engagement {ligne.mois_restants} mois, "
                     f"partir maintenant coûte {euros(ligne.cout_sortie)}")
        st.markdown(f'<div class="pm-note">{note}</div>', unsafe_allow_html=True)


def sans_configuration(erreur: Exception) -> None:
    """Le cas normal d'une machine neuve, pas une panne : dire la commande à taper."""
    st.markdown('<div class="pm-titre">Rien à afficher pour l\'instant</div>',
                unsafe_allow_html=True)
    st.warning(str(erreur))
    st.markdown(
        "`admin_config.json` porte les contrats, et il est personnel : il n'est "
        "pas dans le dépôt, et sur une machine neuve il n'existe pas encore. "
        "Le modèle versionné se copie en une commande, depuis `paper-manager/` :"
    )
    st.code("cp admin_config.exemple.json admin_config.json", language="bash")
    st.markdown(
        "Puis y mettre ses propres contrats — chaque champ est décrit dans "
        "`paper-manager/README.md`, section « Le fichier `admin_config.json` »."
    )


def main() -> None:
    st.set_page_config(page_title="Paper-Manager", page_icon="📄", layout="centered")
    st.markdown(FEUILLE, unsafe_allow_html=True)

    try:
        configuration = charger(CONFIG)
    except ErreurConfiguration as erreur:
        sans_configuration(erreur)
        return

    # Le journal débloque deux types d'alerte ; son absence n'est pas une
    # erreur, c'est un coffre qu'on n'a pas encore rempli. `charger` rend alors
    # un journal vide — exactement ce que fait `paper.py etat`, et c'est
    # volontaire : les deux affichages doivent dire la même chose du même jour.
    try:
        journal = charger_journal(configuration.classement.racine / "documents.json")
    except ErreurJournal as erreur:
        st.error(f"{erreur}")
        return

    etat = tableau(configuration, journal=journal)

    entete(etat)
    jauge(etat)
    budget(etat, libelles(configuration))
    alertes_du_jour(etat)
    contrats(etat)


main()
