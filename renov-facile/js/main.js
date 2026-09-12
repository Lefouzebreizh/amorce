// Page d'accueil et pont vers le coffre local (suivis enregistrés).
// Contrairement à ensemble-mdph/js/main.js, dont c'est le registre de douze
// démarches, Rénov Facile n'en propose qu'une seule — pas de grille de
// cartes à construire, juste un bouton "C'est parti" qui la démarre
// directement. Toute la mécanique de reprise (brouillon en clair, coffre
// chiffré) est reprise telle quelle : générique, elle ne connaît aucun
// contenu de démarche.
const REGISTRE_DEMARCHES = {
  renovation: DEMARCHE_RENOVATION,
};

const vueAccueil = document.getElementById("vue-accueil");
const vueQuestionnaire = document.getElementById("vue-questionnaire");
const racineQuestionnaire = document.getElementById("racine-questionnaire");
const lienAccueil = document.getElementById("lien-accueil");
const zoneCoffre = document.getElementById("zone-coffre");
const zoneBrouillon = document.getElementById("zone-brouillon");
const zoneBandeaux = document.getElementById("zone-bandeaux");
const lienReprise = document.getElementById("lien-reprise");
const carteUnique = document.getElementById("carte-unique");

// Replié par défaut : un nouveau visiteur, qui n'a ni brouillon ni suivi
// chiffré, ne doit jamais voir cet état — repart à false à chaque
// rechargement de page, ce qui est le comportement voulu.
let repriseDepliee = false;

function creerEl(tag, classe, contenu) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (contenu !== undefined) el.textContent = contenu;
  return el;
}

function afficherAccueil() {
  vueQuestionnaire.hidden = true;
  vueAccueil.hidden = false;
  lienAccueil.hidden = true;
  rafraichirZoneReprise();
}

function afficherQuestionnaire() {
  vueAccueil.hidden = true;
  vueQuestionnaire.hidden = false;
  lienAccueil.hidden = false;
}

// Quitte la démarche en cours à tout moment, quelle que soit l'étape où l'on
// se trouve. Un seul appui en arrière suffit : ouvrirQuestionnaire() n'empile
// qu'une seule entrée d'historique, quel que soit le nombre d'étapes
// parcourues. Ce geste ne modifie ni n'efface le brouillon déjà écrit en
// localStorage à chaque étape franchie (voir engine.js, sauvegarderBrouillon).
lienAccueil.addEventListener("click", () => history.back());

function ouvrirQuestionnaire() {
  history.pushState({ vue: "questionnaire" }, "");
  afficherQuestionnaire();
}

function demarrerDemarche(demarche) {
  ouvrirQuestionnaire();
  Moteur.demarrer(demarche, racineQuestionnaire);
}

function rendreCarteUnique() {
  carteUnique.innerHTML = "";
  // .carte-demarche naît en opacity:0 (style.css) — sur ensemble-mdph.js/main.js,
  // dont c'est le gabarit, un IntersectionObserver ajoute .carte-visible quand
  // chaque carte de la grille entre dans l'écran au défilement. Une seule
  // carte, posée directement sous le héro, n'a pas besoin de ce mécanisme :
  // elle est déjà dans le premier écran, donc visible tout de suite plutôt
  // qu'en attendant un scroll qui ne viendra pas.
  const carte = creerEl("div", "carte-demarche disponible carte-visible");
  carte.appendChild(creerEl("p", "carte-kicker", DEMARCHE_RENOVATION.titreCourt));
  carte.appendChild(creerEl("p", "carte-accroche", DEMARCHE_RENOVATION.accroche));
  const bouton = creerEl("button", "bouton-primaire", DEMARCHE_RENOVATION.boutonDemarrer);
  bouton.type = "button";
  bouton.addEventListener("click", () => demarrerDemarche(DEMARCHE_RENOVATION));
  carte.appendChild(bouton);
  carteUnique.appendChild(carte);
}

function texteEcheance(echeanceISO) {
  const cible = new Date(echeanceISO);
  cible.setHours(0, 0, 0, 0);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jours = Math.round((cible - aujourdhui) / 86400000);
  if (jours < 0) return { texte: `échéance passée depuis ${Math.abs(jours)} j`, enRetard: true };
  if (jours === 0) return { texte: "c'est aujourd'hui", enRetard: false };
  if (jours <= 60) return { texte: `dans ${jours} j`, enRetard: false };
  return { texte: `dans ${Math.round(jours / 30)} mois`, enRetard: false };
}

