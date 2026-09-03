"""Les deux étages de décision, et le veto qui les précède.

L'ordre n'est pas négociable, pour la même raison que le bouclier de
NexusCrypto passe avant le dimensionnement : **un étage qui affine ne rattrape
jamais un étage qui s'est trompé de sujet.** Si le son n'est pas un chat, il
n'y a pas d'intention à chercher — une porte qui claque a une durée, une
hauteur et une enveloppe, et un classifieur d'intention lui en trouvera une.

Ce fichier ne connaît ni numpy, ni TFLite, ni fichier son. Il reçoit ce que
YAMNet a rendu — des dictionnaires `étiquette -> score`, une fenêtre par
0,975 s — et rend un verdict. C'est ce qui permet de l'éprouver sur des
scores écrits à la main, y compris ceux qu'aucun micro ne produira jamais.
"""

from dataclasses import dataclass

from .intentions import Intention, Source

# Les classes félines de YAMNet, relevées dans le fichier de poids lui-même
# (`yamnet_label_list.txt`, 521 lignes) et non de mémoire : 76 Cat, 77 Purr,
# 78 Meow, 79 Hiss, 80 Caterwaul, et 104 Roaring cats (lions, tigers).
#
# **`Roaring cats` était exclu, et le premier vrai chat a montré que c'était
# faux.** Le raisonnement tenait : retenir cette classe ferait passer la porte
# à un documentaire animalier. Mesuré le 03/09/2026 sur un enregistrement du
# chat d'Erwann, un chat domestique noir et blanc filmé dans son salon :
#
#     fenêtres 0 à 8 (4,5 s)   Roaring cats 0,94 à 1,00   cumul félin 0,000
#     fenêtres 9 à 14 (3 s)    Cat 1,00  Purr 1,00        cumul félin 1,99
#
# Le chat bâille bruyamment, gueule grande ouverte — visible sur l'image — et
# YAMNet le range en rugissement. **Quatre secondes et demie de vrai chat
# scoraient zéro à la porte**, et seule la queue de ronronnement a sauvé le
# verdict. Sur un enregistrement sans ronronnement, ce chat aurait été refusé.
#
# Le compromis est donc inversé, et c'est le bon sens du produit : **perdre un
# vrai chat domestique coûte plus cher qu'admettre un lion.** Personne
# n'enregistre un lion avec cette application ; tout le monde enregistre un
# chat qui bâille.
CLASSES_FELINES = ("Cat", "Purr", "Meow", "Hiss", "Caterwaul",
                   "Roaring cats (lions, tigers)")

# `Cat` est une classe **parente**, pas une sœur des quatre autres — et c'est
# le défaut que ce projet a payé en premier, découvert en regardant de vrais
# scores plutôt qu'en relisant le code.
#
# Sur deux miaulements réels, mesuré le 01/09/2026 :
#     Cat 0,969   Meow 0,852   Animal 0,969
#     Cat 0,988   Meow 0,891   Animal 0,992
#
# `Cat` gagne systématiquement contre la classe précise. Le laisser concourir
# ferait qu'un ronronnement à `Cat 0,90 / Purr 0,60` retiendrait `Cat`, ne
# trouverait pas de lecture directe, et repartirait en `INDECIS` — c'est-à-dire
# que la seule intention que le modèle sait vraiment lire serait perdue à tous
# les coups. Rien ne l'aurait signalé : aucun test n'échouait, et l'étage 2
# rendait un verdict parfaitement plausible.
#
# `Cat` ouvre donc la porte et ne choisit jamais. Même raison qu'`Animal` et
# `Domestic animals, pets`, qui sont vrais et n'apprennent rien.
#
# `Roaring cats` est dans le même cas, et pour une raison de plus : sur le
# bâillement mesuré ci-dessus, rien ne dit si le chat est content, agacé ou
# seulement fatigué. C'est un son félin fort, et c'est tout ce qu'on en sait.
CLASSES_SPECIFIQUES = ("Purr", "Meow", "Hiss", "Caterwaul")

# Parmi elles, celles qui portent une **lecture**. `Meow` n'y est pas : c'est la
# classe résiduelle, « un chat a vocalisé », et elle n'apprend rien de plus.
CLASSES_PORTEUSES = ("Purr", "Hiss", "Caterwaul")

