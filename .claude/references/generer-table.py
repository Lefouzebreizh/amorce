"""
Régénère la table des compétences depuis le disque.

Écrite parce que la table vivait dans `CLAUDE.md`, tenue à la main, et qu'elle
y était fausse le lendemain de chaque ajout. Une liste qui se recopie ment ;
une liste qui se découvre ne peut pas.
"""
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parents[2]
SKILLS = RACINE / ".claude" / "skills"
SORTIE = RACINE / ".claude" / "references" / "competences.md"

lignes = ["# Les compétences du dépôt", "",
          "Table **générée** depuis `.claude/skills/` — ne pas la tenir à la main :",
          "dans ce dépôt, ce qui s'énumère est faux le lendemain. La régénérer avec",
          "`python3 .claude/references/generer-table.py`.", "",
          "| compétence | ce qu'elle fait |", "| --- | --- |"]

for dossier in sorted(p for p in SKILLS.iterdir() if (p / "SKILL.md").is_file()):
    texte = (dossier / "SKILL.md").read_text(encoding="utf-8", errors="replace")
    trouve = re.search(r"^description:\s*(.+?)(?:\n[a-z_]+:|\n---)", texte, re.S | re.M)
    brut = trouve.group(1) if trouve else ""
    # Le marqueur de bloc replié de YAML n'est pas du texte.
    # Une description écrite sur plusieurs lignes commence par `>-` ou `|`, et
    # ce marqueur se retrouvait tel quel en tête de sept lignes du tableau —
    # là où le lecteur attend la première phrase de la compétence.
    brut = re.sub(r"^\s*[>|][-+]?\s*", "", brut)
    # Les guillemets d'un scalaire YAML n'en font pas partie non plus, et c'est
    # le même défaut que ci-dessus sous une autre forme. Il est arrivé le
    # 03/09/2026 : trente-trois descriptions ont été quotées d'un coup — un
    # scalaire non quoté ne peut pas contenir « : » — et le guillemet ouvrant
    # s'est retrouvé en tête de trente-trois lignes du tableau. Le contrôle de
    # cohérence était vert : il vérifie que la compétence est citée, jamais à
    # quoi ressemble la citation.
    brut = brut.strip()
    for guillemet in ('"', "'"):
        if len(brut) > 1 and brut.startswith(guillemet) and brut.endswith(guillemet):
            brut = brut[1:-1]
            break
    resume = " ".join(brut.split())[:150]
    if len(resume) == 150:
        resume = resume.rsplit(" ", 1)[0] + "…"
    lignes.append(f"| `/{dossier.name}` | {resume} |")

SORTIE.write_text("\n".join(lignes) + "\n", encoding="utf-8")
print(f"{len(lignes) - 8} compétences écrites dans {SORTIE.relative_to(RACINE)}")
