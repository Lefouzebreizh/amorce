'use client';

import { useId, useState } from 'react';
import { BOUTON_PRINCIPAL, SECTION, TITRE_SECTION } from '@/components/ui';
import { aUnCourrielDirect, aUnTelephone, aUnWhatsapp, contact } from '@/lib/config';
import { CHAMP_PIEGE, analyserDemande, type ChampDemande, type Demande } from '@/lib/demande';
import { lienMailtoDemande } from '@/lib/courriel';

/*
 * Le formulaire, et le seul morceau interactif de la page.
 *
 * Il valide avec exactement la même fonction que la route serveur : un artisan
 * qui se trompe d'un chiffre le voit avant l'envoi, et personne ne peut poster
 * n'importe quoi en contournant le navigateur.
 *
 * Il ne pose aucun mouchard et n'envoie rien avant que le bouton soit pressé.
 */

type Etat =
  | { nom: 'repos' }
  | { nom: 'envoi' }
  | { nom: 'recu' }
  | { nom: 'invalide'; erreurs: Partial<Record<ChampDemande, string>> }
  /*
   * La route répond, mais l'envoi de courriel n'est pas configuré ou a échoué.
   *
   * La demande est conservée : c'est elle qui permet de proposer le repli par
   * messagerie sans redemander à l'artisan de tout retaper. Un formulaire qui
   * échoue et vide ses champs perd le client, pas seulement l'envoi.
   */
  | { nom: 'panne'; demande: Demande | null };

const METIERS = [
  'Maçon',
  'Couvreur',
  'Électricien',
  'Plombier',
  'Chauffagiste',
  'Menuisier',
  'Peintre',
  'Carreleur',
  'Plaquiste',
  'Terrassier',
  'Paysagiste',
  'Serrurier',
];

const CHAMPS = 'w-full min-h-14 rounded-xl border-2 border-bordure bg-white px-4 text-lg text-encre placeholder:text-ardoise/60 focus:border-bleu';

/*
 * Le message sous un champ, défini hors du formulaire : React interdit de créer
 * un composant pendant le rendu — il serait démonté et remonté à chaque frappe,
 * et le champ perdrait le curseur.
 */
function MessageErreur({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) return null;

  return (
    <p id={id} className="mt-1.5 text-base font-semibold text-[#b4231d]">
      {message}
    </p>
  );
}

