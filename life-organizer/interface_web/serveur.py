"""Serveur local de l'interface web de Life-Organizer.

Usage strictement personnel, sur cette seule machine :

    python interface_web/serveur.py

puis http://127.0.0.1:8420 dans un navigateur. Aucune authentification, aucun
accès réseau ouvert au-delà de 127.0.0.1 — ce n'est pas un produit, c'est une
façade sur `organizer.py`.

Ce serveur ne réimplémente aucune décision de tri. Chaque requête se traduit
en un appel à `organizer.py <sous-commande> ...`, exactement la commande
qu'on taperait soi-même dans un terminal, et la sortie de cette commande est
celle qui s'affiche dans l'interface. La logique métier reste entièrement
dans les modules existants.
"""

from __future__ import annotations

import datetime
import os
import subprocess
import sys
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interpreteur import COMMANDES_AVEC_DOSSIERS, interpreter  # noqa: E402

RACINE_PROJET = Path(__file__).resolve().parent.parent
DOSSIER_WEB = Path(__file__).resolve().parent
DOSSIER_DEPOT_TEMP = DOSSIER_WEB / "_depot_temp"

sys.path.insert(0, str(RACINE_PROJET))
import organizer as organizer_cli  # noqa: E402
from noyau.config import charger as charger_config, valider as valider_config  # noqa: E402
from noyau.journal import Journal  # noqa: E402
from modules.depot import regles as depot_regles, traitement as depot_traitement  # noqa: E402
from modules.coffre import stockage as coffre_stockage  # noqa: E402

app = Flask(__name__, static_folder=None)

ORIGINE_ATTENDUE = "http://127.0.0.1:8420"


@app.before_request
def _refuser_hors_origine():
    """Bloque toute requête qui changerait quelque chose depuis une autre page.

    `request.get_json(force=True)` — utilisé par toutes les routes POST — lit
    n'importe quel corps de requête comme du JSON, y compris celui d'un
    `<form>` HTML classique, qui échappe aux protections CORS du navigateur :
    un onglet resté ouvert sur une page tierce pendant que ce serveur tourne
    pourrait sinon déclencher un `--appliquer` réel à l'aveugle. Un GET (la
    page elle-même) n'a rien à protéger ; seule une méthode qui agit compte.
    """
    if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
        return None
    origine = request.headers.get("Origin")
    provenance = origine or request.headers.get("Referer", "")
    if not provenance.startswith(ORIGINE_ATTENDUE):
        return jsonify(ok=False, erreur="Requête refusée : origine inattendue."), 403
    return None


def _config_actuelle() -> dict | None:
    """La même configuration que la CLI verrait — jamais une deuxième lecture divergente."""
    chemin = organizer_cli.config_utilisee(None)
    config = charger_config(chemin)
    return None if valider_config(config) else config


def _purger_depot_temp(max_age_heures: int = 24) -> None:
    """Un fichier téléversé jamais confirmé ne doit pas s'accumuler sans fin."""
    import time

    if not DOSSIER_DEPOT_TEMP.exists():
        return
    limite = time.time() - max_age_heures * 3600
    for fichier in DOSSIER_DEPOT_TEMP.iterdir():
        try:
            if fichier.is_file() and fichier.stat().st_mtime < limite:
                fichier.unlink()
        except OSError:
            pass


def _ligne_de_commande(sous_commande: str, dossiers: list[str], options: list[str], appliquer: bool) -> list[str]:
    ligne = [sys.executable, "organizer.py", sous_commande, *dossiers, *options]
    if appliquer:
        ligne.append("--appliquer")
    return ligne


@app.get("/")
def index():
    return send_from_directory(DOSSIER_WEB, "index.html")


