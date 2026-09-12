// Coffre local chiffré, générique pour toute démarche de la plateforme.
// Même principe cryptographique que le module coffre de life-organizer
// (PBKDF2 600 000 itérations -> AES-GCM 256, jamais de clé en clair stockée),
// adapté à un site 100% client : localStorage tient lieu de disque, il n'y a
// pas de serveur donc pas de séparation "le serveur ne voit que des octets" —
// mais la clé, elle, ne quitte jamais la mémoire de l'onglet.
const Coffre = (() => {
  const CLES_STOCKAGE = {
    sel: "coffre.sel",
    verificateur: "coffre.verificateur",
    index: "coffre.index",
    prefixeObjet: "coffre.objet.",
  };
  const TEXTE_VERIF = { v: 1, marqueur: "ouvert" };
  const ITERATIONS_PBKDF2 = 600000;

  let cle = null;

  function lireLS(cleStockage) {
    try {
      return localStorage.getItem(cleStockage);
    } catch (e) {
      return null;
    }
  }

  function ecrireLS(cleStockage, valeur) {
    try {
      localStorage.setItem(cleStockage, valeur);
    } catch (e) {
      throw new Error("Le stockage local n'est pas disponible sur ce navigateur (navigation privée, quota dépassé...).");
    }
  }

  function supprimerLS(cleStockage) {
    try {
      localStorage.removeItem(cleStockage);
    } catch (e) {
      // rien à faire si le stockage est déjà indisponible
    }
  }

  function verifierChiffrementDisponible() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Le chiffrement n'est pas disponible sur cette connexion (il faut consulter le site en HTTPS).");
    }
  }

  function octetsVersB64(octets) {
    return btoa(String.fromCharCode(...new Uint8Array(octets)));
  }

  function b64VersOctets(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  function idOpaque() {
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(octets).map((o) => o.toString(16).padStart(2, "0")).join("");
  }

  async function deriverCle(motDePasse, sel) {
    const materiau = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(motDePasse),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: sel, iterations: ITERATIONS_PBKDF2, hash: "SHA-256" },
      materiau,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function chiffrer(objet) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const donnees = new TextEncoder().encode(JSON.stringify(objet));
    const chiffre = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, donnees);
    return `${octetsVersB64(iv)}.${octetsVersB64(chiffre)}`;
  }

  async function dechiffrer(paquet) {
    const [ivB64, donneesB64] = paquet.split(".");
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64VersOctets(ivB64) },
      cle,
      b64VersOctets(donneesB64)
    );
    return JSON.parse(new TextDecoder().decode(clair));
  }

  function existeCoffre() {
    return lireLS(CLES_STOCKAGE.sel) !== null;
  }

  function estDeverrouille() {
    return cle !== null;
  }

  function verrouiller() {
    cle = null;
  }

  async function creerCoffre(motDePasse) {
    verifierChiffrementDisponible();
    const sel = crypto.getRandomValues(new Uint8Array(16));
    cle = await deriverCle(motDePasse, sel);
    ecrireLS(CLES_STOCKAGE.sel, octetsVersB64(sel));
    ecrireLS(CLES_STOCKAGE.verificateur, await chiffrer(TEXTE_VERIF));
    ecrireLS(CLES_STOCKAGE.index, await chiffrer([]));
  }

  async function deverrouiller(motDePasse) {
    verifierChiffrementDisponible();
    const selB64 = lireLS(CLES_STOCKAGE.sel);
    if (!selB64) return false;
    const sel = b64VersOctets(selB64);
    const cleCandidate = cle;
    cle = await deriverCle(motDePasse, sel);
    try {
      await dechiffrer(lireLS(CLES_STOCKAGE.verificateur));
      return true;
    } catch (e) {
      cle = cleCandidate;
      return false;
    }
  }

  async function lireIndex() {
    return dechiffrer(lireLS(CLES_STOCKAGE.index));
  }

  async function ecrireIndex(index) {
    ecrireLS(CLES_STOCKAGE.index, await chiffrer(index));
  }

  async function enregistrerSuivi({ demarcheId, etapeId, reponses, historique, echeance, resume }) {
    const id = idOpaque();
    const objet = { demarcheId, etapeId, reponses, historique: historique || [], echeance, creeLe: new Date().toISOString() };
    ecrireLS(CLES_STOCKAGE.prefixeObjet + id, await chiffrer(objet));

    const index = await lireIndex();
    index.push({ id, demarcheId, resume, echeance, creeLe: objet.creeLe });
    await ecrireIndex(index);
    return id;
  }

  async function mettreAJourSuivi(id, { etapeId, reponses, historique, echeance, resume }) {
    const brut = lireLS(CLES_STOCKAGE.prefixeObjet + id);
    if (!brut) return;
    const objet = await dechiffrer(brut);
    if (etapeId) objet.etapeId = etapeId;
    objet.reponses = reponses;
    objet.historique = historique || [];
    objet.echeance = echeance;
    ecrireLS(CLES_STOCKAGE.prefixeObjet + id, await chiffrer(objet));

    const index = await lireIndex();
    const entree = index.find((e) => e.id === id);
    if (entree) {
      entree.echeance = echeance;
      entree.resume = resume;
      await ecrireIndex(index);
    }
  }

  async function lireSuivi(id) {
    const brut = lireLS(CLES_STOCKAGE.prefixeObjet + id);
    return brut ? dechiffrer(brut) : null;
  }

  async function oublierSuivi(id) {
    supprimerLS(CLES_STOCKAGE.prefixeObjet + id);
    const index = await lireIndex();
    await ecrireIndex(index.filter((e) => e.id !== id));
  }

  function toutEffacer() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("coffre."))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // rien à faire si le stockage est déjà indisponible
    }
    cle = null;
  }

  return {
    existeCoffre,
    estDeverrouille,
    verrouiller,
    creerCoffre,
    deverrouiller,
    lireIndex,
    enregistrerSuivi,
    mettreAJourSuivi,
    lireSuivi,
    oublierSuivi,
    toutEffacer,
  };
})();