# Plancher au-dessus duquel une classe porteuse l'emporte sur `Meow`.
#
# Ce nombre a été refusé une première fois, faute de données — quatre bruitages
# ne sont pas un jeu de données, et un seuil inventé aurait eu l'air d'une
# mesure. Il est écrit maintenant parce qu'un corpus de 15 sons le sépare
# franchement, mesuré le 02/09/2026 :
#
#     miaulements ordinaires   Caterwaul  0,000  0,016  0,031
#     feulements / caterwauls  Caterwaul  0,199  0,332  0,414  0,586  0,738
#
# Un rapport de 6 entre le plus haut miaulement ordinaire et le plus bas son de
# détresse. 0,10 tombe au milieu et n'est proche d'aucune valeur observée.
#
# CE QUI L'A RENDU NÉCESSAIRE : sans lui, `Meow` gagnait **les cinq duels sur
# cinq**, et le stress n'était jamais atteint. Le dépôt affirmait que le modèle
# public livrait « contentement et stress » ; mesuré, il ne livrait que le
# contentement. Un `max()` sur des classes de rangs différents ne compare pas
# ce qu'on croit — c'est la même leçon que la classe parente `Cat`, une couche
# plus bas.
#
# CE QUI RESTE À ÉPROUVER : ces quinze sons sont **générés**, pas enregistrés.
# Le plancher sépare proprement ce corpus-là ; il n'a jamais vu un vrai chat.
# Les enregistrements du chat d'Erwann le confirmeront ou le déplaceront.
SEUIL_LECTURE = 0.10

# Ce que YAMNet nomme lui-même, et qu'on n'a donc pas à deviner.
# `Cat` et `Meow` n'y sont pas : ce sont eux qui demandent l'étage 2.
LECTURE_DIRECTE = {
    "Purr": Intention.CONTENTEMENT,
    "Hiss": Intention.STRESS,
    "Caterwaul": Intention.STRESS,
}

# Seuil de la porte, sur la fenêtre la plus féline de l'enregistrement.
#
# 0,20 n'est pas mesuré sur de vrais miaulements — il n'y en avait aucun sous
# la main quand ce fichier a été écrit. C'est une valeur d'attente, choisie
# basse parce que YAMNet répartit sa masse sur 521 classes et qu'un miaulement
# net y plafonne rarement au-dessus de 0,6. **Le premier enregistrement réel
# du chat d'Erwann doit le confirmer ou le déplacer**, et tant que ce n'est pas
# fait, ce nombre est une hypothèse qui a l'air d'une mesure.
SEUIL_PORTE = 0.20


@dataclass(frozen=True)
class Verdict:
    """Ce que l'application a conclu, et à quel titre.

    `source` compte autant que `intention` : c'est elle qui dit si l'écran a le
    droit d'afficher un score. Les séparer serait laisser l'interface décider
    seule de ce qui est mesuré — et elle choisira toujours d'afficher.
    """

    intention: Intention
    source: Source
    confiance: float          # 0 à 1 ; vaut 0 quand la source est AUCUNE
    raison: str               # en français, lisible tel quel dans un journal
    classe_dominante: str     # l'étiquette YAMNet retenue, "" si la porte a fermé

    @property
    def affichable(self) -> bool:
        """Un verdict qu'on peut habiller d'une scène et publier.

        `INDECIS` reste affichable — il a son propre écran. Ce qui ne l'est
        pas, c'est un verdict dont la porte a fermé : il n'y avait pas de chat.
        """
        return self.classe_dominante != ""


def _fenetre_la_plus_feline(fenetres: list[dict[str, float]]) -> tuple[int, float]:
    """Rend l'indice et le score félin cumulé de la meilleure fenêtre.

    On prend le **maximum** sur les fenêtres, jamais la moyenne. Un
    enregistrement de trois secondes porte un miaulement d'une demi-seconde
    entouré de silence : la moyenne le noie, et la porte se referme sur un
    son parfaitement clair. Mesuré nulle part — c'est de l'arithmétique.
    """
    if not fenetres:
        return -1, 0.0
    scores = [sum(f.get(c, 0.0) for c in CLASSES_FELINES) for f in fenetres]
    meilleur = max(range(len(scores)), key=lambda i: scores[i])
    return meilleur, scores[meilleur]


