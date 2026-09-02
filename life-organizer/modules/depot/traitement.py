"""Ce qui touche au disque, au réseau et aux bibliothèques lourdes du dépôt.

Applique la décision, ne la prend pas : `regles.py` dit dans quel dossier une
catégorie va, ce fichier obtient la catégorie (en interrogeant le modèle de
vision) puis dépose le fichier (en appelant `noyau.fichiers.deplacer`, jamais
une seconde implémentation du déplacement).

Les imports lourds (Pillow, requests) vivent dans le corps des fonctions,
comme partout ailleurs dans le projet : `organizer.py verifier` ne doit pas
payer leur temps de chargement.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from noyau import fichiers
from noyau.journal import Journal

from . import regles

EXTENSIONS_VIDEO = {"mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv"}
EXTENSIONS_IMAGE = {"jpg", "jpeg", "png", "heic", "heif", "webp", "tiff", "bmp"}
EXTENSIONS_DOCUMENT = {"pdf"}

# Un côté d'image plus long n'améliore pas un classement à trois catégories et
# ne coûte que plus cher : la même limite que la vignette de contact utilisée
# pour se relire soi-même sur ce projet.
COTE_MAXIMAL_PX = 1024

PROMPT_SYSTEME = """Tu classes un fichier personnel déposé par un particulier dans exactement \
une de ces trois catégories :

- papier_administratif : un document administratif — facture, contrat, avis, \
courrier, relevé, attestation — qu'il soit un vrai scan/PDF ou une simple \
photo prise d'une page.
- photo_personnelle : une photo ou un souvenir personnel — famille, vacances, \
quotidien — sans rapport avec un projet créatif suivi.
- video_projet_creatif : une image extraite d'une vidéo, ou tout contenu qui \
relève visiblement d'un projet créatif suivi (montage, tournage, effets, \
personnage récurrent) plutôt que d'un souvenir personnel brut.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans texte autour :
{"categorie": "papier_administratif|photo_personnelle|video_projet_creatif", \
"confiance": 0.0 à 1.0, "raison": "une phrase courte en français"}

La confiance reflète ton incertitude réelle : une photo de vacances est facile \
(confiance haute), une photo de groupe devant un bâtiment administratif est \
ambiguë (confiance basse) — dis-le plutôt que de trancher à l'aveugle."""


class ErreurDepot(Exception):
    """Le module ne peut pas classer ce fichier, et dit pourquoi."""


@dataclass(frozen=True)
class Contenu:
    genre: str  # "image" ou "texte"
    image_base64: str = ""
    media_type: str = "image/jpeg"
    texte: str = ""


def cle_api(config_depot: dict) -> str | None:
    import os

    nom_variable = (config_depot.get("api_vision") or {}).get("cle_variable_env", "")
    if not nom_variable:
        return None
    return os.environ.get(nom_variable) or None


def _extension(chemin: Path) -> str:
    return chemin.suffix.lower().lstrip(".")


def type_pris_en_charge(chemin: Path) -> bool:
    ext = _extension(chemin)
    return ext in EXTENSIONS_VIDEO | EXTENSIONS_IMAGE | EXTENSIONS_DOCUMENT


def _image_vers_base64(chemin_image: Path) -> str:
    import base64

    from PIL import Image

    with Image.open(chemin_image) as image:
        largeur, hauteur = image.size
        plus_grand_cote = max(largeur, hauteur)
        besoin_redimension = plus_grand_cote > COTE_MAXIMAL_PX

        # Un JPEG déjà sous la limite de taille n'a rien à gagner à être
        # décodé puis réencodé : la lecture des octets tels quels rend le
        # même résultat pour l'API, sans payer un aller-retour Pillow sur
        # chaque photo — le cas le plus courant d'un dépôt de photos.
        if image.format == "JPEG" and image.mode == "RGB" and not besoin_redimension:
            return base64.b64encode(chemin_image.read_bytes()).decode("ascii")

        import io

        image = image.convert("RGB")
        if besoin_redimension:
            echelle = COTE_MAXIMAL_PX / plus_grand_cote
            image = image.resize((max(1, int(largeur * echelle)), max(1, int(hauteur * echelle))))
        tampon = io.BytesIO()
        image.save(tampon, format="JPEG", quality=87)
        return base64.b64encode(tampon.getvalue()).decode("ascii")


def _extraire_une_image(chemin: Path) -> str:
    """Photo ou scan HEIC compris : toujours renvoyé en JPEG base64."""
    if _extension(chemin) in {"heic", "heif"}:
        import pillow_heif

        pillow_heif.register_heif_opener()
    return _image_vers_base64(chemin)


