// Le seul instant où un document du Coffre est lisible ailleurs que dans le
// navigateur de son propriétaire : cette fonction reçoit le fichier en clair,
// le fait lire par Claude (catégorie, nom, échéance éventuelle), renvoie le
// résultat, et ne conserve rien — aucune écriture disque, aucune trace en
// base. Le fichier lui-même est chiffré côté navigateur juste après, comme
// avant l'ajout de cette fonction. Voir SECURITY.md, section « Ce qui change
// avec le classement automatique ».

const CLE_ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
const MODELE = "claude-sonnet-4-5-20250929";

const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "Administratif", "Impôts", "Santé", "Logement", "Banque", "Assurance",
  "Énergie", "Téléphonie et internet", "Emploi", "Véhicule", "Autre",
];

type Resultat = {
  lisible: boolean;
  categorie: string;
  nomSuggere: string;
  emetteur: string | null;
  referenceClient: string | null;
  montant: string | null;
  texteExtrait: string | null;
  echeance: {
    presente: boolean;
    date: string | null; // AAAA-MM-JJ
    libelle: string | null;
    confiance: "haute" | "moyenne" | "basse";
  };
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

  let corps: { donnees?: string; type?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON attendu : { donnees, type }." }, 400);
  }
  const { donnees, type } = corps;
  if (!donnees || !type) {
    return reponseJson({ erreur: "Champs 'donnees' (base64) et 'type' (MIME) requis." }, 400);
  }

  const estPdf = type === "application/pdf";
  const estImage = type.startsWith("image/");
  if (!estPdf && !estImage) {
    // Un type qu'on ne sait pas montrer à un modèle de vision (ex. .docx,
    // .zip) — on répond une proposition vide plutôt qu'une erreur : le
    // dépôt continue, juste sans suggestion.
    return reponseJson({
      lisible: false, categorie: "", nomSuggere: "", emetteur: null, referenceClient: null, montant: null,
      texteExtrait: null,
      echeance: { presente: false, date: null, libelle: null, confiance: "basse" },
    } satisfies Resultat);
  }

  const blocContenu = estPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: donnees } }
    : { type: "image", source: { type: "base64", media_type: type, data: donnees } };

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const invite =
    `Aujourd'hui : ${aujourdhui}. Voici peut-être un document personnel (papier administratif, ` +
    `facture, courrier...) — ou peut-être une image vide, floue, illisible, ou sans rapport ` +
    `(photo quelconque, page blanche, test). NE JAMAIS INVENTER : si tu ne peux pas lire un vrai ` +
    `contenu de document avec certitude, réponds avec "lisible": false et laisse tous les autres ` +
    `champs vides/faux — une réponse honnête « je ne sais pas » vaut infiniment mieux qu'une ` +
    `suggestion plausible mais fausse, surtout pour une date d'échéance.\n` +
    `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec exactement ces champs :\n` +
    `{"lisible": booléen — vrai seulement si tu identifies avec certitude un vrai document lisible, ` +
    `"categorie": une valeur parmi ${JSON.stringify(CATEGORIES)} si lisible sinon "", ` +
    `"nomSuggere": un nom de fichier court et clair sans extension si lisible sinon "" (ex. "EDF facture juillet"), ` +
    `"emetteur": le nom de l'entreprise ou de l'organisme qui a émis ce document, écrit noir sur blanc, sinon null (jamais deviné à partir du logo ou du sujet), ` +
    `"referenceClient": le numéro de client/contrat/abonné s'il est écrit noir sur blanc, sinon null (jamais un numéro de facture ou une date prise pour une référence), ` +
    `"montant": le montant à payer ou dû, écrit noir sur blanc et recopié tel quel avec sa devise (ex. "89,90 €"), sinon null (jamais additionné, converti ou déduit d'un total partiel), ` +
    `"texteExtrait": jusqu'à 500 caractères du texte réellement lisible sur ce document (objet, noms propres, mots-clés du contenu — pas une reformulation), pour qu'une recherche plus tard le retrouve, sinon null si rien de lisible, ` +
    `"echeance": {"presente": booléen — vrai seulement si CE document contient, noir sur blanc, une date limite, ` +
    `une date de préavis, une échéance de paiement ou de renouvellement, ` +
    `"date": la date au format AAAA-MM-JJ si présente sinon null, ` +
    `"libelle": une courte description de ce qui arrive à cette date si présente sinon null (ex. "Fin du préavis assurance habitation"), ` +
    `"confiance": "haute" seulement si la date est écrite noir sur blanc et que tu l'as lue directement, jamais "haute" si déduite ou incertaine}}\n` +
    `Ne devine jamais une date, un nom, un émetteur, une référence, ou une catégorie : ` +
    `dans le doute sur le document entier, "lisible": false et tout le reste vide/faux ; ` +
    `dans le doute sur un champ précis (émetteur, référence, montant), laisse-le null plutôt que d'inventer.`;

  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLE_ANTHROPIC,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 800, // relevé depuis 500 : texteExtrait peut porter jusqu'à 500 caractères
      temperature: 0, // au plus littéral possible — pas de créativité voulue ici
      messages: [{ role: "user", content: [blocContenu, { type: "text", text: invite }] }],
    }),
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    return reponseJson({ erreur: `Appel Claude en échec (${reponse.status}) : ${detail.slice(0, 300)}` }, 502);
  }

  const donneesReponse = await reponse.json();
  const texte: string = donneesReponse?.content?.[0]?.text ?? "";
  try {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    const resultat = JSON.parse(texte.slice(debut, fin + 1)) as Resultat;
    return reponseJson(resultat);
  } catch {
    return reponseJson({ erreur: "Réponse de Claude illisible.", brut: texte.slice(0, 300) }, 502);
  }
});
