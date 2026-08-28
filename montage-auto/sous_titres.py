#!/usr/bin/env python3
"""Sous-titres : lecture SRT/JSON, et tracé mot à mot au format ASS.

Deux façons de poser du texte sur une image, et elles ne servent pas la même
chose.

`monter_episode.texte_ffmpeg` trace par `drawtext`, dans le graphe de rendu.
C'est ce qui permet le ressort à l'arrivée, la secousse, la lueur qui bat —
autant d'expressions évaluées image par image, que le format ASS ne sait pas
écrire. C'est le chemin des **titres**.

Ce fichier-ci trace en **ASS**, et pour une raison précise : le mot à mot. Un
sous-titre qui s'allume mot après mot demande une ligne par mot, chacune avec
son instant ; en `drawtext` cela ferait trois passes de rendu par mot, soit
plusieurs centaines pour une phrase de dix secondes. `libass` fait le même
travail en une passe, parce que c'est exactement ce pour quoi il est écrit.

La règle qui en découle : **titres en drawtext, dialogue en ASS.** Mélanger les
deux sur un même texte donne deux copies légèrement décalées, l'une par le
graphe et l'autre par le rendu des sous-titres.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

# Le cyan de la marque et son contour. `libass` lit le BGR à l'envers du
# HTML — &HAABBGGRR — et c'est la faute la plus courante sur ce format : un
# #00E5FF écrit tel quel ressort orange.
def ass_couleur(html: str, alpha: int = 0) -> str:
    """Convertit #RRGGBB en &HAABBGGRR, l'ordre attendu par libass."""
    h = html.lstrip("#")
    if len(h) != 6 or any(c not in "0123456789abcdefABCDEF" for c in h):
        raise ValueError(f"couleur illisible : « {html} » (attendu #RRGGBB)")
    r, v, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha:02X}{b}{v}{r}".upper()


@dataclass
class Replique:
    """Une phrase, ses bornes, et le découpage en mots qu'on en déduit."""
    texte: str
    debut: float
    fin: float
    mots: list[tuple[str, float, float]] = field(default_factory=list)

    def decouper(self) -> list[tuple[str, float, float]]:
        """Répartit la durée entre les mots au prorata de leur longueur.

        Une répartition égale donne un mot d'une lettre aussi long qu'un mot de
        douze, et le décalage se voit dès la troisième phrase. Le prorata de
        longueur n'est pas la vérité — seule une transcription alignée la
        donne — mais il tient sans rien d'autre que le texte.
        """
        if self.mots:
            return self.mots
        mots = [m for m in re.split(r"\s+", self.texte.strip()) if m]
        if not mots:
            return []
        poids = [len(m) + 1 for m in mots]
        total = sum(poids)
        duree = max(self.fin - self.debut, 0.01)
        decoupe, t = [], self.debut
        for mot, p in zip(mots, poids):
            d = duree * p / total
            decoupe.append((mot, t, t + d))
            t += d
        return decoupe


_HORODATE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*"
    r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")


def lire_srt(chemin: Path) -> list[Replique]:
    """Lit un SRT. Les numéros de bloc sont ignorés : ils mentent souvent."""
    contenu = chemin.read_text(encoding="utf-8-sig")
    repliques: list[Replique] = []
    for bloc in re.split(r"\n\s*\n", contenu):
        lignes = [l for l in bloc.splitlines() if l.strip()]
        if not lignes:
            continue
        marque = next((_HORODATE.search(l) for l in lignes
                       if _HORODATE.search(l)), None)
        if marque is None:
            continue
        g = [int(x) for x in marque.groups()]
        debut = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        fin = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        texte = " ".join(l for l in lignes
                         if not _HORODATE.search(l) and not l.strip().isdigit())
        if texte.strip():
            repliques.append(Replique(texte.strip(), debut, fin))
    if not repliques:
        raise SystemExit(f"{chemin} : aucun sous-titre lisible.")
    return repliques