@app.post("/api/commande")
def api_commande():
    corps = request.get_json(force=True, silent=True) or {}
    texte = str(corps.get("texte", "")).strip()
    appliquer = bool(corps.get("appliquer", False))

    if not texte:
        return jsonify(ok=False, erreur="Rien à interpréter."), 400

    commande = interpreter(texte)

    if not commande.reconnue:
        return jsonify(
            ok=True,
            reconnue=False,
            texte=texte,
            message=(
                "Aucune des commandes ne correspond à cette phrase. "
                "Un verbe plus direct aide — ranger, nettoyer, convertir "
                "ou agrandir."
            ),
        )

    ligne = _ligne_de_commande(commande.sous_commande, commande.dossiers, commande.options, appliquer)

    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    resultat = subprocess.run(
        ligne,
        cwd=RACINE_PROJET,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )

    sortie = (resultat.stdout or "") + (resultat.stderr or "")

    if resultat.returncode != 0:
        statut = "erreur"
    elif appliquer:
        statut = "applique"
    else:
        statut = "simulation"

    return jsonify(
        ok=True,
        reconnue=True,
        texte=texte,
        sous_commande=commande.sous_commande,
        dossiers=commande.dossiers,
        appliquer=appliquer,
        commande_texte=" ".join(["organizer.py", commande.sous_commande, *commande.dossiers, *commande.options] + (["--appliquer"] if appliquer else [])),
        sortie=sortie.strip(),
        code=resultat.returncode,
        statut=statut,
        a_dossier_explicite=bool(commande.dossiers),
        accepte_dossier=commande.sous_commande in COMMANDES_AVEC_DOSSIERS,
    )


@app.get("/api/depot/formats")
def api_depot_formats():
    """Les extensions réellement acceptées par `depot_traitement`, à la source.

    Recopiées en dur dans l'attribut `accept` du champ fichier, elles
    dériveraient silencieusement de ce que le serveur accepte vraiment dès
    qu'un format serait ajouté ou retiré côté Python.
    """
    extensions = sorted(
        depot_traitement.EXTENSIONS_IMAGE
        | depot_traitement.EXTENSIONS_VIDEO
        | depot_traitement.EXTENSIONS_DOCUMENT
    )
    return jsonify(extensions=["." + e for e in extensions])


@app.post("/api/depot/analyser")
def api_depot_analyser():
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide : voir « organizer verifier »."), 400

    reglages = config.get("depot", {})
    if not reglages.get("actif", False):
        return jsonify(ok=False, erreur="Le dépôt est désactivé : depot.actif est faux dans la configuration."), 400

    fichier = request.files.get("fichier")
    if not fichier or not fichier.filename:
        return jsonify(ok=False, erreur="Aucun fichier reçu."), 400

    nom_sur = secure_filename(fichier.filename) or "fichier"
    chemin_temp = DOSSIER_DEPOT_TEMP / f"{uuid.uuid4().hex}_{nom_sur}"
    DOSSIER_DEPOT_TEMP.mkdir(parents=True, exist_ok=True)
    fichier.save(chemin_temp)

    if not depot_traitement.type_pris_en_charge(chemin_temp):
        chemin_temp.unlink(missing_ok=True)
        return jsonify(ok=False, erreur=f"Type de fichier non pris en charge : {fichier.filename}"), 400

    nom_projet = request.form.get("projet") or reglages.get("projet_par_defaut")
    if not nom_projet or not depot_regles.projet_connu(reglages, nom_projet):
        chemin_temp.unlink(missing_ok=True)
        connus = ", ".join(sorted((reglages.get("projets") or {}).keys())) or "aucun"
        return jsonify(ok=False, erreur=f"Projet inconnu : {nom_projet!r}. Projets déclarés : {connus}."), 400

    racine_projet = Path((reglages.get("projets", {}).get(nom_projet) or {}).get("racine_drive", ""))

    # Même contenu déjà déposé dans ce projet : ne pas repayer un appel à
    # l'API de vision pour retrouver une réponse qu'on connaît déjà.
    deja = depot_traitement.deja_depose(chemin_temp, racine_projet) if racine_projet.name else None
    if deja:
        chemin_temp.unlink(missing_ok=True)
        return jsonify(
            ok=True, deja_depose=True, nom_fichier=fichier.filename,
            destination=deja["destination"], depose_le=deja.get("depose_le"),
        )

    try:
        classification = depot_traitement.classifier(chemin_temp, reglages, config)
    except depot_traitement.ErreurDepot as erreur:
        chemin_temp.unlink(missing_ok=True)
        return jsonify(ok=False, erreur=str(erreur)), 400

    aujourdhui = datetime.date.today()
    champs = {"annee": str(aujourdhui.year), "mois": f"{aujourdhui.month:02d}"}
    proposition = depot_regles.proposer(classification, reglages, nom_projet, champs)
    if proposition is None:
        chemin_temp.unlink(missing_ok=True)
        return jsonify(ok=False, erreur=(
            f"Aucune règle pour la catégorie « {classification.categorie} » "
            f"dans le projet « {nom_projet} »."
        )), 400

    racine = Path((reglages.get("projets", {}).get(nom_projet) or {}).get("racine_drive", ""))
    destination_apercu = str(racine / proposition.dossier_relatif / fichier.filename)

    # Un aperçu par catégorie possible : si l'utilisateur corrige le
    # classement dans l'interface, le vrai chemin s'affiche tout de suite,
    # sans réimplémenter `dossier_pour` côté navigateur.
    regles_projet = (reglages.get("projets", {}).get(nom_projet) or {}).get("regles") or []
    destinations_par_categorie = {}
    for cat in depot_regles.CATEGORIES:
        dossier = depot_regles.dossier_pour(cat, regles_projet, champs)
        if dossier is not None:
            destinations_par_categorie[cat] = str(racine / dossier / fichier.filename)

    return jsonify(
        ok=True,
        id=chemin_temp.name,
        nom_fichier=fichier.filename,
        projet=nom_projet,
        categorie=proposition.categorie,
        confiance=proposition.confiance,
        fiable=proposition.fiable,
        raison=proposition.raison,
        dossier_relatif=proposition.dossier_relatif,
        destination_apercu=destination_apercu,
        destinations_par_categorie=destinations_par_categorie,
        categories_possibles=list(depot_regles.CATEGORIES),
    )


