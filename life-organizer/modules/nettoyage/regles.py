"""Décider si une photo est floue, si deux photos sont la même, et laquelle garder.

Trois décisions tiennent ce fichier :

1. **Deux fichiers identiques ne sont pas des doublons, et réciproquement.** Une
   photo recadrée, recompressée ou passée par une messagerie n'a plus un seul
   octet en commun avec l'originale : un SHA les croit étrangères. C'est
   l'empreinte perceptuelle qui les rapproche — elle décrit l'image, pas le
   fichier. À l'inverse, deux photos d'une rafale sont *presque* identiques et
   ne sont pas des doublons : personne ne veut qu'on lui retire la seule où tout
   le monde a les yeux ouverts.

2. **La ressemblance se règle, parce qu'elle ne se devine pas.** Ce qui sépare
   « la même photo recompressée » de « la photo d'après » n'a pas de valeur
   universelle : cela dépend d'un appareil, d'un sujet, d'une habitude de
   déclenchement. Le seuil est donc un réglage de premier plan
   (`nettoyage_medias.doublons.distance_max`), doublé d'une échelle nommée pour
   qui ne veut pas raisonner en bits.

3. **On ne juge que des mesures déjà prises.** Aucune image n'est ouverte ici :
   le décodage vit dans `traitement.py`. C'est ce qui permet de vérifier un
   seuil sur des nombres, en une seconde, sans installer Pillow ni OpenCV.

4. **La netteté passe avant la ressemblance.** Une photo floue écartée n'a plus
   à être comparée à quoi que ce soit : c'est un décodage de moins par photo
   jetée, et surtout cela évite qu'une photo nette soit écartée comme doublon
   de sa propre version ratée.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from noyau.modele import ECARTER, GARDER, Decision, Doublon, Media

# Un pHash fait 64 bits : la distance de Hamming va donc de 0 (même image) à 64
# (l'image et son négatif). Les valeurs utiles tiennent dans le premier quart.
BITS_DU_HACHAGE = 64

# L'échelle nommée. Les valeurs viennent de ce que chaque palier laisse passer :
#
#   0  — le même rendu, bit pour bit après réduction : une copie, un « (1) ».
#   2  — la même photo recompressée ou redimensionnée par une messagerie.
#   5  — la même scène recadrée légèrement, ou réétalonnée par un filtre.
#   10 — deux prises très proches. À ce palier, une rafale commence à être vue
#        comme un doublon : c'est utile pour faire le tri d'un dossier de
#        vacances, dangereux pour un dossier qu'on ne relira pas.
#
# Au-delà, deux photos différentes du même lieu se rejoignent : voir
# `avertissement_ressemblance`.
NIVEAUX_DE_RESSEMBLANCE = {
    "identique": 0,
    "stricte": 2,
    "prudente": 5,
    "large": 10,
}

# À partir d'ici, l'expérience du pHash est constante : deux photos sans rapport
# passent sous le seuil dès qu'elles partagent une composition (un ciel, un mur
# clair, un document scanné). On laisse le réglage possible, on prévient.
RESSEMBLANCE_A_RISQUE = 12


@dataclass(frozen=True)
class Ressemblance:
    """Le seuil retenu pour une exécution, et d'où il vient.

    L'origine est portée jusqu'à l'affichage : un utilisateur qui voit trente
    groupes de doublons doit pouvoir dire, sans relire le code, si c'est son
    fichier de configuration ou son argument de ligne de commande qui parle.
    """

    distance_max: int
    origine: str


def distance_de_hamming(empreinte_a: str, empreinte_b: str) -> int:
    """Nombre de bits qui diffèrent entre deux empreintes hexadécimales.

    Deux empreintes de longueurs différentes ne se comparent pas : un pHash 8×8
    et un pHash 16×16 ne décrivent pas la même chose, et les comparer rendrait
    un nombre qui a l'air d'une distance sans en être une.
    """
    if len(empreinte_a) != len(empreinte_b):
        raise ValueError(
            "Empreintes de tailles différentes : "
            f"{len(empreinte_a) * 4} bits contre {len(empreinte_b) * 4} bits"
        )
    return (int(empreinte_a, 16) ^ int(empreinte_b, 16)).bit_count()


def resoudre_ressemblance(demande: str | int | None, defaut: int) -> Ressemblance:
    """Traduit ce que l'utilisateur a demandé en une distance maximale.

    Trois écritures acceptées, parce que trois personnes différentes règlent
    cela : un niveau nommé (« prudente »), un nombre de bits pour qui sait ce
    qu'est un pHash, et rien du tout — auquel cas la configuration décide.
    """
    if demande is None or demande == "":
        return Ressemblance(_distance_valide(defaut, "configuration"), "configuration")

    if isinstance(demande, str):
        niveau = demande.strip().lower()
        if niveau in NIVEAUX_DE_RESSEMBLANCE:
            return Ressemblance(NIVEAUX_DE_RESSEMBLANCE[niveau], f"niveau « {niveau} »")
        try:
            demande = int(niveau)
        except ValueError:
            raise ValueError(
                f"Ressemblance « {demande} » inconnue. Attendu : "
                f"{', '.join(NIVEAUX_DE_RESSEMBLANCE)}, "
                f"ou un nombre de bits entre 0 et {BITS_DU_HACHAGE}"
            ) from None

    return Ressemblance(_distance_valide(demande, "argument"), "argument")


def _distance_valide(valeur: object, provenance: str) -> int:
    if not isinstance(valeur, int) or isinstance(valeur, bool):
        raise ValueError(f"Distance de ressemblance ({provenance}) : « {valeur} » n'est pas un entier")
    if not 0 <= valeur <= BITS_DU_HACHAGE:
        raise ValueError(
            f"Distance de ressemblance ({provenance}) : {valeur} hors de 0–{BITS_DU_HACHAGE}"
        )
    return valeur


def avertissement_ressemblance(distance_max: int) -> str | None:
    """La phrase à afficher quand le seuil demandé devient risqué, sinon rien.

    On prévient au lieu de refuser : c'est le réglage de l'utilisateur, et un
    dossier de captures d'écran se dédoublonne très bien à 14. Mais il doit
    savoir que sous ce seuil, deux photos sans rapport peuvent se rejoindre.
    """
    if distance_max >= RESSEMBLANCE_A_RISQUE:
        return (
            f"Ressemblance très permissive ({distance_max} bits sur {BITS_DU_HACHAGE}) : "
            "des photos différentes prises au même endroit seront regroupées. "
            "Relire la liste avant d'appliquer."
        )
    if distance_max >= NIVEAUX_DE_RESSEMBLANCE["large"]:
        return (
            f"Ressemblance permissive ({distance_max} bits) : les rafales seront "
            "vues comme des doublons."
        )
    return None


def sont_quasi_identiques(media_a: Media, media_b: Media, distance_max: int) -> bool:
    """Deux photos se ressemblent-elles assez pour n'en garder qu'une ?"""
    return distance_de_hamming(
        media_a.empreinte_perceptuelle, media_b.empreinte_perceptuelle
    ) <= distance_max


def grouper_quasi_identiques(
    medias: list[Media],
    distance_max: int,
    comparer_entre_dossiers: bool = True,
) -> list[list[Media]]:
    """Rassemble les photos qui se ressemblent, par composantes connexes.

    Le regroupement est transitif : si A ressemble à B et B à C, les trois sont
    dans le même groupe même si A et C dépassent le seuil. C'est voulu — une
    rafale de cinq photos forme une chaîne, et la découper en groupes qui se
    chevauchent obligerait à choisir deux fois quoi garder pour la même photo.
    C'est aussi la raison d'être de l'avertissement ci-dessus : plus le seuil est
    permissif, plus la chaîne peut dériver loin de son premier maillon.

    La comparaison est faite paire à paire. Cela suffit largement à un dossier
    personnel (quelques milliers de photos) ; au-delà de dix mille, il faudra un
    index (arbre BK) — pas avant, ce serait de la complexité sans utilité.
    """
    if distance_max < 0:
        raise ValueError("La distance maximale ne peut pas être négative")

    groupes: list[list[Media]] = []
    for lot in _lots_comparables(medias, comparer_entre_dossiers):
        groupes.extend(_composantes_connexes(lot, distance_max))
    return [groupe for groupe in groupes if len(groupe) > 1]


def _lots_comparables(medias: list[Media], comparer_entre_dossiers: bool) -> list[list[Media]]:
    """Découpe en ensembles comparables entre eux.

    `comparer_entre_dossiers` à `false` veut dire : la même photo dans deux
    dossiers différents n'est pas un doublon mais un classement. C'est le cas de
    qui range déjà à la main et ne veut dédoublonner que l'intérieur des dossiers.
    """
    if comparer_entre_dossiers:
        return [list(medias)]
    par_dossier: dict[Path, list[Media]] = {}
    for media in medias:
        par_dossier.setdefault(media.chemin.parent, []).append(media)
    return list(par_dossier.values())


def _composantes_connexes(medias: list[Media], distance_max: int) -> list[list[Media]]:
    parent = list(range(len(medias)))

    def racine(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for i in range(len(medias)):
        for j in range(i + 1, len(medias)):
            if sont_quasi_identiques(medias[i], medias[j], distance_max):
                parent[racine(i)] = racine(j)

    par_racine: dict[int, list[Media]] = {}
    for index, media in enumerate(medias):
        par_racine.setdefault(racine(index), []).append(media)
    return list(par_racine.values())


# Les critères de départage disponibles, dans le sens « le plus grand gagne ».
# La date est inversée : la plus ancienne l'emporte, parce que c'est celle du
# fichier d'origine — les copies, les partages et les réenregistrements sont
# toujours postérieurs.
_CRITERES = {
    # La netteté d'abord parmi les départages : constaté sur un vrai dossier, la
    # version floue d'une photo est souvent la plus lourde (le flou se comprime
    # mal), et départager au poids gardait le raté en écartant l'original. Une
    # netteté non mesurée vaut -1 : elle ne gagne jamais contre une mesurée,
    # mais deux non mesurées restent à égalité et laissent trancher la suite.
    "nettete": lambda media: media.nettete if media.nettete is not None else -1.0,
    "definition": lambda media: media.definition,
    "poids": lambda media: media.poids_octets,
    "date_la_plus_ancienne": lambda media: -media.date_horodatage,
    "date_la_plus_recente": lambda media: media.date_horodatage,
}



# `conserver` dit ce qu'on veut garder, `departager_par` comment trancher
# ensuite. Les deux réglages existent parce qu'ils ne répondent pas à la même
# question, et le premier prime : demander « meilleure_definition » puis lire une
# liste qui commence par le poids donnerait la photo la plus lourde, pas la plus
# définie.
_CONSERVER = {
    "meilleure_definition": "definition",
    "plus_lourde": "poids",
    "plus_ancienne": "date_la_plus_ancienne",
    "plus_recente": "date_la_plus_recente",
    "plus_nette": "nettete",
}


def criteres_de_departage(conserver: str, departager_par: list[str]) -> list[str]:
    """L'ordre effectif des critères, `conserver` en tête."""
    if conserver not in _CONSERVER:
        raise ValueError(
            f"nettoyage_medias.doublons.conserver : « {conserver} » inconnu "
            f"(attendu : {', '.join(_CONSERVER)})"
        )
    principal = _CONSERVER[conserver]
    return [principal] + [critere for critere in departager_par if critere != principal]