def _extraire_une_frame_video(chemin: Path) -> str:
    from noyau import outils_externes

    ffmpeg = outils_externes.trouver_ffmpeg()
    if not ffmpeg:
        raise ErreurDepot(
            "ffmpeg introuvable : impossible d'extraire une image de cette vidéo. "
            + outils_externes.message_installation("ffmpeg")
        )
    import tempfile

    with tempfile.TemporaryDirectory() as dossier_temp:
        image_temp = Path(dossier_temp) / "frame.jpg"
        resultat = subprocess.run(
            [str(ffmpeg), "-y", "-ss", "1.0", "-i", str(chemin), "-frames:v", "1",
             "-q:v", "3", str(image_temp)],
            capture_output=True, text=True,
        )
        if not image_temp.exists():
            # Une vidéo de moins d'une seconde n'a pas d'image à cet instant :
            # on retente à l'image zéro plutôt que d'abandonner.
            subprocess.run(
                [str(ffmpeg), "-y", "-i", str(chemin), "-frames:v", "1",
                 "-q:v", "3", str(image_temp)],
                capture_output=True, text=True,
            )
        if not image_temp.exists():
            raise ErreurDepot(f"ffmpeg n'a rendu aucune image de {chemin.name}.")
        return _image_vers_base64(image_temp)


def _texte_pdf(chemin: Path, pages_max: int = 8) -> str:
    """La couche numérique d'un PDF, ou une chaîne vide s'il n'en a pas.

    Pas de repli OCR ici : un PDF issu d'un simple scan (image sans couche de
    texte) n'est pas lisible par cette seule fonction — voir `ErreurDepot`
    levée par l'appelant. `pypdf` s'importe ici et non en tête de fichier,
    comme partout ailleurs dans ce module.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    import logging

    # `pypdf` écrit ses avertissements sur la sortie standard, au milieu du
    # compte rendu du dépôt — l'erreur est de toute façon dite par `ErreurDepot`.
    logging.getLogger("pypdf").setLevel(logging.ERROR)

    try:
        lecteur = PdfReader(str(chemin))
        morceaux = [page.extract_text() or "" for page in lecteur.pages[:pages_max]]
    except Exception:
        return ""
    return "\n".join(morceaux)


def preparer_contenu(chemin: Path, config: dict) -> Contenu:
    """Le contenu à envoyer au modèle, sans jamais envoyer le fichier au format brut."""
    ext = _extension(chemin)

    if ext in EXTENSIONS_DOCUMENT:
        texte = _texte_pdf(chemin)
        if not texte.strip():
            raise ErreurDepot(
                f"Aucun texte lisible dans {chemin.name} (pas de couche numérique — "
                "un PDF issu d'un simple scan n'est pas pris en charge ici)."
            )
        # Masqué avant de quitter la machine (SECURITY.md) : ce texte peut
        # porter un IBAN ou un numéro de sécurité sociale. Masquer avant de
        # tronquer, jamais après — sans quoi une coupure au milieu d'un motif
        # le laisserait passer.
        from noyau import redaction

        return Contenu(genre="texte", texte=redaction.masquer(texte)[:6000])

    if ext in EXTENSIONS_IMAGE:
        return Contenu(genre="image", image_base64=_extraire_une_image(chemin), media_type="image/jpeg")

    if ext in EXTENSIONS_VIDEO:
        return Contenu(genre="image", image_base64=_extraire_une_frame_video(chemin), media_type="image/jpeg")

    raise ErreurDepot(f"Extension .{ext} non prise en charge par le dépôt.")


def _bloc_contenu(contenu: Contenu) -> list[dict]:
    if contenu.genre == "image":
        return [{
            "type": "image",
            "source": {"type": "base64", "media_type": contenu.media_type, "data": contenu.image_base64},
        }]
    return [{"type": "text", "text": f"Texte extrait du document :\n\n{contenu.texte}"}]


def _extraire_json(texte: str) -> dict:
    correspondance = re.search(r"\{.*\}", texte, re.DOTALL)
    if not correspondance:
        raise ErreurDepot(f"Réponse du modèle sans JSON exploitable : {texte[:200]!r}")
    return json.loads(correspondance.group(0))


def classifier(chemin: Path, config_depot: dict, config: dict) -> regles.Classification:
    """Interroge le modèle de vision. Lève `ErreurDepot` plutôt que de deviner."""
    cle = cle_api(config_depot)
    if not cle:
        nom_variable = (config_depot.get("api_vision") or {}).get("cle_variable_env", "?")
        raise ErreurDepot(
            f"Clé d'API absente : la variable d'environnement {nom_variable} n'est pas définie. "
            "Le dépôt reste désactivé tant qu'elle ne l'est pas — aucune catégorie n'est devinée."
        )

    contenu = preparer_contenu(chemin, config)

    import requests

    reglages_api = config_depot.get("api_vision") or {}
    point_de_terminaison = reglages_api.get("point_de_terminaison") or "https://api.anthropic.com/v1/messages"
    modele = reglages_api.get("modele") or "claude-sonnet-5"

    try:
        reponse = requests.post(
            point_de_terminaison,
            headers={
                "x-api-key": cle,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": modele,
                "max_tokens": 300,
                "system": PROMPT_SYSTEME,
                "messages": [{"role": "user", "content": _bloc_contenu(contenu)}],
            },
            timeout=60,
        )
    except requests.exceptions.Timeout:
        raise ErreurDepot(
            "L'API de vision n'a pas répondu en 60 secondes — réessaie, "
            "ou vérifie la connexion réseau."
        ) from None
    except requests.exceptions.ConnectionError as erreur:
        raise ErreurDepot(f"Impossible de joindre l'API de vision : {erreur}") from None
    except requests.exceptions.RequestException as erreur:
        raise ErreurDepot(f"Échec de la requête vers l'API de vision : {erreur}") from None

    if reponse.status_code != 200:
        raise ErreurDepot(f"L'API de vision a répondu {reponse.status_code} : {reponse.text[:300]}")

    try:
        corps = reponse.json()
    except ValueError:
        raise ErreurDepot(f"Réponse de l'API de vision illisible (pas du JSON) : {reponse.text[:200]!r}") from None
    morceaux_texte = [b.get("text", "") for b in corps.get("content", []) if b.get("type") == "text"]
    donnees = _extraire_json("".join(morceaux_texte))

    categorie = str(donnees.get("categorie", ""))
    if not regles.categorie_valide(categorie):
        raise ErreurDepot(f"Catégorie rendue par le modèle inconnue : {categorie!r}")

    return regles.Classification(
        categorie=categorie,
        confiance=max(0.0, min(1.0, float(donnees.get("confiance", 0.0)))),
        raison=str(donnees.get("raison", "")),
    )


PROMPT_CHAMPS = """Tu identifies un document administratif déposé par un particulier \
et tu listes les champs qu'il devrait probablement remplir ou vérifier.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans texte autour :
{"type_document": "un nom court et clair, par exemple \\"Avis d'imposition\\"",
 "resume": "une phrase qui dit de quoi il s'agit",
 "champs": [
   {"nom": "nom court du champ", \
"explication": "explication simple, une ou deux phrases, de ce que c'est, où le \
trouver sur le document ou comment le remplir correctement"}
 ]}

