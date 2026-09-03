# Une correction en masse déplace le défaut en aval

**03/09/2026** — trouvé en réparant les frontmatters YAML des compétences.

## Ce qui a été mesuré

GitHub signalait une erreur YAML sur **un** fichier de compétence, à la ligne 2,
colonne 114 : `pas un site vitrine : où passe la logique`. Un scalaire YAML non
quoté ne peut pas contenir « : » suivi d'un espace.

Le réflexe était de corriger ce fichier-là. La mesure a rendu autre chose :
**33 des 66** frontmatters échouaient à `yaml.safe_load` avec exactement la même
erreur, certains depuis des semaines. Rien ne le signalait, parce que le contrôle
de cohérence du dépôt vérifie qu'une compétence est **citée**, jamais que son
entête se **lit**.

Premier enseignement, déjà connu mais repayé : **un défaut signalé sur un fichier
se compte sur tous les fichiers de la même forme avant d'être corrigé.** Le
signalement désigne l'exemplaire qu'on a ouvert, pas la population.

## Le piège, qui est la vraie leçon

Les 33 descriptions ont été quotées d'un coup, chacune vérifiée : la valeur relue
est identique octet pour octet à l'originale. Correction juste, vérification
juste.

Puis la table des compétences a été régénérée — et **le guillemet ouvrant s'est
retrouvé en tête de 33 lignes du tableau**. `generer-table.py` extrayait la
description par expression régulière et retirait déjà le marqueur de bloc replié
`>-` ; il ne connaissait pas les guillemets, parce qu'aucune description n'en
portait avant cette correction-là.

Aucun contrôle ne l'a vu. Le vérificateur de cohérence était vert : il compare
des noms de compétences, pas l'apparence de leur citation. Le défaut a été trouvé
**en relisant le diff**, pas en mesurant.

## Ce qu'il faut retenir

**Une correction en masse crée une valeur que le reste de la chaîne n'a jamais
vue.** Tant qu'aucune description n'était quotée, le code en aval n'avait aucune
raison de savoir déquoter — et il ne l'avait jamais eu à faire, donc rien ne
tombait. Le correctif est juste et casse quand même, en aval, silencieusement.

Le geste qui l'attrape n'est pas un test de plus. C'est : **après une correction
qui touche N fichiers d'un coup, relancer ce qui les consomme et regarder sa
sortie.** Ici, régénérer la table et lire le diff. Trente secondes.

Et le corollaire : **un contrôle qui vérifie qu'une chose est citée ne vérifie
pas à quoi ressemble la citation.** Deux contrôles différents, et on n'a
longtemps eu que le premier.

## Ce qui a été laissé derrière

Deux gardes, pour que ni le défaut ni son ricochet ne reviennent :

- `verifier-coherence.py` refuse un frontmatter de compétence dont une valeur
  non quotée contient « : » — éprouvé dans les deux sens, il tombe avec le
  défaut réintroduit ;
- `generer-table.py` retire les guillemets d'un scalaire, comme il retirait déjà
  le marqueur de bloc.
