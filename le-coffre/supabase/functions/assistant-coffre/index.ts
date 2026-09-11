// L'assistant du Tiroir Secret : répond en langage naturel aux questions sur
// les papiers déjà déposés. Reçoit un RÉSUMÉ des documents (nom, catégorie,
// émetteur, montant, échéance, jusqu'à 200 caractères de texte extrait —
// voir digestIndex dans src/lib/coffre.ts), jamais un fichier ni son contenu
// intégral. Peut aussi chercher sur le web (outil hébergé de Claude) pour une
// question qui déborde de la paperasse personnelle. Ne conserve rien —
// mêmes garanties que classer-document, voir SECURITY.md.

const CLE_ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
const MODELE = "claude-sonnet-4-5-20250929";
// Un plafond bas : chaque recherche web a un coût, et la plupart des
// questions n'en demandent aucune — mieux vaut que Claude en manque une que
// d'en déclencher dix pour une seule question mal comprise.
const RECHERCHES_WEB_MAX = 3;

const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tour = { role: "user" | "assistant"; texte: string };

type DigestDocument = {
  nom: string;
  categorie: string;
  type: string;
  emetteur?: string;
  montant?: string | null;
  echeanceLibelle?: string | null;
  echeanceDate?: string | null;
  extrait?: string | null;
};

type ActionProposee =
  | { type: "classer"; nom: string; categorie: string }
  | { type: "supprimer"; nom: string };

// Même liste que recuperer-formulaire-cerfa — dupliquée plutôt que partagée,
// les fonctions Supabase n'importent pas de module commun entre elles. Sert
// ici de premier filtre, avant que le client n'appelle cette autre fonction,
// qui revérifie de toute façon : deux couches valent mieux qu'une seule sur
// un champ qui déclenche un fetch serveur vers une adresse trouvée par le
// modèle.
const DOMAINES_FORMULAIRES_AUTORISES = [
  "service-public.fr", "gouv.fr", "caf.fr", "ameli.fr", "urssaf.fr",
  "francetravail.fr", "pole-emploi.fr", "msa.fr",
];

