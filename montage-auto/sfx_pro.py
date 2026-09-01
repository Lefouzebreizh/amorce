#!/usr/bin/env python3
"""Ce qu'il faut à une bibliothèque de sons pour servir à un monteur.

Séparé de `download_blockbuster_sfx.py`, qui fabrique et mesure : ici on ne
crée aucun son, on **décrit** ceux qui existent. La séparation n'est pas
cosmétique — la fabrication doit rester lisible sans les huit cents lignes de
catalogue visuel, de bacs pour logiciels de montage et de fiches de licence.

Rien n'est régénéré : chaque fonction lit `audio_catalog.json` et les WAV déjà
posés. Relancer le script deux fois de suite ne produit aucune différence.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import wave
import xml.etree.ElementTree as arbre
from pathlib import Path

import numpy

# ── caractère de chaque son ───────────────────────────────────────────────────
#
# L'humeur et l'intensité ne se mesurent pas : elles se décident. Un algorithme
# qui les déduirait du spectre donnerait « sombre » à tout ce qui est grave et
# se tromperait sur le premier carillon. Elles sont donc écrites à la main, une
# fois, et c'est ce qui les rend utilisables comme filtre.
CARACTERE = {
    "impact_lourd_court":  ("brutal", 8),   "impact_lourd_long":  ("brutal", 9),
    "impact_metal_brise":  ("brutal", 8),   "impact_debris":      ("chaotique", 7),
    "braam_court":         ("menaçant", 8), "braam_massif":       ("menaçant", 10),
    "braam_double":        ("menaçant", 9), "chute_sub":          ("sombre", 6),
    "chute_sub_profonde":  ("sombre", 7),   "impact_puis_chute":  ("brutal", 9),
    "choc_acier":          ("sec", 5),      "choc_enclume":       ("brutal", 7),
    "riser_court":         ("tendu", 5),    "riser_moyen":        ("tendu", 7),
    "riser_long":          ("tendu", 8),    "riser_pulse":        ("tendu", 8),
    "descente_tension":    ("inquiet", 5),  "coeur_lent":         ("inquiet", 4),
    "coeur_panique":       ("tendu", 8),    "tension_sourde":     ("inquiet", 5),
    "whoosh_rapide":       ("vif", 4),      "whoosh_moyen":       ("vif", 5),
    "whoosh_lourd":        ("massif", 7),   "whoosh_retour":      ("vif", 4),
    "whoosh_tournant":     ("vertigineux", 6), "whoosh_tournant_long": ("vertigineux", 7),
    "transition_eclair":   ("électrique", 6), "transition_impact": ("brutal", 8),
    "drone_sombre":        ("sombre", 3),   "drone_grave":        ("sombre", 3),
    "drone_tendu":         ("inquiet", 4),  "drone_braam":        ("menaçant", 6),
    "grondement_terre":    ("massif", 5),   "grondement_braises": ("organique", 3),
    "souffle_caverne":     ("organique", 2),
    "ui_validation":       ("clair", 2),    "ui_notification":    ("clair", 3),
    "ui_erreur":           ("sec", 4),      "ui_clic":            ("sec", 1),
    "ui_clic_doux":        ("clair", 1),    "ui_bascule":         ("sec", 2),
    "ui_apparition":       ("clair", 2),
}

# Les rangements fins ne concernent que les impacts : c'est la seule famille
# assez fournie pour qu'un monteur s'y perde.
SOUS_DOSSIERS = {
    "01_Impacts_and_Booms": {
        "Braams": ("braam_court", "braam_massif", "braam_double", "drone_braam"),
        "Sub_Bass": ("chute_sub", "chute_sub_profonde", "impact_lourd_long",
                     "impact_lourd_court"),
        "Trailer_Hits": ("impact_metal_brise", "impact_debris", "impact_puis_chute",
                         "choc_acier", "choc_enclume"),
    },
}


# ── mesures normalisées ───────────────────────────────────────────────────────

def lire_wav(chemin: Path) -> tuple[numpy.ndarray, int]:
    with wave.open(str(chemin), "rb") as source:
        taux = source.getframerate()
        largeur = source.getsampwidth()
        brut = source.readframes(source.getnframes())
    if largeur == 2:
        signal = numpy.frombuffer(brut, dtype=numpy.int16).astype(numpy.float64) / 32768.0
    elif largeur == 3:
        octets = numpy.frombuffer(brut, dtype=numpy.uint8).reshape(-1, 3)
        entiers = (octets[:, 0].astype(numpy.int32)
                   | (octets[:, 1].astype(numpy.int32) << 8)
                   | (octets[:, 2].astype(numpy.int32) << 16))
        entiers = numpy.where(entiers & 0x800000, entiers - 0x1000000, entiers)
        signal = entiers.astype(numpy.float64) / 8388608.0
    else:
        signal = numpy.frombuffer(brut, dtype=numpy.int32).astype(numpy.float64) / 2147483648.0
    return signal, taux


def ecrire_wav_24(chemin: Path, signal: numpy.ndarray, taux: int) -> None:
    """WAV 24 bits — le format qu'attend un banc de montage.

    Les seize bits suffisaient à l'écoute ; ils ne suffisent plus dès qu'un
    monteur baisse un son de vingt décibels puis le remonte, ce que fait
    n'importe quel étagement de couches.
    """
    borne = numpy.clip(signal, -1.0, 1.0)
    entiers = numpy.int32(borne * 8388607).astype("<i4")
    octets = entiers.view(numpy.uint8).reshape(-1, 4)[:, :3].tobytes()
    chemin.parent.mkdir(parents=True, exist_ok=True)
    partiel = chemin.with_suffix(chemin.suffix + ".partiel")
    with wave.open(str(partiel), "wb") as sortie:
        sortie.setnchannels(1)
        sortie.setsampwidth(3)
        sortie.setframerate(taux)
        sortie.writeframes(octets)
    partiel.replace(chemin)


def mesurer_lufs(signal: numpy.ndarray, taux: int) -> float | None:
    """Sonie intégrée. `None` quand le son est trop court pour la norme.

    BS.1770 exige 400 ms de signal : un clic d'interface de 160 ms n'a pas de
    LUFS, et lui en inventer un serait plus faux que de laisser le champ vide.
    """
    if len(signal) < int(0.4 * taux):
        return None
    try:
        import pyloudnorm
        metre = pyloudnorm.Meter(taux)
        valeur = float(metre.integrated_loudness(signal))
    except Exception:
        return None
    return None if valeur < -70 or not numpy.isfinite(valeur) else round(valeur, 1)


def mesurer_vrai_pic(signal: numpy.ndarray) -> float:
    """Vrai pic approché par suréchantillonnage ×4.

    Le pic échantillon sous-estime ce qu'un convertisseur restituera : entre
    deux points, la courbe reconstruite dépasse. Quatre fois suffit à voir les
    dépassements qui comptent, et ne coûte rien sur des fichiers de six secondes.
    """
    from scipy import signal as filtres
    if len(signal) < 16:
        crete = float(numpy.max(numpy.abs(signal))) if len(signal) else 0.0
    else:
        crete = float(numpy.max(numpy.abs(filtres.resample_poly(signal, 4, 1))))
    return round(20.0 * numpy.log10(max(crete, 1e-9)), 1)


def rogner_silence(signal: numpy.ndarray, seuil_db: float = -50.0,
                   marge_ms: float = 20.0, taux: int = 48000) -> numpy.ndarray:
    """Coupe le silence de tête et de queue, et garde une marge.

    La marge n'est pas de la prudence : couper au ras du premier échantillon
    audible fabrique un clic, et un clic sur un impact s'entend plus que
    l'impact.
    """
    seuil = 10.0 ** (seuil_db / 20.0)
    au_dessus = numpy.flatnonzero(numpy.abs(signal) > seuil)
    if au_dessus.size == 0:
        return signal
    marge = int(marge_ms * taux / 1000.0)
    debut = max(0, int(au_dessus[0]) - marge)
    fin = min(len(signal), int(au_dessus[-1]) + marge)
    return signal[debut:fin]


def empreinte(chemin: Path) -> str:
    import hashlib
    condensat = hashlib.md5()
    with open(chemin, "rb") as source:
        for bloc in iter(lambda: source.read(1 << 16), b""):
            condensat.update(bloc)
    return condensat.hexdigest()


# ── aperçus ───────────────────────────────────────────────────────────────────

def dessiner_apercu(chemin_wav: Path, sortie: Path, perte_db: float | None) -> bool:
    """Forme d'onde et spectrogramme, avec la ligne des 400 Hz tracée dessus.

    La ligne est le seul élément qui compte : sans elle, un spectrogramme dit à
    quoi le son ressemble, avec elle il dit ce que l'auditeur en recevra.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as traceur
        from scipy import signal as filtres
    except ImportError:
        return False

    donnees, taux = lire_wav(chemin_wav)
    if donnees.size < 256:
        return False

    figure, (haut, bas) = traceur.subplots(
        2, 1, figsize=(7.2, 4.4), facecolor="#0d1117",
        gridspec_kw={"height_ratios": [1, 1.5]})
    temps = numpy.arange(len(donnees)) / taux

    haut.plot(temps, donnees, linewidth=0.5, color="#58d6a0")
    haut.set_facecolor("#0d1117")
    haut.set_xlim(0, temps[-1])
    haut.set_ylim(-1, 1)
    haut.set_yticks([])
    haut.tick_params(colors="#8b949e", labelsize=7)
    for bord in haut.spines.values():
        bord.set_color("#30363d")

    fenetre = min(1024, len(donnees))
    frequences, instants, densite = filtres.spectrogram(
        donnees, fs=taux, nperseg=fenetre, noverlap=fenetre // 2)
    bas.pcolormesh(instants, frequences, 10 * numpy.log10(densite + 1e-12),
                   shading="gouraud", cmap="magma")
    bas.set_yscale("log")
    bas.set_ylim(40, min(16000, taux / 2))
    bas.axhline(400, color="#f85149", linestyle="--", linewidth=1.2)
    bas.set_facecolor("#0d1117")
    bas.set_xlabel("temps (s)", color="#8b949e", fontsize=8)
    bas.set_ylabel("Hz", color="#8b949e", fontsize=8)
    bas.tick_params(colors="#8b949e", labelsize=7)
    for bord in bas.spines.values():
        bord.set_color("#30363d")

    titre = chemin_wav.stem
    if perte_db is not None:
        titre += f"   ·   perte téléphone {perte_db:.1f} dB"
    figure.suptitle(titre, color="#e6edf3", fontsize=10)
    figure.tight_layout()
    sortie.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(sortie, dpi=96, facecolor="#0d1117")
    traceur.close(figure)
    return True


# ── bacs pour logiciels de montage ────────────────────────────────────────────

def _indenter(element, niveau=0):
    creux = "\n" + "  " * niveau
    if len(element):
        if not (element.text or "").strip():
            element.text = creux + "  "
        for enfant in element:
            _indenter(enfant, niveau + 1)
        if not (enfant.tail or "").strip():
            enfant.tail = creux
    if niveau and not (element.tail or "").strip():
        element.tail = creux


def ecrire_bacs(catalogue: list, racine: Path) -> list[Path]:
    """Deux XML, un par logiciel. Ni l'un ni l'autre n'est un FCPXML complet.

    Un bac est une liste de fichiers, pas un montage : DaVinci et Premiere
    acceptent tous deux un XML minimal pour peupler un chutier, et prétendre
    écrire un projet entier ferait dépendre le résultat de la version installée.
    """
    ecrits = []

    racine_dv = arbre.Element("DaVinciResolveBins", version="1")
    par_categorie: dict[str, list] = {}
    for entree in catalogue:
        par_categorie.setdefault(entree["categorie"], []).append(entree)

    for categorie, sons in sorted(par_categorie.items()):
        bac = arbre.SubElement(racine_dv, "Bin", name=categorie)
        for son in sons:
            arbre.SubElement(
                bac, "MediaPoolItem",
                name=son["nom"],
                filePath=str((racine / son["chemin"]).resolve()),
                duration=str(son.get("duree_s") or ""),
                keyword=f"{son.get('mood', '')} {son.get('categorie', '')}".strip())
    _indenter(racine_dv)
    chemin_dv = racine / "DaVinci_Resolve_Bins.xml"
    arbre.ElementTree(racine_dv).write(chemin_dv, encoding="utf-8", xml_declaration=True)
    ecrits.append(chemin_dv)

    racine_pr = arbre.Element("PremiereData", Version="3")
    projet = arbre.SubElement(racine_pr, "Project")
    arbre.SubElement(projet, "Name").text = "Blockbuster SFX"
    for categorie, sons in sorted(par_categorie.items()):
        bac = arbre.SubElement(projet, "Bin")
        arbre.SubElement(bac, "Name").text = categorie
        for son in sons:
            element = arbre.SubElement(bac, "Clip")
            arbre.SubElement(element, "Name").text = son["nom"]
            arbre.SubElement(element, "PathURL").text = \
                (racine / son["chemin"]).resolve().as_uri()
    _indenter(racine_pr)
    chemin_pr = racine / "Premiere_Pro_Bins.xml"
    arbre.ElementTree(racine_pr).write(chemin_pr, encoding="utf-8", xml_declaration=True)
    ecrits.append(chemin_pr)
    return ecrits


# ── recettes ──────────────────────────────────────────────────────────────────

RECETTES_MONTEUR = [
    ("braam-qui-perce", "Un braam qui perce sur un téléphone", """
Le braam est le son le plus souvent perdu, parce qu'il est le plus grave. Trois
couches, et l'ordre compte.

| couche | son | gain | rôle |
| --- | --- | --- | --- |
| 1 | `braam_massif` | gain conseillé du catalogue | la masse, ressentie |
| 2 | `choc_acier` posé **20 ms avant** | −6 dB | l'attaque, entendue |
| 3 | `whoosh_rapide` finissant sur l'attaque | −4 dB | l'élan qui l'amène |

La couche 2 est celle qu'on oublie. Sans elle, le braam existe sur une enceinte
et disparaît sur un téléphone : son énergie vit sous 400 Hz, et l'attaque
métallique est la seule partie que le petit haut-parleur restitue. Vingt
millisecondes d'avance, pas plus — au-delà l'oreille entend deux sons.
"""),
    ("impact-qui-casse", "Un impact qui fait voler quelque chose en morceaux", """
| couche | son | gain | rôle |
| --- | --- | --- | --- |
| 1 | `impact_debris` | gain conseillé | le corps et les éclats |
| 2 | `chute_sub` **au même instant** | −8 dB | la masse qui tombe |
| 3 | `grondement_braises` sur les 3 s qui suivent | −14 dB | la traîne |

Le piège est de monter la couche 2. Elle ne s'entend pas, elle se ressent : la
pousser ne la rend pas audible, elle mange seulement la marge du limiteur et
fait plonger tout le mixage à chaque impact.
"""),
    ("montee-avant-coupe", "Une montée qui arrive avant la coupe", """
Une montée posée **sur** la coupe arrive en retard : le spectateur voit le
changement avant de l'entendre.

- `riser_moyen` commence **3,0 s avant** la coupe et finit **0,1 s après**.
- `whoosh_rapide` centré sur la coupe, à −3 dB.
- L'impact tombe sur la première image du nouveau plan, jamais sur la dernière
  de l'ancien.

Ce décalage de 0,1 s est la seule valeur du document qui ne se discute pas :
c'est le temps qu'il faut à l'œil pour accepter la coupe.
"""),
    ("lit-qui-tient", "Un lit sonore qui tient vingt secondes", """
La faute mesurée sur ce dépôt : confier le lit à un drone. Un drone perd
quinze décibels sur un haut-parleur de téléphone — il ne peut rien porter.

| couche | son | gain | rôle |
| --- | --- | --- | --- |
| 1 | `grondement_braises` ou `souffle_caverne` | gain conseillé | **le lit audible** (perte 1,3 et 0,3 dB) |
| 2 | `drone_sombre` | −8 dB sous la couche 1 | ce qui se ressent sur une enceinte |

Un seul élément possède le grave à la fois. Deux drones superposés, chacun
mesuré conforme, ont donné 11 dB de perte au mixage.
"""),
    ("interface-qui-ne-fatigue-pas", "Des sons d'interface qu'on entend cent fois par jour", """
Un son d'application n'est pas un son de bande-annonce : il sera entendu des
centaines de fois, et ce qui impressionne au premier passage exaspère au
vingtième.

- Sous **300 ms** pour une action, sous **700 ms** pour une notification.
- Jamais de grave : il n'apporte rien sur un téléphone et alourdit le fichier.
  Les sons `ui_*` de cette bibliothèque perdent tous moins de 5 dB, par
  construction.
- Le son d'erreur descend en hauteur, celui de validation monte. C'est la seule
  convention que l'oreille lit sans apprentissage.
- Version `.ogg` 96 kbps pour l'application : la différence est inaudible sur un
  son de moins d'une seconde, et le poids compte plus.
"""),
]


def ecrire_recettes(racine: Path) -> list[Path]:
    dossier = racine / "recipes"
    dossier.mkdir(parents=True, exist_ok=True)
    ecrits = []
    for nom, titre, corps in RECETTES_MONTEUR:
        chemin = dossier / f"{nom}.md"
        chemin.write_text(f"# {titre}\n{corps.rstrip()}\n", encoding="utf-8")
        ecrits.append(chemin)
    return ecrits


# ── licences ──────────────────────────────────────────────────────────────────

def ecrire_licences(catalogue: list, racine: Path) -> Path:
    synthetises = [s for s in catalogue if s.get("source") == "synthese"]
    importes = [s for s in catalogue if s.get("source") != "synthese"]

    lignes = ["# Licences et attributions", "",
              "## Sons synthétisés — aucune attribution requise", "",
              f"Les **{len(synthetises)} sons** fabriqués par",
              "`montage-auto/download_blockbuster_sfx.py` n'empruntent à aucune banque :",
              "ils sont calculés à partir de bruit et d'oscillateurs. Aucun enregistrement",
              "n'entre dans leur fabrication.", "",
              "**Ils sont donc monétisables sans restriction**, y compris dans une œuvre",
              "commerciale, sans mention et sans redevance. C'est la raison principale de",
              "les fabriquer plutôt que de les télécharger : une banque gratuite impose",
              "presque toujours une attribution, et une attribution oubliée sur une vidéo",
              "vue cent mille fois est un litige, pas un détail.", ""]

    if importes:
        lignes += ["## Sons importés — attribution requise", "",
                   "Chaque entrée porte sa licence telle que la source la déclare.",
                   "**Vérifier avant toute monétisation** : une licence peut changer entre",
                   "le téléchargement et la publication.", "",
                   "| son | source | licence | lien |", "| --- | --- | --- | --- |"]
        for son in importes:
            lignes.append(f"| `{son['nom']}` | {son.get('source', '?')} | "
                          f"{son.get('license', 'à vérifier')} | "
                          f"{son.get('source_url', '—')} |")
        lignes.append("")
    else:
        lignes += ["## Sons importés", "",
                   "Aucun. La bibliothèque est intégralement synthétisée — rien à",
                   "attribuer, rien à vérifier avant publication.", ""]

    chemin = racine / "LICENSES.md"
    chemin.write_text("\n".join(lignes), encoding="utf-8")
    return chemin


# ── catalogue visuel ──────────────────────────────────────────────────────────

def ecrire_page(catalogue: list, racine: Path) -> Path:
    """Une page autonome : ni serveur, ni réseau, ni bibliothèque distante.

    Elle est posée à la racine de la bibliothèque et lit les fichiers voisins par
    chemin relatif : ouverte depuis le disque elle joue les sons, et déplacée
    ailleurs elle ne joue plus rien. C'est voulu — une page qui irait chercher
    ses sons sur un serveur cesserait de marcher le jour où le serveur s'arrête.
    """
    donnees = json.dumps([{
        "nom": s["nom"], "categorie": s["categorie"],
        "duree": s.get("duree_s"), "perte": s.get("perte_db"),
        "gain": s.get("gain_conseille_db"), "lufs": s.get("lufs"),
        "pic": s.get("true_peak_db"), "humeur": s.get("mood"),
        "intensite": s.get("intensity"), "chemin": s["chemin"],
        "app": s.get("chemin_app"), "apercu": s.get("preview"),
    } for s in catalogue], ensure_ascii=False)

    # Le JSON est embarqué dans un <script> : un nom de son contenant
    # « </script> » y refermerait la balise et casserait toute la page. Échapper
    # les chevrons et l'esperluette suffit, et laisse le JSON valide — c'est la
    # parade retenue partout où des données sont posées dans du HTML.
    donnees = (donnees.replace("&", r"\u0026")
                      .replace("<", r"\u003c")
                      .replace(">", r"\u003e"))
    return _poser_page(racine, donnees, len(catalogue))


def _poser_page(racine: Path, donnees: str, total: int) -> Path:
    modele = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bibliotheque SFX</title>
<style>
 :root{--fond:#0d1117;--carte:#161b22;--bord:#30363d;--texte:#e6edf3;
       --gris:#8b949e;--vert:#3fb950;--orange:#d29922;--rouge:#f85149}
 *{box-sizing:border-box}
 body{margin:0;background:var(--fond);color:var(--texte);
      font:18px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
 header{padding:24px 20px 12px;border-bottom:1px solid var(--bord)}
 h1{margin:0 0 6px;font-size:26px}
 .sous{color:var(--gris);font-size:16px}
 .reglages{display:flex;flex-wrap:wrap;gap:14px;padding:16px 20px;
           border-bottom:1px solid var(--bord);align-items:center}
 label{font-size:15px;color:var(--gris);display:flex;gap:8px;align-items:center}
 select,input[type=search]{background:var(--carte);color:var(--texte);
   border:1px solid var(--bord);border-radius:8px;padding:10px 12px;font-size:16px;
   min-height:44px}
 input[type=range]{min-height:44px}
 .grille{display:grid;gap:14px;padding:20px;
         grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
 .carte{background:var(--carte);border:1px solid var(--bord);border-radius:12px;
        padding:16px;display:flex;flex-direction:column;gap:10px}
 .nom{font-weight:600;font-size:18px;word-break:break-word}
 .meta{display:flex;flex-wrap:wrap;gap:8px;font-size:14px;color:var(--gris)}
 .puce{border:1px solid var(--bord);border-radius:999px;padding:3px 10px}
 .bon{color:var(--vert);border-color:var(--vert)}
 .moyen{color:var(--orange);border-color:var(--orange)}
 .mauvais{color:var(--rouge);border-color:var(--rouge)}
 audio{width:100%;min-height:44px}
 img{width:100%;border-radius:8px;border:1px solid var(--bord);background:#000}
 button{background:#21262d;color:var(--texte);border:1px solid var(--bord);
        border-radius:8px;padding:12px;font-size:15px;cursor:pointer;min-height:44px}
 button:hover{border-color:var(--gris)}
 .vide{padding:40px 20px;color:var(--gris);text-align:center}
 @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<header>
  <h1>Bibliotheque SFX</h1>
  <div class="sous">TOTAL sons &middot; la perte indique ce qu'un haut-parleur de
  telephone ne restituera pas &mdash; au-dela de 10 dB, la moitie du sound design
  disparait.</div>
</header>
<div class="reglages">
  <label>Categorie <select id="cat"><option value="">toutes</option></select></label>
  <label>Humeur <select id="hum"><option value="">toutes</option></select></label>
  <label>Perte max <input type="range" id="perte" min="0" max="20" value="20">
    <span id="perteVal">20 dB</span></label>
  <label>Intensite min <input type="range" id="inten" min="1" max="10" value="1">
    <span id="intenVal">1</span></label>
  <label><input type="search" id="q" placeholder="chercher un nom"></label>
</div>
<div class="grille" id="grille"></div>
<div class="vide" id="vide" hidden>Aucun son ne correspond a ces filtres.</div>
<script>
const SONS = DONNEES;
const $ = s => document.querySelector(s);
const classe = p => p == null ? "" : (p <= 5 ? "bon" : p <= 10 ? "moyen" : "mauvais");

for (const [id, champ] of [["cat","categorie"],["hum","humeur"]]) {
  const vus = [...new Set(SONS.map(s => s[champ]).filter(Boolean))].sort();
  for (const v of vus) {
    const o = document.createElement("option"); o.value = o.textContent = v;
    $("#"+id).append(o);
  }
}

function copier(texte, bouton) {
  const fini = () => { const a = bouton.textContent;
    bouton.textContent = "chemin copie"; setTimeout(() => bouton.textContent = a, 1200); };
  // Le presse-papier moderne n'existe pas sur une page ouverte en file:// ;
  // la zone de texte cachee, elle, marche partout.
  if (navigator.clipboard && location.protocol !== "file:") {
    navigator.clipboard.writeText(texte).then(fini, () => secours(texte, fini));
  } else secours(texte, fini);
}
function secours(texte, fini) {
  const z = document.createElement("textarea");
  z.value = texte; z.style.position = "fixed"; z.style.opacity = "0";
  document.body.append(z); z.select();
  try { document.execCommand("copy"); fini(); } catch (e) {}
  z.remove();
}

function rendre() {
  const cat = $("#cat").value, hum = $("#hum").value;
  const perteMax = +$("#perte").value, intenMin = +$("#inten").value;
  const q = $("#q").value.trim().toLowerCase();
  $("#perteVal").textContent = perteMax + " dB";
  $("#intenVal").textContent = intenMin;

  const gardes = SONS.filter(s =>
    (!cat || s.categorie === cat) && (!hum || s.humeur === hum) &&
    (s.perte == null || s.perte <= perteMax) &&
    ((s.intensite ?? 1) >= intenMin) &&
    (!q || s.nom.toLowerCase().includes(q)));

  const g = $("#grille"); g.textContent = "";
  $("#vide").hidden = gardes.length > 0;

  for (const s of gardes) {
    const c = document.createElement("div"); c.className = "carte";
    const nom = document.createElement("div");
    nom.className = "nom"; nom.textContent = s.nom; c.append(nom);

    const meta = document.createElement("div"); meta.className = "meta";
    const puces = [
      [s.duree != null ? s.duree.toFixed(2) + " s" : null, ""],
      [s.perte != null ? "perte " + s.perte.toFixed(1) + " dB" : null, classe(s.perte)],
      [s.gain != null ? "gain " + (s.gain > 0 ? "+" : "") + s.gain + " dB" : null, ""],
      [s.lufs != null ? s.lufs + " LUFS" : null, ""],
      [s.humeur, ""], [s.intensite != null ? "intensite " + s.intensite : null, ""],
    ];
    for (const [t, k] of puces) {
      if (!t) continue;
      const p = document.createElement("span");
      p.className = "puce " + k; p.textContent = t; meta.append(p);
    }
    c.append(meta);

    if (s.apercu) {
      const i = document.createElement("img");
      i.src = s.apercu; i.alt = "spectrogramme de " + s.nom; i.loading = "lazy";
      c.append(i);
    }
    const a = document.createElement("audio");
    a.controls = true; a.preload = "none"; a.src = s.app || s.chemin;
    c.append(a);

    const b = document.createElement("button");
    b.textContent = "copier le chemin";
    b.addEventListener("click", () => copier(s.chemin, b));
    c.append(b);
    g.append(c);
  }
}
for (const id of ["cat","hum","perte","inten","q"])
  $("#"+id).addEventListener("input", rendre);
rendre();
</script></body></html>
"""
    page = modele.replace("DONNEES", donnees).replace("TOTAL", str(total))
    chemin = racine / "sfx_library.html"
    chemin.write_text(page, encoding="utf-8")
    return chemin
