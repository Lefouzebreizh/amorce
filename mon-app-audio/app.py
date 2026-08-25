#!/usr/bin/env python3
"""Interface visuelle du studio audio.

Ce fichier ne contient **aucune** logique de traitement : il choisit des
fichiers, promène des curseurs et affiche des résultats. Tout ce qui décide vit
dans `core/`, où cela se teste sans navigateur. La règle vaut dans les deux
sens : rien dans `core/` ne connaît Streamlit.

Le parcours suit l'ordre dans lequel on travaille vraiment — le texte d'abord,
la voix ensuite (enregistrée ou fabriquée), les bruitages une fois qu'on sait où
tombent les silences, les volumes en dernier.
"""

from __future__ import annotations

import sys
from pathlib import Path

import requests
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import mixeur, synchroniseur, synthese  # noqa: E402

STOCKAGE = Path(__file__).resolve().parent / 'stockage'
DOSSIERS = {
    'voix': STOCKAGE / 'voix',
    'textes': STOCKAGE / 'textes',
    'bruitages': STOCKAGE / 'bruitages',
    'resultats': STOCKAGE / 'resultats',
}
SONS = ('.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac')
TEXTES = ('.txt', '.srt', '.md')
MODELES = ['tiny', 'base', 'small', 'medium']


st.set_page_config(page_title='Studio audio', page_icon='🎚️', layout='wide')

for dossier in DOSSIERS.values():
    dossier.mkdir(parents=True, exist_ok=True)


@st.cache_resource(show_spinner=False)
def _charger(chemin: str, empreinte: float):
    """Garde le son décodé en mémoire : Streamlit rejoue le script entier à
    chaque curseur déplacé, et redécoder trois minutes de MP3 à chaque fois rend
    l'interface poisseuse. L'empreinte (date de modification) suffit à repérer un
    fichier remplacé sous le même nom."""
    del empreinte
    return mixeur.charger(chemin)


def charger(chemin: Path):
    return _charger(str(chemin), chemin.stat().st_mtime)


def lister(dossier: Path, extensions: tuple[str, ...]) -> list[Path]:
    return sorted(f for f in dossier.iterdir() if f.suffix.lower() in extensions)


def deposer(fichiers, dossier: Path) -> None:
    """Range les fichiers déposés dans la bibliothèque : ils sont ainsi
    retrouvables au prochain lancement, ce qu'un fichier gardé en mémoire de
    session n'est pas."""
    for fichier in fichiers or []:
        (dossier / fichier.name).write_bytes(fichier.getbuffer())


def telecharger(url: str, dossier: Path) -> Path:
    """Range un son distant dans la bibliothèque, sous le nom qu'il porte."""
    reponse = requests.get(url, timeout=30)
    reponse.raise_for_status()
    nom = Path(url.split('?')[0]).name or 'telecharge.mp3'
    chemin = dossier / nom
    chemin.write_bytes(reponse.content)
    return chemin


def horodater(ms: int) -> str:
    return f'{ms // 60000:d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def oublier_alignement() -> None:
    """Un alignement ne survit pas au changement de voix : le garder afficherait
    des minutages calculés sur un autre enregistrement."""
    for cle in ('repliques', 'passages', 'mots'):
        st.session_state.pop(cle, None)


# ── Barre latérale : la bibliothèque ────────────────────────────────────────

ffmpeg = mixeur.outiller()

with st.sidebar:
    st.header('Bibliothèque')
    st.caption(f'Fichiers rangés dans `{STOCKAGE.name}/`')

    deposer(st.file_uploader('Ajouter des voix', SONS, accept_multiple_files=True,
                             key='depot_voix'), DOSSIERS['voix'])
    deposer(st.file_uploader('Ajouter des textes', ['txt', 'srt', 'md'],
                             accept_multiple_files=True, key='depot_textes'), DOSSIERS['textes'])
    deposer(st.file_uploader('Ajouter des bruitages', SONS, accept_multiple_files=True,
                             key='depot_bruitages'), DOSSIERS['bruitages'])

    with st.form('depuis_url', clear_on_submit=True):
        url = st.text_input('…ou un bruitage depuis une adresse',
                            placeholder='https://exemple.org/vague.mp3')
        if st.form_submit_button('Récupérer') and url.strip():
            try:
                st.success(f'{telecharger(url.strip(), DOSSIERS["bruitages"]).name} récupéré.')
            except Exception as souci:
                st.error(f'Téléchargement impossible : {souci}')

    if not ffmpeg:
        st.warning('ffmpeg est introuvable : seul le WAV sera lisible. '
                   'Lancez `pip install -r requirements.txt`.')

