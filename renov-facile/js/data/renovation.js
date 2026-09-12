// Démarche Rénovation énergétique — MaPrimeRénov' / CEE, du premier réflexe
// avant dépôt jusqu'au recours en cas de refus ou de blocage.
//
// Unique démarche du site (contrairement à ensemble-mdph, qui en propose
// douze) : js/main.js ne montre donc pas de grille de cartes, juste un
// bouton "C'est parti" qui démarre directement celle-ci. Le moteur
// (js/engine.js) est générique et ne connaît aucun contenu propre à la
// rénovation énergétique — voir js/engine.js pour le format des étapes.

const DEMARCHE_RENOVATION = {
  id: "renovation",
  titreCourt: "Ta rénovation énergétique, sans y laisser des plumes",
  accroche: "MaPrimeRénov', CEE, artisan RGE, délais de l'Anah — trois questions pour savoir où tu en es, et ce qu'il faut faire maintenant, pas dans un jargon administratif.",
  boutonDemarrer: "On y va",
  premiereEtape: "aiguillage",

  calculateurs: {
    // Estime la fin de l'instruction Anah à partir de la date de dépôt et de
    // l'ampleur du projet — délais RÉELS de 2026 (3 à 6 mois), pas les 15
    // jours théoriques de la plaquette officielle. Voir bloc_pendant pour le
    // détail et la source de cet écart.
    calcDelaiInstruction(date, reponses) {
      const mois = reponses.ampleur ? 6 : 3;
      const dateEstimee = ajouterMois(date, mois);
      const jours = joursRestants(dateEstimee);
      const moisEcoulesDepuisDepot = moisEcoules(date, new Date());
      let texte, ton;
      if (jours >= 0) {
        texte = `Ton dossier est dans le circuit depuis ${moisEcoulesDepuisDepot} mois. Sur la base des délais réels constatés en ce moment (${mois} mois pour ${reponses.ampleur ? "une rénovation d'ampleur" : "un geste isolé"}), tu peux espérer une réponse d'ici environ ${Math.max(0, Math.round(jours / 30))} mois — mais ça peut aussi glisser un peu, la file d'attente reste longue. Pas de quoi paniquer.`;
        ton = "ok";
      } else {
        texte = `Ce délai théorique de ${mois} mois est dépassé (dossier déposé il y a ${moisEcoulesDepuisDepot} mois), et ce n'est pas forcément mauvais signe : beaucoup de dossiers prennent plus longtemps que prévu en ce moment, surtout ceux d'ampleur. Si l'attente te semble vraiment excessive, c'est le moment de relancer poliment.`;
        ton = "attention";
      }
      return {
        dynamique: { texte, ton },
        echeance: {
          date: dateEstimee.toISOString(),
          libelle: `Estimation de fin d'instruction par l'Anah (${mois} mois après le dépôt, pour ${reponses.ampleur ? "une rénovation d'ampleur" : "un geste isolé"}) — une estimation, pas une garantie.`,
          confiance: reponses.dateApproximative ? "moyenne" : "haute",
        },
      };
    },

    // Le recours gracieux contre un refus se ferme 2 mois après la
    // notification — délai identique à celui déjà éprouvé côté MDPH
    // (js/data non repris ici, mais le calcul est le même principe : 2 mois
    // à partir d'une notification écrite).
    calcDelaiRecours(date, reponses) {
      const dateLimite = ajouterMois(date, 2);
      const jours = joursRestants(dateLimite);
      let texte, ton;
      if (jours >= 0) {
        texte = `Il te reste encore ${jours} jour${jours > 1 ? "s" : ""} pour envoyer ton recours gracieux, en recommandé avec accusé de réception. Ne traîne pas trop, mais tu as le temps de le préparer correctement.`;
        ton = "ok";
      } else {
        texte = `Ce délai de 2 mois est dépassé depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? "s" : ""}. Le recours gracieux par cette voie n'est en principe plus possible — mais parles-en vite à un espace France Rénov' ou au Défenseur des Droits pour voir ce qu'il reste comme option, chaque situation a ses nuances.`;
        ton = "attention";
      }
      return {
        dynamique: { texte, ton },
        echeance: {
          date: dateLimite.toISOString(),
          libelle: "Fin du délai de 2 mois pour envoyer un recours gracieux contre ce refus, en recommandé avec accusé de réception, adressé à la direction générale de l'Anah.",
          confiance: reponses.dateApproximative ? "moyenne" : "haute",
        },
      };
    },
  },

  etapes: {
    aiguillage: {
      id: "aiguillage",
      kind: "choice",
      texte: "Avant de foncer tête baissée : où tu en es, avec ta demande d'aide à la rénovation énergétique ?",
      aide: "Une question, et on adapte tout le reste à ta situation.",
      options: [
        { label: "Je n'ai pas encore déposé de dossier", suite: "av_logement_age" },
        { label: "Mon dossier est déposé, en cours d'instruction", suite: "in_ampleur" },
        { label: "Mon dossier est refusé, ou bloqué sans réponse", suite: "bl_situation" },
      ],
    },

    // ===================== BRANCHE 1 : AVANT LA DEMANDE =====================

    av_logement_age: {
      id: "av_logement_age",
      kind: "choice",
      texte: "Ton logement a plus de 15 ans ?",
      aide: "Premier verrou, avant même de rêver aux aides.",
      options: [
        { label: "Oui, largement", champ: "logementAncien", value: true, suite: "av_residence_principale" },
        { label: "Non, il est plus récent", champ: "logementAncien", value: false, suite: "av_residence_principale" },
      ],
    },

    av_residence_principale: {
      id: "av_residence_principale",
      kind: "choice",
      texte: "C'est ta résidence principale, occupée au moins 8 mois par an ?",
      aide: "Une résidence secondaire ne rentre pas dans les clous, désolé.",
      options: [
        { label: "Oui, j'y vis vraiment", champ: "residencePrincipale", value: true, suite: "av_travaux_eligibles" },
        { label: "Non, c'est une résidence secondaire", champ: "residencePrincipale", value: false, suite: "av_travaux_eligibles" },
      ],
    },

    av_travaux_eligibles: {
      id: "av_travaux_eligibles",
      kind: "choice",
      texte: "Les travaux visés touchent à la performance énergétique — isolation, pompe à chaleur, ventilation, audit énergétique ?",
      options: [
        { label: "Oui, c'est bien ça", champ: "travauxEligibles", value: true, suite: "notice_avant" },
        { label: "Non, ou je ne sais pas encore", champ: "travauxEligibles", value: false, suite: "notice_avant" },
      ],
    },

    notice_avant: {
      id: "notice_avant",
      kind: "notice",
      blocId: "bloc_avant",
      offrirSauvegarde: false,
      notesConditionnelles: [
        {
          condition: (r) => r.logementAncien === false,
          texte: "Attention : un logement de moins de 15 ans n'est en général pas éligible à MaPrimeRénov'. Vérifie quand même ta situation précise auprès d'un conseiller France Rénov' avant de conclure quoi que ce soit — il existe parfois des exceptions.",
        },
        {
          condition: (r) => r.residencePrincipale === false,
          texte: "Attention : une résidence secondaire ne rentre normalement pas dans les clous de MaPrimeRénov'. Ce n'est pas la peine de monter le dossier sur cette base.",
        },
        {
          condition: (r) => r.travauxEligibles === false,
          texte: "Si tes travaux ne touchent pas à la performance énergétique (isolation, chauffage, ventilation, audit...), ils ne rentrent en général pas dans le cadre de MaPrimeRénov'. Un conseiller France Rénov' peut t'aider à voir si un autre dispositif correspond mieux.",
        },
      ],
    },

    // ===================== BRANCHE 2 : PENDANT L'INSTRUCTION =====================

    in_ampleur: {
      id: "in_ampleur",
      kind: "choice",
      texte: "Ton dossier porte sur un geste isolé (une seule action, genre isolation ou pompe à chaleur), ou sur une rénovation d'ampleur (plusieurs gestes combinés) ?",
      aide: "Ça change beaucoup le délai réel à prévoir.",
      options: [
        { label: "Un geste isolé", champ: "ampleur", value: false, suite: "in_date_depot" },
        { label: "Une rénovation d'ampleur", champ: "ampleur", value: true, suite: "in_date_depot" },
      ],
    },

    in_date_depot: {
      id: "in_date_depot",
      kind: "date-input",
      precision: "mois-jour",
      texte: "Tu as déposé ton dossier quand ?",
      aide: "C'est cette date qui fait démarrer le compte à rebours de l'instruction.",
      calculateur: "calcDelaiInstruction",
      suite: "notice_pendant",
    },

    notice_pendant: {
      id: "notice_pendant",
      kind: "notice",
      blocId: "bloc_pendant",
      dynamiqueDepuis: "in_date_depot",
      offrirSauvegarde: true,
      notesConditionnelles: [
        {
          condition: (r) => r.ampleur === true,
          texte: "Pour une rénovation d'ampleur, un entretien préalable avec un conseiller France Rénov' est obligatoire avant même le dépôt du dossier. Si tu ne l'as pas encore fait, c'est probablement ce qui bloque — recontacte ton espace conseil.",
        },
      ],
      libelleSuivi: (date) => `Dossier déposé le ${dateLongue(date)}, en attente de validation Anah`,
    },

    // ===================== BRANCHE 3 : BLOCAGE OU REFUS =====================

    bl_situation: {
      id: "bl_situation",
      kind: "choice",
      texte: "C'est plutôt quoi ta situation ?",
      options: [
        { label: "J'ai reçu un refus écrit", champ: "situationBlocage", value: "refus", suite: "bl_date_refus" },
        { label: "Silence radio, aucune réponse depuis longtemps", champ: "situationBlocage", value: "silence", suite: "notice_silence" },
      ],
    },

    bl_date_refus: {
      id: "bl_date_refus",
      kind: "date-input",
      precision: "mois-jour",
      texte: "Tu as reçu ce refus quand ?",
      aide: "C'est cette date qui fait courir ton délai de recours.",
      calculateur: "calcDelaiRecours",
      suite: "notice_refus",
    },

    notice_refus: {
      id: "notice_refus",
      kind: "notice",
      blocId: "bloc_blocage",
      dynamiqueDepuis: "bl_date_refus",
      offrirSauvegarde: true,
      libelleSuivi: (date) => `Refus reçu le ${dateLongue(date)} — recours gracieux en préparation`,
    },

    notice_silence: {
      id: "notice_silence",
      kind: "notice",
      blocId: "bloc_blocage",
      offrirSauvegarde: false,
    },
  },

  blocs: {
    bloc_avant: {
      kicker: "Avant de te lancer",
      titre: "On y va, avant de foncer tête baissée",
      intro: "Bon, avant de dépenser un centime, on va poser deux trois trucs. Parce que la rénovation énergétique, c'est un peu comme partir en randonnée sans carte — tu peux y arriver, mais tu vas perdre un temps fou et probablement te tordre une cheville en route.",
      sections: [
        {
          titre: "Le point qui plombe le plus de dossiers : l'artisan RGE",
          paragraphes: [
            "Retiens bien ce sigle, RGE, \"Reconnu Garant de l'Environnement\". Si l'artisan qui fait tes travaux n'a pas ce label, l'aide tombe à zéro. Même si le travail est nickel. Même si t'as payé cher. Zéro, point. Alors avant de signer un devis, vérifie le label sur l'annuaire France Rénov — deux minutes qui t'évitent un cauchemar.",
          ],
        },
        {
          titre: "Ton profil de revenus, la couleur qui décide de tout",
          paragraphes: [
            "L'aide dépend de ton revenu fiscal de référence, classé en quatre couleurs : bleu (très modeste), jaune (modeste), violet (intermédiaire), rose (supérieur). Plus tu es dans le bleu, plus l'aide est généreuse. À titre d'exemple, pour une personne seule hors Île-de-France, tu es \"très modeste\" en dessous de 17 363 euros de revenu fiscal de référence, \"modeste\" en dessous de 22 259 euros, \"intermédiaire\" en dessous de 31 185 euros. Au-delà, tu passes en profil supérieur, avec un accès plus limité.",
          ],
        },
        {
          titre: "Cumuler les aides, oui, mais pas empiler sans limite",
          paragraphes: [
            "MaPrimeRénov' se cumule avec les Certificats d'Économie d'Énergie et l'éco-prêt à taux zéro. Mais attention, il y a des plafonds d'écrêtement selon ton profil — en clair, l'addition de toutes tes aides ne peut pas dépasser un certain pourcentage du montant des travaux. Ce n'est pas un buffet à volonté, c'est plutôt un compteur qui se bloque à un moment donné.",
          ],
        },
        {
          titre: "Prépare-toi à l'attente, sans stresser",
          paragraphes: [
            "Le guichet a rouvert en février 2026 après une fermeture, et il y a déjà des dizaines de milliers de dossiers en attente. Si ça traîne un peu, ce n'est pas que ton dossier est mauvais, c'est juste que tout le monde est dans la même file. On respire.",
          ],
        },
      ],
      checklist: {
        titre: "Avant de signer le moindre devis",
        items: [
          "Le logement a plus de 15 ans et c'est bien ta résidence principale.",
          "Le label RGE de l'artisan, vérifié sur l'annuaire France Rénov — pas juste sur sa parole.",
          "Ta couleur de revenu fiscal de référence (bleu, jaune, violet, rose).",
          "Une idée du plafond de cumul des aides pour ton profil, avant d'additionner MaPrimeRénov', CEE et éco-PTZ.",
        ],
      },
      enBref: {
        titre: "À retenir",
        points: [
          "Pas d'artisan RGE, pas d'aide — vérifié avant de signer, pas après.",
          "Ta couleur de revenu fiscal décide du montant, pas juste de l'éligibilité.",
          "Les aides se cumulent, mais avec un plafond — pas un buffet à volonté.",
          "Le guichet est engorgé depuis la réouverture de février 2026 : l'attente n'est pas un signal négatif.",
        ],
      },
      liensOfficiels: [
        {
          url: "https://france-renov.gouv.fr/artisan-rge",
          texte: "Annuaire des artisans RGE",
          description: "à vérifier avant tout devis signé — France Rénov'",
        },
        {
          url: "https://www.maprimerenov.gouv.fr",
          texte: "MaPrimeRénov' — le site officiel",
          description: "simulateur d'aides et dépôt de dossier",
        },
        {
          url: "https://france-renov.gouv.fr",
          texte: "Trouver un espace conseil France Rénov' près de chez toi",
          description: "gratuit et neutre",
        },
      ],
    },

    bloc_pendant: {
      kicker: "Dossier déposé, patience de rigueur",
      titre: "Maintenant, la patience commence",
      intro: "Ton dossier est déposé. Bravo. Maintenant vient la partie où on attend, et où beaucoup de gens paniquent ou font une bêtise. On va éviter ça.",
      sections: [
        {
          titre: "Le piège numéro un, celui qui fait tout perdre : commencer les travaux trop tôt",
          paragraphes: [
            "Retiens cette règle absolue : tu ne dois ni signer le devis définitif, ni commencer le moindre chantier avant d'avoir reçu la validation officielle de l'Anah. Même chose pour la signature du devis avec ton artisan — elle doit venir après le dépôt du dossier, pas avant. Si tu grilles cette étape, même de quelques jours, tu perds l'aide. Intégralement. Pas de négociation possible.",
            "Comment tu sauras que c'est bon ? Tu reçois un mail de confirmation avec le montant prévisionnel de l'aide. Pense à checker tes spams, ce mail y atterrit parfois par erreur.",
          ],
        },
        {
          titre: "Les vrais délais, pas les délais théoriques",
          paragraphes: [
            "Sur le papier, l'Anah annonce 15 jours pour valider un dossier. Dans la réalité de 2026, c'est un autre monde : compte plutôt 3 mois pour un geste isolé (une seule action, genre isolation ou pompe à chaleur), et plus de 6 mois pour une rénovation d'ampleur. Pourquoi un tel écart ? Parce que 83 000 dossiers étaient en attente depuis la fermeture du guichet fin 2025, et l'Anah les traite avant les nouvelles demandes. Ce n'est pas ton dossier qui est mauvais, c'est juste la file d'attente qui est longue.",
          ],
        },
        {
          titre: "Pour une rénovation d'ampleur, un rendez-vous devient obligatoire",
          paragraphes: [
            "Si ton projet touche à une rénovation globale, tu dois passer par un entretien préalable avec un conseiller France Rénov' avant même de déposer ton dossier. Ça peut sembler être une étape en plus qui rallonge tout, mais vois-le autrement : c'est un expert gratuit et neutre qui t'aide à structurer ton projet et à ne pas rater une aide à laquelle tu as droit.",
          ],
        },
        {
          titre: "Après les travaux, ce n'est pas encore fini",
          paragraphes: [
            "Une fois les travaux terminés, tu transmets la facture à l'Anah, et le versement de la prime prend généralement deux à trois semaines. Donc la timeline complète, c'est : dépôt du dossier, attente de validation (3 à 6 mois selon l'ampleur), travaux, envoi de la facture, versement (2 à 3 semaines). Long, oui. Mais chaque étape a sa logique, et connaître le chemin rend l'attente beaucoup moins angoissante.",
          ],
        },
      ],
      enBref: {
        titre: "À retenir",
        points: [
          "Aucun devis signé, aucun chantier commencé, avant la validation écrite de l'Anah.",
          "3 mois pour un geste isolé, plus de 6 mois pour une rénovation d'ampleur — c'est la réalité 2026, pas un retard anormal.",
          "Rénovation d'ampleur = entretien France Rénov' obligatoire avant le dépôt.",
          "Après travaux : facture envoyée, puis 2 à 3 semaines pour le versement.",
        ],
      },
      liensOfficiels: [
        {
          url: "https://www.maprimerenov.gouv.fr",
          texte: "Suivre l'état de son dossier MaPrimeRénov'",
          description: "espace personnel officiel",
        },
        {
          url: "https://france-renov.gouv.fr",
          texte: "Trouver un espace conseil France Rénov'",
          description: "entretien obligatoire pour une rénovation d'ampleur",
        },
      ],
    },

    bloc_blocage: {
      kicker: "Refus ou blocage",
      titre: "Bon, ça se passe mal. Respire, on gère.",
      intro: "Un refus, une demande de pièces qui traîne, un dossier bloqué en silence radio — c'est fréquent, et ce n'est pas une fatalité. Voici comment réagir, étape par étape.",
      sections: [
        {
          titre: "Tu as reçu un refus : le délai de recours est de 2 mois",
          paragraphes: [
            "À partir de la notification, tu as 2 mois pour envoyer un recours gracieux, en recommandé avec accusé de réception, adressé à la direction générale de l'Anah. Garde précieusement ta preuve de dépôt et d'accusé de réception — plusieurs personnes se sont retrouvées dans des situations où l'Anah affirmait ne trouver aucune trace de leur recours. Ce papier, c'est ta seule vraie preuve.",
          ],
        },
        {
          titre: "Le piège des motifs de refus flous",
          paragraphes: [
            "Beaucoup de refus tombent sur des détails techniques jamais clairement expliqués dans les formulaires — une exclusion sur un type d'isolation, une adresse postale qui ne correspond pas exactement à celle des travaux, un justificatif jugé incohérent. Le réflexe à avoir : demander explicitement le motif précis et écrit du refus si tu ne l'as pas, plutôt que de rester dans le flou. Tu as le droit de savoir exactement ce qui coince.",
          ],
        },
        {
          titre: "Le dossier traîne, personne ne répond",
          paragraphes: [
            "Si ton dossier reste bloqué en silence sans réponse à tes relances : passe par le formulaire de contact officiel de maprimerenov.gouv.fr en citant la référence de ton dossier, ou appelle le 0 808 800 700 (numéro sans surcoût, du lundi au vendredi de 9h à 18h). Si ça continue à ne pas bouger, le Défenseur des Droits peut être saisi en dernier recours administratif.",
          ],
        },
        {
          titre: "Ne signe rien et ne commence rien tant que tu es dans le flou",
          paragraphes: [
            "Un artisan qui insiste pour démarrer pendant que ton dossier est encore en instruction, un devis signé un peu trop vite sous pression commerciale : c'est exactement le scénario qui fait perdre les aides. Tant que tu n'as pas la validation écrite de l'Anah, tu tiens bon.",
          ],
        },
        {
          titre: "Et si le montage a été mal conseillé dès le départ",
          paragraphes: [
            "Si tu as l'impression que ton conseiller ou ton mandataire t'a mal orienté, tu peux aussi engager une action contre ce professionnel, en plus du recours administratif contre l'Anah. Ce sont deux démarches différentes, qui ne s'excluent pas.",
          ],
        },
      ],
      enBref: {
        titre: "Les bons interlocuteurs, gratuits, à connaître par cœur",
        points: [
          "France Rénov' — les espaces conseil sont gratuits et neutres.",
          "Le numéro Anah : 0 808 800 700 (sans surcoût, lundi-vendredi 9h-18h).",
          "En dernier recours administratif : le Défenseur des Droits.",
        ],
      },
      liensOfficiels: [
        {
          url: "https://www.maprimerenov.gouv.fr",
          texte: "Formulaire de contact MaPrimeRénov'",
          description: "cite la référence de ton dossier",
        },
        {
          url: "https://france-renov.gouv.fr",
          texte: "Trouver un espace conseil France Rénov'",
          description: "gratuit et neutre",
        },
        {
          url: "https://www.defenseurdesdroits.fr",
          texte: "Saisir le Défenseur des Droits",
          description: "en dernier recours administratif, gratuit",
        },
      ],
    },
  },
};
