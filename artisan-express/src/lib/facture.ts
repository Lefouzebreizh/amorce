/*
 * La facture, en fonctions pures.
 *
 * Ce fichier ne touche ni au disque, ni à l'horloge, ni au réseau : il reçoit
 * ce qu'il doit écrire et rend du texte. C'est ce qui permet d'éprouver la
 * **numérotation** et les **mentions obligatoires** sans fabriquer de vraie
 * facture — et ce sont exactement les deux choses qu'un contrôle regarde.
 *
 * Le pendant qui touche au disque est `scripts/facture.mjs`.
 *
 * Pourquoi une facture se fabrique ici plutôt que se recopie à la main :
 * `PROSPECTION.md` §5 nomme le moment où l'on perd des clients — « il a dit
 * oui, et on flotte ». Recopier un gabarit, remplir onze champs et vérifier
 * soi-même que la numérotation n'a pas de trou prend vingt minutes, au seul
 * moment où il ne faut pas en prendre.
 */

export type Emetteur = {
  nom: string;
  forme: string;
  adresse: string;
  siren: string;
  courriel: string;
  telephone: string;
  iban: string;
  bic: string;
};

export type Client = {
  nom: string;
  adresse: string;
  siret: string;
};

export type Facture = {
  numero: string;
  emiseLe: string;
  realiseeLe: string;
  prestation: string;
  montantEuros: number;
};

/*
 * La mention de TVA, et sa date.
 *
 * Elle a changé le 01/09/2026 : « art. 293 B du CGI » devient
 * « art. L. 233-1 du CIBS ». Une tolérance court jusqu'au 30/06/2028, donc
 * l'ancienne formule reste acceptée — mais une facture émise aujourd'hui n'a
 * aucune raison de porter le texte d'avant.
 *
 * Elle est ici, en constante, et non recopiée dans le gabarit : le jour où
 * elle rechange, un seul endroit bouge et un test le dit.
 */
export const MENTION_TVA =
  'TVA non applicable, art. L. 233-1 du code des impositions sur les biens et services';

/** L'indemnité forfaitaire de recouvrement entre professionnels. */
export const INDEMNITE_RECOUVREMENT_EUROS = 40;

/*
 * Le numéro suivant, à partir de ce qui a déjà été émis.
 *
 * La règle qui compte : **une suite continue, sans trou.** C'est la mention la
 * plus contrôlée, et un trou se remarque immédiatement — il donne à penser
 * qu'une facture a été retirée.
 *
 * On repart donc du plus grand numéro déjà émis dans l'année, jamais du nombre
 * de factures : une facture supprimée du registre par accident ferait sinon
 * réémettre un numéro déjà utilisé, ce qui est pire qu'un trou.
 */
export function numeroSuivant(dejaEmis: readonly string[], annee: number): string {
  const prefixe = `${annee}-`;
  const rangs = dejaEmis
    .filter((numero) => numero.startsWith(prefixe))
    .map((numero) => Number.parseInt(numero.slice(prefixe.length), 10))
    .filter((rang) => Number.isInteger(rang) && rang > 0);

  const suivant = rangs.length === 0 ? 1 : Math.max(...rangs) + 1;
  return `${prefixe}${String(suivant).padStart(3, '0')}`;
}

/*
 * `2026-09-03` → `03/09/2026`.
 *
 * Les dates circulent en ISO — c'est ce qui se trie, et ce que le registre
 * garde. Mais une facture française s'écrit en jour/mois/année, et un client
 * qui lit `2026-09-03` hésite une seconde de trop : c'est le format d'un
 * fichier, pas celui d'un document qu'on classe.
 *
 * Trouvé en **lisant** une facture produite, pas en la mesurant : neuf tests
 * verts la déclaraient conforme, et elle l'était — la conformité ne dit rien
 * de la convention.
 */
export function dateFrancaise(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  if (annee === undefined || mois === undefined || jour === undefined) return iso;
  return `${jour}/${mois}/${annee}`;
}

/** `300` → `300,00 €`, en typographie française : virgule, espace insécable. */
export function euros(montant: number): string {
  return `${montant.toFixed(2).replace('.', ',')} €`;
}

/*
 * Ce qui manque pour que le document soit une facture.
 *
 * Rendu sous forme de liste plutôt que d'exception : l'appelant peut ainsi
 * tout dire d'un coup, au lieu de faire découvrir les manques un par un.
 *
 * L'IBAN y est parce que ce dépôt facture **par virement** en premier : une
 * facture sans coordonnées bancaires est lisible, conforme, et impayable.
 */
