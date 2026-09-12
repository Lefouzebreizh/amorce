// Vérifie le format du rappel de calendrier généré par js/ics.js. Ne couvre
// pas telecharger(), qui touche au DOM (Blob, document) — voir README,
// §Tests, comme pour js/engine.js.
// Lancer avec : node tests/ics.test.mjs
import vm from "node:vm";
import fs from "node:fs";

const contexte = vm.createContext({ console });
const code = fs.readFileSync(new URL("../js/ics.js", import.meta.url), "utf8");
vm.runInContext(code, contexte);
vm.runInContext("globalThis.__ics = ICS;", contexte);
const { genererICS } = contexte.__ics;

const resultats = [];
function ok(nom, cond) {
  resultats.push({ nom, cond });
}

const contenu = genererICS({
  dateISO: "2026-11-15T00:00:00.000Z",
  titre: "Ma rénovation énergétique — échéance",
  description: "Passé cette date, la validation de l'Anah peut arriver.",
});

ok("commence par BEGIN:VCALENDAR", contenu.startsWith("BEGIN:VCALENDAR"));
ok("se termine par END:VCALENDAR suivi d'un CRLF", contenu.endsWith("END:VCALENDAR\r\n"));
ok("contient un seul événement", (contenu.match(/BEGIN:VEVENT/g) || []).length === 1);
ok("la date d'échéance est reprise telle quelle (20261115)", contenu.includes("DTSTART;VALUE=DATE:20261115"));
ok("DTEND vaut le lendemain (20261116), jamais le même jour", contenu.includes("DTEND;VALUE=DATE:20261116"));
ok("le titre est repris dans SUMMARY", contenu.includes("SUMMARY:Ma rénovation énergétique — échéance"));
ok("porte une alarme", contenu.includes("BEGIN:VALARM") && contenu.includes("ACTION:DISPLAY"));
ok("l'alarme se déclenche avant l'échéance (TRIGGER négatif)", /TRIGGER:-P\d+D/.test(contenu));
ok("les lignes sont terminées en CRLF, pas en LF seul (RFC 5545)", contenu.includes("\r\n") && !/[^\r]\n/.test(contenu));
ok("le PRODID ne porte aucune trace de la marque d'origine du moteur", contenu.includes("PRODID:-//Rénov Facile//FR"));

const avecVirgule = genererICS({
  dateISO: "2026-11-15T00:00:00.000Z",
  titre: "Titre, avec une virgule ; et un point-virgule",
});
ok(
  "virgule et point-virgule sont échappés dans SUMMARY",
  avecVirgule.includes("SUMMARY:Titre\\, avec une virgule \\; et un point-virgule")
);

const sansDescription = genererICS({ dateISO: "2026-11-15T00:00:00.000Z", titre: "Sans description" });
const [corpsEvenement] = sansDescription.split("BEGIN:VALARM");
ok(
  "aucune ligne DESCRIPTION sur l'événement quand le texte n'est pas fourni (l'alarme, elle, en porte toujours une)",
  !corpsEvenement.includes("DESCRIPTION:")
);

for (const r of resultats) console.log(`${r.cond ? "OK  " : "FAIL"} — ${r.nom}`);
const echecs = resultats.filter((r) => !r.cond);
console.log(echecs.length === 0 ? "\nTOUT PASSE" : `\n${echecs.length} ÉCHEC(S)`);
process.exit(echecs.length === 0 ? 0 : 1);
