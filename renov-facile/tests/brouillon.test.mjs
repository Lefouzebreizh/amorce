// Vérifie le filet automatique de reprise (js/brouillon.js) : écriture,
// lecture, expiration, dégradation propre sans stockage.
// Lancer avec : node tests/brouillon.test.mjs
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

function chargerBrouillon(stockage) {
  const contexte = vm.createContext({ localStorage: stockage, console, Date });
  const code = fs.readFileSync(new URL("../js/brouillon.js", import.meta.url), "utf8");
  vm.runInContext(code, contexte);
  vm.runInContext("globalThis.__brouillon = Brouillon;", contexte);
  return contexte.__brouillon;
}

const resultats = [];
function ok(nom, cond) {
  resultats.push({ nom, cond });
}

// --- écriture / lecture normales ---
const stockage1 = creerStockageMemoire();
const brouillon1 = chargerBrouillon(stockage1);

ok("rien à lire avant toute écriture", brouillon1.lire() === null);

brouillon1.enregistrer({
  demarcheId: "renovation",
  etapeId: "instr_date_depot",
  reponses: { pourQui: "moi", recit: "un test" },
  historique: ["aiguillage", "B_recit"],
});

const lu = brouillon1.lire();
ok("demarcheId repris tel quel", lu.demarcheId === "renovation");
ok("etapeId repris tel quel", lu.etapeId === "instr_date_depot");
ok("reponses reprises telles quelles", lu.reponses.recit === "un test");
ok("historique repris tel quel", Array.isArray(lu.historique) && lu.historique.length === 2);
ok("porte un horodatage", typeof lu.majLe === "number" && lu.majLe > 0);

brouillon1.effacer();
ok("plus rien après effacer()", brouillon1.lire() === null);

// --- expiration ---
const stockage2 = creerStockageMemoire();
const brouillon2 = chargerBrouillon(stockage2);
const troisEtUnJours = 31 * 24 * 60 * 60 * 1000;
stockage2.setItem(
  "brouillon.demarche",
  JSON.stringify({ demarcheId: "renovation", etapeId: "aiguillage", reponses: {}, historique: [], majLe: Date.now() - troisEtUnJours })
);
ok("un brouillon vieux de plus de 30 jours est ignoré", brouillon2.lire() === null);
ok("et effacé au passage", stockage2.getItem("brouillon.demarche") === null);

// --- données illisibles ---
const stockage3 = creerStockageMemoire();
const brouillon3 = chargerBrouillon(stockage3);
stockage3.setItem("brouillon.demarche", "{ceci n'est pas du JSON");
ok("un contenu illisible ne fait pas planter la lecture", brouillon3.lire() === null);

// --- stockage indisponible (navigation privée, quota...) ---
const stockageBloque = {
  getItem() { throw new Error("bloqué"); },
  setItem() { throw new Error("bloqué"); },
  removeItem() { throw new Error("bloqué"); },
};
const brouillon4 = chargerBrouillon(stockageBloque);
let planteEcriture = false;
try {
  brouillon4.enregistrer({ demarcheId: "renovation", etapeId: "aiguillage", reponses: {}, historique: [] });
} catch (e) {
  planteEcriture = true;
}
ok("enregistrer() ne plante pas si le stockage est bloqué", !planteEcriture);
ok("lire() rend null si le stockage est bloqué", brouillon4.lire() === null);

for (const r of resultats) console.log(`${r.cond ? "OK  " : "FAIL"} — ${r.nom}`);
const echecs = resultats.filter((r) => !r.cond);
console.log(echecs.length === 0 ? "\nTOUT PASSE" : `\n${echecs.length} ÉCHEC(S)`);
process.exit(echecs.length === 0 ? 0 : 1);
