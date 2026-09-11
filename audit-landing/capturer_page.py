#!/usr/bin/env python3
"""Capture visuelle d'une page de vente, découpée en segments analysables.

Objectif : nourrir un futur modèle de vision avec des images nettes plutôt
qu'un bandeau de 8000 px écrasé au redimensionnement, où le texte devient
illisible — c'est précisément ce qui produit les rapports vagues qu'on veut
éviter (« améliorez votre message » plutôt qu'un défaut précis et visible).

Ce module ne fait que capturer et découper. Le prompt d'analyse d'image, la
génération du rapport et la page de vente du produit viennent après.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import (
    Error as ErreurPlaywright,
    Page,
    TimeoutError as DelaiDepassePlaywright,
    sync_playwright,
)

LARGEUR_VIEWPORT = 1440
HAUTEUR_VIEWPORT = 900
FACTEUR_ECHELLE = 2  # device_scale_factor : rendu net, comme un écran Retina

DELAI_NAVIGATION_MS = 30_000
DELAI_RESEAU_STABLE_MS = 5_000  # plafond de secours : certaines pages B2B
# avec trackers ou chat en direct ne deviennent jamais complètement inactives
DELAI_RESEAU_STABLE_APRES_SCROLL_MS = 2_500

# Laisse le temps à une révélation au scroll (opacity 0 → 1, très répandue
# sur les sites de storytelling) de se terminer avant la capture du segment.
# Mesuré nécessaire : sans lui, une capture pleine page composite prise une
# fois pour toutes ratait des sections encore invisibles — voir
# capturer_et_decouper.
PAUSE_AVANT_CAPTURE_SEGMENT_S = 0.3

PAS_SCROLL_PX = 700
PAUSE_ENTRE_PAS_S = 0.15
MAX_PAS_SCROLL = 80  # garde-fou contre une page à défilement infini

# Sélecteurs de bandeaux de consentement mesurés sur les CMP les plus
# répandus (OneTrust, Didomi, Axeptio, Cookiebot, TrustArc, Google Funding
# Choices). Un sélecteur qui ne matche rien ne coûte qu'un essai ignoré.
SELECTEURS_CONSENTEMENT = [
    "#onetrust-accept-btn-handler",
    "#didomi-notice-agree-button",
    "#axeptio_btn_acceptAll",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "button#truste-consent-button",
    ".fc-cta-consent",
    "button[data-testid='uc-accept-all-button']",
    "[aria-label='Accepter' i]",
    "[aria-label='Tout accepter' i]",
    "[aria-label='Accept all' i]",
    "[aria-label='Accept cookies' i]",
]

# Repli textuel, quand aucun sélecteur d'identifiant ne matche : le bouton
# d'un CMP maison n'a presque jamais un id stable, mais porte presque
# toujours un de ces textes.
TEXTES_CONSENTEMENT = [
    "Tout accepter",
    "Accepter tout",
    "Accepter les cookies",
    "J'accepte",
    "Accepter",
    "Accept all",
    "Accept All Cookies",
    "Accept cookies",
    "I accept",
    "Allow all",
]

DELAI_CLIC_CONSENTEMENT_MS = 1_200

# Étape 2 de l'énoncé : après avoir tenté un clic, tout ce qui reste affiché
# en `position: fixed` est masqué — bandeau de cookies qui a résisté au clic,
# bannière de promo, chat en direct, en-tête collant. Chaque segment étant
# désormais capturé pendant qu'il est réellement scrollé dans le viewport
# (voir capturer_et_decouper), un élément fixe apparaîtrait, pinné, sur
# chacun des treize segments — c'est ce que le masquage évite.
#
# `position: sticky` n'est délibérément PAS masqué, et ça a été mesuré :
# masquer un sticky avec `display:none` le retire du flux normal du document
# (contrairement à `fixed`), ce qui raccourcit la page et décale tout ce qui
# suit — vérifié sur une fixture avec une grande section « épinglée » de
# storytelling, une technique de mise en page très répandue et pas du tout
# limitée à un petit bandeau. Depuis que chaque segment est un vrai viewport
# scrollé à sa position, un sticky se comporte exactement comme sous les
# yeux d'un utilisateur réel — ce qui inclut d'apparaître, à raison, à la
# même position sur plusieurs segments consécutifs une fois épinglé (mesuré
# sur payfit.com/fr, voir README.md) : ce n'est pas la même chose que la
# duplication de l'ancien bug en composite pleine page.
JS_MASQUER_ELEMENTS_FIXES = """
() => {
  const noeuds = document.querySelectorAll('body *');
  let masques = 0;
  for (const noeud of noeuds) {
    const style = window.getComputedStyle(noeud);
    if (style.position === 'fixed') {
      noeud.style.setProperty('display', 'none', 'important');
      masques += 1;
    }
  }
  return masques;
}
"""


@dataclass(frozen=True)
class Segment:
    """Une tranche verticale de la capture, prête à être analysée seule."""

    nom: str
    y_debut_px: int
    y_fin_px: int


def calculer_segments(
    hauteur_totale_px: int,
    hauteur_segment_px: int = HAUTEUR_VIEWPORT * FACTEUR_ECHELLE,
) -> list[Segment]:
    """Découpe une hauteur totale en tranches logiques nommées.

    Fonction pure — aucun navigateur requis — pour rester testable sans
    réseau. Trois cas seulement, et c'est délibéré :

    - une seule tranche → elle vaut à la fois hero et bas ("01-hero-bas") ;
    - deux tranches → "01-hero" et "02-bas", pas de milieu ;
    - au-delà → la première est "hero", la dernière "bas", tout le reste
      "milieu-N" plutôt qu'un unique bloc de plusieurs milliers de pixels :
      un « milieu » monolithique sur une page SaaS de 8000 px reproduirait
      exactement le défaut que le découpage existe pour éviter.
    """
    if hauteur_totale_px <= 0:
        raise ValueError("hauteur_totale_px doit être positive")
    if hauteur_segment_px <= 0:
        raise ValueError("hauteur_segment_px doit être positive")

    nb_segments = max(1, -(-hauteur_totale_px // hauteur_segment_px))  # division arrondie au-dessus
    segments: list[Segment] = []
    for indice in range(nb_segments):
        y_debut = indice * hauteur_segment_px
        y_fin = min(y_debut + hauteur_segment_px, hauteur_totale_px)

        if nb_segments == 1:
            nom = "01-hero-bas"
        elif indice == 0:
            nom = "01-hero"
        elif indice == nb_segments - 1:
            nom = f"{indice + 1:02d}-bas"
        else:
            nom = f"{indice + 1:02d}-milieu"

        segments.append(Segment(nom=nom, y_debut_px=y_debut, y_fin_px=y_fin))
    return segments


def nom_dossier_pour_url(url: str) -> str:
    """Un nom de dossier lisible et stable à partir d'une URL.

    `app.spendesk.com` → `app-spendesk-com` ; les chemins (`/fr`) sont
    conservés pour ne pas confondre deux pages du même domaine.
    """
    decoupee = urlparse(url if "://" in url else f"https://{url}")
    brut = f"{decoupee.netloc}{decoupee.path}".strip("/")
    brut = brut or decoupee.netloc
    nettoye = re.sub(r"[^a-zA-Z0-9]+", "-", brut).strip("-").lower()
    return nettoye or "page"


def fermer_bandeaux_cookies(page: Page) -> bool:
    """Tente de fermer proprement le bandeau de consentement.

    Un clic réel (plutôt qu'un simple masquage) évite de laisser un fond
    d'overlay semi-opaque derrière un bandeau juste caché en CSS. Best
    effort : aucune exception ne remonte, la suite du parcours doit
    continuer même si rien n'a matché.
    """
    for selecteur in SELECTEURS_CONSENTEMENT:
        try:
            localisateur = page.locator(selecteur).first
            if localisateur.is_visible(timeout=DELAI_CLIC_CONSENTEMENT_MS):
                localisateur.click(timeout=DELAI_CLIC_CONSENTEMENT_MS)
                return True
        except (ErreurPlaywright, DelaiDepassePlaywright):
            continue

    for texte in TEXTES_CONSENTEMENT:
        try:
            localisateur = page.get_by_role("button", name=re.compile(re.escape(texte), re.I)).first
            if localisateur.is_visible(timeout=DELAI_CLIC_CONSENTEMENT_MS):
                localisateur.click(timeout=DELAI_CLIC_CONSENTEMENT_MS)
                return True
        except (ErreurPlaywright, DelaiDepassePlaywright):
            continue

    return False


def attendre_stabilite(page: Page, delai_max_ms: int = DELAI_RESEAU_STABLE_MS) -> None:
    """`networkidle` OU le délai de secours, ce qui arrive en premier.

    `wait_for_load_state` lève une exception au-delà du délai : c'est
    exactement la course demandée, sans avoir à la construire à la main.
    Certaines pages B2B avec trackers ou chat en direct ne deviennent
    jamais inactives — les laisser bloquer le script jusqu'à un long
    timeout serait pire que capturer une seconde trop tôt.
    """
    try:
        page.wait_for_load_state("networkidle", timeout=delai_max_ms)
    except DelaiDepassePlaywright:
        pass


def forcer_chargement_complet(page: Page) -> None:
    """Scroll progressif jusqu'en bas pour déclencher le lazy-loading.

    Une bonne partie des images sous la ligne de flottaison ne se chargent
    que quand un `IntersectionObserver` les voit entrer dans le viewport —
    un simple `scroll_height` lu sans avoir scrollé ne les déclenche pas, et
    la capture finale montre des sections vides ou grises.
    """
    hauteur_precedente = -1
    for _ in range(MAX_PAS_SCROLL):
        page.evaluate(f"window.scrollBy(0, {PAS_SCROLL_PX})")
        time.sleep(PAUSE_ENTRE_PAS_S)

        hauteur_actuelle = page.evaluate("document.documentElement.scrollHeight")
        position_actuelle = page.evaluate("window.scrollY + window.innerHeight")
        if position_actuelle >= hauteur_actuelle and hauteur_actuelle == hauteur_precedente:
            break
        hauteur_precedente = hauteur_actuelle

    # Les images déclenchées par le dernier pas de scroll ont besoin d'un
    # instant pour finir de télécharger avant la capture.
    attendre_stabilite(page, DELAI_RESEAU_STABLE_APRES_SCROLL_MS)

    # Ne PAS remonter en haut avant la capture. Beaucoup de sites de
    # storytelling (mesuré sur qonto.com/fr) révèlent leurs sections au
    # scroll par une animation d'opacité (GSAP ScrollTrigger, Framer Motion
    # whileInView, AOS.js…) qui **repasse à 0 dès que la section ressort du
    # viewport** — un remise à zéro juste avant la capture pleine page
    # réinvisibilise donc tout ce qui a été révélé plus bas, sans toucher à
    # la mise en page : la tranche sort blanche, à la bonne position, avec
    # un total de tranches par ailleurs correct. La capture pleine page de
    # Playwright ne dépend pas de la position de défilement courante, donc
    # rien n'oblige à revenir en haut — l'en-tête collant, seul concerné par
    # un changement d'apparence au scroll, est de toute façon masqué juste
    # après par `masquer_elements_fixes`.


def masquer_elements_fixes(page: Page) -> int:
    """Masque tout ce qui reste en `position: fixed`/`sticky`. Rend le compte."""
    return page.evaluate(JS_MASQUER_ELEMENTS_FIXES)


def capturer_et_decouper(
    page: Page,
    url: str,
    dossier_sortie: Path,
    hauteur_segment_px: int | None = None,
) -> list[Path]:
    """Capture chaque segment pendant qu'il est réellement scrollé à l'écran.

    Une seule capture pleine page composite (`page.screenshot(full_page=True)`
    puis découpage a posteriori) a été essayée d'abord, et abandonnée :
    mesuré sur `qonto.com/fr`, des tranches entières sortaient totalement
    blanches, à leur position attendue, alors que le total de tranches restait
    cohérent. Cause reproduite sur une fixture locale : beaucoup de sites de
    storytelling révèlent leurs sections au scroll par une animation
    d'opacité qui **se réinitialise dès que la section ressort du viewport**
    (GSAP ScrollTrigger, Framer Motion `whileInView`, AOS.js sans
    `data-aos-once`…). Une capture composite est prise depuis UNE seule
    position de défilement : aucune position unique ne peut satisfaire toutes
    les sections à la fois sur une page qui en révèle plusieurs.

    Scroller réellement chaque segment dans le viewport avant de le capturer
    évite le problème à la racine, pour cette raison-là comme pour
    `content-visibility: auto` et les animations canvas/vidéo qui ne peignent
    qu'à l'écran : c'est aussi exactement ce qu'un utilisateur réel verrait.
    """
    dossier_page = dossier_sortie / nom_dossier_pour_url(url)
    dossier_page.mkdir(parents=True, exist_ok=True)

    hauteur_totale_logique = page.evaluate("document.documentElement.scrollHeight")
    hauteur_totale_px = hauteur_totale_logique * FACTEUR_ECHELLE

    pas = hauteur_segment_px or (HAUTEUR_VIEWPORT * FACTEUR_ECHELLE)
    segments = calculer_segments(hauteur_totale_px, pas)

    # Un segment ne peut jamais scroller plus bas que ce qu'il reste de page :
    # au-delà, le navigateur clampe de toute façon, mais borner explicitement
    # évite de dépendre de ce comportement implicite.
    y_max_logique = max(0, hauteur_totale_logique - HAUTEUR_VIEWPORT)

    fichiers_ecrits: list[Path] = []
    for segment in segments:
        y_cible_logique = min(segment.y_debut_px // FACTEUR_ECHELLE, y_max_logique)
        page.evaluate(f"window.scrollTo(0, {y_cible_logique})")
        time.sleep(PAUSE_AVANT_CAPTURE_SEGMENT_S)

        chemin = dossier_page / f"{segment.nom}.png"
        page.screenshot(path=str(chemin))
        fichiers_ecrits.append(chemin)

    # `scale="css"` : cette capture de référence reste en full_page=True, donc
    # peut retomber dans le même plafond de hauteur d'image de Chromium que
    # les segments évitent depuis le correctif ci-dessus (mesuré tronqué au-
    # delà d'environ 19 768 px physiques, voir le README). Rendre à l'échelle
    # CSS (1x) au lieu de l'échelle device (2x, celle des segments) divise par
    # deux la hauteur physique demandée, ce qui suffit à rester sous le
    # plafond sur des pages deux fois plus hautes qu'avant que ce fichier de
    # référence, seul, n'y retombe.
    page.evaluate("window.scrollTo(0, 0)")
    chemin_pleine_page = dossier_page / "00-pleine-page.png"
    page.screenshot(path=str(chemin_pleine_page), full_page=True, scale="css")
    fichiers_ecrits.append(chemin_pleine_page)

    return fichiers_ecrits


def capturer_url(page: Page, url: str, dossier_sortie: Path) -> list[Path]:
    """Le parcours complet pour une URL : ouvrir, nettoyer, charger, découper."""
    page.goto(url, timeout=DELAI_NAVIGATION_MS, wait_until="domcontentloaded")
    attendre_stabilite(page)

    a_ferme_un_bandeau = fermer_bandeaux_cookies(page)
    if a_ferme_un_bandeau:
        time.sleep(0.3)  # laisser l'animation de fermeture se terminer

    forcer_chargement_complet(page)
    nb_masques = masquer_elements_fixes(page)

    print(
        f"  bandeau fermé par clic : {a_ferme_un_bandeau} — "
        f"éléments fixes/collants masqués en plus : {nb_masques}",
        file=sys.stderr,
    )

    return capturer_et_decouper(page, url, dossier_sortie)


def main() -> int:
    analyse = argparse.ArgumentParser(description=__doc__.splitlines()[2])
    analyse.add_argument("urls", nargs="*", help="URLs à capturer")
    analyse.add_argument(
        "--sortie",
        type=Path,
        default=Path(__file__).parent / "captures",
        help="dossier racine des captures (défaut : ./captures, ignoré par git)",
    )
    analyse.add_argument(
        "--chromium",
        default="/opt/pw-browsers/chromium",
        help="chemin du binaire Chromium (défaut : celui déjà présent sur cette machine)",
    )
    arguments = analyse.parse_args()

    urls = arguments.urls or [
        "https://qonto.com/fr",
        "https://payfit.com/fr",
        "https://app.spendesk.com",
        "https://pennylane.com",
    ]

    arguments.sortie.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        chemin_chromium = arguments.chromium if Path(arguments.chromium).exists() else None
        navigateur = pw.chromium.launch(executable_path=chemin_chromium)
        contexte = navigateur.new_context(
            viewport={"width": LARGEUR_VIEWPORT, "height": HAUTEUR_VIEWPORT},
            device_scale_factor=FACTEUR_ECHELLE,
        )
        page = contexte.new_page()

        echec = 0
        for url in urls:
            print(f"→ {url}", file=sys.stderr)
            try:
                fichiers = capturer_url(page, url, arguments.sortie)
            except (ErreurPlaywright, DelaiDepassePlaywright) as erreur:
                print(f"  ÉCHEC : {erreur}", file=sys.stderr)
                echec = 1
                continue
            for fichier in fichiers:
                print(f"  {fichier}")

        contexte.close()
        navigateur.close()

    return echec


if __name__ == "__main__":
    raise SystemExit(main())