export function reproches(emetteur: Partial<Emetteur>, client: Partial<Client>): string[] {
  const liste: string[] = [];

  if (!emetteur.nom?.trim()) liste.push('le nom de l’émetteur');
  if (!emetteur.adresse?.trim()) liste.push('l’adresse de l’émetteur');
  if (!emetteur.siren?.trim()) liste.push('le SIREN');
  if (!emetteur.iban?.trim()) liste.push('l’IBAN — sans lui, le virement est impossible');
  if (!client.nom?.trim()) liste.push('le nom du client');

  return liste;
}

function echappe(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/*
 * La facture en un seul fichier HTML.
 *
 * HTML et non PDF, et c'est un choix : le navigateur imprime en PDF depuis
 * n'importe quel appareil, sans bibliothèque à installer ni police à embarquer.
 * La feuille de style porte une règle `@media print` pour que la version
 * imprimée tienne sur une page.
 */
export function genererFacture(
  emetteur: Emetteur,
  client: Client,
  facture: Facture,
): string {
  const e = (v: string) => echappe(v);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Facture ${e(facture.numero)} — ${e(client.nom)}</title>
<style>
  :root { --encre: #101f2e; --gris: #4a5b6d; --trait: #d7e1ee; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2.5rem 1.5rem; color: var(--encre); background: #fff;
    font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .feuille { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0; letter-spacing: .02em; }
  .dates { color: var(--gris); margin: .25rem 0 2rem; }
  .parties { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; }
  .parties h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .12em;
                color: var(--gris); margin: 0 0 .4rem; }
  .parties p { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 2rem 0 0; }
  th, td { text-align: left; padding: .7rem .5rem; border-bottom: 1px solid var(--trait); }
  th { font-size: .8rem; text-transform: uppercase; letter-spacing: .1em; color: var(--gris); }
  td.montant, th.montant { text-align: right; white-space: nowrap; }
  .total { font-size: 1.35rem; font-weight: 700; text-align: right; margin: 1rem 0 .25rem; }
  .tva { text-align: right; color: var(--gris); margin: 0 0 2rem; }
  .bloc { border: 2px solid var(--trait); border-radius: .6rem; padding: 1rem 1.25rem; margin-top: 1.5rem; }
  .bloc h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .12em;
             color: var(--gris); margin: 0 0 .5rem; }
  .bloc p { margin: .15rem 0; }
  .iban { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 1.05rem; font-weight: 700; }
  .pied { margin-top: 2rem; color: var(--gris); font-size: .9rem; }
  /* Une facture s'imprime : pas de marge d'écran, rien qui déborde. */
  @media print {
    body { padding: 0; font-size: 12pt; }
    .bloc { break-inside: avoid; }
  }
  @media (max-width: 34rem) { .parties { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="feuille">
  <h1>FACTURE ${e(facture.numero)}</h1>
  <p class="dates">
    Émise le ${e(dateFrancaise(facture.emiseLe))} — prestation réalisée le ${e(dateFrancaise(facture.realiseeLe))}
  </p>

  <div class="parties">
    <div>
      <h2>Émetteur</h2>
      <p><strong>${e(emetteur.nom)}</strong> — ${e(emetteur.forme)}</p>
      <p>${e(emetteur.adresse)}</p>
      <p>SIREN ${e(emetteur.siren)}</p>
      <p>${e(emetteur.courriel)}</p>
      <p>${e(emetteur.telephone)}</p>
    </div>
    <div>
      <h2>Facturé à</h2>
      <p><strong>${e(client.nom)}</strong></p>
      ${client.adresse === '' ? '' : `<p>${e(client.adresse)}</p>`}
      ${client.siret === '' ? '' : `<p>SIRET ${e(client.siret)}</p>`}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Prestation</th>
        <th class="montant">Quantité</th>
        <th class="montant">Prix unitaire</th>
        <th class="montant">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${e(facture.prestation)}</td>
        <td class="montant">1</td>
        <td class="montant">${euros(facture.montantEuros)}</td>
        <td class="montant">${euros(facture.montantEuros)}</td>
      </tr>
    </tbody>
  </table>

  <p class="total">Total : ${euros(facture.montantEuros)}</p>
  <p class="tva"><em>${MENTION_TVA}</em></p>

  <div class="bloc">
    <h2>Règlement par virement</h2>
    <p>Titulaire : ${e(emetteur.nom)}</p>
    <p class="iban">${e(emetteur.iban)}</p>
    ${emetteur.bic === '' ? '' : `<p>BIC ${e(emetteur.bic)}</p>`}
    <p>Référence à indiquer : <strong>${e(facture.numero)}</strong></p>
  </div>

  <p class="pied">
    Paiement à réception. En cas de retard : pénalités au taux d’intérêt légal, et indemnité
    forfaitaire de recouvrement de ${euros(INDEMNITE_RECOUVREMENT_EUROS)}.
  </p>
</div>
</body>
</html>
`;
}