st.title('🎚️ Studio audio')
st.caption('Aligner une voix sur son texte, la ponctuer de bruitages, et sortir un mixage.')

voix_disponibles = lister(DOSSIERS['voix'], SONS)
textes_disponibles = lister(DOSSIERS['textes'], TEXTES)
bruitages_disponibles = lister(DOSSIERS['bruitages'], SONS)

onglet_texte, onglet_sync, onglet_bruitages, onglet_mixage = st.tabs(
    ['1 · Texte & voix', '2 · Synchronisation', '3 · Bruitages', '4 · Mixage'])


# ── 1. Texte et voix ────────────────────────────────────────────────────────

with onglet_texte:
    colonne_texte, colonne_voix = st.columns(2)

    with colonne_texte:
        st.subheader('Le texte')
        source = st.radio('Provenance', ['Depuis la bibliothèque', 'Saisi ici'], horizontal=True)
        if source == 'Depuis la bibliothèque' and textes_disponibles:
            choix_texte = st.selectbox('Script', textes_disponibles, format_func=lambda f: f.name)
            script = choix_texte.read_text(encoding='utf-8', errors='replace')
            st.text_area('Contenu', script, height=240, disabled=True)
        else:
            script = st.text_area('Collez le script', st.session_state.get('script', ''),
                                  height=240,
                                  placeholder='Une phrase par réplique, ou un texte suivi.')
        st.session_state['script'] = script
        st.caption(f'{len(synchroniseur.lire_script(script))} répliques repérées.')

    with colonne_voix:
        st.subheader('La voix')
        maniere = st.radio('Provenance', ['Un enregistrement', 'Une voix de synthèse'],
                           horizontal=True)

        if maniere == 'Un enregistrement':
            if not voix_disponibles:
                st.info('Déposez un enregistrement dans la barre latérale.')
            else:
                choix_voix = st.selectbox('Enregistrement', voix_disponibles,
                                          format_func=lambda f: f.name)
                if st.session_state.get('voix') != choix_voix:
                    oublier_alignement()
                st.session_state['voix'] = choix_voix
                st.audio(str(choix_voix))

        elif not synthese.disponible():
            st.info('Installez `edge-tts` pour fabriquer une voix : '
                    '`pip install -r requirements.txt`.')
        else:
            # La voix de synthèse arrive avec la position de chaque mot : c'est
            # l'alignement le plus juste que l'application puisse produire, et il
            # ne coûte rien de plus que la fabrication elle-même.
            timbre = st.selectbox('Timbre', st.session_state.get('timbres') or [synthese.VOIX_DEFAUT])
            if st.button('Voir toutes les voix françaises'):
                try:
                    st.session_state['timbres'] = synthese.voix_francaises()
                    st.rerun()
                except Exception as souci:
                    st.error(f'Catalogue indisponible : {souci}')
            vitesse = st.slider('Débit (%)', -40, 40, 0, step=5,
                                help='Négatif pour ralentir. Une voix off se pose '
                                     'volontiers 10 % sous le débit par défaut.')
            hauteur = st.slider('Hauteur (Hz)', -50, 50, 0, step=5,
                                help='Grave ou aigu, sans changer le débit.')
            nom_voix = st.text_input('Nom du fichier', 'voix_de_synthese')

            if st.button('Fabriquer la voix', type='primary', disabled=not script.strip()):
                with st.spinner('Synthèse…'):
                    try:
                        son, mots = synthese.dire(script, timbre, vitesse, hauteur)
                        chemin = mixeur.exporter(son, DOSSIERS['voix'] / f'{nom_voix}.mp3')
                        oublier_alignement()
                        st.session_state['voix'] = chemin
                        st.session_state['mots'] = mots
                        st.rerun()
                    except Exception as souci:
                        st.error(f'Synthèse impossible : {souci}')

            if st.session_state.get('voix'):
                st.audio(str(st.session_state['voix']))


# ── 2. Synchronisation ──────────────────────────────────────────────────────