Si le document ne comporte visiblement aucun champ à remplir (un courrier \
purement informatif, par exemple), renvoie une liste "champs" vide plutôt que \
d'en inventer. Ne dépasse jamais 8 champs, et limite-toi à ceux réellement \
visibles ou évidents sur le document."""


def identifier_champs(chemin: Path, config_depot: dict, config: dict) -> dict:
    """Deuxième lecture, propre aux documents administratifs.

    Pas la catégorie (`classifier` s'en charge déjà) mais le type précis du
    document et les champs qu'il faut probablement remplir — de quoi guider
    l'utilisateur pas à pas plutôt que de le laisser seul face à un formulaire.
    Réutilise `preparer_contenu` : même passage par l'OCR pour un PDF, même
    réduction d'image, pour ne pas payer une deuxième extraction.
    """
    cle = cle_api(config_depot)
    if not cle:
        nom_variable = (config_depot.get("api_vision") or {}).get("cle_variable_env", "?")
        raise ErreurDepot(
            f"Clé d'API absente : la variable d'environnement {nom_variable} n'est pas définie."
        )

    contenu = preparer_contenu(chemin, config)

    import requests

    reglages_api = config_depot.get("api_vision") or {}
    point_de_terminaison = reglages_api.get("point_de_terminaison") or "https://api.anthropic.com/v1/messages"
    modele = reglages_api.get("modele") or "claude-sonnet-5"

    try:
        reponse = requests.post(
            point_de_terminaison,
            headers={
                "x-api-key": cle,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": modele,
                "max_tokens": 1200,
                "system": PROMPT_CHAMPS,
                "messages": [{"role": "user", "content": _bloc_contenu(contenu)}],
            },
            timeout=60,
        )
    except requests.exceptions.Timeout:
        raise ErreurDepot(
            "L'API de vision n'a pas répondu en 60 secondes — réessaie, "
            "ou vérifie la connexion réseau."
        ) from None
    except requests.exceptions.ConnectionError as erreur:
        raise ErreurDepot(f"Impossible de joindre l'API de vision : {erreur}") from None
    except requests.exceptions.RequestException as erreur:
        raise ErreurDepot(f"Échec de la requête vers l'API de vision : {erreur}") from None

    if reponse.status_code != 200:
        raise ErreurDepot(f"L'API de vision a répondu {reponse.status_code} : {reponse.text[:300]}")

    try:
        corps = reponse.json()
    except ValueError:
        raise ErreurDepot(f"Réponse de l'API de vision illisible (pas du JSON) : {reponse.text[:200]!r}") from None
    morceaux_texte = [b.get("text", "") for b in corps.get("content", []) if b.get("type") == "text"]
    donnees = _extraire_json("".join(morceaux_texte))

    champs_bruts = donnees.get("champs")
    champs = []
    if isinstance(champs_bruts, list):
        for champ in champs_bruts[:8]:
            if not isinstance(champ, dict) or not champ.get("nom"):
                continue
            champs.append({
                "nom": str(champ.get("nom", "")).strip(),
                "explication": str(champ.get("explication", "")).strip(),
            })

    return {
        "type_document": str(donnees.get("type_document", "")).strip() or "Document",
        "resume": str(donnees.get("resume", "")).strip(),
        "champs": champs,
    }


