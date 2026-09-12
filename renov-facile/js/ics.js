// Rappel de calendrier au format .ics, généré entièrement côté client :
// aucune donnée ne quitte l'appareil, contrairement à un rappel par
// courriel qui demanderait un serveur et une adresse. Un seul événement
// journée entière posé à la date d'échéance, avec une alarme intégrée
// quelques jours avant — Google Agenda, Apple Calendrier et Outlook
// l'importent et déclenchent eux-mêmes la notification, sans dépendre du
// site pour s'en souvenir. Générique, comme js/coffre.js : ne connaît aucun
// contenu de démarche, seulement une date et deux textes.
//
// Porté depuis Lefouzebreizh/ensemble-mdph (dépôt séparé), débrandé : le
// PRODID et l'UID ne portent plus aucune trace de la marque d'origine.
const ICS = (() => {
  const JOURS_AVANT_ALARME = 3;

  // RFC 5545 : virgule, point-virgule et antislash s'échappent, ainsi que
  // les retours à la ligne. Sans ça, un texte contenant une virgule — très
  // fréquent en français — casse le fichier pour certains lecteurs.
  function echapperTexte(texte) {
    return String(texte)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function formatDateJournee(date) {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const jour = String(date.getDate()).padStart(2, "0");
    return `${annee}${mois}${jour}`;
  }

  function formatHorodatage(date) {
    return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  }

  function genererUID() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}@renov-facile`;
  }

  // dateISO : date d'échéance (ISO, ce que porte déjà chaque calculateur de
  // démarche). titre : résumé court. description : texte libre, en général
  // le libellé déjà validé de l'échéance — jamais un nouveau texte inventé
  // ici, ce module ne fait que mettre en forme ce qu'on lui donne.
  function genererICS({ dateISO, titre, description }) {
    const date = new Date(dateISO);
    const lendemain = new Date(date);
    lendemain.setDate(lendemain.getDate() + 1);

    const lignes = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Rénov Facile//FR",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${genererUID()}`,
      `DTSTAMP:${formatHorodatage(new Date())}`,
      `DTSTART;VALUE=DATE:${formatDateJournee(date)}`,
      `DTEND;VALUE=DATE:${formatDateJournee(lendemain)}`,
      `SUMMARY:${echapperTexte(titre)}`,
    ];
    if (description) lignes.push(`DESCRIPTION:${echapperTexte(description)}`);
    lignes.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${echapperTexte(titre)}`,
      `TRIGGER:-P${JOURS_AVANT_ALARME}D`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    );
    // RFC 5545 impose des fins de ligne CRLF, pas de simples \n.
    return `${lignes.join("\r\n")}\r\n`;
  }

  // Seule partie qui touche au DOM — donc la seule non couverte par
  // tests/ics.test.mjs, comme le reste du rendu (voir README, §Tests).
  function telecharger(nomFichier, contenu) {
    const blob = new Blob([contenu], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    URL.revokeObjectURL(url);
  }

  return { genererICS, telecharger };
})();