def lire_json(chemin: Path) -> list[Replique]:
    """Lit un JSON — soit une liste de répliques, soit une sortie alignée.

    Deux formes sont acceptées, parce que les deux existent dans ce dépôt :
    `[{"texte", "debut", "fin"}]` écrit à la main, et
    `[{"texte", "debut", "fin", "mots": [{"mot", "debut", "fin"}]}]` que rend
    une transcription alignée. La seconde donne un mot à mot juste au lieu
    d'un mot à mot au prorata — on la préfère dès qu'elle est disponible.
    """
    brut = json.loads(chemin.read_text(encoding="utf-8"))
    if isinstance(brut, dict):
        brut = brut.get("sous_titres") or brut.get("segments") or []
    repliques = []
    for e in brut:
        texte = e.get("texte") or e.get("text") or ""
        debut = float(e.get("debut", e.get("start", 0.0)))
        fin = float(e.get("fin", e.get("end", debut)))
        mots = [(m.get("mot") or m.get("word"),
                 float(m.get("debut", m.get("start", 0.0))),
                 float(m.get("fin", m.get("end", 0.0))))
                for m in (e.get("mots") or e.get("words") or [])]
        if texte.strip():
            repliques.append(Replique(texte.strip(), debut, fin, mots))
    if not repliques:
        raise SystemExit(f"{chemin} : aucun sous-titre lisible.")
    return repliques


def lire(chemin: Path) -> list[Replique]:
    """Choisit le lecteur d'après l'extension."""
    chemin = Path(chemin)
    if not chemin.is_file():
        raise SystemExit(f"Sous-titres introuvables : {chemin}")
    if chemin.suffix.lower() == ".srt":
        return lire_srt(chemin)
    if chemin.suffix.lower() == ".json":
        return lire_json(chemin)
    raise SystemExit(f"{chemin.suffix} : attendu .srt ou .json")


def _hms(t: float) -> str:
    """L'horodatage ASS : h:mm:ss.cc, au centième et non au millième."""
    t = max(0.0, t)
    h, reste = divmod(t, 3600)
    m, s = divmod(reste, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ecrire_ass(repliques: list[Replique], sortie: Path,
               largeur: int = 1080, hauteur: int = 1920,
               police: str = "Montserrat ExtraBold", taille: int = 64,
               vive: str = "#00E5FF", eteinte: str = "#FFFFFF",
               marge_basse: int = 300, contour: int = 6) -> Path:
    """Écrit un ASS où le mot en cours s'allume en cyan.

    Deux styles et non un : le mot courant en `Vif`, les autres en `Dormant`.
    Chaque mot devient une ligne `Dialogue` de sa propre durée, positionnée par
    `\\an2` et la marge basse — pas de `\\pos` absolu, sinon le texte sort du
    cadre dès qu'on change de définition.
    """
    sortie = Path(sortie)
    entete = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {largeur}",
        f"PlayResY: {hauteur}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Vif,{police},{taille},{ass_couleur(vive)},{ass_couleur(vive)},"
        f"{ass_couleur('#000000')},{ass_couleur('#000000', 128)},"
        f"-1,0,0,0,100,100,1,0,1,{contour},2,2,60,60,{marge_basse},1",
        f"Style: Dormant,{police},{taille},{ass_couleur(eteinte, 60)},"
        f"{ass_couleur(eteinte, 60)},{ass_couleur('#000000')},"
        f"{ass_couleur('#000000', 160)},"
        f"-1,0,0,0,100,100,1,0,1,{max(2, contour - 2)},2,2,60,60,"
        f"{marge_basse},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, "
        "MarginV, Effect, Text",
    ]
    lignes = []
    for replique in repliques:
        decoupe = replique.decouper()
        if not decoupe:
            continue
        phrase = [m for m, _, _ in decoupe]
        for i, (_, debut, fin) in enumerate(decoupe):
            # La phrase entiere est reecrite a chaque mot, seul le style du mot
            # courant change. C'est ce qui garde la ligne stable a l'ecran :
            # n'afficher que le mot courant la ferait sauter de gauche a droite.
            morceaux = []
            for j, mot in enumerate(phrase):
                mot = mot.replace("{", "(").replace("}", ")")
                if j == i:
                    morceaux.append(
                        r"{\rVif\fscx112\fscy112\t(0,90,\fscx100\fscy100)}"
                        + mot)
                else:
                    morceaux.append(r"{\rDormant}" + mot)
            lignes.append(
                f"Dialogue: 0,{_hms(debut)},{_hms(fin)},Vif,,0,0,0,,"
                + " ".join(morceaux))
    sortie.write_text("\n".join(entete + lignes) + "\n", encoding="utf-8")
    return sortie
