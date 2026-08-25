# Les histoires bonus

Une histoire bonus n'est pas une chute du livre : c'est une histoire entière
qui n'y est pas. La différence compte, parce qu'elle décide de tout le reste.

**Pourquoi elles marchent.** Montrer quatre planches du livre, c'est dépenser le
produit pour faire la publicité du produit. Une histoire hors-livre ne coûte
rien au livre : elle le prouve sans l'entamer. Le lecteur ne se dit pas « j'ai
déjà vu », il se dit « il y en a d'autres ».

**Et surtout : une histoire se partage, une annonce non.** Personne ne repartage
« mon livre sort le 12 ». Les gens repartagent quatre cases qui les ont fait
rire. C'est le seul contenu de tout le plan de lancement qui circule tout seul.

**Trois règles.**

1. **Jamais la plus faible.** Une bonus médiocre dit au lecteur « voilà le
   niveau ». Si vous devez arbitrer, donnez la deuxième meilleure.
2. **Jamais une histoire du Tome 2.** Les dix expressions de `TOME2-PISTES.md`
   sont du stock à vendre. Une bonus doit être orpheline.
3. **La première ne se paie pas.** Elle circule librement, c'est l'hameçon.
   C'est la **suivante** qu'on annonce à la liste. Le marché honnête, c'est
   « celle-ci est offerte, les prochaines arrivent par courriel ».

---

## Bonus n° 1 — « Têtu comme un bourricot » (prête)

Planche complète, déjà illustrée, absente du sommaire du Tome 1. Coût nul.

Roussy refuse de bouger, bras croisés. Zéphy le félicite d'être devenu un
menhir de Carnac et propose de lui mettre de la mousse sur le nez pour faire
plus vrai. Ils se mettent en grève des pattes tous les deux — jusqu'à ce que le
goûter aux glands grillés se rappelle à eux, à un tout petit pas de fourmi de
là.

> *Être têtu, ce n'est pas être fort. C'est oublier qu'un tout petit pas peut
> tout débloquer.*

**Corrections appliquées** (`kdp/lancement/corriger_bonus.py`) — au pixel, avec la
seule matière de la planche : la fonte des bulles n'est aucune de celles dont on
dispose, et les facteurs de condensation relevés d'une ligne à l'autre ne
concordent pas assez pour retypographier sans que le raccord se voie.

| Panneau | Relevé | Fait |
| --- | --- | --- |
| 3 | « **Ok !** On fait grève… » | supprimé, ligne recentrée. « Ok » est un anglicisme à demi capitalisé ; la forme juste, « OK », aurait demandé un K capital qui n'existe nulle part sur la planche |
| 3 | « **…** Mais le goûter » | points de suspension en tête supprimés, ligne recentrée |
| 4 | « ça **compte pas** ! » | « ça **ne** compte pas ! » — le « ne » est bâti avec le « n » de « Un » et le « e » de « de », deux lignes plus haut dans la même bulle, décalés des trente-deux pixels qui séparent les deux lignes de base |

**Défaut de dessin corrigé, panneau 3.** Zéphy y a les yeux grands ouverts,
mais ses pupilles mesuraient six pixels sur six dans un œil de cinquante sur
quarante, serrées contre le coin interne : à taille réelle, le regard paraissait
vide. Elles sont redessinées à une proportion de dessin animé, avec un reflet,
tracées à quatre fois la taille puis réduites — une ellipse dessinée directement
à cette échelle sortirait crénelée, et une pupille crénelée se voit plus qu'une
pupille trop petite.

C'est un défaut de **dessin**, pas de texte : le contrôle typographique ne peut
rien contre cette famille-là. D'autres sont relevés dans
`kdp/relecture/RELECTURE-TOME1.md` — Roussy en chaton page 19, une seule aile à
Zéphy sur la même page, la queue de bulle du panneau 3 qui remonte dans le
panneau 1 en page 7. Il faut un œil humain, et vous venez d'en apporter la
preuve.

**Non fait : la casse du titre.** « Têtu comme un **B**ourricot » devrait s'écrire
avec un b minuscule selon la charte. Le B est un capital calligraphique à
parafe, deux fois la hauteur d'x, dans une écriture où les lettres sont liées :
il n'existe aucun b minuscule ailleurs dans le titre, et le greffer à partir de
la hampe du « h » de Zéphy se verrait. La décision déjà prise s'applique — les
planches font foi, et la charte enregistre la forme normalisée.

**Découpage pour le compte à rebours** — quatre panneaux plus la carte de
parchemin, un par jour :

```bash
python3 kdp/lancement/panneaux.py --planche bourricot.webp \
        --vers reseaux/ --prefixe bourricot
```

---

## Bonus n° 2 — « Avoir les nerfs à fleur de peau » (à illustrer)

C'est **l'expression la plus exactement sur le sujet du livre** de toute la
collection, et son image littérale est douce plutôt qu'inquiétante : des fleurs
qui poussent sur la peau. À réserver pour le mois qui suit le lancement,
annoncée à la liste.

| | |
| --- | --- |
| **1** | Une feuille tombe. Roussy sursaute d'un mètre. **Roussy :** Tout me touche trop fort aujourd'hui. J'ai les nerfs à fleur de peau. |
| **2** | Zéphy s'approche, plisse les yeux, recule d'un pas. **Zéphy :** Attends. Attends. C'est vrai. Il te pousse des fleurs partout. |
| **3** | Roussy panique et veut les arracher. Zéphy lui retient la patte. **Zéphy :** N'arrache pas. Une fleur, ça veut dire que quelque chose pousse. |
| **4** | Assis dans l'herbe, tous les deux couverts de petites fleurs — Zéphy en a attrapé aussi. Des abeilles tournent. **Roussy :** Alors on est deux jardins ? **Zéphy :** Deux jardins un peu bruyants, oui. |

> *Avoir les nerfs à fleur de peau, ce n'est pas être fragile.*
> *C'est fleurir plus vite que les autres.*

```
Panel 1: autumn forest path, a single leaf falling, ROUSSY leaping a foot in
the air, every hair on end, eyes huge, comic motion lines.
Panel 2: ZEPHY leaning in very close, squinting, then rearing back in surprise;
tiny pale violet and yellow flowers are visibly sprouting through Roussy's fur.
Panel 3: ROUSSY panicking, trying to pull the flowers off; ZEPHY gently holding
his paw back with a hoof, calm and serious for once.
Panel 4: both sitting in tall grass, both now covered in small flowers, bees
drifting around them, warm late light, completely at peace.
```

---

## Le rythme, ensuite

**Une bonus par mois**, annoncée à la liste. C'est ce qui fait qu'une adresse
courriel reste vivante au lieu de dormir jusqu'au Tome 2 — et c'est la seule
raison honnête de demander cette adresse.

Chaque bonus donne, sans travail supplémentaire :

- **quatre publications** pour un compte à rebours, une par panneau ;
- **une carte de parchemin**, le format qui circule le mieux ;
- **une page de plus** sur le site, donc une raison de revenir.

Expressions encore libres, hors des dix réservées au Tome 2 : *ne pas être dans
son assiette*, *en avoir gros sur la patate*, *broyer du noir*, *avoir la gorge
nouée*, *se mettre martel en tête*, *avoir un chat dans la gorge* — non, celle-là
est page 4.