function urlFormulaireValide(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const hote = u.hostname.toLowerCase();
    return DOMAINES_FORMULAIRES_AUTORISES.some((d) => hote === d || hote.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

type Resultat = {
  reponse: string;
  documentsCites: string[];
  ouvrirFormulaire: boolean;
  ouvrirRangement: boolean;
  // Un seul bot (10/09/2026) : le tri en lot ne renvoie plus vers un bouton
  // séparé du tableau de bord, il se déclenche depuis la conversation même —
  // voir point 3 du système ci-dessous et trierAutomatiquement() côté client.
  declencherTriAutomatique: boolean;
  rechercheWebEffectuee: boolean;
  actions: ActionProposee[];
  // Trouvé par recherche web (voir point 2) : le nom de la démarche et
  // l'adresse exacte du PDF officiel — jamais rempli côté serveur, voir
  // recuperer-formulaire-cerfa et suggerer-champs-formulaire, appelées par
  // le client seulement après confirmation de l'utilisateur.
  formulaireCerfa: { demarche: string; url: string } | null;
};

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: ENTETES_CORS });
  }
  if (!CLE_ANTHROPIC) {
    return reponseJson({ erreur: "ANTHROPIC_API_KEY absente côté serveur." }, 500);
  }

  let corps: { question?: string; historique?: Tour[]; documents?: DigestDocument[] };
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON attendu : { question, historique, documents }." }, 400);
  }
  const { question, historique, documents } = corps;
  if (!question || typeof question !== "string" || !question.trim()) {
    return reponseJson({ erreur: "Champ 'question' (texte non vide) requis." }, 400);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const systeme =
    `Tu es l'assistant du Tiroir Secret, un coffre-fort numérique de papiers personnels. ` +
    `Aujourd'hui : ${aujourdhui}.\n\n` +
    `Voici la liste des papiers déjà déposés par cet utilisateur, en JSON — jamais le contenu ` +
    `des fichiers eux-mêmes, seulement ce résumé :\n${JSON.stringify(documents ?? [])}\n\n` +
    `Ton rôle a six volets :\n` +
    `1. Retrouver un ou plusieurs papiers dans CETTE liste, jamais en inventer un qui n'y est ` +
    `pas. Mets leur "nom" exact (tel qu'écrit ci-dessus, caractère pour caractère) dans ` +
    `"documentsCites". Liste vide si aucun ne correspond, plutôt que d'en approcher un au hasard.\n` +
    `2. Si l'utilisateur nomme une démarche administrative précise pour laquelle il existe un ` +
    `CERFA ou un formulaire officiel (carte grise, changement d'adresse, demande de passeport, ` +
    `déclaration de perte, etc.), cherche sur le web l'adresse EXACTE du PDF officiel — priorité ` +
    `absolue à service-public.fr et aux sites en .gouv.fr, jamais un site tiers, un comparateur ou ` +
    `un blog qui republie le formulaire. Si tu trouves une adresse fiable qui se termine par un ` +
    `vrai fichier PDF, mets-la dans "formulaireCerfa": {"demarche": "...", "url": "..."} et dis ` +
    `dans "reponse" que tu l'as trouvé et proposes de le préparer déjà rempli avec ce que ses ` +
    `papiers permettent — jamais une simple question du genre « veux-tu que je... ». Si tu ne ` +
    `trouves rien de fiable, dis-le et retombe sur le point 3.\n` +
    `3. Si l'utilisateur veut remplir, compléter ou signer un document dont il a déjà le PDF vierge, ` +
    `ou si le point 2 n'a rien trouvé de fiable, explique dans "reponse" que l'outil « Remplir un ` +
    `formulaire » du tableau de bord fait ça, et mets "ouvrirFormulaire": true.\n` +
    `4. Si l'utilisateur veut ranger, classer ou trier TOUS ses papiers ou un lot indéterminé ` +
    `(« range tout », « trie mes papiers »), dis dans "reponse" que tu t'en occupes maintenant ` +
    `(jamais une question du genre « veux-tu que je... » — ça part automatiquement, sans clic) ` +
    `et mets "declencherTriAutomatique": true — ne propose aucune action précise dans ce cas, ` +
    `ce tri en lot traite tous les papiers non classés bien mieux qu'une action par document.\n` +
    `5. Si l'utilisateur désigne un ou plusieurs documents PRÉCIS (nommés ou clairement identifiables ` +
    `dans la liste) et demande de les classer dans une catégorie — existante ou nouvelle, ce qui ` +
    `revient à créer un dossier, un dossier n'étant qu'une catégorie partagée par des documents — ` +
    `ou de les supprimer, propose une ou plusieurs entrées dans "actions" plutôt que de renvoyer ` +
    `vers un outil : {"type": "classer", "nom": "...", "categorie": "..."} ou ` +
    `{"type": "supprimer", "nom": "..."}. "nom" doit toujours être un nom EXACT de la liste ` +
    `ci-dessus, jamais inventé ni approché. Dis dans "reponse" ce que tu proposes, en clair — ` +
    `l'action ne s'exécute qu'après confirmation de l'utilisateur, jamais toute seule.\n` +
    `6. Pour une vraie question générale (définition, actualité, calcul, culture générale...) qui ` +
    `ne concerne pas directement ses papiers, tu peux chercher sur le web avec l'outil fourni — ` +
    `dis alors clairement dans "reponse" que ça vient d'une recherche web, jamais confondu avec ` +
    `le contenu de ses papiers personnels.\n\n` +
    `Ne devine jamais un fait sur un papier qui n'est pas dans la liste ci-dessus : dans le ` +
    `doute, dis que tu ne le trouves pas plutôt que d'en inventer un.\n` +
    `Réponds toujours en français, court et concret (quelques phrases maximum), en texte ` +
    `naturel uniquement : jamais de balise comme <cite> ou de crochet de note ([1], [2]…), ` +
    `même après une recherche web — nomme la source dans la phrase si besoin.\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec exactement ces champs : ` +
    `{"reponse": ta réponse en langage naturel, ` +
    `"documentsCites": [noms exacts trouvés dans la liste, tableau vide si aucun], ` +
    `"ouvrirFormulaire": booléen, ` +
    `"ouvrirRangement": booléen (toujours faux désormais, conservé pour compatibilité), ` +
    `"declencherTriAutomatique": booléen, ` +
    `"actions": [actions précises proposées comme au point 5, tableau vide si aucune], ` +
    `"formulaireCerfa": {"demarche": "...", "url": "..."} comme au point 2, ou null si aucun formulaire trouvé, ` +
    `"rechercheWebEffectuee": vrai seulement si tu as réellement utilisé l'outil de recherche ` +
    `web pour cette réponse précise}.`;

  const messages = [
    ...(Array.isArray(historique) ? historique : []).map((tour) => ({
      role: tour.role,
      content: tour.texte,
    })),
    { role: "user", content: question },
  ];

  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLE_ANTHROPIC,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 1024,
      temperature: 0,
      system: systeme,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: RECHERCHES_WEB_MAX }],
      messages,
    }),
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    return reponseJson({ erreur: `Appel Claude en échec (${reponse.status}) : ${detail.slice(0, 300)}` }, 502);
  }

  const donneesReponse = await reponse.json();
  const blocs: Array<{ type: string; text?: string }> = donneesReponse?.content ?? [];
  const rechercheWebEffectuee = blocs.some(
    (b) => b.type === "server_tool_use" || b.type === "web_search_tool_result",
  );
  // La réponse finale (le JSON attendu) suit toujours les blocs d'outil quand
  // il y en a — jamais le premier bloc texte, qui peut n'être qu'un
  // raisonnement intermédiaire avant la recherche web.
  const blocsTexte = blocs.filter((b): b is { type: string; text: string } => b.type === "text" && Boolean(b.text));
  const texte = blocsTexte.length > 0 ? blocsTexte[blocsTexte.length - 1].text : "";

  try {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    const resultat = JSON.parse(texte.slice(debut, fin + 1)) as Resultat;
    resultat.rechercheWebEffectuee = Boolean(resultat.rechercheWebEffectuee) || rechercheWebEffectuee;
    if (!Array.isArray(resultat.documentsCites)) resultat.documentsCites = [];
    resultat.ouvrirRangement = Boolean(resultat.ouvrirRangement);
    resultat.declencherTriAutomatique = Boolean(resultat.declencherTriAutomatique);
    // Filet défensif sur les actions, la partie la plus sensible de la
    // réponse : jamais une action sur un nom que la liste envoyée ne porte
    // pas, jamais un type inconnu, jamais une catégorie vide pour un
    // classement — la consigne dit déjà de ne rien inventer, ceci vérifie
    // que c'est vrai plutôt que de le supposer.
    const nomsConnus = new Set((documents ?? []).map((d) => d.nom));
    resultat.actions = (Array.isArray(resultat.actions) ? resultat.actions : []).filter(
      (a): a is ActionProposee => {
        if (!a || typeof a !== "object" || !("type" in a) || !("nom" in a)) return false;
        if (typeof a.nom !== "string" || !nomsConnus.has(a.nom)) return false;
        if (a.type === "supprimer") return true;
        if (a.type === "classer") return "categorie" in a && typeof a.categorie === "string" && a.categorie.trim() !== "";
        return false;
      },
    );
    // Filet défensif : le modèle a déjà écrit du balisage de citation
    // (<cite index="...">...</cite>) en clair malgré la consigne ci-dessus —
    // on retire les balises sans perdre le texte qu'elles entourent.
    // Filet défensif sur formulaireCerfa : jamais une adresse hors de la
    // liste des sites officiels, jamais une démarche vide — c'est ce champ
    // qui déclenche ensuite un fetch serveur (recuperer-formulaire-cerfa),
    // donc la même règle qu'une action : on vérifie, on ne suppose pas.
    if (
      !resultat.formulaireCerfa
      || typeof resultat.formulaireCerfa !== "object"
      || typeof resultat.formulaireCerfa.demarche !== "string"
      || !resultat.formulaireCerfa.demarche.trim()
      || !urlFormulaireValide(resultat.formulaireCerfa.url)
    ) {
      resultat.formulaireCerfa = null;
    }
    if (typeof resultat.reponse === "string") {
      resultat.reponse = resultat.reponse.replace(/<\/?[a-z][^>]*>/gi, "");
    }
    return reponseJson(resultat);
  } catch {
    return reponseJson({ erreur: "Réponse de Claude illisible.", brut: texte.slice(0, 300) }, 502);
  }
});