@app.post("/api/depot/confirmer")
def api_depot_confirmer():
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    reglages = config.get("depot", {})

    corps = request.get_json(force=True, silent=True) or {}
    identifiant = str(corps.get("id", ""))
    nom_projet = str(corps.get("projet", ""))
    categorie = str(corps.get("categorie", ""))

    chemin_temp = DOSSIER_DEPOT_TEMP / secure_filename(identifiant)
    if not identifiant or ".." in identifiant or not chemin_temp.is_file():
        return jsonify(ok=False, erreur="Fichier temporaire introuvable — l'analyse a peut-être expiré."), 400

    if not depot_regles.categorie_valide(categorie):
        return jsonify(ok=False, erreur=f"Catégorie inconnue : {categorie!r}."), 400

    projet = (reglages.get("projets") or {}).get(nom_projet)
    if not projet or not projet.get("racine_drive"):
        return jsonify(ok=False, erreur=f"Projet ou racine Drive introuvable pour « {nom_projet} »."), 400

    # Le dossier n'est jamais pris tel quel depuis le client : seule la
    # catégorie (validée ci-dessus) en sort, et c'est `dossier_pour` — la même
    # fonction que l'analyse — qui la retraduit en chemin.
    aujourdhui = datetime.date.today()
    champs = {"annee": str(aujourdhui.year), "mois": f"{aujourdhui.month:02d}"}
    dossier_relatif = depot_regles.dossier_pour(categorie, projet.get("regles") or [], champs)
    if dossier_relatif is None:
        return jsonify(ok=False, erreur=f"Aucune règle pour la catégorie « {categorie} » dans « {nom_projet} »."), 400

    racine = Path(projet["racine_drive"])
    journal = Journal(_chemin(config.get("dossiers", {}).get("journal")), simulation=False)

    try:
        # L'empreinte se prend avant `deposer` : celui-ci déplace (donc fait
        # disparaître) le fichier temporaire une fois l'opération réussie.
        destination = depot_traitement.deposer(
            chemin_temp, racine, dossier_relatif, journal, appliquer=True,
            nom_final=_nom_original(chemin_temp),
        )
        depot_traitement.enregistrer_depot(destination, destination, racine)
    except OSError as erreur:
        return jsonify(ok=False, erreur=f"Le dépôt a échoué : {erreur}"), 500

    return jsonify(ok=True, destination=str(destination))


@app.post("/api/depot/champs")
def api_depot_champs():
    """Lecture intelligente d'un document administratif déjà déposé (temp).

    Son type précis et les champs qu'il faut probablement remplir, pour
    guider l'utilisateur pas à pas — jamais un remplissage automatique du
    PDF lui-même, seulement une lecture qui explique.
    """
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    reglages = config.get("depot", {})

    corps = request.get_json(force=True, silent=True) or {}
    identifiant = str(corps.get("id", ""))
    chemin_temp = DOSSIER_DEPOT_TEMP / secure_filename(identifiant)
    if not identifiant or ".." in identifiant or not chemin_temp.is_file():
        return jsonify(ok=False, erreur="Fichier temporaire introuvable — l'analyse a peut-être expiré."), 400

    try:
        resultat = depot_traitement.identifier_champs(chemin_temp, reglages, config)
    except depot_traitement.ErreurDepot as erreur:
        return jsonify(ok=False, erreur=str(erreur)), 400

    return jsonify(ok=True, **resultat)