def choisir_a_conserver(groupe: list[Media], departager_par: list[str]) -> Media:
    """Celle du groupe qu'on garde.

    Les critères s'appliquent dans l'ordre donné par la configuration, et le
    chemin tranche en dernier : sans lui, deux photos rigoureusement équivalentes
    donneraient un gagnant qui change d'une exécution à l'autre, donc une
    quarantaine différente à chaque passage sur le même dossier.
    """
    inconnus = [critere for critere in departager_par if critere not in _CRITERES]
    if inconnus:
        raise ValueError(
            f"Critère de départage inconnu : {', '.join(inconnus)}. "
            f"Attendu parmi : {', '.join(_CRITERES)}"
        )

    def cle(media: Media) -> tuple:
        return tuple(_CRITERES[critere](media) for critere in departager_par)

    meilleure = max(cle(media) for media in groupe)
    ex_aequo = [media for media in groupe if cle(media) == meilleure]
    return min(ex_aequo, key=lambda media: str(media.chemin))


def constituer_doublons(
    medias: list[Media],
    distance_max: int,
    departager_par: list[str],
    comparer_entre_dossiers: bool = True,
) -> list[Doublon]:
    """Le résultat complet : les groupes, et pour chacun celui qui reste.

    C'est la seule fonction que `traitement.py` appelle. Les groupes sont rendus
    du plus gros au plus petit : c'est là qu'est l'espace à récupérer, et c'est
    ce qu'on veut lire en premier quand la liste dépasse un écran.
    """
    doublons: list[Doublon] = []
    for groupe in grouper_quasi_identiques(medias, distance_max, comparer_entre_dossiers):
        conserve = choisir_a_conserver(groupe, departager_par)
        ecartes = sorted(
            (media for media in groupe if media is not conserve),
            key=lambda media: str(media.chemin),
        )
        doublons.append(
            Doublon(
                conserve=conserve,
                ecartes=ecartes,
                distance_max_du_groupe=max(
                    distance_de_hamming(
                        conserve.empreinte_perceptuelle, media.empreinte_perceptuelle
                    )
                    for media in ecartes
                ),
            )
        )
    doublons.sort(key=lambda doublon: (-len(doublon.ecartes), str(doublon.conserve.chemin)))
    return doublons


