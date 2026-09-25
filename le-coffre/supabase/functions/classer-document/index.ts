// Le seul instant où un document du Coffre est lisible EN ENTIER ailleurs que
// dans le navigateur de son propriétaire : cette fonction reçoit le fichier en
// clair, le fait lire par Gemini (catégorie, nom, échéance éventuelle), renvoie
// le résultat, et ne conserve rien — aucune écriture disque, aucune trace en
// base. Le fichier lui-même est chiffré côté navigateur juste après, comme
// avant l'ajout de cette fonction. Voir SECURITY.md, section « Ce qui change
// avec le classement automatique ».
//
// Assistant-coffre (ajoutée plus tard) ne revoit jamais le fichier — seulement
// un résumé déjà réduit par CETTE fonction (texteExtrait, plafonné à 500
// caractères) — voir SECURITY.md, section « L'assistant conversationnel ».

const CLE_GEMINI = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");
const MODELE = "gemini-2.5-flash";

const ORIGINES_AUTORISEES = new Set([
  "https://coffre-puce.vercel.app",
  "https://coffre-erwannchevallier-6916s-projects.vercel.app",
  "https://coffre-git-main-erwannchevallier-6916s-projects.vercel.app",
]);

const ORIGINE_APERCU_VERCEL = /^https:\/\/coffre-[a-z0-9-]+-erwannchevallier-6916s-projects\.vercel\.app$/;

function origineAutorisee(origin: string | null): boolean {
  return !origin || ORIGINES_AUTORISEES.has(origin) || ORIGINE_APERCU_VERCEL.test(origin);
}

function entetesCors(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && origineAutorisee(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

const CATEGORIES_BASE = [
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

function texteCourt(valeur: unknown, longueur: number): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim().slice(0, longueur);
  return propre || null;
}

function categorieSure(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const propre = valeur.trim().replace(/\s+/g, " ");
  if (!propre || propre.length > 60 || /[\x00-\x1f<>:"\\|?*]/.test(propre) || propre.includes("/")) return null;
  return propre;
}

// La réponse du modèle est une proposition non fiable tant qu'elle n'a pas
// passé cette frontière. Aucun champ libre, catégorie inconnue ou date mal
// formée ne doit atteindre l'index chiffré en étant pris pour une vérité.
function resultatSur(resultat: unknown): Resultat {
  const vide: Resultat = {
    lisible: false, categorie: "", nomSuggere: "", emetteur: null,
    referenceClient: null, montant: null, texteExtrait: null,
    echeance: { presente: false, date: null, libelle: null, confiance: "basse" },
  };
  if (!resultat || typeof resultat !== "object") return vide;
  const brut = resultat as Record<string, unknown>;
  const categorie = categorieSure(brut.categorie);
  if (brut.lisible !== true || !categorie) return vide;
  const nomSuggere = texteCourt(brut.nomSuggere, 120);
  if (!nomSuggere) return vide;
  const echeanceBrute = brut.echeance && typeof brut.echeance === "object"
    ? brut.echeance as Record<string, unknown> : {};
  const date = typeof echeanceBrute.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(echeanceBrute.date)
    ? echeanceBrute.date : null;
  const confiance = ["haute", "moyenne", "basse"].includes(String(echeanceBrute.confiance))
    ? echeanceBrute.confiance as Resultat["echeance"]["confiance"] : "basse";
  const presente = echeanceBrute.presente === true && Boolean(date);
  return {
    lisible: true,
    categorie,
    nomSuggere,
    emetteur: texteCourt(brut.emetteur, 120),
    referenceClient: texteCourt(brut.referenceClient, 120),
    montant: texteCourt(brut.montant, 80),
    texteExtrait: texteCourt(brut.texteExtrait, 500),
    echeance: {
      presente,
      date: presente ? date : null,
      libelle: presente ? texteCourt(echeanceBrute.libelle, 180) : null,
      confiance: presente ? confiance : "basse",
    },
  };
}

function reponseJson(corps: unknown, statut = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...entetesCors(origin), "Content-Type": "application/json" },
  });
}

async function utilisateurAuthentifie(requete: Request): Promise<boolean> {
  const autorisation = requete.headers.get("authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const clePublique = Deno.env.get("SUPABASE_ANON_KEY");
  if (!autorisation?.startsWith("Bearer ") || !url || !clePublique) return false;
  const verification = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: autorisation, apikey: clePublique },
  });
  return verification.ok;
}

