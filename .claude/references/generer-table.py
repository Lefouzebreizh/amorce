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
    resume = " ".join(brut.split())[:150]
    if len(resume) == 150:
        resume = resume.rsplit(" ", 1)[0] + "…"
    lignes.append(f"| `/{dossier.name}` | {resume} |")

SORTIE.write_text("\n".join(lignes) + "\n", encoding="utf-8")
print(f"{len(lignes) - 8} compétences écrites dans {SORTIE.relative_to(RACINE)}")
