// Vérifie les utilitaires de date partagés par toutes les démarches.
// Lancer avec : node tests/dates.test.mjs
import vm from "node:vm";
import fs from "node:fs";

const contexte = vm.createContext({ console });
const code = fs.readFileSync(new URL("../js/dates.js", import.meta.url), "utf8");
vm.runInContext(code, contexte);
vm.runInContext(
  `globalThis.__dates = { ajouterJours, ajouterMois, ajouterAns, moisEcoules, joursRestants, moisAnnee, dateLongue };`,
  contexte
);
const { ajouterJours, ajouterMois, ajouterAns, moisEcoules, joursRestants, moisAnnee, dateLongue } = contexte.__dates;

const resultats = [];
function ok(nom, cond) {
  resultats.push({ nom, cond });
}

// Comparaison en heure locale (pas toISOString, qui repasse en UTC et peut
// décaler d'un jour selon le fuseau de la machine qui exécute le test).
const local = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

ok("ajouterJours avance de N jours", local(ajouterJours(new Date(2026, 0, 20), 15)) === "2026-2-4");
ok("ajouterMois avance de N mois", local(ajouterMois(new Date(2026, 0, 15), 2)) === "2026-3-15");
ok(
  "ajouterMois gère le débordement de fin de mois (31 jan + 1 mois)",
  local(ajouterMois(new Date(2026, 0, 31), 1)) === "2026-3-3" // JS Date normalise : pas de 31 février
);
ok("ajouterAns avance de N années", local(ajouterAns(new Date(2026, 0, 15), 3)) === "2029-1-15");

ok("moisEcoules compte les mois pleins entre deux dates", moisEcoules(new Date(2025, 0, 15), new Date(2026, 8, 15)) === 20);
ok("moisEcoules ne descend jamais sous zéro (date de départ dans le futur)", moisEcoules(new Date(2027, 0, 1), new Date(2026, 0, 1)) === 0);

const demain = new Date();
demain.setDate(demain.getDate() + 1);
demain.setHours(0, 0, 0, 0);
ok("joursRestants trouve 1 jour pour demain", joursRestants(demain) === 1);

const hier = new Date();
hier.setDate(hier.getDate() - 1);
ok("joursRestants est négatif pour une date passée", joursRestants(hier) === -1);

ok("moisAnnee formate mois + année", moisAnnee(new Date(2026, 0, 15)) === "janvier 2026");
ok("dateLongue formate une date complète en français", dateLongue(new Date(2026, 0, 15)) === "15 janvier 2026");

for (const r of resultats) console.log(`${r.cond ? "OK  " : "FAIL"} — ${r.nom}`);
const echecs = resultats.filter((r) => !r.cond);
console.log(echecs.length === 0 ? "\nTOUT PASSE" : `\n${echecs.length} ÉCHEC(S)`);
process.exit(echecs.length === 0 ? 0 : 1);