# ─────────────────────────────── La netteté ──────────────────────────────────
#
# Trois refus de trancher, et la raison de chacun :
#
# - **Une mesure absente n'est pas une mesure basse.** Une image qu'on n'a pas su
#   ouvrir n'arrive jamais jusqu'ici : `traitement.py` la consigne et l'enjambe.
#   Si elle arrivait quand même avec `nettete = None`, la traiter comme un zéro
#   mettrait en quarantaine tout ce qu'OpenCV ne sait pas lire — un jour, un
#   format entier.
# - **Un visage l'emporte sur le seuil.** La seule photo d'un moment n'est jamais
#   reprise ; qu'elle soit bougée n'en fait pas un rebut.
# - **Le récent est laissé tranquille.** Ce qui vient d'être importé est encore
#   en cours de tri par son propriétaire ; l'écarter dans la foulée donne
#   l'impression que l'outil range plus vite qu'on ne regarde.

# Variance du laplacien sous laquelle une photo est tenue pour floue. La valeur
# de référence de la littérature est 100 sur des images de 8 à 12 mégapixels ;
# elle est dans `organizer_config.json` parce qu'un capteur de téléphone récent,
# qui lisse le bruit, descend structurellement plus bas.
SEUIL_LAPLACIEN_PAR_DEFAUT = 100.0
IGNORER_SI_RECENTE_JOURS_PAR_DEFAUT = 7
SECONDES_PAR_JOUR = 86400


