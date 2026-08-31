/// Le corpus de « Tout seul » : dix-sept gestes, écrits à l'avance et relus.
///
/// **Rien ici n'est généré, et c'est la décision qui commande tout le module.**
/// Trois raisons, aucune négociable :
///
/// 1. Le public est un enfant. Un geste physique improvisé par un modèle peut
///    blesser — et personne, à cet âge, ne reconnaît un conseil absurde.
/// 2. Un corpus fermé répond **instantanément et hors ligne** : pas de réseau,
///    pas d'attente, pas de facture, pas de quota qui s'épuise un dimanche.
/// 3. Une réponse fausse à un enfant qui ne sait pas lire ne se rattrape pas.
///    Il ne va pas vérifier ailleurs ; il exécute.
///
/// Ce que la fermeture coûte : dix-sept gestes, pas mille. Ce qu'elle rapporte :
/// aucune surveillance adulte nécessaire.
///
/// ## Les règles d'écriture des phrases, et pourquoi
///
/// Tout est **dit à voix haute**, jamais lu. Une phrase se juge donc à
/// l'oreille, et les tests fixent ce qui se mesure :
///
/// - **Présent, deuxième personne, un seul geste par étape.** « Croise les deux
///   lacets », jamais « effectue un croisement initial ». Un verbe abstrait
///   passe la relecture d'un adulte et laisse un enfant immobile.
/// - **Quatre-vingts caractères au plus.** Ce n'est pas une contrainte
///   d'affichage — rien ne s'affiche — c'est la longueur au-delà de laquelle
///   l'enfant a oublié le début de la phrase à la fin.
/// - **Aucun mot que l'enfant n'emploie pas lui-même.** « Le doigt qui montre »
///   plutôt que « l'index », « le trou de ton nez » plutôt que « la narine ».
///
/// ## Les étiquettes, et l'arbitrage qui se reperd
///
/// L'appareil photo rend un **nom d'objet**, jamais un nom de geste. Chaque
/// geste porte donc les noms sous lesquels son objet se présente.
///
/// **Un mot ne peut désigner qu'un geste** (les tests le vérifient), et deux
/// gestes se disputent réellement certains mots. « Chaussure » vaut pour les
/// lacets comme pour le bon pied. L'arbitrage retenu, une fois pour toutes : le
/// **mot générique** va au geste qu'on apprend en premier — « chaussure » au
/// bon pied — et le **mot précis** garde l'autre — « lacet », « basket ». Un
/// enfant qui sait déjà mettre ses chaussures montrera le lacet ; celui qui n'y
/// arrive pas montre la chaussure entière.
library;

import '../entities/geste.dart';

/// Le corpus, et les objets que le refus a le droit de citer.
abstract final class CorpusGestes {
  /// Les objets nommés dans le conseil qui accompagne un refus, avec la
  /// tournure exacte à dire. Le premier membre est l'étiquette telle que le
  /// corpus la connaît : un test vérifie qu'elle y ouvre bien un geste, sans
  /// quoi le refus enverrait l'enfant vers un second refus.
  static const List<(String, String)> exemples = [
    ('chaussure', 'tes chaussures'),
    ('brosse à dents', 'ta brosse à dents'),
    ('manteau', 'ton manteau'),
  ];