with onglet_sync:
    if not st.session_state.get('voix') or not st.session_state.get('script', '').strip():
        st.info('Choisissez un texte et une voix à l’étape 1.')
    else:
        methodes = ['Par les silences']
        if synchroniseur.whisper_disponible():
            methodes.insert(0, 'Par les mots (Whisper)')
        if st.session_state.get('mots'):
            methodes.insert(0, 'Minutage de la voix de synthèse')

        reglage, resultat = st.columns([1, 2])
        with reglage:
            methode = st.radio('Méthode', methodes,
                               help='Le minutage d’une voix de synthèse est exact et gratuit. '
                                    'Whisper est précis au mot mais lent au premier appel. '
                                    'Les silences sont instantanés et justes à la réplique près.')
            if methode == 'Par les mots (Whisper)':
                modele = st.selectbox('Modèle', MODELES, index=MODELES.index('small'),
                                      help='Plus le modèle est gros, plus la transcription est '
                                           'fidèle et lente. Le premier usage télécharge le modèle.')
            if methode == 'Par les silences':
                silence = st.slider('Durée d’un silence (ms)', 100, 1500,
                                    synchroniseur.SILENCE_MIN_MS, step=50,
                                    help='En deçà, la pause est traitée comme une respiration '
                                         'et ne coupe pas la réplique.')
                sensibilite = st.slider('Sensibilité (dB sous la crête)', 10, 45, 26,
                                        help='Plus la valeur est grande, plus les passages parlés '
                                             'sont repérés larges. À augmenter sur une voix '
                                             'enregistrée loin du micro.')
            aligner = st.button('Aligner le texte sur la voix', type='primary')

        if aligner:
            morceaux = synchroniseur.lire_script(st.session_state['script'])
            try:
                if methode == 'Par les silences':
                    with st.spinner('Analyse du signal…'):
                        niveaux = synchroniseur.enveloppe(charger(st.session_state['voix']))
                        passages = synchroniseur.detecter_passages(
                            niveaux,
                            seuil_dbfs=synchroniseur.seuil_relatif(niveaux, sensibilite),
                            silence_min_ms=silence,
                        )
                        st.session_state['repliques'] = synchroniseur.repartir(passages, morceaux)
                        st.session_state['passages'] = passages
                else:
                    if methode == 'Par les mots (Whisper)':
                        with st.spinner('Transcription… (le premier appel charge le modèle)'):
                            st.session_state['mots'] = synchroniseur.transcrire(
                                st.session_state['voix'], modele)
                    mots = st.session_state['mots']
                    st.session_state['repliques'] = synchroniseur.aligner(morceaux, mots)
                    st.session_state['passages'] = synchroniseur.passages_depuis_mots(mots)
            except Exception as souci:
                st.error(f'Alignement impossible : {souci}')

        repliques = st.session_state.get('repliques') or []
        with resultat:
            if not repliques:
                st.write('Aucun alignement pour l’instant.')
            else:
                approximatives = [r for r in repliques if not r.cale]
                st.success(f'{len(repliques)} répliques, '
                           f'{len(st.session_state.get("passages") or [])} passages parlés.')
                if approximatives:
                    st.warning(f'{len(approximatives)} répliques n’ont pas été retrouvées dans '
                               'la voix : leur minutage est interpolé (marquées ~).')
                st.dataframe([
                    {'': '' if r.cale else '~', 'Début': horodater(r.debut_ms),
                     'Fin': horodater(r.fin_ms), 'Texte': r.texte}
                    for r in repliques
                ], hide_index=True)
                st.download_button('Télécharger les sous-titres (.srt)',
                                   synchroniseur.vers_srt(repliques),
                                   file_name=f'{Path(st.session_state["voix"]).stem}.srt')


# ── 3. Bruitages ────────────────────────────────────────────────────────────