def est_flou(nettete: float | None, seuil: float) -> bool:
    """Une mesure absente n'est jamais floue : on ne juge pas ce qu'on n'a pas lu."""
    if nettete is None:
        return False
    return nettete < seuil


def est_recente(date_horodatage: float, maintenant: float, jours: int) -> bool:
    """Vrai si le fichier date de moins de `jours`. Zéro désactive la protection."""
    if jours <= 0:
        return False
    return date_horodatage > maintenant - jours * SECONDES_PAR_JOUR


def decider_nettete(media: Media, reglages: dict, maintenant: float) -> Decision:
    """Rend le geste à poser sur une photo, et la phrase qui le justifie.

    L'ordre des tests n'est pas indifférent : la netteté d'abord, parce qu'une
    photo nette n'a besoin d'aucune protection ; les deux garde-fous ensuite,
    du moins coûteux au plus coûteux à établir.
    """
    seuil = float(reglages.get("seuil_variance_laplacien", SEUIL_LAPLACIEN_PAR_DEFAUT))
    if not est_flou(media.nettete, seuil):
        mesure = f"{media.nettete:.0f}" if media.nettete is not None else "non mesurée"
        return Decision(media, GARDER, f"nette (netteté {mesure}, seuil {seuil:.0f})")

    jours = int(reglages.get("ignorer_si_recente_jours", IGNORER_SI_RECENTE_JOURS_PAR_DEFAUT))
    if est_recente(media.date_horodatage, maintenant, jours):
        return Decision(media, GARDER, f"floue, mais datée de moins de {jours} jours")

    if reglages.get("ignorer_si_visage_detecte", True) and media.visage_detecte:
        return Decision(media, GARDER, "floue, mais un visage y est reconnu")

    return Decision(media, ECARTER, f"floue (netteté {media.nettete:.0f} < {seuil:.0f})")


def compter(decisions: list[Decision]) -> dict[str, int]:
    """Le décompte par geste, pour la ligne de résumé de fin de course."""
    total: dict[str, int] = {}
    for decision in decisions:
        total[decision.geste] = total.get(decision.geste, 0) + 1
    return total


def chemins_ecartes(decisions: list[Decision]) -> set:
    """Ce que la passe de netteté retire du lot avant la recherche de doublons."""
    return {decision.media.chemin for decision in decisions if decision.geste == ECARTER}
