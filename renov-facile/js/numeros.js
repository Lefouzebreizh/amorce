// Numéros utiles — brique additive, indépendante de la démarche. Accessible
// depuis le bouton dans l'en-tête, présent sur toutes les pages (accueil et
// questionnaire). Contenu vérifié auprès de sources officielles
// (france-renov.gouv.fr, maprimerenov.gouv.fr, defenseurdesdroits.fr) plutôt
// qu'inventé. Mécanique de modale portée telle quelle depuis
// Lefouzebreizh/ensemble-mdph (dépôt séparé) — générique, elle ne connaît
// aucun contenu propre à ce site.
(() => {
  function creerEl(tag, classe, contenu) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (contenu !== undefined) el.textContent = contenu;
    return el;
  }

  const bouton = document.getElementById("lien-numeros");
  if (!bouton) return;

  const fond = creerEl("div", "numeros-fond");
  fond.hidden = true;

  const modale = creerEl("div", "numeros-modale");
  modale.setAttribute("role", "dialog");
  modale.setAttribute("aria-modal", "true");
  modale.setAttribute("aria-label", "Numéros utiles");

  const entete = creerEl("div", "numeros-entete");
  entete.appendChild(creerEl("span", "numeros-titre", "Numéros utiles"));
  const boutonFermer = creerEl("button", "numeros-fermer", "✕");
  boutonFermer.type = "button";
  boutonFermer.setAttribute("aria-label", "Fermer");
  entete.appendChild(boutonFermer);
  modale.appendChild(entete);

  modale.appendChild(
    creerEl(
      "p",
      "numeros-intro",
      "Des contacts gratuits, indépendants de ce site, si tu as besoin d'aller plus loin ou de parler à quelqu'un."
    )
  );

  const SECTIONS = [
    {
      titre: "Se faire conseiller gratuitement sur son projet",
      lignes: [
        "France Rénov' — les espaces conseil sont gratuits et neutres, en présentiel ou par téléphone.",
      ],
      lien: { texte: "france-renov.gouv.fr", url: "https://france-renov.gouv.fr" },
    },
    {
      titre: "Suivre ou relancer un dossier MaPrimeRénov'",
      lignes: [
        "0 808 800 700 — numéro sans surcoût, du lundi au vendredi de 9h à 18h.",
        "Le formulaire de contact officiel, à utiliser en citant la référence de ton dossier.",
      ],
      lien: { texte: "maprimerenov.gouv.fr", url: "https://www.maprimerenov.gouv.fr" },
    },
    {
      titre: "Vérifier qu'un artisan est bien RGE",
      lignes: [
        "L'annuaire officiel des artisans labellisés — à consulter avant de signer le moindre devis.",
      ],
      lien: { texte: "france-renov.gouv.fr/artisan-rge", url: "https://france-renov.gouv.fr/artisan-rge" },
    },
    {
      titre: "En dernier recours administratif",
      lignes: [
        "Le Défenseur des Droits peut être saisi gratuitement si rien n'a abouti après un refus ou un blocage prolongé.",
      ],
      lien: { texte: "defenseurdesdroits.fr", url: "https://www.defenseurdesdroits.fr" },
    },
  ];

  for (const section of SECTIONS) {
    const bloc = creerEl("div", "numeros-section");
    bloc.appendChild(creerEl("p", "numeros-section-titre", section.titre));
    for (const ligne of section.lignes) {
      bloc.appendChild(creerEl("p", "numeros-ligne", ligne));
    }
    const liens = section.liens || (section.lien ? [section.lien] : []);
    if (liens.length > 0) {
      const zoneLiens = creerEl("p", "numeros-liens");
      liens.forEach((lien, index) => {
        const a = document.createElement("a");
        a.href = lien.url;
        a.textContent = lien.texte;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        zoneLiens.appendChild(a);
        if (index < liens.length - 1) zoneLiens.appendChild(document.createTextNode(" · "));
      });
      bloc.appendChild(zoneLiens);
    }
    modale.appendChild(bloc);
  }

  modale.appendChild(
    creerEl(
      "p",
      "numeros-avertissement",
      "Coordonnées vérifiées auprès de sources officielles au moment de la rédaction — vérifie l'information si tu as un doute, ces choses changent."
    )
  );

  fond.appendChild(modale);
  document.body.appendChild(fond);

  function afficher() {
    fond.hidden = false;
  }

  function fermer() {
    fond.hidden = true;
  }

  function ouvrir() {
    history.pushState({ vue: "numeros" }, "");
    afficher();
  }

  function demanderFermeture() {
    if (history.state && history.state.vue === "numeros") {
      history.back();
    } else {
      fermer();
    }
  }

  bouton.addEventListener("click", ouvrir);
  boutonFermer.addEventListener("click", demanderFermeture);
  fond.addEventListener("click", (e) => {
    if (e.target === fond) demanderFermeture();
  });

  window.addEventListener("popstate", (evenement) => {
    if (!fond.hidden && (!evenement.state || evenement.state.vue !== "numeros")) {
      fermer();
    }
  });
})();