with onglet_bruitages:
    st.session_state.setdefault('bruitages', [])
    if not bruitages_disponibles:
        st.info('Déposez des sons dans la barre latérale pour les poser sur le montage.')
    else:
        choix, position, gain, ajout = st.columns([3, 2, 2, 1])
        with choix:
            son = st.selectbox('Son', bruitages_disponibles, format_func=lambda f: f.name)
        with position:
            # Les débuts de réplique sont les emplacements naturels d'un
            # bruitage : on les propose plutôt que de laisser chercher la seconde.
            reperes = {'Début du montage': 0}
            for numero, replique in enumerate(st.session_state.get('repliques') or [], start=1):
                reperes[f'{numero}. {replique.texte[:32]}'] = replique.debut_ms
            repere = st.selectbox('Repère', list(reperes), index=0)
            instant = st.number_input('Instant (s)', min_value=0.0, step=0.1,
                                      value=reperes[repere] / 1000)
        with gain:
            niveau = st.slider('Niveau (dB)', -24.0, 12.0, 0.0, step=0.5)
            fondu = st.slider('Fondu (ms)', 0, 1000, 0, step=50)
        with ajout:
            st.write('')
            if st.button('Poser', type='primary'):
                st.session_state['bruitages'].append({
                    'chemin': son, 'position_ms': int(instant * 1000),
                    'gain_db': niveau, 'fondu_ms': fondu,
                })

        poses = st.session_state['bruitages']
        if not poses:
            st.write('Aucun bruitage posé.')
        for index, pose in enumerate(list(poses)):
            ligne, retrait = st.columns([6, 1])
            ligne.write(
                f'**{pose["chemin"].name}** — {horodater(pose["position_ms"])} · '
                f'{pose["gain_db"]:+.1f} dB'
                + (f' · fondu {pose["fondu_ms"]} ms' if pose['fondu_ms'] else '')
            )
            if retrait.button('Retirer', key=f'retrait_{index}'):
                poses.pop(index)
                st.rerun()


# ── 4. Mixage ───────────────────────────────────────────────────────────────

with onglet_mixage:
    if not st.session_state.get('voix'):
        st.info('Choisissez une voix à l’étape 1.')
    else:
        table, sortie = st.columns([1, 2])
        with table:
            st.subheader('Table de mixage')
            reglages = mixeur.Reglages(
                gain_voix_db=st.slider('Voix (dB)', -12.0, 12.0, 0.0, step=0.5,
                                       help='Le niveau de référence : les autres sources se '
                                            'règlent par rapport à elle.'),
                gain_bruitages_db=st.slider('Bruitages (dB)', -30.0, 6.0, -4.0, step=0.5,
                                            help='Un bruitage doit se remarquer sans couvrir '
                                                 'le mot qu’il ponctue.'),
                gain_musique_db=st.slider('Musique (dB)', -40.0, 0.0, -16.0, step=0.5,
                                          help='Un lit sonore, pas un morceau : il se sent '
                                               'plus qu’il ne s’écoute.'),
                attenuation_db=st.slider('Baisse sous la voix (dB)', -24.0, 0.0, -9.0, step=0.5,
                                         help='De combien la musique s’efface pendant la '
                                              'parole, et seulement pendant.'),
            )
            musique_choisie = st.selectbox(
                'Musique de fond', ['Aucune'] + [f.name for f in bruitages_disponibles],
                help='Rangée avec les bruitages : c’est la même bibliothèque de sons.')
            if not st.session_state.get('passages'):
                st.caption('Sans alignement (étape 2), la musique ne baissera pas sous la voix.')

        with sortie:
            st.subheader('Sortie')
            extension = st.radio('Format', ['mp3', 'wav'], horizontal=True)
            nom = st.text_input('Nom du fichier', Path(st.session_state['voix']).stem + '_mixe')

            if st.button('Mixer', type='primary'):
                with st.spinner('Mixage…'):
                    bruitages = [
                        mixeur.Bruitage(
                            nom=pose['chemin'].name, son=charger(pose['chemin']),
                            position_ms=pose['position_ms'], gain_db=pose['gain_db'],
                            fondu_ms=pose['fondu_ms'],
                        )
                        for pose in st.session_state.get('bruitages', [])
                    ]
                    musique = None
                    if musique_choisie != 'Aucune':
                        musique = charger(DOSSIERS['bruitages'] / musique_choisie)
                    mixage = mixeur.mixer(charger(st.session_state['voix']), bruitages, musique,
                                          st.session_state.get('passages'), reglages)
                    st.session_state['resultat'] = mixeur.exporter(
                        mixage, DOSSIERS['resultats'] / f'{nom}.{extension}')

            resultat = st.session_state.get('resultat')
            if resultat and resultat.exists():
                st.success(f'Écrit dans `stockage/resultats/{resultat.name}`')
                st.audio(str(resultat))
                st.download_button('Télécharger le mixage', resultat.read_bytes(),
                                   file_name=resultat.name)
