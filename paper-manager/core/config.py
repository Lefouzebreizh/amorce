"""Lecture, validation et réécriture d'`admin_config.json`.

Ce fichier est écrit par deux mains — la mienne pour les contrats, le programme
pour les alertes — et c'est de là que viennent ses deux règles :

1. **Seule la section `alertes` est réécrite.** Le reste est relu et réémis tel
   quel, dans son ordre d'origine (`json.dump(..., indent=2,
   ensure_ascii=False)` sur le dictionnaire relu, sans tri des clés). Un
   programme qui reformate le fichier qu'on édite à la main est un programme
   qu'on cesse d'éditer à la main.
2. **Toute écriture est précédée d'une copie en `admin_config.json.bak`, et
   passe par un fichier temporaire renommé.** Une configuration tronquée par une
   coupure au milieu d'un `write`, c'est six mois de saisie de contrats perdus.

La validation est stricte à la lecture : une date impossible, une catégorie
inconnue ou un `preavis_jours` négatif arrêtent le programme avec le nom du
champ fautif. Un assistant administratif qui se trompe en silence est pire que
pas d'assistant du tout.

Le champ `version` sert aux migrations : la lecture sait relire les versions
antérieures et réécrit à la version courante.
"""
