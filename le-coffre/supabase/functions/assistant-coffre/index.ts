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

type Resultat = {
  reponse: string;
  documentsCites: string[];
  ouvrirFormulaire: boolean;
  rechercheWebEffectuee: boolean;
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
    `Ton rôle a trois volets :\n` +
    `1. Retrouver un ou plusieurs papiers dans CETTE liste, jamais en inventer un qui n'y est ` +
    `pas. Mets leur "nom" exact (tel qu'écrit ci-dessus, caractère pour caractère) dans ` +
    `"documentsCites". Liste vide si aucun ne correspond, plutôt que d'en approcher un au hasard.\n` +
    `2. Si l'utilisateur veut remplir, compléter ou signer un document, explique dans "reponse" ` +
    `que l'outil « Remplir un formulaire » du tableau de bord fait ça, et mets ` +
    `"ouvrirFormulaire": true.\n` +
    `3. Pour une vraie question générale (démarche administrative, définition, actualité) qui ` +
    `ne concerne pas directement ses papiers, tu peux chercher sur le web avec l'outil fourni — ` +
    `dis alors clairement dans "reponse" que ça vient d'une recherche web, jamais confondu avec ` +
    `le contenu de ses papiers personnels.\n\n` +
    `Ne devine jamais un fait sur un papier qui n'est pas dans la liste ci-dessus : dans le ` +
    `doute, dis que tu ne le trouves pas plutôt que d'en inventer un.\n` +
    `Réponds toujours en français, court et concret (quelques phrases maximum).\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec exactement ces champs : ` +
    `{"reponse": ta réponse en langage naturel, ` +
    `"documentsCites": [noms exacts trouvés dans la liste, tableau vide si aucun], ` +
    `"ouvrirFormulaire": booléen, ` +
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
    return reponseJson(resultat);
  } catch {
    return reponseJson({ erreur: "Réponse de Claude illisible.", brut: texte.slice(0, 300) }, 502);
  }
});
