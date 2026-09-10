// Récupère un formulaire CERFA officiel dont l'assistant a trouvé l'adresse
// par recherche web (voir assistant-coffre, champ "formulaireCerfa") — le
// navigateur ne peut pas le télécharger lui-même : la plupart des sites
// publics n'envoient pas d'en-tête CORS permissif sur leurs PDF, et laisser
// le client demander une URL arbitraire à ce serveur ouvrirait un relais
// (SSRF). Deux garde-fous avant tout fetch : le domaine doit appartenir à
// la liste des sites officiels ci-dessous, et le contenu reçu doit
// commencer par la signature d'un vrai PDF (%PDF). Ne conserve rien —
// mêmes garanties que classer-document, voir SECURITY.md.

const ENTETES_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Domaines officiels français qui publient des CERFA et formulaires
// administratifs — jamais un domaine arbitraire, même suggéré par le
// modèle : c'est ce qui empêche ce point d'entrée de devenir un relais vers
// n'importe quelle adresse.
const DOMAINES_AUTORISES = [
  "service-public.fr",
  "gouv.fr",
  "caf.fr",
  "ameli.fr",
  "urssaf.fr",
  "francetravail.fr",
  "pole-emploi.fr",
  "msa.fr",
];

const TAILLE_MAX_OCTETS = 15 * 1024 * 1024; // 15 Mo — un CERFA ne dépasse jamais ça

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, "Content-Type": "application/json" },
  });
}

function hoteAutorise(url: URL): boolean {
  const hote = url.hostname.toLowerCase();
  return DOMAINES_AUTORISES.some((domaine) => hote === domaine || hote.endsWith(`.${domaine}`));
}

function b64FromBuf(buf: ArrayBuffer): string {
  const octets = new Uint8Array(buf);
  const TAILLE_BLOC = 32768;
  let binaire = "";
  for (let i = 0; i < octets.length; i += TAILLE_BLOC) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TAILLE_BLOC));
  }
  return btoa(binaire);
}

Deno.serve(async (requete: Request) => {
  if (requete.method === "OPTIONS") {
    return new Response("ok", { headers: ENTETES_CORS });
  }

  let corps: { url?: string };
  try {
    corps = await requete.json();
  } catch {
    return reponseJson({ erreur: "Corps JSON attendu : { url }." }, 400);
  }
  const { url } = corps;
  if (!url || typeof url !== "string") {
    return reponseJson({ erreur: "Champ 'url' requis." }, 400);
  }

  let cible: URL;
  try {
    cible = new URL(url);
  } catch {
    return reponseJson({ erreur: "Adresse invalide." }, 400);
  }
  if (cible.protocol !== "https:") {
    return reponseJson({ erreur: "Seules les adresses https sont acceptées." }, 400);
  }
  if (!hoteAutorise(cible)) {
    return reponseJson({
      erreur: `Ce domaine (${cible.hostname}) n'est pas un site officiel reconnu — le formulaire doit être déposé à la main.`,
    }, 400);
  }

  let reponse: Response;
  try {
    reponse = await fetch(cible.toString(), {
      headers: { "User-Agent": "Mon-Tiroir-Secret/1.0 (recherche de formulaire CERFA)" },
      redirect: "follow",
    });
  } catch (err) {
    return reponseJson({ erreur: `Impossible de joindre ce site : ${err instanceof Error ? err.message : String(err)}` }, 502);
  }
  if (!reponse.ok) {
    return reponseJson({ erreur: `Le site a répondu ${reponse.status} — le formulaire doit être déposé à la main.` }, 502);
  }

  const buf = await reponse.arrayBuffer();
  if (buf.byteLength === 0) {
    return reponseJson({ erreur: "Réponse vide." }, 502);
  }
  if (buf.byteLength > TAILLE_MAX_OCTETS) {
    return reponseJson({ erreur: "Le fichier dépasse la taille attendue pour un CERFA." }, 502);
  }
  // Signature PDF (%PDF) plutôt que le seul en-tête Content-Type, que
  // certains sites publics renseignent mal (octet-stream, texte...).
  const debut = new Uint8Array(buf.slice(0, 5));
  const signature = String.fromCharCode(...debut);
  if (!signature.startsWith("%PDF")) {
    return reponseJson({ erreur: "Le fichier trouvé n'est pas un vrai PDF." }, 502);
  }

  return reponseJson({ donnees: b64FromBuf(buf), type: "application/pdf" });
});