@app.post("/api/depot/ouvrir_dossier")
def api_depot_ouvrir_dossier():
    """Ouvre l'explorateur de fichiers sur le dépôt qu'on vient de faire.

    N'ouvre jamais un chemin arbitraire : seulement un chemin qui tombe sous
    l'une des racines Drive déclarées dans `depot.projets`, pour qu'une page
    tierce ouverte dans un autre onglet ne puisse pas faire lancer
    l'explorateur ailleurs sur la machine via cet endpoint.
    """
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400

    corps = request.get_json(force=True, silent=True) or {}
    chemin = Path(str(corps.get("chemin", "")))

    racines = [
        Path(p["racine_drive"]).resolve()
        for p in (config.get("depot", {}).get("projets") or {}).values()
        if p.get("racine_drive")
    ]
    try:
        chemin_resolu = chemin.resolve()
    except OSError:
        return jsonify(ok=False, erreur="Chemin invalide."), 400

    if not any(racine == chemin_resolu or racine in chemin_resolu.parents for racine in racines):
        return jsonify(ok=False, erreur="Ce chemin ne relève d'aucun projet de dépôt connu."), 400
    if not chemin_resolu.exists():
        return jsonify(ok=False, erreur="Ce fichier n'existe plus à cet emplacement."), 404

    try:
        subprocess.run(["explorer", f"/select,{chemin_resolu}"], check=False)
    except OSError as erreur:
        return jsonify(ok=False, erreur=f"Impossible de lancer l'explorateur : {erreur}"), 500

    return jsonify(ok=True)


# --- Le coffre : stockage chiffré de bout en bout -------------------------
#
# Ce serveur ne possède jamais la clé de chiffrement, seulement des octets
# opaques (des « blobs ») et deux valeurs non secrètes (le sel et le
# vérificateur, comparables à un hachage de mot de passe classique). Tout ce
# qui donne du sens à ces octets — nom d'origine, catégorie, date — vit dans
# un index lui-même chiffré, que ce serveur stocke sans jamais le lire.
# Détails complets dans SECURITY.md.


def _dossier_coffre_ou_erreur(config: dict):
    """Le dossier du coffre, ou une réponse d'erreur JSON toute prête."""
    reglages = config.get("coffre", {})
    if not reglages.get("actif", False):
        return None, (jsonify(ok=False, erreur="Le coffre est désactivé : coffre.actif est faux dans la configuration."), 400)
    try:
        return coffre_stockage.dossier_coffre(reglages), None
    except ValueError as erreur:
        return None, (jsonify(ok=False, erreur=str(erreur)), 400)


@app.get("/api/coffre/etat")
def api_coffre_etat():
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur
    info = coffre_stockage.lire_cle_info(dossier)
    return jsonify(ok=True, initialise=info is not None)


@app.get("/api/coffre/cle")
def api_coffre_cle():
    """Le sel et le vérificateur d'un coffre déjà initialisé — jamais la phrase, jamais la clé."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur
    info = coffre_stockage.lire_cle_info(dossier)
    if info is None:
        return jsonify(ok=False, erreur="Ce coffre n'a pas encore de phrase secrète."), 404
    return jsonify(ok=True, **info)


@app.post("/api/coffre/initialiser")
def api_coffre_initialiser():
    """Enregistre le sel et le vérificateur d'un coffre tout neuf — une seule fois.

    Le corps ne contient jamais la phrase secrète ni la clé : seulement ce
    que le navigateur en a tiré pour pouvoir, plus tard, vérifier lui-même
    qu'une phrase retapée est la bonne.
    """
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    corps = request.get_json(force=True, silent=True) or {}
    champs = ("sel", "iterations", "verificateur_iv", "verificateur_texte")
    if not all(corps.get(c) for c in champs):
        return jsonify(ok=False, erreur="Informations de clé incomplètes."), 400
    info = {c: corps[c] for c in champs}

    try:
        coffre_stockage.ecrire_cle_info(dossier, info)
    except FileExistsError as erreur:
        return jsonify(ok=False, erreur=str(erreur)), 409

    return jsonify(ok=True)


@app.get("/api/coffre/index")
def api_coffre_index():
    """L'index chiffré tel quel, en base64 — ce serveur ne l'a jamais déchiffré."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur
    if not (dossier / coffre_stockage.NOM_INDEX).is_file():
        return jsonify(ok=True, existe=False)

    import base64

    octets = coffre_stockage.lire_blob(dossier, coffre_stockage.NOM_INDEX)
    return jsonify(ok=True, existe=True, contenu=base64.b64encode(octets).decode("ascii"))


