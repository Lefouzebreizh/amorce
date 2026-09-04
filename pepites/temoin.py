#!/usr/bin/env python3
"""Le banc d'essai du radar : sa note fait-elle mieux que le hasard ?

`profils.py` répond à une autre question, et les deux ne se remplacent pas :
il fait passer six profils connus par les mêmes filtres et la même note, et
dit ce qu'un seuil déplacé vient de casser ailleurs. C'est de la
**non-régression**, et c'est excellent pour ça. Mais il ne compare à rien.

Or un détecteur ne se juge jamais sur ses propres sorties. Un scan qui garde
vingt-cinq jetons sur trois cents a l'air de trier — et il en aurait
exactement l'air si sa note était tirée aux dés. « Il a retenu 8 % » ne sait
pas distinguer les deux cas. La seule mesure qui tranche est un comparatif :
la même liste, le même nombre de retenues, prises au hasard.

    python3 temoin.py

Aucun réseau, aucune dépendance, une graine fixe : deux exécutions rendent le
même tableau.

## Ce que ce banc a appris en se trompant lui-même

Il n'y a pas d'historique de pépites à rejouer — DexScreener ne publie aucune
archive, et aucun jeu figé ne porte des paires de faible capitalisation. Ce
banc travaille donc sur un **marché fabriqué**, et son premier jet portait une
hypothèse cachée qui décidait seule du verdict.

Ce premier jet faisait monter le cours à proportion de la demande réelle, sans
plus. Conséquence non voulue : un jeton **dont le cours avait déjà monté**
était le meilleur pari — corrélation `+0,838` entre la variation passée et le
rendement à venir. C'est un monde **momentum**.

Or le radar est bâti sur la thèse contraire, et le dit en propres termes : un
mouvement déjà visible est un sommet en train de se faire. Son critère de
*discrétion* pénalise exactement ce que ce monde-là récompensait — corrélation
`−0,293` entre la même variation et la note. Le banc ne mesurait donc pas la
note : il mesurait mon hypothèse sur la forme du marché, et le radar perdait
par construction.

**D'où la seule rédaction honnête : la thèse est un paramètre, pas un décor.**
Le banc tourne trois mondes, et c'est leur écart qui informe :

| monde | ce qui paie | ce qu'un verdict y vaut |
| --- | --- | --- |
| **momentum** | ce qui monte continue | conditionnel |
| **pré-rupture** | la demande accumulée pas encore sortie | conditionnel |
| **bruit** | rien, le rendement est décorrélé | **franc** |

Les deux premiers ne départagent pas le radar : ils disent sous quelle
hypothèse de marché sa note gagne. Laquelle décrit les jetons de faible
capitalisation ne se tranche **pas** ici, et se tranchera sur des données
réelles, le jour où le radar tourne derrière du vrai réseau.

Le troisième, lui, n'a aucune réserve : les observables y sont tirés des mêmes
lois, mais le rendement est tiré **indépendamment**. Il n'y a rien à trouver,
donc la note ne doit pas battre le hasard. Si elle le bat, elle lit du bruit —
et ce verdict-là ne dépend d'aucune hypothèse.

## Lire un écart sans se tromper

Un écart ne veut rien dire tant qu'on ignore ce que le hasard seul produit
d'une fois sur l'autre. Le banc rend donc l'**écart-type du témoin** : tout
gain plus petit que lui est du bruit, quel que soit son signe. C'est la même
leçon que le banc de NexusCrypto a payée en septembre — on lisait la colonne
de son propre camp sans regarder ce qui la sépare de celle d'en face.
"""

from __future__ import annotations

import random
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.modeles import CHAMPS_METRIQUES, Candidat, Jeton, Paire  # noqa: E402
from core.reglages import charger  # noqa: E402
from skills.convergence import mesurer, noter  # noqa: E402
from skills.radar import filtrer  # noqa: E402

MAINTENANT = datetime.now(timezone.utc)

