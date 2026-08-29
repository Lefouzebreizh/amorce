/**
 * Demander au DNS si une adresse existe — et savoir quand la question n'a pas
 * pu être posée.
 *
 * `niche.domaine` fabrique la balise canonique, l'`og:url`, le sitemap et le
 * `robots.txt`. Une adresse qui ne résout pas ne casse rien de visible : le
 * site s'affiche, les contrôles passent, et chaque page déclare pourtant à
 * Google que sa version de référence se trouve là où personne ne sert rien.
 * Invisible en test, coûteux en ligne — donc une sonde, et pas un coup d'œil.
 *
 * **La sonde est un `lookup`, jamais une requête HTTP.** Derrière un mandataire
 * filtrant tout rend `000` : un domaine bloqué ressemble alors trait pour trait
 * à un domaine inexistant. Le DNS sépare les deux, vérifié sur témoin le
 * 29/08/2026 — `api.binance.com` résout et reste injoignable.
 *
 * **Et un échec ne prouve rien tout seul.** Sur une machine sans résolveur,
 * *toutes* les adresses échouent, y compris les bonnes : conclure « le domaine
 * n'existe pas » y serait faux onze fois sur onze. D'où le témoin ci-dessous,
 * interrogé avant de rendre un verdict.
 */

import { promises as dns } from 'node:dns';

/*
 * `example.com` est réservé par l'IANA (RFC 2606) : il existe par construction,
 * n'appartient à personne et ne disparaîtra pas. Un domaine d'entreprise ferait
 * un témoin plus fragile — il déménage, expire, ou se fait filtrer.
 * Mesuré résolvant depuis l'environnement de session le 29/08/2026.
 */
const TEMOIN = 'example.com';

export async function resout(hote) {
  try {
    await dns.lookup(hote);
    return true;
  } catch {
    return false;
  }
}

/** Le résolveur répond-il seulement ? Faux = on ne sait pas, on n'accuse pas. */
export const dnsDisponible = () => resout(TEMOIN);

/**
 * Trie une liste d'adresses en trois tas. `morts` n'est renseigné que si le
 * témoin a répondu : sans résolveur, on rend `disponible: false` et des tas
 * vides plutôt qu'un verdict qu'on n'a pas les moyens de porter.
 */
export async function auditerAdresses(adresses) {
  const illisibles = [];
  const hotes = new Set();
  for (const adresse of adresses) {
    try {
      hotes.add(new URL(adresse).hostname);
    } catch {
      illisibles.push(adresse);
    }
  }

  if (!(await dnsDisponible())) {
    return { disponible: false, morts: [], vivants: [], illisibles };
  }

  const morts = [];
  const vivants = [];
  for (const hote of hotes) {
    (await resout(hote) ? vivants : morts).push(hote);
  }
  return { disponible: true, morts, vivants, illisibles };
}
