"""Rapatrie un corpus de miaulements **étiquetés par contexte**, depuis YouTube.

## Pourquoi ce script existe

ESC-50 a réglé une question et en a laissé une entière. Il dit « chat », jamais
« chat qui a faim » : la porte et la lecture directe y ont été mesurées sur 40
enregistrements, mais la **tête acoustique** — celle qui décide entre « il
demande quelque chose », « il te dit bonjour » et « il est content » — n'a
toujours aucune vérité de terrain. `CORPUS.md` §5 le dit depuis le 04/09/2026 :
« pour ça il faut un chat qu'on connaît, filmé dans une situation qu'on sait
nommer ».

Cette phrase était trop pessimiste, et c'est le connecteur TubeAlfred qui l'a
montré : **des milliers de gens filment leur chat et écrivent le contexte dans
le titre.** « Hungry cat meowing for food », « Cat meowing to go outside »,
« Cat greets owner home » — l'étiquette est là, écrite par la personne qui
était dans la pièce. C'est une étiquette faible (personne n'a vérifié), mais
c'est infiniment plus qu'aucune étiquette.

## Ce qu'il ne fait pas, et pourquoi il tourne chez Erwann

Il ne télécharge **rien depuis une session distante** : mesuré huit fois le
04/09/2026, YouTube refuse les octets à une adresse de centre de données. Le
détail du refus a changé de nature ce jour-là et vaut d'être su — le client
`mweb` de `yt-dlp` nomme la vraie cause, un **jeton PO (GVS PO Token)**, et non
un compte manquant. Le fabriquer localement demande le greffon
`bgutil-ytdlp-pot-provider`, dont le paquet PyPI s'installe mais dont le script
serveur vit dans un dépôt GitHub **hors de la portée accordée à la session**.

Donc : la liste se prépare ici, les octets viennent de chez toi.

    python3 chat-traducteur/scripts/telecharger_corpus_etiquete.py
    python3 chat-traducteur/scripts/telecharger_corpus_etiquete.py --feuille  # sans rien télécharger
    python3 chat-traducteur/scripts/telecharger_corpus_etiquete.py --liste    # le décompte seul

Il écrit dans tous les cas une **feuille d'écoute** à côté des fichiers :
l'étiquette du téléverseur n'a jamais été vérifiée par une oreille, et c'est ce
contrôle-là qui décide si ce corpus vaut quelque chose.

Les fichiers atterrissent dans `.fixtures/corpus-etiquete/<intention>/`, ignoré
par Git — l'invariant « aucun binaire versionné » ne souffre pas d'exception.
Ce qui revient dans le dépôt est le tableau de mesures, jamais le son.

## La licence, dite plutôt que tue

Les entrées marquées `libre=True` viennent de chaînes de bruitages qui
annoncent le domaine public ou l'usage libre. **Toutes les autres sont sous
licence YouTube standard** : elles servent à *éprouver* la règle sur la machine
d'Erwann, exactement comme ESC-50, et ne peuvent pas être embarquées dans un
produit vendu. Un corpus qu'on ne peut pas redistribuer reste un corpus qu'on
peut mesurer.
"""

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOSSIER = RACINE / ".fixtures" / "corpus-etiquete"


