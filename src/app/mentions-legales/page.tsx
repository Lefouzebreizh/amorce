import type { Metadata } from 'next';

import { Bloc, PageTexte } from '@/components/PageTexte';

export const metadata: Metadata = {
  title: 'Mentions légales — Amorce',
  description: 'Éditeur, hébergement, contact et données personnelles d’Amorce.',
};

/**
 * Les mentions légales, obligatoires dès qu'un site vend.
 *
 * ## Ce qui est écrit, et ce qui ne l'est pas
 *
 * Le numéro SIRET manque : l'immatriculation était en cours au moment d'écrire.
 * Il est annoncé comme tel plutôt qu'omis en silence — un visiteur qui cherche
 * l'identité d'un vendeur et ne trouve rien conclut à une absence, pas à une
 * attente. **Aucun numéro n'est inventé**, et la mention se retire le jour où
 * le vrai arrive.
 *
 * Deux points restent à compléter et sont signalés dans le texte plutôt que
 * comblés : le SIRET, et le médiateur de la consommation — que la loi impose à
 * qui vend à des particuliers, et qui se souscrit auprès d'un organisme agréé.
 * Écrire un nom de médiateur qu'on n'a pas serait un faux.
 */
export default function Page() {
  return (
    <PageTexte titre="Mentions légales" miseAJour="2 septembre 2026">
      <Bloc titre="Éditeur du site">
        <p>
          Amorce est édité par <strong className="text-mist">Erwann Chevallier</strong>,
          entrepreneur individuel sous le régime de la micro-entreprise.
        </p>
        <p>20a rue Clotilde Vautier, 35000 Rennes, France.</p>
        {/* Sur sa propre ligne : un courriel visé au doigt dans un paragraphe
             ne fait jamais les 44 px que le §2 impose. */}
        <a href="mailto:erwannchevallier@gmail.com" className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          erwannchevallier@gmail.com
        </a>
        <p className="text-base">
          SIRET en cours d’attribution — l’immatriculation est déposée et le numéro
          sera publié ici dès qu’il sera délivré.
        </p>
      </Bloc>

      <Bloc titre="Directeur de la publication">
        <p>Erwann Chevallier.</p>
      </Bloc>

      <Bloc titre="Hébergement">
        <p>
          Le site est hébergé par <strong className="text-mist">Vercel Inc.</strong>,
          340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
        </p>
      </Bloc>

      <Bloc titre="Ce que le site sait de vous">
        <p>
          <strong className="text-mist">Le studio de montage ne transmet rien.</strong>{' '}
          Vos vidéos, vos sons et vos textes restent dans votre navigateur : il
          n’existe aucun serveur qui les reçoive, aucune base de données, aucune
          route qui accepte un fichier. Rien à supprimer, parce que rien n’est
          collecté.
        </p>
        <p>
          Une seule exception, et elle ne touche à aucun média : si vous achetez
          une licence, un serveur vérifie que votre clé a bien été payée. Il
          reçoit la clé, rien d’autre — ni votre nom, ni le nom d’un fichier, ni
          la durée d’un montage.
        </p>
        <p>
          Le paiement est traité par <strong className="text-mist">Stripe</strong>,
          qui conserve les données bancaires selon sa propre politique. Amorce ne
          voit jamais votre numéro de carte.
        </p>
        <p>
          Aucun traceur publicitaire, aucune mesure d’audience, aucun cookie de
          suivi.
        </p>
      </Bloc>

      <Bloc titre="Vos droits">
        <p>
          Vous pouvez demander l’accès, la rectification ou la suppression des
          données liées à votre licence en écrivant à l’adresse ci-dessous. En
          pratique, ces données se résument à votre clé et à l’état du paiement
          correspondant.
        </p>
        <a href="mailto:erwannchevallier@gmail.com" className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          erwannchevallier@gmail.com
        </a>
      </Bloc>

      <Bloc titre="Propriété">
        <p>
          Le code, les textes et l’identité visuelle d’Amorce appartiennent à
          Erwann Chevallier. Les vidéos que vous montez vous appartiennent
          entièrement : Amorce n’en revendique rien et n’en garde aucune copie.
        </p>
      </Bloc>
    </PageTexte>
  );
}
