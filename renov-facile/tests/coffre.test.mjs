// Vérifie le coffre local chiffré de bout en bout (création, verrouillage,
// mauvais mot de passe, mise à jour, oubli) et la dégradation propre quand
// le stockage local est indisponible (navigation privée, quota...).
// Lancer avec : node tests/coffre.test.mjs
import vm from "node:vm";
import fs from "node:fs";

function creerStockageMemoire() {
  const donnees = new Map();
  return {
    getItem: (k) => (donnees.has(k) ? donnees.get(k) : null),
    setItem: (k, v) => donnees.set(k, v),
    removeItem: (k) => donnees.delete(k),
  };
}

function creerStockageBloque() {
  return {
    getItem() { throw new Error("bloqué"); },
    setItem() { throw new Error("bloqué"); },
    removeItem() { throw new Error("bloqué"); },
  };
}

function chargerCoffre(stockage) {
  const contexte = vm.createContext({
    window: {},
    localStorage: stockage,
    crypto,
    btoa,
    atob,
    console,
    TextEncoder,
    TextDecoder,
  });
  contexte.window.crypto = crypto;
  const code = fs.readFileSync(new URL("../js/coffre.js", import.meta.url), "utf8");
  vm.runInContext(code, contexte);
  // `const Coffre` vit dans la portée lexicale du contexte, pas comme propriété
  // directement lisible depuis l'extérieur — on l'expose explicitement.
  vm.runInContext("globalThis.__Coffre = Coffre;", contexte);
  return contexte.__Coffre;
}

const resultats = [];
function ok(nom, cond) {
  resultats.push({ nom, cond });
}

async function testsNominal() {
  const Coffre = chargerCoffre(creerStockageMemoire());

  ok("pas de coffre au départ", Coffre.existeCoffre() === false);

  await Coffre.creerCoffre("motdepasse1");
  ok("coffre existe après création", Coffre.existeCoffre() === true);
  ok("déverrouillé juste après création", Coffre.estDeverrouille() === true);

  const id = await Coffre.enregistrerSuivi({
    demarcheId: "renovation",
    etapeId: "instr_date_depot",
    reponses: { date: new Date(2025, 0, 15).toISOString() },
    echeance: { date: new Date(2025, 4, 15).toISOString(), libelle: "test", confiance: "haute" },
    resume: "Dossier déposé en janvier 2025",
  });
  ok("id opaque retourné (32 car. hex)", typeof id === "string" && /^[0-9a-f]{32}$/.test(id));

  const index1 = await Coffre.lireIndex();
  ok("index contient 1 entrée", index1.length === 1);
  ok("resume correct dans l'index", index1[0].resume === "Dossier déposé en janvier 2025");

  const suiviComplet = await Coffre.lireSuivi(id);
  ok("suivi complet contient la bonne date", suiviComplet.reponses.date === new Date(2025, 0, 15).toISOString());

  Coffre.verrouiller();
  ok("verrouillé", Coffre.estDeverrouille() === false);

  const mauvais = await Coffre.deverrouiller("mauvais-mdp");
  ok("mauvais mot de passe rejeté", mauvais === false);
  ok("reste verrouillé après un échec", Coffre.estDeverrouille() === false);

  const bon = await Coffre.deverrouiller("motdepasse1");
  ok("bon mot de passe accepté", bon === true);
  ok("déverrouillé après succès", Coffre.estDeverrouille() === true);

  const index2 = await Coffre.lireIndex();
  ok("index lisible après re-déverrouillage", index2.length === 1);

  await Coffre.mettreAJourSuivi(id, {
    reponses: { date: new Date(2025, 0, 15).toISOString() },
    echeance: { date: new Date(2025, 4, 15).toISOString(), libelle: "test", confiance: "haute" },
    resume: "Dossier déposé en janvier 2025 (mis à jour)",
  });
  const index3 = await Coffre.lireIndex();
  ok("mise à jour reflétée dans l'index", index3[0].resume.includes("mis à jour"));

  await Coffre.oublierSuivi(id);
  const index4 = await Coffre.lireIndex();
  ok("suivi supprimé de l'index", index4.length === 0);
  ok("suivi supprimé illisible ensuite", (await Coffre.lireSuivi(id)) === null);
}

async function testsStockageIndisponible() {
  const Coffre = chargerCoffre(creerStockageBloque());

  ok("existeCoffre() ne plante pas si le stockage est bloqué", Coffre.existeCoffre() === false);

  try {
    await Coffre.creerCoffre("motdepasse1");
    ok("creerCoffre() aurait dû rejeter si le stockage est bloqué", false);
  } catch (e) {
    ok("creerCoffre() donne un message clair (pas l'erreur brute du navigateur)", e.message.includes("stockage local"));
  }
}

await testsNominal();
await testsStockageIndisponible();

for (const r of resultats) console.log(`${r.cond ? "OK  " : "FAIL"} — ${r.nom}`);
const echecs = resultats.filter((r) => !r.cond);
console.log(echecs.length === 0 ? "\nTOUT PASSE" : `\n${echecs.length} ÉCHEC(S)`);
process.exit(echecs.length === 0 ? 0 : 1);