# Relevé par TubeAlfred le 04/09/2026, puis trié à la main sur les fiches.
# `contexte` est l'étiquette du **téléverseur**, pas une vérité vérifiée : c'est
# ce qui rend ce corpus utile et ce qui borne ce qu'il prouve.
#
# `attendu` est ce que le traducteur devrait dire. Il n'est pas rempli pour les
# contrôles : là, ce qui compte est ce qu'il ne doit **pas** dire.
CORPUS = [
    # --- demande : le chat réclame à manger -------------------------------
    ("demande", "wWVNqWx9KfI", 165, "chat errant qui réclame la nourriture qu'il a sentie", False),
    ("demande", "88H4sQhpwdw", 89, "chat qui miaule pour manger", False),
    ("demande", "k61F4xTPhXI", 73, "Snoopy réclame sa gamelle", False),
    ("demande", "NvzqznH_wto", 134, "chat noir affamé, miaulements forts", False),
    ("demande", "UHID4G-NXgA", 121, "chat qui miaule en attendant sa nourriture", False),
    ("demande", "qOyAJesyQB4", 130, "chat qui réclame **doucement** en se frottant", False),
    # --- demande : le chat veut sortir ------------------------------------
    ("demande", "Vg1D7Dorslo", 12, "Tango miaule pour sortir", False),
    ("demande", "5zlAUM-IYqE", 38, "Frankie passe ses journées à la porte", False),
    ("demande", "AVcyNS_QtJY", 112, "chat qui veut sortir", False),
    # --- salutation : le chat accueille -----------------------------------
    ("salutation", "yGHlMaptuT4", 42, "retour après un week-end, deux chats accueillent", False),
    ("salutation", "V44Zpy3bDKQ", 11, "chat qui accueille au retour à la maison", False),
    ("salutation", "sQvUTORalJ0", 18, "Lexy accueille et parle", False),
    ("salutation", "6fEJnVINnps", 17, "Wendy attend dehors au retour du travail", False),
    ("salutation", "XkvySUjxdUM", 6, "Moicha accueille, tous les jours pareil", False),
    ("salutation", "d35hdtgnXTs", 63, "Maddox accueille au retour, échange de miaulements", False),
    # --- contentement : ronronnement, la seule lecture directe qui reste ---
    ("contentement", "Kwlr5wDDZEI", 18, "Mozza ronronne au micro — domaine public", True),
    ("contentement", "KkaYaVa2VjE", 31, "ronronnement au micro, prise naturelle", False),
    ("contentement", "Pfwk0dYKvG0", 34, "Morris ronronne", False),
    ("contentement", "hZuT0HmdKnE", 15, "ronronnement fort", False),
    ("contentement", "nu6IB50pRsQ", 38, "Jonzi ronronne devant la caméra", False),
    ("contentement", "v5NOMNdqoYc", 34, "respiration et ronronnement, très près", False),
    # --- contrôles : ce que le traducteur ne doit **pas** nommer -----------
    ("controle", "ZuURopvoRkk", 38, "chat effrayé — le stress n'est plus mesurable, il ne doit pas être affirmé", True),
    ("controle", "jIo3AVU1ATg", 7, "chat en colère — même attente", True),
    ("controle", "Ev9S6SAQpPk", 71, "Panzer paniqué dans le garage : titré « à une porte », c'est de la peur", False),
    ("controle", "_Z-neVXZtXY", 49, "titré « pour ouvrir la porte », décrit comme un appel de chaleur", False),
    # --- bruitages libres : la porte et la durée, sans contexte ------------
    ("bruitage", "pU6wPYi3WdI", 21, "dix miaulements enchaînés — dix chats, pas un", True),
    ("bruitage", "qdXfC60O8G0", 19, "miaulement de chaton", True),
    ("bruitage", "boP9dOqMsxU", 27, "miaulement", True),
]

# Écarté, et la raison compte plus que l'entrée : `rsucLntx76E` — « My cat
# meowing and begging to open the door » — porte une **musique de fond** de la
# bibliothèque audio YouTube, annoncée dans sa propre description. Un fond
# musical déplace tout ce que YAMNet lit. Le meilleur titre du lot, inutilisable.


def commande(identifiant: str, intention: str) -> list[str]:
    """La commande exacte, en WAV 16 kHz mono — la forme que lit `adaptateurs/audio.py`."""
    return [
        "yt-dlp",
        "-x",
        "--audio-format", "wav",
        "--postprocessor-args", "-ar 16000 -ac 1",
        "-o", str(DOSSIER / intention / f"{identifiant}.%(ext)s"),
        f"https://www.youtube.com/watch?v={identifiant}",
    ]