  /// Les dix-sept gestes. L'ordre n'a pas de sens fonctionnel — l'accès se fait
  /// toujours par étiquette — mais suit à peu près la journée d'un enfant.
  static const List<Geste> gestes = [
    Geste(
      identifiant: 'nouer_ses_lacets',
      nom: 'Nouer ses lacets',
      etiquettes: ['lacet', 'cordon', 'basket', 'tennis'],
      etapes: [
        Etape('Tire les deux lacets pour serrer la chaussure.', 'serrer'),
        Etape('Croise les deux lacets l\'un sur l\'autre.', 'croiser'),
        Etape('Passe un lacet sous l\'autre, puis tire.', 'passer-dessous'),
        Etape('Fais une boucle avec le lacet de droite.', 'boucle'),
        Etape('Enroule l\'autre lacet autour de la boucle.', 'enrouler'),
        Etape('Pousse ce lacet dans le petit trou.', 'trou'),
        Etape('Tire les deux boucles : c\'est noué.', 'noeud-fini'),
      ],
    ),
    Geste(
      identifiant: 'boutonner_son_gilet',
      nom: 'Boutonner son gilet',
      etiquettes: ['bouton', 'boutonnière', 'gilet', 'cardigan', 'chemise'],
      etapes: [
        Etape('Prends le bouton du bas entre deux doigts.', 'bouton'),
        Etape('Trouve le trou qui est juste en face.', 'boutonniere'),
        Etape('Pousse le bouton dans le trou.', 'pousser'),
        Etape('Attrape le bouton de l\'autre côté et tire.', 'tirer'),
        Etape('Recommence avec le bouton juste au-dessus.', 'recommencer'),
      ],
    ),
    Geste(
      identifiant: 'fermer_une_fermeture_eclair',
      nom: 'Fermer une fermeture éclair',
      etiquettes: ['fermeture éclair', 'fermeture', 'zip', 'tirette',
          'glissière'],
      etapes: [
        Etape('Tiens le bas de ton blouson avec une main.', 'tenir-bas'),
        Etape('Mets la petite pointe dans la boîte du bas.', 'emboiter'),
        Etape('Pousse la pointe jusqu\'au fond de la boîte.', 'pousser-fond'),
        Etape('Tiens toujours le bas, et tire le curseur en haut.',
            'tirer-curseur'),
        Etape('Monte doucement jusqu\'à ton menton.', 'menton'),
      ],
    ),
    Geste(
      identifiant: 'se_brosser_les_dents',
      nom: 'Se brosser les dents',
      etiquettes: ['brosse à dents', 'dentifrice', 'dent',
          'tube de dentifrice'],
      etapes: [
        Etape('Mouille ta brosse sous l\'eau du robinet.', 'mouiller'),
        Etape('Pose un petit pois de dentifrice dessus.', 'dentifrice'),
        Etape('Brosse les dents du haut en faisant des ronds.', 'ronds-haut'),
        Etape('Brosse les dents du bas en faisant des ronds.', 'ronds-bas'),
        Etape('Brosse le dessus des dents qui mâchent.', 'machoire'),
        Etape('Crache, puis rince ta brosse sous l\'eau.', 'cracher'),
      ],
    ),
    Geste(
      identifiant: 'se_laver_les_mains',
      nom: 'Se laver les mains',
      etiquettes: ['savon', 'lavabo', 'main', 'robinet', 'évier'],
      etapes: [
        Etape('Ouvre le robinet et mouille tes deux mains.', 'robinet'),
        Etape('Prends du savon dans le creux de ta main.', 'savon'),
        Etape('Frotte tes deux paumes l\'une contre l\'autre.', 'paumes'),
        Etape('Frotte le dessus de chaque main.', 'dessus-main'),
        Etape('Rince tes mains jusqu\'à ce que la mousse parte.', 'rincer'),
        Etape('Essuie tes mains avec la serviette.', 'serviette'),
      ],
    ),
    Geste(
      identifiant: 'se_moucher',
      nom: 'Se moucher',
      etiquettes: ['mouchoir', 'boîte de mouchoirs', 'nez'],
      etapes: [
        Etape('Prends un mouchoir dans la boîte.', 'mouchoir'),
        Etape('Pose-le sur ton nez, sans appuyer fort.', 'poser'),
        Etape('Bouche un trou de ton nez avec ton doigt.', 'trou-du-nez'),
        Etape('Souffle par l\'autre trou dans le mouchoir.', 'souffler'),
        Etape('Fais pareil de l\'autre côté.', 'autre-cote'),
        Etape('Jette le mouchoir à la poubelle.', 'poubelle'),
      ],
    ),
    Geste(
      identifiant: 'mettre_ses_chaussures_au_bon_pied',
      nom: 'Mettre ses chaussures au bon pied',
      etiquettes: ['chaussure', 'sandale', 'chausson', 'botte', 'soulier'],
      etapes: [
        Etape('Pose tes deux chaussures par terre devant toi.', 'poser-sol'),
        Etape('Regarde le bout pointu de chaque chaussure.', 'bout-pointu'),
        Etape('Tourne-les jusqu\'à ce que les bouts s\'écartent.', 'ecarter'),
        Etape('Entre les deux, tu vois un grand sourire.', 'sourire'),
        Etape('Mets ton pied gauche dans la chaussure de gauche.',
            'pied-gauche'),
        Etape('Mets ton pied droit dans l\'autre chaussure.', 'pied-droit'),
      ],
    ),
    Geste(
      identifiant: 'verser_sans_renverser',
      nom: 'Verser sans renverser',
      etiquettes: ['pichet', 'carafe', 'verre', 'bouteille', 'broc'],
      etapes: [
        Etape('Pose ton verre bien à plat sur la table.', 'verre'),
        Etape('Prends le pichet par l\'anse, avec toute ta main.', 'anse'),
        Etape('Approche le bec du pichet du bord du verre.', 'bec'),
        Etape('Penche le pichet tout doucement.', 'pencher'),
        Etape('Arrête quand l\'eau arrive au milieu du verre.', 'moitie'),
        Etape('Redresse le pichet avant de le reposer.', 'redresser'),
      ],
    ),
    Geste(
      identifiant: 'plier_un_tee_shirt',
      nom: 'Plier un tee-shirt',
      etiquettes: ['tee-shirt', 't-shirt', 'maillot', 'pull'],
      etapes: [
        Etape('Pose le tee-shirt à plat sur la table.', 'a-plat'),
        Etape('Lisse-le avec ta main pour enlever les plis.', 'lisser'),
        Etape('Rabats une manche sur le milieu du dos.', 'manche-un'),
        Etape('Rabats l\'autre manche sur le milieu du dos.', 'manche-deux'),
        Etape('Plie le bas du tee-shirt jusqu\'au col.', 'plier-bas'),
        Etape('Range-le à plat dans ton tiroir.', 'tiroir'),
      ],
    ),
    Geste(
      identifiant: 'faire_son_lit',
      nom: 'Faire son lit',
      etiquettes: ['lit', 'couette', 'oreiller', 'drap', 'édredon'],
      etapes: [
        Etape('Tire le drap jusqu\'en haut du lit.', 'drap'),
        Etape('Lisse le drap avec tes deux mains.', 'lisser-drap'),
        Etape('Étale la couette sur tout le lit.', 'couette'),
        Etape('Tire chaque coin de la couette vers toi.', 'coins'),
        Etape('Pose ton oreiller tout en haut du lit.', 'oreiller'),
      ],
    ),
    Geste(
      identifiant: 'ranger_ses_jouets',
      nom: 'Ranger ses jouets',
      etiquettes: ['jouet', 'cube', 'peluche', 'coffre à jouets',
          'petite voiture'],
      etapes: [
        Etape('Regarde par terre et choisis un seul jouet.', 'choisir'),
        Etape('Prends ce jouet dans tes mains.', 'prendre'),
        Etape('Porte-le jusqu\'à sa boîte.', 'porter'),
        Etape('Pose-le dedans, sans le lancer.', 'poser-boite'),
        Etape('Reviens en chercher un autre.', 'revenir'),
        Etape('Continue jusqu\'à ce que le sol soit vide.', 'sol-vide'),
      ],
    ),
    Geste(
      identifiant: 'tenir_sa_fourchette',
      nom: 'Tenir sa fourchette',
      etiquettes: ['fourchette', 'couvert', 'cuillère', 'assiette'],
      etapes: [
        Etape('Pose la fourchette dans ta main, pointes en bas.',
            'fourchette'),
        Etape('Pose ton doigt qui montre sur le manche.', 'doigt-qui-montre'),
        Etape('Serre le manche avec ton pouce et tes doigts.', 'pouce'),
        Etape('Pique un morceau avec les pointes.', 'piquer'),
        Etape('Monte la fourchette jusqu\'à ta bouche.', 'bouche'),
      ],
    ),
    Geste(
      identifiant: 'ouvrir_une_brique_de_lait',
      nom: 'Ouvrir une brique de lait',
      etiquettes: ['brique de lait', 'brique', 'lait', 'berlingot'],
      etapes: [
        Etape('Pose la brique debout sur la table.', 'brique'),
        Etape('Attrape le bouchon entre ton pouce et ton doigt.', 'bouchon'),
        Etape('Tourne le bouchon vers la gauche, sans lâcher.', 'tourner'),
        Etape('Enlève le bouchon et pose-le sur la table.', 'poser-bouchon'),
        Etape('Prends la brique à deux mains pour verser.', 'deux-mains'),
      ],
    ),
    Geste(
      identifiant: 'mettre_son_manteau',
      nom: 'Mettre son manteau',
      etiquettes: ['manteau', 'blouson', 'veste', 'anorak', 'doudoune',
          'capuche'],
      etapes: [
        Etape('Pose ton manteau par terre, grand ouvert.', 'manteau-sol'),
        Etape('Mets le col du manteau contre tes pieds.', 'col-aux-pieds'),
        Etape('Glisse tes deux bras dans les deux manches.', 'manches'),
        Etape('Lève les bras au-dessus de ta tête.', 'lever-les-bras'),
        Etape('Le manteau passe tout seul dans ton dos.', 'bascule'),
        Etape('Baisse les bras : ton manteau est mis.', 'fini'),
      ],
    ),
    Geste(
      identifiant: 'tenir_son_crayon',
      nom: 'Tenir son crayon',
      etiquettes: ['crayon', 'stylo', 'feutre', 'crayon de couleur',
          'trousse'],
      etapes: [
        Etape('Pose le crayon devant toi, la pointe vers toi.',
            'crayon-sur-table'),
        Etape('Pince le crayon tout près de sa pointe.', 'pincer'),
        Etape('Bascule-le en arrière : il tombe dans ta main.', 'basculer'),
        Etape('Laisse-le poser sur ton troisième doigt.', 'troisieme-doigt'),
        Etape('Écris sans serrer fort.', 'ecrire'),
      ],
    ),
    Geste(
      identifiant: 'se_coiffer',
      nom: 'Se coiffer',
      etiquettes: ['brosse à cheveux', 'peigne', 'cheveu'],
      etapes: [
        Etape('Tiens la brosse par son manche.', 'brosse'),
        Etape('Commence tout en bas de tes cheveux.', 'bas-des-cheveux'),
        Etape('Descends la brosse doucement, sans tirer.', 'descendre'),
        Etape('Remonte petit à petit vers le haut de la tête.', 'remonter'),
        Etape('Passe la brosse aussi derrière ta tête.', 'derriere'),
      ],
    ),
    Geste(
      identifiant: 'nouer_son_echarpe',
      nom: 'Nouer son écharpe',
      etiquettes: ['écharpe', 'foulard', 'cache-nez', 'tour de cou'],
      etapes: [
        Etape('Pose l\'écharpe autour de ton cou.', 'echarpe-au-cou'),
        Etape('Tire pour que les deux côtés soient pareils.', 'egaliser'),
        Etape('Croise les deux côtés devant toi.', 'croiser'),
        Etape('Passe un côté par-dessous, puis remonte-le.', 'passer-dessous'),
        Etape('Tire tout doucement, sans serrer ton cou.', 'serrer-doucement'),
      ],
    ),
  ];
}