def deposer(
    chemin_source: Path,
    racine_projet: Path,
    dossier_relatif: str,
    journal: Journal,
    appliquer: bool,
    nom_final: str | None = None,
) -> Path:
    """La destination proposée, déplacée pour de vrai seulement si `appliquer`.

    `racine_projet` est un dossier local — celui où Google Drive Desktop
    synchronise déjà `depot.projets.<nom>.racine_drive` — jamais un appel à
    une API de stockage : c'est ce qui permet de réutiliser `deplacer` tel
    quel plutôt que d'écrire un deuxième chemin de dépôt de fichier.

    `nom_final` distingue le nom qu'on donne au fichier déposé du nom de
    `chemin_source` : l'interface web enregistre l'envoi sous un nom temporaire
    préfixé (pour ne jamais écraser deux dépôts simultanés), et le fichier posé
    sur Drive doit porter le nom d'origine, pas ce préfixe technique.
    """
    destination_visee = racine_projet / dossier_relatif / (nom_final or chemin_source.name)
    if not appliquer:
        return fichiers.nom_disponible(destination_visee)
    return fichiers.deplacer(chemin_source, destination_visee, verifier=True)


def _historique_chemin(racine_projet: Path) -> Path:
    return racine_projet / ".depot_historique.json"


def _lire_historique(racine_projet: Path) -> dict:
    chemin = _historique_chemin(racine_projet)
    if not chemin.exists():
        return {}
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def deja_depose(chemin: Path, racine_projet: Path) -> dict | None:
    """L'entrée d'historique si ce contenu exact a déjà été déposé ici.

    Comparé par empreinte du contenu (`noyau.fichiers.empreinte`, la même que
    `deplacer` utilise pour vérifier une copie) et non par nom : une photo
    renommée entre deux envois reste reconnue, une photo homonyme mais
    différente ne l'est pas. `None` dès que la destination enregistrée n'existe
    plus — un dépôt qu'on a soi-même déplacé ou supprimé depuis ne doit pas
    faire croire qu'il est toujours là.
    """
    historique = _lire_historique(racine_projet)
    entree = historique.get(fichiers.empreinte(chemin))
    if entree and Path(entree["destination"]).exists():
        return entree
    return None


def enregistrer_depot(chemin_avant_deplacement: Path, destination: Path, racine_projet: Path) -> None:
    """Note ce dépôt dans l'historique du projet, pour que `deja_depose` le retrouve.

    Doit être appelé avec le chemin *source*, avant que `deposer` ne le
    déplace — l'empreinte se calcule sur un fichier qui existe encore.
    """
    from datetime import datetime

    historique = _lire_historique(racine_projet)
    historique[fichiers.empreinte(chemin_avant_deplacement)] = {
        "destination": str(destination),
        "depose_le": datetime.now().isoformat(timespec="seconds"),
    }
    _historique_chemin(racine_projet).write_text(
        json.dumps(historique, ensure_ascii=False, indent=2), encoding="utf-8"
    )
