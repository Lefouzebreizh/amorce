# Recherche P vs NP — Pipeline Koroth–Sarma

## Statut
Projet mis en pause temporairement pour priorité revenus. Ce dossier conserve l'état canonique afin de reprendre sans rejouer les pistes déjà validées ou réfutées.

## Brique acquise — cache cumulatif KW+
Pour un circuit C de profondeur d et un étiquetage admissible d'orientations B, soit S_t le support traité au tour t de l'Algorithm 1 de Koroth–Sarma. Définir W_cum(pi)=|union_t S_t| et W_cum*(C)=min_B max_pi W_cum(pi).

DÉDUCTION FORMALISÉE ET VÉRIFIÉE :

KW+(f) <= d + W_cum*(C).

Une coordonnée déjà rencontrée est synchronisée entre Alice et Bob et reste common knowledge ; elle n'a pas besoin d'être retransmise. La majoration |union S_t| <= sum |S_t| <= 4wd redonne exactement le coût d(4w+1) de Koroth–Sarma.

## Structure conditionnelle de Koroth
- t=1 : recyclage forcé ; les deux orientations non nulles sont emboîtées beta_2 subset beta_1.
- t=2 : dispersion déjà légalement possible sous la contrainte conditionnelle de monotonie.
- Noyau inter-générations minimal : 0.
- Noyau intra-négation : la monotonie impose des intersections locales entre fonctions comparables, mais aucun noyau commun global n'est forcé dès deux bits de préfixe. Exemple diamant : g00=q1 OR q2, g01=q1, g10=q2, g11=q1 AND q2.
- La monotonie conditionnelle seule est donc compatible structurellement avec une accumulation proche de Theta(tw). Attention : possibilité structurelle, pas nécessité pour CLIQUE.

## Exemple de cache réel
Une construction jouet basée sur un interrupteur global Z donne, par niveau, des supports B, B, vide. Sur w=2,m=4, deux simulations indépendantes ont obtenu W_cum=2 et sum |S_t|=8. Cela prouve que le cache cumulatif peut améliorer réellement le comptage, mais la fonction finale est essentiellement OR et la non-monotonie y est inutile.

## Résultats/source importants
- Koroth–Sarma, arXiv:1404.7443 / ECCC TR14-072 : Algorithm 1, orientations, borne 4w+1, résultats structuraux.
- Théorème 11 article / Théorème 3.3.1 thèse : existence d'une fonction monotone sans circuit monotone polylog mais calculable en polylog avec au plus deux portes internes d'orientation non nulle.
- Jukna & Lingas, STACS 2019 : negation width syntaxique ; Corollaire 6.4, CLIQUE(n,n/2) a une borne de taille 2^{Omega(n)} pour w=o(n/log n). Les auteurs indiquent explicitement que la relation orientation width / negation width reste ouverte.
- Amano–Maruoka / Fischer / Markov–Morizumi : axes distincts ; ne pas confondre nombre de NOT, decrease, negation width et orientation.

## Pistes réfutées/rétrogradées
- Bonus DAG vs formule pour profondeur/poids : fermé par unrolling.
- Persistance universelle des orientations : faux.
- Irrédundance seule : insuffisante.
- Fischer -> peu de NOT -> petit support : faux ; l'inverter peut commencer par une négation de seuil à support Theta(N).
- Comparaison brute W_cum / negation width JL : paramètres incomparables en général.
- Vertex cover / simple compression : ne fournit pas le raccourci recherché.
- Recyclage universel dans la construction conditionnelle : réfuté ; dès t>=2 la dispersion est possible.

## Front de recherche à la reprise
Le front est désormais spécifique à CLIQUE : même si un circuit général peut disperser ses orientations, CLIQUE peut-elle être calculée efficacement ainsi ?

Piste immédiate : relier le support cumulé d'une exécution aux variables-arêtes et à la géométrie des sommets touchés. Tester si un grand ensemble indépendant du graphe formé par le support cumulé d'UN SEUL chemin suffit à une restriction monotone utile, ou identifier précisément pourquoi le Théorème 6 exige une orientation uniforme globale. Ensuite seulement revenir à l'approximation Razborov / Alon–Boppana / Amano–Maruoka.

## Discipline
Toujours distinguer SOURCE / DÉDUCTION / CONJECTURE / RÉFUTÉ. Une absence de résultat web n'établit jamais l'absence d'antériorité. Lire les sources primaires intégralement quand elles deviennent fondationnelles. Tester les ponts entre paramètres sur des exemples adversariaux avant promotion en déduction.