@app.post("/api/coffre/index")
def api_coffre_index_ecrire():
    """Remplace l'index chiffré par la version que le navigateur vient de recalculer."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    corps = request.get_json(force=True, silent=True) or {}
    contenu_b64 = corps.get("contenu")
    if not contenu_b64:
        return jsonify(ok=False, erreur="Index manquant."), 400

    import base64

    try:
        octets = base64.b64decode(contenu_b64, validate=True)
    except (ValueError, TypeError):
        return jsonify(ok=False, erreur="Index illisible (pas du base64 valide)."), 400

    coffre_stockage.ecrire_blob(dossier, coffre_stockage.NOM_INDEX, octets)
    return jsonify(ok=True)


@app.get("/api/coffre/objets")
def api_coffre_objets():
    """La liste des blobs présents — noms opaques, tailles, dates. Jamais un nom d'origine."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur
    return jsonify(ok=True, objets=coffre_stockage.lister_blobs(dossier))


@app.post("/api/coffre/objets/<nom>")
def api_coffre_objet_ecrire(nom: str):
    """Reçoit un document déjà chiffré par le navigateur, tel quel."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    nom_sur = secure_filename(nom)
    if not nom_sur:
        return jsonify(ok=False, erreur="Nom de fichier invalide."), 400
    octets = request.get_data()
    if not octets:
        return jsonify(ok=False, erreur="Fichier vide."), 400

    try:
        coffre_stockage.ecrire_blob(dossier, nom_sur, octets)
    except ValueError as erreur_valeur:
        return jsonify(ok=False, erreur=str(erreur_valeur)), 400

    return jsonify(ok=True, nom=nom_sur)


@app.get("/api/coffre/objets/<nom>")
def api_coffre_objet_lire(nom: str):
    """Rend un document chiffré tel quel — c'est au navigateur de le déchiffrer."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    nom_sur = secure_filename(nom)
    try:
        octets = coffre_stockage.lire_blob(dossier, nom_sur)
    except (ValueError, FileNotFoundError, OSError):
        return jsonify(ok=False, erreur="Objet introuvable."), 404

    from flask import Response

    return Response(octets, mimetype="application/octet-stream")


@app.delete("/api/coffre/objets/<nom>")
def api_coffre_objet_supprimer(nom: str):
    """Efface un document du coffre pour de vrai : écrasement puis suppression."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    nom_sur = secure_filename(nom)
    efface = coffre_stockage.supprimer_definitivement(dossier, nom_sur)
    return jsonify(ok=True, efface=efface)


@app.post("/api/coffre/sauvegarde")
def api_coffre_sauvegarde():
    """Copie l'état actuel du coffre (déjà chiffré) vers le dossier de sauvegarde configuré."""
    config = _config_actuelle()
    if config is None:
        return jsonify(ok=False, erreur="Configuration invalide."), 400
    reglages = config.get("coffre", {})
    dossier, erreur = _dossier_coffre_ou_erreur(config)
    if erreur:
        return erreur

    try:
        cible_sauvegarde = coffre_stockage.dossier_sauvegarde(reglages)
    except ValueError as erreur_valeur:
        return jsonify(ok=False, erreur=str(erreur_valeur)), 400

    try:
        cible = coffre_stockage.sauvegarder(dossier, cible_sauvegarde)
    except FileNotFoundError as erreur_fichier:
        return jsonify(ok=False, erreur=str(erreur_fichier)), 400
    except OSError as erreur_os:
        return jsonify(ok=False, erreur=f"Sauvegarde impossible : {erreur_os}"), 500

    return jsonify(ok=True, dossier=str(cible))


def _chemin(valeur: str | None) -> Path | None:
    return Path(valeur).expanduser() if valeur else None


_LONGUEUR_PREFIXE_TEMP = len(uuid.uuid4().hex) + 1  # 32 caractères hex + le "_" qui les sépare du nom


def _nom_original(chemin_temp: Path) -> str:
    """Le nom tel qu'envoyé, sans le préfixe technique posé par `analyser`."""
    return chemin_temp.name[_LONGUEUR_PREFIXE_TEMP:] or chemin_temp.name


if __name__ == "__main__":
    _purger_depot_temp()
    print(f"Life-Organizer — interface web sur http://127.0.0.1:8420  (racine : {RACINE_PROJET})")
    app.run(host="127.0.0.1", port=8420, debug=False)