async function rendreListeSuivis() {
  let index;
  try {
    index = await Coffre.lireIndex();
  } catch (e) {
    zoneCoffre.innerHTML = "";
    zoneCoffre.appendChild(creerEl("p", "coffre-vide", "Tes suivis enregistrés ne sont pas accessibles pour l'instant, mais le reste du site fonctionne normalement."));
    return;
  }
  zoneCoffre.innerHTML = "";

  if (index.length === 0) {
    zoneCoffre.appendChild(creerEl("p", "coffre-vide", "Rien d'enregistré pour l'instant — c'est normal, ça reste toujours facultatif."));
  }

  for (const suivi of index) {
    const carte = creerEl("div", "carte-suivi");
    carte.appendChild(creerEl("p", "suivi-resume", suivi.resume));

    if (suivi.echeance) {
      const ech = texteEcheance(suivi.echeance.date);
      const badge = creerEl("span", `suivi-echeance${ech.enRetard ? " en-retard" : ""}`, ech.texte);
      carte.appendChild(badge);
    }

    const actions = creerEl("div", "suivi-actions");

    if (suivi.echeance) {
      const boutonRappel = creerEl("button", "lien-discret", "📅 Rappel calendrier");
      boutonRappel.type = "button";
      boutonRappel.addEventListener("click", () => {
        const demarcheDuSuivi = REGISTRE_DEMARCHES[suivi.demarcheId];
        const contenu = ICS.genererICS({
          dateISO: suivi.echeance.date,
          titre: `${demarcheDuSuivi ? demarcheDuSuivi.titreCourt : suivi.resume} — échéance`,
          description: suivi.echeance.libelle,
        });
        ICS.telecharger("rappel-echeance.ics", contenu);
      });
      actions.appendChild(boutonRappel);
    }

    const boutonReprendre = creerEl("button", "lien-discret", "Voir où j'en suis →");
    boutonReprendre.type = "button";
    boutonReprendre.addEventListener("click", async () => {
      try {
        const suiviComplet = await Coffre.lireSuivi(suivi.id);
        ouvrirQuestionnaire();
        Moteur.reprendre(REGISTRE_DEMARCHES[suivi.demarcheId], racineQuestionnaire, {
          ...suiviComplet,
          id: suivi.id,
        });
      } catch (e) {
        afficherAccueil();
      }
    });
    actions.appendChild(boutonReprendre);

    const boutonOublier = creerEl("button", "lien-discret discret-danger", "Oublier ce suivi");
    boutonOublier.type = "button";
    boutonOublier.addEventListener("click", async () => {
      try {
        await Coffre.oublierSuivi(suivi.id);
      } catch (e) {
        // rien à faire de plus si le stockage est indisponible
      }
      rendreListeSuivis();
    });
    actions.appendChild(boutonOublier);

    carte.appendChild(actions);
    zoneCoffre.appendChild(carte);
  }

  const boutonVerrouiller = creerEl("button", "lien-discret", "Verrouiller mes suivis");
  boutonVerrouiller.type = "button";
  boutonVerrouiller.addEventListener("click", () => {
    Coffre.verrouiller();
    rafraichirZoneCoffre();
  });
  zoneCoffre.appendChild(boutonVerrouiller);
}

function rendreFormulaireDeverrouillage() {
  zoneCoffre.innerHTML = "";
  zoneCoffre.appendChild(creerEl("p", "coffre-titre", "Tu as déjà un suivi enregistré sur cet appareil."));

  const formulaire = creerEl("div", "sauvegarde-form");
  const champMdp = document.createElement("input");
  champMdp.type = "password";
  champMdp.className = "champ-mdp";
  champMdp.placeholder = "Ton mot de passe";
  champMdp.setAttribute("aria-label", "Ton mot de passe");
  formulaire.appendChild(champMdp);

  const messageErreur = creerEl("p", "champ-erreur");
  messageErreur.hidden = true;

  const bouton = creerEl("button", "bouton-secondaire", "Retrouver mes suivis");
  bouton.type = "button";
  champMdp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") bouton.click();
  });
  bouton.addEventListener("click", async () => {
    if (bouton.disabled) return;
    bouton.disabled = true;
    try {
      const ok = await Coffre.deverrouiller(champMdp.value);
      if (!ok) {
        messageErreur.textContent = "Ce mot de passe ne correspond pas.";
        messageErreur.hidden = false;
        return;
      }
      rendreListeSuivis();
    } catch (e) {
      messageErreur.textContent = e.message || "Impossible d'accéder à tes suivis pour le moment.";
      messageErreur.hidden = false;
    } finally {
      bouton.disabled = false;
    }
  });
  formulaire.appendChild(bouton);

  zoneCoffre.appendChild(formulaire);
  zoneCoffre.appendChild(messageErreur);
}

