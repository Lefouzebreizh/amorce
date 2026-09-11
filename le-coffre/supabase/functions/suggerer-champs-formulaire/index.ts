// Propose une valeur pour chaque champ d'un formulaire (CERFA ou autre),
// à partir du résumé des papiers déjà déposés et de l'identité — jamais du
// contenu réel des fichiers, qui ne quitte le navigateur qu'au moment du
// classement (voir classer-document et SECURITY.md, section « L'assistant »).
// Complète, sans le remplacer, le rapprochement par nom de champ que fait
// déjà src/lib/formulaire.ts pour l'identité (nom, adresse...) : ici, c'est
// une correspondance sémantique large (« numéro de sécurité sociale »,
// « immatriculation »...) contre ce que les documents portent réellement.
// Une suggestion reste une suggestion — jamais écrite dans le PDF sans que
// l'utilisateur la voie et la valide dans l'écran de remplissage.

const CLE_ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
const MODELE = "claude-sonnet-4-5-20250929";

const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DigestDocument = {
  nom: string; categorie: string; type: string; emetteur?: string; montant?: string | null;
  echeanceLibelle?: string | null; echeanceDate?: string | null; extrait?: string | null;
};

type Identite = { nom: string; adresse: string; codePostal: string; ville: string };

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

  let corps: { champs?: string[]; documents?: DigestDocument[]; identite?: Identite; demarche?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON attendu : { champs, documents, identite?, demarche? }." }, 400);
  }
  const { champs, documents, identite, demarche } = corps;
  if (!Array.isArray(champs) || champs.length === 0) {
    return reponseJson({ erreur: "Champ 'champs' (tableau de noms non vide) requis." }, 400);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const invite =
    `Aujourd'hui : ${aujourdhui}. Voici un formulaire administratif${demarche ? ` pour la démarche « ${demarche} »` : ""} ` +
    `à préparer pour un utilisateur du Tiroir Secret, un coffre-fort de papiers personnels.\n\n` +
    `Ses papiers déjà déposés, en résumé (jamais leur contenu intégral) :\n${JSON.stringify(documents ?? [])}\n\n` +
    `Son identité connue : ${JSON.stringify(identite ?? null)}\n\n` +
    `Voici les noms des champs du formulaire, tels qu'ils existent dans le PDF (souvent techniques ou peu ` +
    `lisibles) :\n${JSON.stringify(champs)}\n\n` +
    `Pour chaque champ, propose une valeur SEULEMENT si tu la déduis avec confiance d'un papier ou de ` +
    `l'identité ci-dessus — jamais devinée, jamais calculée à partir de suppositions. Un champ qui ` +
    `ressemble à une date de naissance, un numéro de sécurité sociale, une immatriculation, une ` +
    `référence client, etc. ne se remplit que si cette information précise est écrite noir sur blanc ` +
    `dans un des papiers. Dans le doute, ne propose rien pour ce champ plutôt que d'inventer — l'utilisateur ` +
    `verra et complétera lui-même le reste avant de générer le PDF.\n\n` +
    `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec exactement ce champ :\n` +
    `{"valeurs": {"<nom exact du champ>": "<valeur trouvée, texte court>", ...}} — n'inclus que les champs ` +
    `pour lesquels tu as une valeur sûre, omets tous les autres plutôt que d'y mettre une chaîne vide.`;

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
      messages: [{ role: "user", content: invite }],
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
    const resultat = JSON.parse(texte.slice(debut, fin + 1)) as { valeurs?: Record<string, string> };
    const valeursBrutes = resultat.valeurs && typeof resultat.valeurs === "object" ? resultat.valeurs : {};
    // Filet défensif : jamais une clé hors de la liste des champs réellement
    // présents dans le PDF, jamais une valeur qui ne serait pas du texte.
    const nomsConnus = new Set(champs);
    const valeurs: Record<string, string> = {};
    for (const [nom, valeur] of Object.entries(valeursBrutes)) {
      if (nomsConnus.has(nom) && typeof valeur === "string" && valeur.trim()) valeurs[nom] = valeur;
    }
    return reponseJson({ valeurs });
  } catch {
    return reponseJson({ erreur: "Réponse de Claude illisible.", brut: texte.slice(0, 300) }, 502);
  }
});