GRAINE = 20260904
POPULATION = 600          # ce qu'un tour de radar ramène, ordre de grandeur
RETENUES = 25             # ce que le radar garde avant les appels coûteux
TIRAGES_HASARD = 400      # pour que le témoin ait une moyenne et un écart-type

MOMENTUM, PRE_RUPTURE, BRUIT = "momentum", "pré-rupture", "bruit"


def _fabriquer(rng: random.Random, chaine, monde: str):
    """Un jeton, ses observables, et le rendement qu'il fera *ensuite*.

    L'ordre des lignes suit l'histoire : d'abord ce qui est caché, ensuite ce
    que le radar pourra voir. L'inverse — partir des observables et leur
    attribuer un rendement — est le miroir que ce banc évite.

    Les trois mondes partagent **exactement** les mêmes lois d'observables :
    seule la ligne du rendement change. C'est ce qui rend leur comparaison
    lisible — le radar voit trois fois la même chose et doit trancher trois
    fois différemment.
    """
    # --- ce que personne ne voit ---------------------------------------
    profondeur = rng.lognormvariate(11.3, 0.9)          # liquidité du pool, $
    taille = profondeur * rng.lognormvariate(2.4, 0.7)  # capitalisation, $
    demande = profondeur * rng.betavariate(1.4, 9.0) * 0.9   # achats réels /h, $
    lavage = profondeur * rng.betavariate(1.2, 4.0) * 3.0    # volume creux /h, $

    # Quelle part de la demande a déjà été encaissée par le cours. Le reste est
    # ce qui peut encore pousser — et c'est là-dessus que les deux thèses de
    # marché s'opposent.
    deja_sorti = rng.betavariate(2.0, 2.0)

    pression = demande / profondeur
    bruit_rendement = rng.gauss(0.0, 0.05)

    if monde == MOMENTUM:
        # Ce qui monte continue : la pression pousse encore, quoi qu'il se soit
        # déjà passé.
        rendement = 100.0 * (2.2 * pression + bruit_rendement)
    elif monde == PRE_RUPTURE:
        # Seule la demande **pas encore sortie** paie. Un jeton déjà monté a
        # dépensé sa cartouche : c'est la thèse du radar.
        rendement = 100.0 * (2.2 * pression * (1.0 - deja_sorti) + bruit_rendement)
    else:
        # Mêmes observables, rendement décorrélé : il n'y a rien à trouver.
        rendement = 100.0 * (2.2 * rng.betavariate(1.4, 9.0) * 0.9 + bruit_rendement)

    # --- ce que DexScreener publie -------------------------------------
    volume_h1 = demande + lavage
    # Le rythme des vingt-quatre heures écoulées n'est pas celui de l'heure qui
    # vient de passer : c'est justement cet écart que l'accélération mesure.
    volume_h24 = volume_h1 * 24.0 * rng.lognormvariate(0.0, 0.55)
    volume_h6 = volume_h24 / 4.0 * rng.lognormvariate(0.0, 0.25)

    # Les achats réels penchent d'un côté ; le lavage revient toujours à
    # l'équilibre, puisqu'il rachète ce qu'il vend. La part acheteuse se tire
    # **une seule fois** : la tirer deux fois ferait un nombre de transactions
    # qui ne serait celui d'aucune des deux.
    ticket_reel = rng.lognormvariate(5.2, 0.8)
    ticket_lavage = rng.lognormvariate(4.4, 0.5)
    tx_reelles = max(1, int(demande / ticket_reel))
    tx_lavage = max(0, int(lavage / ticket_lavage))
    part_acheteuse = rng.uniform(0.62, 0.88)
    achats_h1 = int(tx_reelles * part_acheteuse) + tx_lavage // 2
    ventes_h1 = max(1, tx_reelles - int(tx_reelles * part_acheteuse) + tx_lavage // 2)

    # Le cours a encaissé la part déjà sortie de la demande. C'est la seule
    # fenêtre du radar sur ce qu'il ne voit pas — et elle est bruitée.
    variation_h1 = 100.0 * (pression * deja_sorti * rng.uniform(0.7, 1.3)) + rng.gauss(0.0, 3.0)

    paire = Paire(
        adresse="0xpool", dex="banc",
        jeton=Jeton(chaine=chaine, adresse=f"0x{rng.getrandbits(64):016x}",
                    symbole="BANC", nom="Banc"),
        quote_adresse=sorted(chaine.quotes)[0], quote_symbole="REF",
        prix_usd=0.001,
        liquidite_usd=profondeur, market_cap=taille, fdv=taille,
        creee_le=MAINTENANT - timedelta(hours=rng.uniform(30.0, 900.0)),
        volume_h1=volume_h1, volume_h6=volume_h6, volume_h24=volume_h24,
        variation_h1=variation_h1,
        variation_h6=variation_h1 * rng.uniform(0.8, 2.2),
        variation_h24=variation_h1 * rng.uniform(1.0, 3.5),
        achats_h1=achats_h1, ventes_h1=ventes_h1,
        achats_h24=achats_h1 * 24, ventes_h24=ventes_h1 * 24,
        releve_le=MAINTENANT,
    )
    return Candidat.depuis_paires([paire]), rendement


def _un_monde(reglages, chaine, monde: str) -> dict[str, float]:
    rng = random.Random(GRAINE)
    population = [_fabriquer(rng, chaine, monde) for _ in range(POPULATION)]

    tous = [c for c, _ in population]
    rendements = {id(c): r for c, r in population}

    # Le hasard doit tirer dans **le même vivier** que la note, sinon on
    # mesurerait les filtres et non la note.
    survivants, _ = filtrer(tous, reglages.filtres)

    notes = []
    for candidat in survivants:
        note = noter(candidat, mesurer(candidat), reglages.convergence)
        if note.retenu:                       # un drapeau élimine, il ne note pas
            notes.append((note.total, candidat))
    notes.sort(key=lambda paire: paire[0], reverse=True)
    choisis = [c for _, c in notes[:RETENUES]]

    def moyenne(lot):
        return statistics.fmean(rendements[id(c)] for c in lot) if lot else 0.0

    tirage_rng = random.Random(GRAINE + 1)
    vivier = [c for _, c in notes] or survivants
    taille_tirage = min(RETENUES, len(vivier))
    tirages = [moyenne(tirage_rng.sample(vivier, taille_tirage))
               for _ in range(TIRAGES_HASARD)] or [0.0]

    return {
        "population": len(tous),
        "survivants": len(survivants),
        "notes": len(notes),
        "radar": moyenne(choisis),
        "hasard": statistics.fmean(tirages),
        "dispersion": statistics.pstdev(tirages),
        "correlation": (statistics.correlation([n for n, _ in notes],
                                               [rendements[id(c)] for _, c in notes])
                        if len(notes) > 2 else 0.0),
    }


def _couverture(reglages, chaine, monde: str) -> tuple[list[tuple], float]:
    """Quels critères ce monde rend signifiants — et combien de points il laisse
    dans le noir.

    C'est la garde la plus importante du fichier. Un critère auquel le marché
    fabriqué ne donne aucun sens est un critère que le banc **handicape** : la
    note y dépense du poids sur du bruit, et perdre dans ces conditions ne dit
    rien d'elle. Sans cette table, le banc rendrait un verdict qui a l'air
    général et qui ne l'est pas.
    """
    rng = random.Random(GRAINE)
    population = [_fabriquer(rng, chaine, monde) for _ in range(POPULATION)]
    rendements = {id(c): r for c, r in population}
    survivants, _ = filtrer([c for c, _ in population], reglages.filtres)
    gardes = [c for c in survivants
              if noter(c, mesurer(c), reglages.convergence).retenu]
    mesures = [mesurer(c) for c in gardes]
    rends = [rendements[id(c)] for c in gardes]

    lignes, aveugle = [], 0.0
    for critere in reglages.convergence.criteres:
        valeurs = [float(getattr(m, CHAMPS_METRIQUES[critere.nom])) for m in mesures]
        try:
            correlation = statistics.correlation(valeurs, rends)
        except statistics.StatisticsError:
            correlation = 0.0
        muet = abs(correlation) < 0.10
        if muet:
            aveugle += critere.poids
        lignes.append((critere.nom, critere.poids, correlation, muet))
    return lignes, aveugle


def principal() -> int:
    reglages = charger()
    chaine = reglages.chaines["base"]

    print(f"Marché fabriqué, graine {GRAINE} · {POPULATION} jetons par monde · "
          f"{RETENUES} retenues · témoin moyenné sur {TIRAGES_HASARD} tirages\n")

    resultats = {}
    for monde, attendu in ((MOMENTUM, "conditionnel"),
                           (PRE_RUPTURE, "conditionnel"),
                           (BRUIT, "la note ne doit PAS battre le hasard")):
        r = _un_monde(reglages, chaine, monde)
        resultats[monde] = r
        ecart = r["radar"] - r["hasard"]
        significatif = abs(ecart) > r["dispersion"]

        print(f"── monde « {monde} » — {attendu}")
        print(f"   {r['population']} jetons → {r['survivants']} passent les filtres "
              f"→ {r['notes']} sans drapeau → {RETENUES} retenus")
        print(f"   {'retenus du radar':<38} {r['radar']:+7.2f} %")
        print(f"   {'hasard, dans le même vivier':<38} {r['hasard']:+7.2f} % "
              f"(± {r['dispersion']:.2f})")
        print(f"   {'ce que la note ajoute':<38} {ecart:+7.2f} pt"
              f"   {'✓ au-dessus du bruit' if significatif else '— dans le bruit'}")
        print(f"   {'corrélation note × rendement':<38} {r['correlation']:+7.3f}\n")

    lignes, aveugle = _couverture(reglages, chaine, PRE_RUPTURE)
    print(f"── ce que ce banc éprouve vraiment, dans le monde « {PRE_RUPTURE} »")
    print(f"   {'critère':<16}{'poids':>7}{'corr. avec le rendement':>26}")
    for nom, poids, correlation, muet in lignes:
        marque = "   ← muet ici" if muet else ""
        print(f"   {nom:<16}{poids:>7.0f}{correlation:>+26.3f}{marque}")
    print(f"\n   {aveugle:.0f} points sur 100 reposent sur des critères auxquels ce "
          f"marché fabriqué\n   ne donne aucun sens. Le banc les handicape : un écart "
          f"négatif ne peut donc\n   pas se lire comme « la note ne vaut rien », "
          f"seulement comme « le reste ne\n   suffit pas ici ».\n")

    # Le seul verdict sans réserve : dans un monde sans signal, la note ne doit
    # rien trouver.
    b = resultats[BRUIT]
    hallucine = (b["radar"] - b["hasard"]) > b["dispersion"]
    if hallucine:
        print("⚠ Dans un monde où il n'y a rien à trouver, la note bat quand même "
              "le hasard\n  au-delà de sa dispersion : elle lit du bruit.")
    else:
        print("✅ Dans un monde sans signal, la note ne bat pas le hasard : "
              "elle n'hallucine pas.")

    gagnant = max((MOMENTUM, PRE_RUPTURE),
                  key=lambda m: resultats[m]["radar"] - resultats[m]["hasard"])
    print(f"\nLa note gagne le plus dans le monde « {gagnant} ». Ce n'est pas un "
          f"verdict sur\nle radar : c'est la thèse de marché qu'il parie. "
          f"Laquelle décrit les vrais\njetons de faible capitalisation ne se "
          f"tranche pas ici — il y faut du réseau.")
    return 1 if hallucine else 0


if __name__ == "__main__":
    raise SystemExit(principal())
