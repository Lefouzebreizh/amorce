# Plans de remplissage

Un plan par formulaire, écrit **une fois**, rejoué à chaque fois. Le plan est du
JSON versionné ; le PDF vierge qu'il vise est un binaire et vit dans
`coffre/formulaires/`, hors du dépôt.

## Fabriquer un plan

```bash
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf            # ce que le PDF déclare
python3 paper.py champs coffre/formulaires/mon-cerfa.pdf --gabarit \
        > modeles/formulaires/mon-cerfa.json                        # le squelette à compléter
```

Puis remplir la section `champs` : à gauche le nom du champ tel que le PDF le
donne, à droite un gabarit entre accolades.

```bash
python3 paper.py remplir modeles/formulaires/mon-cerfa.json --abonnement maif-habitation
```

## Ce qu'on peut écrire à droite

| Écriture | Donne |
| --- | --- |
| `"{identite.nom}"` | une valeur de la configuration |
| `"{identite.prenom} {identite.nom}"` | plusieurs, composées avec du texte libre |
| `"{abonnement.engagement.fin}"` | une date, mise au format 01/11/2026 |
| `"{abonnement.montant}"` | un montant, à la virgule : 214,80 |
| `"{@aujourdhui}"` | la date du jour |
| `"{@aujourdhui:%Y}"` | la date du jour à un format choisi |
| `true` / `false` | coche ou laisse une case |

`abonnement` n'existe que si `--abonnement <id>` est passé. Un chemin inconnu
arrête le remplissage : sur un formulaire, un champ vide et un champ oublié se
ressemblent trop.

## PDF plats

Un scan ou une sortie de traitement de texte ne déclare aucun champ. Le plan
porte alors une section `positions`, en points PDF, origine en haut à gauche :

```json
"positions": {
  "nom":        { "page": 1, "rect": [200, 88, 500, 106], "taille": 10 },
  "recommande": { "page": 1, "rect": [200, 150, 214, 164], "coche": "X" }
}
```

Les coordonnées se relèvent une fois, à la règle, sur la page exportée en image.
Un texte qui ne tient pas dans son cadre lève une erreur plutôt que de
disparaître silencieusement.
