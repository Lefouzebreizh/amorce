const parcours = {
  "fin-droits": {
    titre: "Tes droits se terminent. On sécurise la suite.",
    intro: "Ne laisse pas la dernière date arriver seule. Commence par vérifier ta situation avec France Travail, puis ouvre les autres pistes qui peuvent correspondre à ton foyer.",
    etapes: [
      ["Vérifie ta date de fin d’indemnisation", "Consulte ton espace France Travail ou contacte ton conseiller pour vérifier ta dernière échéance et les démarches déjà attendues."],
      ["Demande un point sur les aides après la fin de droits", "Les aides possibles dépendent notamment de ta situation et de tes ressources. Demande à France Travail quelles pistes peuvent être étudiées dans ton cas.", "https://www.francetravail.fr/candidat/", "Ouvrir France Travail"],
      ["Regarde les aides liées à ton foyer", "La CAF étudie la composition du foyer, les ressources et la situation complète. Utilise son espace ou son simulateur pour démarrer une demande adaptée.", "https://www.caf.fr/allocataires/", "Vérifier auprès de la CAF"]
    ]
  },
  activite: {
    titre: "Tu lances une activité. Cadre-la avant de courir.",
    intro: "Créer une activité peut s’articuler avec ta recherche d’emploi, mais les choix et les délais comptent. Prépare un rendez-vous avec les bonnes questions plutôt que de deviner.",
    etapes: [
      ["Fais le point avec France Travail", "Explique ton projet, ton calendrier et tes revenus prévus. Demande quelles déclarations et quels accompagnements s’appliquent à ta situation."],
      ["Vérifie les aides à la création", "Les aides et formalités dépendent du statut et de ta situation. Vérifie-les avant de te fier à une simulation.", "https://entreprendre.service-public.fr/", "Ouvrir Entreprendre.Service-Public.fr"],
      ["Garde une trace de tes démarches", "Note les dates, interlocuteurs, pièces demandées et réponses reçues. Une liste simple évite de recommencer la même histoire à chaque appel."]
    ]
  },
  perdu: {
    titre: "Tu n’as pas besoin de tout résoudre aujourd’hui.",
    intro: "On remet de l’ordre dans ce qui presse. L’objectif est de préparer un premier échange utile, pas de te faire naviguer dans dix démarches à la fois.",
    etapes: [
      ["Écris ce qui change maintenant", "Fin de contrat, date de fin de droits, activité en cours, loyer, enfants, santé : quelques mots suffisent pour préparer le bon rendez-vous."],
      ["Choisis un seul interlocuteur de départ", "France Travail pour l’inscription et l’indemnisation ; la CAF pour les aides liées aux ressources et au foyer. Commence par celui qui correspond à l’urgence."],
      ["Prépare trois questions", "Exemple : “Quelle est ma prochaine échéance ?”, “Quelles aides dois-je vérifier ?”, “Quelle pièce manque à mon dossier ?”"]
    ]
  }
};

const section = document.querySelector(".result");
const title = document.querySelector("#result-title");
const intro = document.querySelector("#result-intro");
const steps = document.querySelector("#steps");

function afficherParcours(id) {
  const choix = parcours[id];
  title.textContent = choix.titre;
  intro.textContent = choix.intro;
  steps.replaceChildren(...choix.etapes.map(([titre, texte, lien, libelle]) => {
    const item = document.createElement("li");
    const contenu = document.createElement("div");
    const heading = document.createElement("h3");
    const copy = document.createElement("p");
    heading.textContent = titre;
    copy.textContent = texte;
    contenu.append(heading, copy);
    if (lien) {
      const a = document.createElement("a");
      a.href = lien; a.target = "_blank"; a.rel = "noreferrer"; a.textContent = libelle;
      contenu.append(a);
    }
    item.append(contenu); return item;
  }));
  section.hidden = false;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll("[data-path]").forEach((button) => button.addEventListener("click", () => afficherParcours(button.dataset.path)));
document.querySelector("#reset").addEventListener("click", () => document.querySelector(".chooser").scrollIntoView({ behavior: "smooth", block: "start" }));
