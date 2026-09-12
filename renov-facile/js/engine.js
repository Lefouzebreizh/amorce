// Moteur générique de questionnaire, commun à toutes les démarches de la plateforme.
// Une démarche est un objet de données (voir js/data/*.js) : ce fichier ne connaît
// aucun contenu MDPH, seulement des "étapes" de trois types (choice, date-input,
// notice) et des transitions entre elles.
const AVERTISSEMENT_LEGAL =
  "Ce site donne des repères généraux, pas un accompagnement personnalisé. " +
  "En cas de doute sur ta situation, un conseiller France Rénov' ou un professionnel du secteur pourra t'aider à y voir clair.";

const Moteur = (() => {
  let demarche = null;
  let racine = null;
  let etapeId = null;
  let reponses = {};
  let entreesBrutes = {};
  let dynamique = {};
  let echeanceCourante = null;
  let historique = [];
  let suiviIdCourant = null;

  function demarrer(uneDemarche, elRacine) {
    demarche = uneDemarche;
    racine = elRacine;
    etapeId = demarche.premiereEtape;
    reponses = {};
    entreesBrutes = {};
    dynamique = {};
    echeanceCourante = null;
    historique = [];
    suiviIdCourant = null;
    rendre();
  }

  // Reprend une démarche depuis n'importe quelle étape sauvegardée — pas
  // seulement une notice avec échéance. Si l'étape retrouvée est une notice
  // alimentée par une date déjà répondue, on relance son calculateur pour que
  // le message ("il te reste 12 jours"...) reste juste par rapport à
  // aujourd'hui, plutôt que de rester figé au jour de la sauvegarde.
  function reprendre(uneDemarche, elRacine, suivi) {
    demarche = uneDemarche;
    racine = elRacine;
    reponses = { ...suivi.reponses };
    entreesBrutes = {};
    dynamique = {};
    historique = Array.isArray(suivi.historique) ? [...suivi.historique] : [];
    suiviIdCourant = suivi.id;
    echeanceCourante = suivi.echeance || null;
    etapeId = suivi.etapeId;

    const etape = demarche.etapes[etapeId];
    if (etape.kind === "notice" && etape.dynamiqueDepuis && reponses.date) {
      const etapeOrigine = demarche.etapes[etape.dynamiqueDepuis];
      const resultat = demarche.calculateurs[etapeOrigine.calculateur](new Date(reponses.date), reponses);
      dynamique[etapeOrigine.id] = resultat.dynamique;
      echeanceCourante = resultat.echeance || null;
    }
    rendre();
  }

  function etapeCourante() {
    return demarche.etapes[etapeId];
  }

  // Filet automatique : tant que la démarche n'est pas déjà suivie dans le
  // coffre chiffré (suiviIdCourant), chaque étape franchie se réécrit en
  // clair dans localStorage — sans quoi un coup de fil ou un onglet déchargé
  // par le téléphone effacerait tout, coffre ou pas.
  function sauvegarderBrouillon() {
    if (suiviIdCourant) return;
    Brouillon.enregistrer({ demarcheId: demarche.id, etapeId, reponses, historique });
  }

  function aller(id) {
    historique.push(etapeId);
    etapeId = id;
    sauvegarderBrouillon();
    rendre();
  }

  function revenir() {
    if (historique.length === 0) return;
    etapeId = historique.pop();
    sauvegarderBrouillon();
    rendre();
  }

  function rendre() {
    racine.classList.remove("entree");
    // force un reflow pour que la transition rejoue à chaque étape
    void racine.offsetWidth;
    racine.innerHTML = "";

    const etape = etapeCourante();
    let bloc;
    if (etape.kind === "choice") bloc = rendreChoix(etape);
    else if (etape.kind === "date-input") bloc = rendreDateInput(etape);
    else if (etape.kind === "texte-libre") bloc = rendreTexteLibre(etape);
    else if (etape.kind === "notice") bloc = rendreNotice(etape);

    racine.appendChild(bloc);
    if (historique.length > 0) {
      racine.appendChild(creerBoutonRetour());
    }
    // La notice qui offre déjà une sauvegarde liée à une échéance couvre le
    // besoin sur cet écran précis — pas la peine d'empiler un second bouton.
    const aDejaUneSauvegardeSpecifique = etape.kind === "notice" && etape.offrirSauvegarde && echeanceCourante;
    if (!aDejaUneSauvegardeSpecifique) {
      racine.appendChild(creerZoneSauvegardeGenerique(etape));
    }
    racine.classList.add("entree");
  }

  function creerEl(tag, classe, contenu) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (contenu !== undefined) el.textContent = contenu;
    return el;
  }

  function creerBoutonRetour() {
    const bouton = creerEl("button", "lien-retour", "← revenir en arrière");
    bouton.type = "button";
    bouton.addEventListener("click", revenir);
    return bouton;
  }

  function creerDureeEstimee(texte) {
    return creerEl("p", "etape-duree", `⏱ ${texte}`);
  }

  // Calculée à partir du contenu réel du bloc (≈200 mots/minute) plutôt que
  // saisie à la main démarche par démarche : reste juste même si le texte
  // change, sans dépendre d'estimations tapées une fois puis jamais revues.
  function estimerMinutesLecture(bloc) {
    let mots = 0;
    const compter = (texte) => {
      if (texte) mots += texte.trim().split(/\s+/).filter(Boolean).length;
    };
    compter(bloc.intro);
    for (const section of bloc.sections) {
      compter(section.titre);
      if (section.paragraphes) section.paragraphes.forEach(compter);
      if (section.liste) section.liste.forEach(compter);
    }
    if (bloc.enBref) {
      compter(bloc.enBref.titre);
      bloc.enBref.points.forEach(compter);
    }
    return Math.max(1, Math.round(mots / 200));
  }

  function rendreChoix(etape) {
    const conteneur = creerEl("div", "etape etape-choix");
    conteneur.appendChild(creerDureeEstimee("Une question, une trentaine de secondes"));
    conteneur.appendChild(creerEl("h2", "etape-texte", etape.texte));
    if (etape.aide) conteneur.appendChild(creerEl("p", "etape-aide", etape.aide));

    const options = creerEl("div", "options");
    for (const option of etape.options) {
      const bouton = creerEl("button", "option", option.label);
      bouton.type = "button";
      bouton.addEventListener("click", () => {
        if (option.champ) reponses[option.champ] = option.value;
        aller(option.suite);
      });
      options.appendChild(bouton);
    }
    conteneur.appendChild(options);
    return conteneur;
  }

  // Seule étape à saisie libre du moteur, et volontairement facultative :
  // deux boutons à égalité, "Je continue" et "Passer cette étape", jamais
  // un champ obligatoire qui bloquerait qui ne veut ou ne peut pas écrire.
  function rendreTexteLibre(etape) {
    const conteneur = creerEl("div", "etape etape-texte-libre");
    conteneur.appendChild(creerDureeEstimee("Facultatif, à ton rythme"));
    conteneur.appendChild(creerEl("h2", "etape-texte", etape.texte));
    if (etape.aide) conteneur.appendChild(creerEl("p", "etape-aide", etape.aide));

    const champ = document.createElement("textarea");
    champ.className = "champ-texte-libre";
    champ.rows = 4;
    champ.placeholder = "Écris ici, si tu en as envie...";
    champ.setAttribute("aria-label", etape.texte);
    if (typeof reponses[etape.champ] === "string") champ.value = reponses[etape.champ];
    conteneur.appendChild(champ);

    const actions = creerEl("div", "texte-libre-actions");

    const boutonContinuer = creerEl("button", "bouton-primaire", "Je continue");
    boutonContinuer.type = "button";
    boutonContinuer.addEventListener("click", () => {
      const valeur = champ.value.trim();
      if (valeur) reponses[etape.champ] = valeur;
      else delete reponses[etape.champ];
      aller(etape.suite);
    });
    actions.appendChild(boutonContinuer);

    const boutonPasser = creerEl("button", "lien-discret", "Passer cette étape →");
    boutonPasser.type = "button";
    boutonPasser.addEventListener("click", () => {
      delete reponses[etape.champ];
      aller(etape.suite);
    });
    actions.appendChild(boutonPasser);

    conteneur.appendChild(actions);
    return conteneur;
  }

  const MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];

  function rendreDateInput(etape) {
    const conteneur = creerEl("div", "etape etape-date");
    conteneur.appendChild(creerDureeEstimee("Une date à retrouver, moins d'une minute"));
    conteneur.appendChild(creerEl("h2", "etape-texte", etape.texte));
    if (etape.aide) conteneur.appendChild(creerEl("p", "etape-aide", etape.aide));

    const champs = creerEl("div", "champs-date");
    const brut = entreesBrutes[etape.id] || {};

    const selectMois = document.createElement("select");
    selectMois.className = "champ-mois";
    selectMois.setAttribute("aria-label", "Mois");
    const optionMoisVide = creerEl("option", null, "Mois");
    optionMoisVide.value = "";
    selectMois.appendChild(optionMoisVide);
    MOIS.forEach((nom, i) => {
      const o = creerEl("option", null, nom.charAt(0).toUpperCase() + nom.slice(1));
      o.value = String(i);
      if (brut.mois === String(i)) o.selected = true;
      selectMois.appendChild(o);
    });

    const champAnnee = document.createElement("input");
    champAnnee.className = "champ-annee";
    champAnnee.type = "number";
    champAnnee.placeholder = "Année";
    champAnnee.setAttribute("aria-label", "Année");
    champAnnee.min = "2015";
    champAnnee.max = String(new Date().getFullYear());
    if (brut.annee) champAnnee.value = brut.annee;

    champs.appendChild(selectMois);
    champs.appendChild(champAnnee);

    let selectJour = null;
    if (etape.precision === "mois-jour") {
      selectJour = document.createElement("select");
      selectJour.className = "champ-jour";
      selectJour.setAttribute("aria-label", "Jour (facultatif)");
      const optionJourVide = creerEl("option", null, "Jour (si tu t'en souviens)");
      optionJourVide.value = "";
      selectJour.appendChild(optionJourVide);
      for (let j = 1; j <= 31; j++) {
        const o = creerEl("option", null, String(j));
        o.value = String(j);
        if (brut.jour === String(j)) o.selected = true;
        selectJour.appendChild(o);
      }
      champs.appendChild(selectJour);
    }

    conteneur.appendChild(champs);

    const erreur = creerEl("p", "champ-erreur");
    erreur.hidden = true;
    conteneur.appendChild(erreur);

    const bouton = creerEl("button", "bouton-primaire", "Je continue");
    bouton.type = "button";
    champAnnee.addEventListener("keydown", (e) => {
      if (e.key === "Enter") bouton.click();
    });
    bouton.addEventListener("click", () => {
      const mois = selectMois.value;
      const annee = champAnnee.value;
      if (mois === "" || !annee || annee.length !== 4 || Number(annee) < 1000) {
        erreur.textContent = "Le mois et l'année nous suffisent pour continuer.";
        erreur.hidden = false;
        return;
      }
      const jour = selectJour && selectJour.value ? Number(selectJour.value) : 15;
      const date = new Date(Number(annee), Number(mois), jour);

      if (date > new Date()) {
        erreur.textContent = "Cette date tombe dans le futur — vérifie l'année, ça vaut le coup d'œil.";
        erreur.hidden = false;
        return;
      }

      entreesBrutes[etape.id] = { mois, annee, jour: selectJour ? selectJour.value : undefined };
      reponses.date = date.toISOString();
      reponses.dateApproximative = !(selectJour && selectJour.value);

      const resultat = demarche.calculateurs[etape.calculateur](date, reponses);
      dynamique[etape.id] = resultat.dynamique;
      echeanceCourante = resultat.echeance || null;
      aller(etape.suite);
    });
    conteneur.appendChild(bouton);

    return conteneur;
  }

  function rendreNotice(etape) {
    const conteneur = creerEl("div", "etape etape-notice");
    const bloc = demarche.blocs[etape.blocId];

    // Le message affiché ici vient uniquement du calculateur de l'étape qui
    // a mené à cette notice (une date saisie, transformée en délai concret).
    // Cette version du moteur n'appelle aucun serveur de personnalisation par
    // LLM — Rénov Facile n'en a pas, contrairement à ensemble-mdph dont ce
    // fichier est porté : appeler une route inexistante aurait échoué à
    // chaque notice, en silence pour l'utilisateur mais en erreur dans la
    // console (voir §8 bis de la charte du dépôt).
    if (etape.dynamiqueDepuis && dynamique[etape.dynamiqueDepuis]) {
      const d = dynamique[etape.dynamiqueDepuis];
      conteneur.appendChild(creerEl("div", `message-dynamique ton-${d.ton}`, d.texte));
    }

    if (etape.notesConditionnelles) {
      for (const note of etape.notesConditionnelles) {
        if (note.condition(reponses)) {
          conteneur.appendChild(creerEl("div", "encart", note.texte));
        }
      }
    }

    conteneur.appendChild(creerEl("p", "bloc-kicker", bloc.kicker));
    conteneur.appendChild(creerEl("h2", "bloc-titre", bloc.titre));
    const minutes = estimerMinutesLecture(bloc);
    conteneur.appendChild(creerDureeEstimee(`Environ ${minutes} minute${minutes > 1 ? "s" : ""} de lecture`));
    if (bloc.intro) conteneur.appendChild(creerEl("p", "bloc-intro", bloc.intro));

    for (const section of bloc.sections) {
      const secEl = creerEl("section", "bloc-section");
      if (section.titre) secEl.appendChild(creerEl("h3", null, section.titre));
      if (section.paragraphes) {
        for (const p of section.paragraphes) secEl.appendChild(creerEl("p", null, p));
      }
      if (section.liste) {
        const ul = document.createElement("ul");
        for (const item of section.liste) ul.appendChild(creerEl("li", null, item));
        secEl.appendChild(ul);
      }
      conteneur.appendChild(secEl);
    }

    if (bloc.checklist) {
      conteneur.appendChild(rendreChecklist(etape, bloc));
    }

    if (bloc.enBref) {
      const enBref = creerEl("div", "en-bref");
      enBref.appendChild(creerEl("p", "en-bref-titre", bloc.enBref.titre));
      const ul = document.createElement("ul");
      for (const item of bloc.enBref.points) ul.appendChild(creerEl("li", null, item));
      enBref.appendChild(ul);
      conteneur.appendChild(enBref);
    }

    if (bloc.liensOfficiels) {
      const zone = creerEl("div", "liens-officiels");
      zone.appendChild(creerEl("p", "liens-officiels-titre", "Où trouver ce dont tu as besoin"));
      const ul = document.createElement("ul");
      for (const lien of bloc.liensOfficiels) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = lien.url;
        a.textContent = lien.texte;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.appendChild(a);
        if (lien.description) li.appendChild(creerEl("span", "lien-description", ` — ${lien.description}`));
        ul.appendChild(li);
      }
      zone.appendChild(ul);
      conteneur.appendChild(zone);
    }

    if (etape.offrirSauvegarde && echeanceCourante) {
      conteneur.appendChild(rendreZoneSauvegarde(etape));
    }

    conteneur.appendChild(creerEl("p", "avertissement-legal", AVERTISSEMENT_LEGAL));

    const boutonImprimer = creerEl("button", "lien-discret lien-imprimer no-print", "🖨 Imprimer ou garder cette page en PDF");
    boutonImprimer.type = "button";
    boutonImprimer.addEventListener("click", () => window.print());
    conteneur.appendChild(boutonImprimer);

    return conteneur;
  }

  function rendreChecklist(etape, bloc) {
    const zone = creerEl("div", "checklist");
    zone.appendChild(creerEl("p", "checklist-titre", bloc.checklist.titre));

    bloc.checklist.items.forEach((texte, index) => {
      const cleCoche = `checklist.${demarche.id}.${etape.blocId}.${index}`;
      const ligne = creerEl("label", "checklist-item");

      const case_ = document.createElement("input");
      case_.type = "checkbox";
      try {
        case_.checked = localStorage.getItem(cleCoche) === "1";
      } catch (e) {
        // pas grave si indisponible, la case reste simplement décochée
      }
      case_.addEventListener("change", () => {
        try {
          localStorage.setItem(cleCoche, case_.checked ? "1" : "0");
        } catch (e) {
          // rien à faire de plus si le stockage est indisponible
        }
      });

      ligne.appendChild(case_);
      ligne.appendChild(creerEl("span", null, texte));
      zone.appendChild(ligne);
    });

    return zone;
  }

  // Le rappel .ics ne demande ni mot de passe ni coffre : c'est le rappel le
  // plus simple qu'on puisse offrir, indépendant de la sauvegarde chiffrée
  // ci-dessous. Se souvenir (calendrier) et reprendre où on en était
  // (coffre) répondent à deux besoins différents ; rien n'empêche de
  // vouloir l'un sans l'autre.
  function rendreBoutonRappelICS(etape) {
    const bouton = creerEl("button", "lien-discret no-print", "📅 Ajouter un rappel à mon calendrier");
    bouton.type = "button";
    bouton.addEventListener("click", () => {
      const contenu = ICS.genererICS({
        dateISO: echeanceCourante.date,
        titre: `${demarche.titreCourt} — échéance`,
        description: echeanceCourante.libelle,
      });
      ICS.telecharger("rappel-echeance.ics", contenu);
    });
    return bouton;
  }

  // Contrairement au .ics (téléchargé, jamais revu) et au coffre (chiffré,
  // jamais lu par personne d'autre), ce rappel-là part vraiment sur un
  // serveur : une adresse e-mail et cette seule date, le temps d'un envoi.
  // Double confirmation obligatoire (voir api/alerte-echeance.js) — sans
  // elle, n'importe qui pourrait inscrire l'adresse de quelqu'un d'autre.
  function rendreFormulaireAlerteEmail(etape) {
    const zone = creerEl("div", "alerte-email no-print");

    const ouvrirFormulaire = () => {
      zone.innerHTML = "";

      const formulaire = creerEl("div", "sauvegarde-form");
      const champEmail = document.createElement("input");
      champEmail.type = "email";
      champEmail.className = "champ-texte";
      champEmail.placeholder = "ton@e-mail.fr";
      champEmail.setAttribute("aria-label", "Ton adresse e-mail");
      champEmail.autocomplete = "email";
      formulaire.appendChild(champEmail);

      const messageErreur = creerEl("p", "champ-erreur");
      messageErreur.hidden = true;

      const boutonEnvoyer = creerEl("button", "bouton-secondaire", "M'envoyer un rappel");
      boutonEnvoyer.type = "button";
      champEmail.addEventListener("keydown", (e) => {
        if (e.key === "Enter") boutonEnvoyer.click();
      });
      boutonEnvoyer.addEventListener("click", async () => {
        const email = champEmail.value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          messageErreur.textContent = "Il faut une adresse e-mail valide.";
          messageErreur.hidden = false;
          return;
        }
        if (boutonEnvoyer.disabled) return;
        boutonEnvoyer.disabled = true;
        try {
          const reponse = await fetch("/api/alerte-echeance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              demarcheId: demarche.id,
              email,
              dateLimite: echeanceCourante.date,
              libelle: echeanceCourante.libelle,
            }),
          });
          if (!reponse.ok) {
            messageErreur.textContent = "Impossible d'activer ce rappel pour le moment, mais le reste du site fonctionne normalement.";
            messageErreur.hidden = false;
            return;
          }
          zone.innerHTML = "";
          zone.appendChild(creerEl("p", "sauvegarde-confirmee", "✓ Vérifie ta boîte mail : un lien de confirmation t'attend."));
        } catch (e) {
          messageErreur.textContent = "Impossible d'activer ce rappel pour le moment, mais le reste du site fonctionne normalement.";
          messageErreur.hidden = false;
        } finally {
          boutonEnvoyer.disabled = false;
        }
      });

      formulaire.appendChild(boutonEnvoyer);
      zone.appendChild(formulaire);
      zone.appendChild(messageErreur);
      zone.appendChild(
        creerEl(
          "p",
          "alerte-email-confidentialite",
          "On garde ton e-mail et cette date, rien d'autre, le temps d'un seul envoi. Un lien pour tout arrêter est dans chaque e-mail."
        )
      );
    };

    const lienOuvrir = creerEl("button", "lien-discret", "✉️ Recevoir un rappel par e-mail");
    lienOuvrir.type = "button";
    lienOuvrir.addEventListener("click", ouvrirFormulaire);
    zone.appendChild(lienOuvrir);
    return zone;
  }

  function rendreZoneSauvegarde(etape) {
    const zone = creerEl("div", "zone-sauvegarde");
    zone.appendChild(rendreBoutonRappelICS(etape));
    zone.appendChild(rendreFormulaireAlerteEmail(etape));

    if (suiviIdCourant) {
      Coffre.mettreAJourSuivi(suiviIdCourant, {
        etapeId: etape.id,
        reponses,
        historique: [...historique],
        echeance: echeanceCourante,
        resume: etape.libelleSuivi(new Date(reponses.date)),
      });
      zone.appendChild(creerEl("p", "sauvegarde-confirmee", "✓ Ce suivi est à jour dans tes échéances enregistrées."));
      return zone;
    }

    zone.appendChild(creerEl("p", "sauvegarde-titre", "Tu veux qu'on te le rappelle la prochaine fois ?"));
    zone.appendChild(
      creerEl(
        "p",
        "sauvegarde-texte",
        "On peut garder cette échéance ici, chiffrée sur ton appareil avec un mot de passe que toi seul·e connais. Personne d'autre, pas même nous, ne peut la lire."
      )
    );

    const formulaire = creerEl("div", "sauvegarde-form");
    const champMdp = document.createElement("input");
    champMdp.type = "password";
    champMdp.className = "champ-mdp";
    champMdp.placeholder = Coffre.existeCoffre() ? "Ton mot de passe" : "Choisis un mot de passe";
    champMdp.setAttribute("aria-label", champMdp.placeholder);
    champMdp.autocomplete = "new-password";
    formulaire.appendChild(champMdp);

    const messageErreur = creerEl("p", "champ-erreur");
    messageErreur.hidden = true;

    const boutonSauver = creerEl("button", "bouton-secondaire", "Je garde cette échéance");
    boutonSauver.type = "button";
    champMdp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") boutonSauver.click();
    });
    boutonSauver.addEventListener("click", async () => {
      const motDePasse = champMdp.value;
      if (!motDePasse || motDePasse.length < 4) {
        messageErreur.textContent = "Il faut au moins 4 caractères.";
        messageErreur.hidden = false;
        return;
      }

      if (boutonSauver.disabled) return;
      boutonSauver.disabled = true;

      try {
        let ok = true;
        if (!Coffre.existeCoffre()) {
          await Coffre.creerCoffre(motDePasse);
        } else if (!Coffre.estDeverrouille()) {
          ok = await Coffre.deverrouiller(motDePasse);
        }

        if (!ok) {
          messageErreur.textContent = "Ce mot de passe ne correspond pas à celui déjà enregistré.";
          messageErreur.hidden = false;
          return;
        }

        suiviIdCourant = await Coffre.enregistrerSuivi({
          demarcheId: demarche.id,
          etapeId: etape.id,
          reponses,
          historique: [...historique],
          echeance: echeanceCourante,
          resume: etape.libelleSuivi(new Date(reponses.date)),
        });
        // Le suivi chiffré prend le relais : le brouillon en clair n'a plus
        // de raison d'exister à côté.
        Brouillon.effacer();
        rendre();
      } catch (e) {
        messageErreur.textContent = e.message || "Impossible d'enregistrer ce suivi pour le moment, mais le reste du site fonctionne normalement.";
        messageErreur.hidden = false;
      } finally {
        boutonSauver.disabled = false;
      }
    });

    formulaire.appendChild(boutonSauver);
    zone.appendChild(formulaire);
    zone.appendChild(messageErreur);
    return zone;
  }

  function libelleSuiviGenerique(etape) {
    if (etape.kind === "notice") {
      return `${demarche.titreCourt} — ${demarche.blocs[etape.blocId].titre}`;
    }
    return `${demarche.titreCourt} — étape en cours`;
  }

  // Contrairement à rendreZoneSauvegarde (liée à une échéance précise et
  // affichée seulement sur la notice qui la calcule), cette zone-ci apparaît
  // sur chaque étape — choix, date, ou notice sans échéance — pour qu'on
  // puisse reprendre une démarche là où on l'a laissée sans tout refaire,
  // même si on n'a encore répondu à aucune question de date.
  function creerZoneSauvegardeGenerique(etape) {
    const zone = creerEl("div", "zone-sauvegarde sauvegarde-generique no-print");

    if (suiviIdCourant) {
      const bouton = creerEl("button", "lien-discret", "🔄 Mettre à jour ma sauvegarde");
      bouton.type = "button";
      bouton.addEventListener("click", async () => {
        try {
          await Coffre.mettreAJourSuivi(suiviIdCourant, {
            etapeId: etape.id,
            reponses,
            historique: [...historique],
            echeance: echeanceCourante,
            resume: libelleSuiviGenerique(etape),
          });
          zone.innerHTML = "";
          zone.classList.add("ouverte");
          zone.appendChild(creerEl("p", "sauvegarde-confirmee", "✓ Sauvegarde mise à jour."));
        } catch (e) {
          // discret : le reste de la page continue de fonctionner
        }
      });
      zone.appendChild(bouton);
      return zone;
    }

    const lienOuvrir = creerEl("button", "lien-discret", "💾 Je reprends ça plus tard");
    lienOuvrir.type = "button";
    lienOuvrir.addEventListener("click", () => {
      zone.innerHTML = "";
      zone.classList.add("ouverte");
      zone.appendChild(creerEl("p", "sauvegarde-titre", "Reprendre plus tard, sans tout refaire ?"));
      zone.appendChild(
        creerEl(
          "p",
          "sauvegarde-texte",
          "On garde ta place ici, chiffrée sur ton appareil avec un mot de passe que toi seul·e connais."
        )
      );

      const formulaire = creerEl("div", "sauvegarde-form");
      const champMdp = document.createElement("input");
      champMdp.type = "password";
      champMdp.className = "champ-mdp";
      champMdp.placeholder = Coffre.existeCoffre() ? "Ton mot de passe" : "Choisis un mot de passe";
      champMdp.setAttribute("aria-label", champMdp.placeholder);
      champMdp.autocomplete = "new-password";
      formulaire.appendChild(champMdp);

      const messageErreur = creerEl("p", "champ-erreur");
      messageErreur.hidden = true;

      const boutonSauver = creerEl("button", "bouton-secondaire", "Sauvegarder ma progression");
      boutonSauver.type = "button";
      champMdp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") boutonSauver.click();
      });
      boutonSauver.addEventListener("click", async () => {
        const motDePasse = champMdp.value;
        if (!motDePasse || motDePasse.length < 4) {
          messageErreur.textContent = "Il faut au moins 4 caractères.";
          messageErreur.hidden = false;
          return;
        }
        if (boutonSauver.disabled) return;
        boutonSauver.disabled = true;
        try {
          let ok = true;
          if (!Coffre.existeCoffre()) {
            await Coffre.creerCoffre(motDePasse);
          } else if (!Coffre.estDeverrouille()) {
            ok = await Coffre.deverrouiller(motDePasse);
          }
          if (!ok) {
            messageErreur.textContent = "Ce mot de passe ne correspond pas à celui déjà enregistré.";
            messageErreur.hidden = false;
            return;
          }
          suiviIdCourant = await Coffre.enregistrerSuivi({
            demarcheId: demarche.id,
            etapeId: etape.id,
            reponses,
            historique: [...historique],
            echeance: echeanceCourante,
            resume: libelleSuiviGenerique(etape),
          });
          // Le suivi chiffré prend le relais : le brouillon en clair n'a
          // plus de raison d'exister à côté.
          Brouillon.effacer();
          zone.innerHTML = "";
          zone.appendChild(
            creerEl("p", "sauvegarde-confirmee", "✓ Sauvegardé. Tu retrouveras cette démarche depuis l'accueil.")
          );
        } catch (e) {
          messageErreur.textContent =
            e.message || "Impossible d'enregistrer pour le moment, mais le reste du site fonctionne normalement.";
          messageErreur.hidden = false;
        } finally {
          boutonSauver.disabled = false;
        }
      });

      formulaire.appendChild(boutonSauver);
      zone.appendChild(formulaire);
      zone.appendChild(messageErreur);
    });
    zone.appendChild(lienOuvrir);
    return zone;
  }

  // Donne au chat (js/chat.js) de quoi cloisonner sa réponse à la démarche en
  // cours et éviter de faire répéter ce qui est déjà su — jamais plus que ce
  // que l'étape affiche déjà à l'écran.
  function etatCourant() {
    if (!demarche) return null;
    const info = { demarcheId: demarche.id, etapeId, reponses: { ...reponses } };
    const etape = etapeCourante();
    if (etape && etape.kind === "notice") {
      const bloc = demarche.blocs[etape.blocId];
      info.bloc = { kicker: bloc.kicker, titre: bloc.titre, intro: bloc.intro || null };
    }
    return info;
  }

  return { demarrer, reprendre, etatCourant };
})();
