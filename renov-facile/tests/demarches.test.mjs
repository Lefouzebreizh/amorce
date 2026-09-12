// Vérifie que la démarche est bien formée : toute étape référencée existe,
// tout bloc référencé existe, tout calculateur référencé existe, aucune
// étape orpheline, aucun bloc mort. Porté depuis ensemble-mdph/tests/
// demarches.test.mjs, adapté à une seule démarche (Rénov Facile n'en a
// qu'une, contrairement au registre de douze démarches d'origine).
// Lancer avec : node tests/demarches.test.mjs
import vm from "node:vm";
import fs from "node:fs";

function chargerDansContexte(fichiers) {
  const contexte = vm.createContext({ console });
  for (const fichier of fichiers) {
    const code = fs.readFileSync(new URL(`../${fichier}`, import.meta.url), "utf8");
    vm.runInContext(code, contexte);
  }
  return contexte;
}

const contexte = chargerDansContexte(["js/dates.js", "js/data/renovation.js"]);

vm.runInContext("globalThis.__demarches = [DEMARCHE_RENOVATION];", contexte);
const demarches = contexte.__demarches;

const problemes = [];

for (const d of demarches) {
  if (!d.etapes[d.premiereEtape]) {
    problemes.push(`${d.id}: premiereEtape "${d.premiereEtape}" introuvable`);
  }

  for (const [id, etape] of Object.entries(d.etapes)) {
    if (etape.id !== id) {
      problemes.push(`${d.id}/${id}: etape.id ("${etape.id}") ne correspond pas à la clé`);
    }

    if (etape.kind === "choice") {
      for (const opt of etape.options) {
        if (!d.etapes[opt.suite]) {
          problemes.push(`${d.id}/${id}: option "${opt.label}" pointe vers une suite inexistante "${opt.suite}"`);
        }
      }
    }

    if (etape.kind === "date-input") {
      if (!d.etapes[etape.suite]) {
        problemes.push(`${d.id}/${id}: suite inexistante "${etape.suite}"`);
      }
      if (!d.calculateurs[etape.calculateur]) {
        problemes.push(`${d.id}/${id}: calculateur inexistant "${etape.calculateur}"`);
      }
      if (!["mois", "mois-jour"].includes(etape.precision)) {
        problemes.push(`${d.id}/${id}: precision invalide "${etape.precision}"`);
      }
    }

    if (etape.kind === "notice") {
      if (!d.blocs[etape.blocId]) {
        problemes.push(`${d.id}/${id}: blocId inexistant "${etape.blocId}"`);
      }
      if (etape.dynamiqueDepuis && !d.etapes[etape.dynamiqueDepuis]) {
        problemes.push(`${d.id}/${id}: dynamiqueDepuis inexistant "${etape.dynamiqueDepuis}"`);
      }
      if (etape.offrirSauvegarde && !etape.libelleSuivi) {
        problemes.push(`${d.id}/${id}: offrirSauvegarde sans libelleSuivi`);
      }
      if (etape.offrirSauvegarde && !etape.dynamiqueDepuis) {
        problemes.push(`${d.id}/${id}: offrirSauvegarde sans dynamiqueDepuis (rien à sauver)`);
      }
    }
  }

  // Étapes jamais atteintes depuis premiereEtape
  const atteignables = new Set([d.premiereEtape]);
  let changement = true;
  while (changement) {
    changement = false;
    for (const etape of Object.values(d.etapes)) {
      if (!atteignables.has(etape.id)) continue;
      const suites = etape.kind === "choice" ? etape.options.map((o) => o.suite) : etape.suite ? [etape.suite] : [];
      for (const s of suites) {
        if (!atteignables.has(s)) {
          atteignables.add(s);
          changement = true;
        }
      }
    }
  }
  for (const id of Object.keys(d.etapes)) {
    if (!atteignables.has(id)) problemes.push(`${d.id}/${id}: étape orpheline, jamais atteinte`);
  }

  // Blocs jamais référencés
  const blocsUtilises = new Set(
    Object.values(d.etapes)
      .filter((e) => e.kind === "notice")
      .map((e) => e.blocId)
  );
  for (const blocId of Object.keys(d.blocs)) {
    if (!blocsUtilises.has(blocId)) problemes.push(`${d.id}: bloc "${blocId}" jamais référencé`);
  }
}

if (problemes.length === 0) {
  console.log(`OK — ${demarches.length} démarche(s) vérifiée(s), aucun problème structurel.`);
  process.exit(0);
} else {
  console.log(problemes.map((p) => `FAIL — ${p}`).join("\n"));
  console.log(`\n${problemes.length} PROBLÈME(S)`);
  process.exit(1);
}