export function FormulaireDevis() {
  const idBase = useId();
  const [etat, setEtat] = useState<Etat>({ nom: 'repos' });

  const erreurs = etat.nom === 'invalide' ? etat.erreurs : {};

  async function envoyer(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();

    const donnees = Object.fromEntries(new FormData(evenement.currentTarget).entries());
    const analyse = analyserDemande(donnees);

    if (analyse.statut === 'invalide') {
      setEtat({ nom: 'invalide', erreurs: analyse.erreurs });
      return;
    }

    /*
     * Un envoi piégé est accepté sans rien dire côté serveur — il n'a donc pas
     * de demande exploitable, et le repli par messagerie ne lui est pas offert.
     */
    const demande = analyse.statut === 'valide' ? analyse.demande : null;

    setEtat({ nom: 'envoi' });

    try {
      const reponse = await fetch('/api/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      });

      setEtat(reponse.ok ? { nom: 'recu' } : { nom: 'panne', demande });
    } catch {
      setEtat({ nom: 'panne', demande });
    }
  }

  function attributs(champ: ChampDemande) {
    return {
      id: `${idBase}-${champ}`,
      name: champ,
      className: CHAMPS,
      'aria-invalid': erreurs[champ] !== undefined,
      'aria-describedby': erreurs[champ] !== undefined ? `${idBase}-${champ}-erreur` : undefined,
    };
  }

  if (etat.nom === 'recu') {
    return (
      <section className={SECTION} id="formulaire">
        <div className="rounded-2xl border-2 border-bleu bg-bleu-pale p-8 text-center">
          <h2 className={TITRE_SECTION}>C’est envoyé.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ardoise">
            Je te rappelle dans la journée. On parle cinq minutes de ton métier et de ta zone, et je
            m’y mets. Si c’est urgent, appelle — je décroche plus vite que je ne lis mes courriels.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={SECTION} id="formulaire">
      <h2 className={TITRE_SECTION}>Dis-moi qui tu es, je te rappelle</h2>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ardoise">
        Cinq lignes. Pas de compte à créer, pas de newsletter, et ton numéro ne part chez personne
        d’autre que moi.
      </p>

      <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={envoyer} noValidate>
        <div>
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-nom`}>
            Ton nom
          </label>
          <input {...attributs('nom')} type="text" autoComplete="name" placeholder="Yann Le Goff" />
          <MessageErreur id={`${idBase}-nom-erreur`} message={erreurs.nom} />
        </div>

        <div>
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-metier`}>
            Ton métier
          </label>
          <input
            {...attributs('metier')}
            type="text"
            list={`${idBase}-metiers`}
            placeholder="Couvreur"
          />
          <datalist id={`${idBase}-metiers`}>
            {METIERS.map((metier) => (
              <option key={metier} value={metier} />
            ))}
          </datalist>
          <MessageErreur id={`${idBase}-metier-erreur`} message={erreurs.metier} />
        </div>

        <div>
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-ville`}>
            Ta ville
          </label>
          <input
            {...attributs('ville')}
            type="text"
            autoComplete="address-level2"
            placeholder="Quimper"
          />
          <MessageErreur id={`${idBase}-ville-erreur`} message={erreurs.ville} />
        </div>

        <div>
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-telephone`}>
            Ton téléphone
          </label>
          <input
            {...attributs('telephone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
          />
          <MessageErreur id={`${idBase}-telephone-erreur`} message={erreurs.telephone} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-courriel`}>
            Ton courriel <span className="font-normal text-ardoise">— si tu en as un</span>
          </label>
          <input
            {...attributs('courriel')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="yann@exemple.fr"
          />
          <MessageErreur id={`${idBase}-courriel-erreur`} message={erreurs.courriel} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-lg font-bold text-encre" htmlFor={`${idBase}-message`}>
            Ce que tu fais, ce que tu veux <span className="font-normal text-ardoise">— facultatif</span>
          </label>
          <textarea
            {...attributs('message')}
            rows={4}
            className={`${CHAMPS} py-3`}
            placeholder="Je fais de la rénovation de toiture sur 30 km autour de Quimper. J’ai des photos de chantiers."
          />
          <MessageErreur id={`${idBase}-message-erreur`} message={erreurs.message} />
        </div>

        {/* Le piège à robots : hors de l'écran, hors du clavier, hors des
            lecteurs d'écran. Un humain ne le voit jamais. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
          <label htmlFor={`${idBase}-piege`}>Ne pas remplir</label>
          <input id={`${idBase}-piege`} name={CHAMP_PIEGE} type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="sm:col-span-2">
          <button className={`${BOUTON_PRINCIPAL} w-full sm:w-auto`} type="submit" disabled={etat.nom === 'envoi'}>
            {etat.nom === 'envoi' ? 'Envoi…' : 'Envoyer, et rappelle-moi'}
          </button>
        </div>

        {etat.nom === 'panne' && aUnCourrielDirect && etat.demande !== null ? (
          /*
           * Le repli qui ne demande aucun compte : la demande part par la
           * messagerie de l'artisan, déjà écrite. Il reste un bouton à presser
           * chez lui — mais il reste surtout un chemin, là où la page n'en
           * offrait plus aucun tant que rien n'était réglé.
           */
          <div role="alert" className="rounded-xl bg-bleu-pale p-4 sm:col-span-2">
            <p className="text-lg leading-relaxed text-encre">
              L’envoi automatique ne marche pas — c’est de mon côté, pas du tien. Ton message est
              prêt : appuie, il part de ta messagerie.
            </p>
            <a
              className={`${BOUTON_PRINCIPAL} mt-4 inline-flex`}
              href={lienMailtoDemande(etat.demande, contact.courrielDirect)}
            >
              Envoyer depuis ma messagerie
            </a>
          </div>
        ) : null}
        {etat.nom === 'panne' && !(aUnCourrielDirect && etat.demande !== null) ? (
          <p role="alert" className="rounded-xl bg-bleu-pale p-4 text-lg leading-relaxed text-encre sm:col-span-2">
            Le formulaire ne part pas — c’est de mon côté, pas du tien.{' '}
            {aUnTelephone ? (
              <>
                Appelle-moi directement au{' '}
                <a className="font-bold text-bleu underline" href={contact.telephoneLien}>
                  {contact.telephoneAffiche}
                </a>
                .
              </>
            ) : null}
            {aUnWhatsapp ? (
              <>
                {' '}
                Ou écris-moi sur{' '}
                <a className="font-bold text-bleu underline" href={contact.whatsappLien}>
                  WhatsApp
                </a>
                .
              </>
            ) : null}
            {!aUnTelephone && !aUnWhatsapp ? ' Réessaie dans quelques minutes.' : null}
          </p>
        ) : null}
      </form>
    </section>
  );
}