Deno.serve(async (requete: Request) => {
  const origin = requete.headers.get("origin");
  if (!origineAutorisee(origin)) {
    return reponseJson({ erreur: "Origine non autorisée." }, 403, origin);
  }
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: entetesCors(origin) });
  }
  if (requete.method !== "POST") {
    return reponseJson({ erreur: "Méthode non autorisée." }, 405, origin);
  }
  if (!(await utilisateurAuthentifie(requete))) {
    return reponseJson({ erreur: "Session utilisateur requise." }, 401, origin);
  }
  if (!CLE_GEMINI) {
    return reponseJson({ erreur: "GEMINI_API_KEY absente côté serveur." }, 500, origin);
  }

  let corps: {
    donnees?: string;
    type?: string;
    cheminRelatif?: string;
    categoriesExistantes?: string[];
  };
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON attendu : { donnees, type }." }, 400, origin);
  }
  const { donnees, type, cheminRelatif, categoriesExistantes } = corps;
  if (!donnees || !type) {
    return reponseJson({ erreur: "Champs 'donnees' (base64) et 'type' (MIME) requis." }, 400, origin);
  }

  const estPdf = type === "application/pdf";
  const estImage = type.startsWith("image/");
  const estTexte = type.startsWith("text/") || ["application/json", "application/rtf", "application/xml"].includes(type);
  if (!estPdf && !estImage && !estTexte) {
    // Un type que Gemini ne sait pas lire directement ici (ex. .docx, .zip)
    // revient vers « À vérifier » côté client, sans bloquer le reste du lot.
    return reponseJson({
      lisible: false, categorie: "", nomSuggere: "", emetteur: null, referenceClient: null, montant: null,
      texteExtrait: null,
      echeance: { presente: false, date: null, libelle: null, confiance: "basse" },
    } satisfies Resultat, 200, origin);
  }

  const blocContenu = { inlineData: { mimeType: type, data: donnees } };
  const categoriesConnues = Array.from(new Set([
    ...CATEGORIES_BASE,
    ...(Array.isArray(categoriesExistantes) ? categoriesExistantes : []),
  ].map(categorieSure).filter((c): c is string => Boolean(c)))).slice(0, 120);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const invite =
    `Aujourd'hui : ${aujourdhui}. Voici peut-être un document personnel (papier administratif, ` +
    `facture, courrier...) — ou peut-être une image vide, floue, illisible, ou sans rapport ` +
    `(photo quelconque, page blanche, test). NE JAMAIS INVENTER : si tu ne peux pas lire un vrai ` +
    `contenu de document avec certitude, réponds avec "lisible": false et laisse tous les autres ` +
    `champs vides/faux — une réponse honnête « je ne sais pas » vaut infiniment mieux qu'une ` +
    `suggestion plausible mais fausse, surtout pour une date d'échéance.\n` +
    `Le fichier vient du chemin relatif ${JSON.stringify(texteCourt(cheminRelatif, 240) ?? "inconnu")}. ` +
    `Ce chemin est un indice faible : le contenu réel du document décide toujours.\n` +
    `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec exactement ces champs :\n` +
    `{"lisible": booléen — vrai seulement si tu identifies avec certitude un vrai document lisible, ` +
    `"categorie": choisis en priorité une catégorie cohérente parmi ${JSON.stringify(categoriesConnues)}. ` +
    `Si aucune ne convient, crée un nouveau nom de dossier court, stable et descriptif (un à trois mots, ` +
    `60 caractères maximum), sans barre oblique ni ponctuation de chemin. La catégorie est choisie sur ` +
    `l'objet réel du document, jamais sur son apparence (une facture n'est pas ` +
    `automatiquement "Administratif"), en suivant ces frontières précises : ` +
    `Administratif = identité et démarches personnelles non couvertes ailleurs (CNI, passeport, ` +
    `livret de famille, état civil, casier judiciaire) ; ` +
    `Impôts = avis d'imposition, déclarations fiscales, taxe foncière ou d'habitation ; ` +
    `Santé = sécurité sociale, mutuelle, ordonnances, factures et remboursements médicaux ; ` +
    `Logement = loyer, quittance, charges de copropriété, diagnostics du logement — jamais son ` +
    `assurance, qui va dans Assurance ; ` +
    `Banque = relevés de compte, crédits, épargne, contrats bancaires ; ` +
    `Assurance = tout contrat ou attestation d'assurance quel qu'en soit le sujet (habitation, ` +
    `auto, responsabilité civile), sauf la mutuelle santé elle-même qui reste dans Santé ; ` +
    `Énergie = électricité, gaz, eau ; ` +
    `Téléphonie et internet = forfait mobile, box internet ; ` +
    `Emploi = contrat de travail, bulletin de salaire, formation professionnelle, démarches ` +
    `France Travail — jamais un document qui concerne d'abord un véhicule ; ` +
    `Véhicule = tout ce qui touche directement à un véhicule, y compris professionnel — carte ` +
    `grise, permis de conduire, contrôle technique, facture de garage, amende, carte de ` +
    `conducteur ; ` +
    `Autre = rien de tout ça mais un vrai document lisible. ` +
    `Dans le doute entre deux catégories proches, choisir la plus spécifique (ex. Véhicule ` +
    `plutôt qu'Emploi pour une carte de conducteur professionnelle), ` +
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

  const reponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent`,
    {
    method: "POST",
    headers: {
      "x-goog-api-key": CLE_GEMINI,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [blocContenu, { text: invite }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1600,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  // Le statut est journalisé sans contenu personnel ni clé. Les quotas Gemini
  // se consultent côté projet Google et ne sont pas exposés par ces en-têtes.
  console.log("[classer-document] appel Gemini :", JSON.stringify({
    statut: reponse.status,
  }));

  if (!reponse.ok) {
    const detail = await reponse.text();
    return reponseJson({ erreur: `Appel Gemini en échec (${reponse.status}) : ${detail.slice(0, 300)}` }, 502, origin);
  }

  const donneesReponse = await reponse.json();
  const parties: Array<{ text?: string }> = donneesReponse?.candidates?.[0]?.content?.parts ?? [];
  const texte = parties.map((partie) => partie.text ?? "").join("\n");
  try {
    const debut = texte.indexOf("{");
    const fin = texte.lastIndexOf("}");
    const resultat = resultatSur(JSON.parse(texte.slice(debut, fin + 1)));
    return reponseJson(resultat, 200, origin);
  } catch {
    return reponseJson({ erreur: "Réponse de Gemini illisible.", brut: texte.slice(0, 300) }, 502, origin);
  }
});