def feuille() -> str:
    """La feuille d'écoute : ce que l'oreille d'Erwann doit trancher, fichier par fichier.

    Elle existe parce qu'une écoute qui ne laisse pas de trace est une écoute
    à refaire. Les deux colonnes vides sont l'objet du travail : l'étiquette du
    téléverseur est **faible** — personne ne l'a vérifiée — et c'est la seule
    oreille du projet qui peut la valider ou l'écarter.

    Deux verdicts par fichier, et pas un de plus :

    - **étiquette** : ce qu'on entend correspond-il au contexte annoncé ?
    - **son** : un seul chat, sans musique, sans voix par-dessus ?

    Un `non` dans l'une ou l'autre colonne retire le fichier du corpus, et il
    vaut mieux qu'il le retire **avant** la mesure — un corpus qu'on nettoie
    après avoir vu les résultats n'est plus un corpus, c'est un tri.
    """
    lignes = [
        "# Feuille d'écoute — corpus étiqueté",
        "",
        "Vingt-huit fichiers, étiquetés par leur téléverseur et **jamais écoutés**.",
        "Deux colonnes à remplir : `oui`, `non`, ou `?`.",
        "",
        "- **étiquette** — ce que j'entends correspond-il au contexte annoncé ?",
        "- **son** — un seul chat, sans musique ni voix par-dessus ?",
        "",
        "Un `non` dans l'une des deux retire le fichier, et le retire **avant**",
        "la mesure. Nettoyer un corpus après avoir vu les résultats n'est plus",
        "un nettoyage.",
        "",
    ]
    for intention in ("demande", "salutation", "contentement", "controle", "bruitage"):
        lot = [c for c in CORPUS if c[0] == intention]
        lignes += [
            f"## {intention} — {len(lot)} fichiers",
            "",
            "| fichier | durée | contexte annoncé | étiquette | son | note |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for _, identifiant, duree, contexte, libre in lot:
            marque = " 🆓" if libre else ""
            lignes.append(
                f"| `{identifiant}`{marque} | {duree // 60}:{duree % 60:02} "
                f"| {contexte} |  |  |  |"
            )
        lignes.append("")

    lignes += [
        "🆓 = chaîne qui annonce le domaine public ou l'usage libre.",
        "",
        "Une fois rempli, la mesure :",
        "",
        "```bash",
        f"python3 chat-traducteur/scripts/mesurer_corpus.py {DOSSIER}",
        "```",
        "",
        "Ce fichier vit dans `.fixtures/`, donc hors de Git. Ce qui revient dans",
        "le dépôt est le **verdict** — quels fichiers tiennent, lesquels sautent",
        "et pourquoi —, jamais les enregistrements.",
        "",
    ]
    return "\n".join(lignes)


def main() -> int:
    print(f"{len(CORPUS)} enregistrements, étiquetés par leur téléverseur.\n")
    for intention in ("demande", "salutation", "contentement", "controle", "bruitage"):
        lot = [c for c in CORPUS if c[0] == intention]
        secondes = sum(c[2] for c in lot)
        libres = sum(1 for c in lot if c[4])
        print(f"  {intention:14} {len(lot):2} fichiers, {secondes // 60} min {secondes % 60:02} s"
              f"  ({libres} libre{'s' if libres > 1 else ''})")

    if "--liste" in sys.argv:
        return 0

    DOSSIER.mkdir(parents=True, exist_ok=True)
    chemin = DOSSIER / "FEUILLE-ECOUTE.md"
    chemin.write_text(feuille(), encoding="utf-8")
    print(f"\nFeuille d'écoute : {chemin}")

    if "--feuille" in sys.argv:
        return 0

    manque = subprocess.run(["which", "yt-dlp"], capture_output=True).returncode
    if manque:
        print("\nyt-dlp est absent : `pip install -U yt-dlp`.")
        return 3

    echecs = []
    for intention, identifiant, _, contexte, _ in CORPUS:
        (DOSSIER / intention).mkdir(parents=True, exist_ok=True)
        print(f"\n→ {identifiant}  {contexte}")
        if subprocess.run(commande(identifiant, intention)).returncode:
            echecs.append(identifiant)

    if echecs:
        print(f"\n{len(echecs)} refus : {', '.join(echecs)}")
        print("Un « Sign in to confirm you're not a bot » depuis une adresse "
              "résidentielle est inattendu — passer alors des cookies de "
              "navigateur : --cookies-from-browser firefox")
    print(f"\nMesurer ensuite :\n"
          f"  python3 chat-traducteur/scripts/mesurer_corpus.py {DOSSIER}")
    return 1 if echecs else 0


if __name__ == "__main__":
    raise SystemExit(main())