function texteDepuis(momentMs) {
  const minutes = Math.round((Date.now() - momentMs) / 60000);
  if (minutes < 60) return "il y a quelques minutes";
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} heure${heures > 1 ? "s" : ""}`;
  const jours = Math.round(heures / 24);
  return `il y a ${jours} jour${jours > 1 ? "s" : ""}`;
}

// Les deux bandeaux (brouillon et coffre) sont indépendants et peuvent donc
// être visibles ensemble. Empilés, ils prennent une hauteur qui repousse la
// carte hors du premier écran ; côte à côte, cette hauteur se libère. Mais
// les mettre en grille à deux colonnes quand un seul des deux est visible
// laisserait une colonne vide à côté : cette fonction n'active les deux
// colonnes que si les deux bandeaux le sont réellement.
function ajusterMiseEnPageBandeaux() {
  const brouillonVisible = !zoneBrouillon.hidden;
  const coffreVisible = !zoneCoffre.hidden;
  zoneBandeaux.hidden = !brouillonVisible && !coffreVisible;
  zoneBandeaux.classList.toggle("deux-colonnes", brouillonVisible && coffreVisible);
}

function aQuelqueChoseAReprendre() {
  const brouillon = Brouillon.lire();
  const aBrouillon = !!(brouillon && REGISTRE_DEMARCHES[brouillon.demarcheId]);
  return aBrouillon || Coffre.existeCoffre();
}

// Point d'entrée unique de la reprise, replié par défaut : un lien discret
// tant qu'on n'a pas cliqué, invisible s'il n'y a rien à reprendre du tout.
function rafraichirZoneReprise() {
  if (!aQuelqueChoseAReprendre()) {
    repriseDepliee = false;
    lienReprise.hidden = true;
    zoneBandeaux.hidden = true;
    return;
  }
  if (!repriseDepliee) {
    lienReprise.hidden = false;
    zoneBandeaux.hidden = true;
    return;
  }
  lienReprise.hidden = true;
  rafraichirZoneBrouillon();
  rafraichirZoneCoffre();
}

lienReprise.addEventListener("click", () => {
  repriseDepliee = true;
  rafraichirZoneReprise();
});

function rafraichirZoneBrouillon() {
  const brouillon = Brouillon.lire();
  const demarcheDuBrouillon = brouillon && REGISTRE_DEMARCHES[brouillon.demarcheId];
  zoneBrouillon.innerHTML = "";
  if (!brouillon || !demarcheDuBrouillon) {
    zoneBrouillon.hidden = true;
    ajusterMiseEnPageBandeaux();
    return;
  }
  zoneBrouillon.hidden = false;

  zoneBrouillon.appendChild(
    creerEl("p", "brouillon-titre", `Tu avais commencé ${texteDepuis(brouillon.majLe)}.`)
  );
  zoneBrouillon.appendChild(
    creerEl(
      "p",
      "brouillon-texte",
      "On a gardé ta place ici, sur cet appareil — pas besoin de mot de passe pour ça, juste pratique après une interruption."
    )
  );

  const actions = creerEl("div", "brouillon-actions");

  const boutonContinuer = creerEl("button", "bouton-primaire", "Continuer →");
  boutonContinuer.type = "button";
  boutonContinuer.addEventListener("click", () => {
    ouvrirQuestionnaire();
    Moteur.reprendre(demarcheDuBrouillon, racineQuestionnaire, brouillon);
  });
  actions.appendChild(boutonContinuer);

  const boutonEffacer = creerEl("button", "lien-discret discret-danger", "Recommencer à zéro");
  boutonEffacer.type = "button";
  boutonEffacer.addEventListener("click", () => {
    Brouillon.effacer();
    rafraichirZoneReprise();
  });
  actions.appendChild(boutonEffacer);

  zoneBrouillon.appendChild(actions);
  ajusterMiseEnPageBandeaux();
}

function rafraichirZoneCoffre() {
  if (!Coffre.existeCoffre()) {
    zoneCoffre.hidden = true;
    ajusterMiseEnPageBandeaux();
    return;
  }
  zoneCoffre.hidden = false;
  ajusterMiseEnPageBandeaux();
  if (Coffre.estDeverrouille()) {
    rendreListeSuivis();
  } else {
    rendreFormulaireDeverrouillage();
  }
}

window.addEventListener("popstate", (evenement) => {
  if (evenement.state && evenement.state.vue === "questionnaire") {
    afficherQuestionnaire();
  } else {
    afficherAccueil();
  }
});

history.replaceState({ vue: "accueil" }, "");
rendreCarteUnique();
afficherAccueil();