def juger(
    fenetres: list[dict[str, float]],
    *,
    seuil_porte: float = SEUIL_PORTE,
    tete_intention=None,
) -> Verdict:
    """Traverse les deux étages et rend un verdict.

    `tete_intention` est la couture prévue pour la tête entraînée qui séparera
    faim et envie de sortir. Elle prend les traits acoustiques et rend un
    couple `(Intention, confiance)`. Tant qu'elle vaut `None`, un miaulement
    ordinaire ressort `INDECIS` — et c'est le cas normal aujourd'hui, pas une
    panne.
    """
    indice, score_felin = _fenetre_la_plus_feline(fenetres)

    # --- Étage 1 : la porte. Un veto, pas une note. ---
    if indice < 0:
        return Verdict(Intention.INDECIS, Source.AUCUNE, 0.0,
                       "Aucune fenêtre analysable : l'enregistrement est trop court.", "")
    if score_felin < seuil_porte:
        # « Aucun son de chat », et non « ce n'est pas un chat ». La nuance
        # a été payée sur un vrai fichier : une vidéo où le chat quémande en
        # silence, sur une bande-son d'accordéon, rendait « ce n'est pas un
        # chat » à quelqu'un qui filmait son chat. Le verdict était juste, la
        # phrase était fausse — et c'est elle que l'utilisateur lit.
        return Verdict(
            Intention.INDECIS, Source.AUCUNE, 0.0,
            f"Aucun son de chat entendu (score félin {score_felin:.2f} "
            f"< {seuil_porte:.2f}) — trop loin du micro, ou couvert par autre chose.",
            "",
        )

    fenetre = fenetres[indice]
    # Parmi les quatre classes *spécifiques* seulement — voir le commentaire de
    # `CLASSES_SPECIFIQUES` : ni `Animal`, ni `Domestic animals`, ni `Cat` ne
    # concourent, parce qu'ils sont vrais et n'apprennent rien.
    # QUESTION TRANCHÉE le 02/09/2026, sur un corpus de 15 sons.
    #
    # Une classe porteuse de lecture l'emporte sur `Meow` dès qu'elle franchit
    # `SEUIL_LECTURE` — voir le commentaire de cette constante pour les chiffres
    # qui l'ont décidée. En dessous, `Meow` reprend la main et l'étage 2 bis
    # s'applique.
    #
    # `Hiss` est dans la liste et n'en sortira pas, mais il faut savoir qu'il
    # est **muet** : 0,000 sur les trois feulements du corpus. La classe existe
    # dans YAMNet et ne se déclenche pas sur un chat — c'est `Caterwaul` qui
    # porte seul le stress aujourd'hui. Le retirer ne changerait rien ; le
    # croire actif ferait chercher un défaut ailleurs.
    porteuse = max(CLASSES_PORTEUSES, key=lambda c: fenetre.get(c, 0.0))
    if fenetre.get(porteuse, 0.0) >= SEUIL_LECTURE:
        dominante = porteuse
    else:
        # Le repli est `Meow` **en dur**, et non un `max()` sur les classes
        # spécifiques. La nuance a l'air cosmétique et ne l'est pas :
        # `max()` sur des scores tous égaux à zéro rend le **premier** élément
        # du tuple, c'est-à-dire `Purr`. Un son qui franchit la porte sans
        # qu'aucune classe précise ne réponde — un rugissement, un miaulement
        # trop lointain — ressortait donc « contentement, mesuré, 0 % ».
        #
        # Le défaut est resté invisible tant que `Roaring cats` était hors de
        # la porte : il fallait un son félin fort qu'aucune classe précise ne
        # nomme, et il n'y en avait pas. Le test du lion l'a attrapé à la
        # seconde où cette classe est entrée.
        #
        # `Meow` est le bon repli parce qu'il ne porte aucune lecture : il dit
        # « un chat a vocalisé », ce qui est exactement tout ce qu'on sait.
        dominante = "Meow"

    # --- Étage 2 : ce que le modèle nomme déjà lui-même. ---
    if dominante in LECTURE_DIRECTE:
        return Verdict(
            LECTURE_DIRECTE[dominante], Source.MESUREE, fenetre.get(dominante, 0.0),
            f"YAMNet a nommé « {dominante} » à {fenetre.get(dominante, 0.0):.2f}.",
            dominante,
        )

    # --- Étage 2 bis : le miaulement, qui demande une tête entraînée. ---
    if tete_intention is None:
        return Verdict(
            Intention.INDECIS, Source.AUCUNE, 0.0,
            "Miaulement reconnu, mais faim et envie de sortir ne se séparent "
            "pas sans tête entraînée — voir README, « Ce qui manque ».",
            dominante,
        )

    intention, confiance = tete_intention()
    return Verdict(intention, Source.PROVISOIRE, confiance,
                   f"Tête d'intention sur un « {dominante} ».", dominante)
