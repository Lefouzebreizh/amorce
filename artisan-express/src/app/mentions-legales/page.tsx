import type { Metadata } from 'next';
import Link from 'next/link';
import { contact } from '@/lib/config';

/*
 * Les mentions légales, obligatoires dès qu'un site vend.
 *
 * Elles ne sont pas une formalité décorative : la loi pour la confiance dans
 * l'économie numérique impose à tout éditeur d'un site professionnel de se
 * nommer, de donner une adresse, un moyen de le joindre, son numéro
 * d'immatriculation, et l'identité de son hébergeur. Un site marchand sans ces
 * lignes est en infraction, et c'est le premier reproche qu'un client mécontent
 * ou un concurrent agacé peut faire remonter.
 *
 * Elles sont écrites ici plutôt que sous la page de vente, et c'est délibéré :
 * une page de vente qui se termine par un pavé juridique perd exactement au
 * moment où elle devait convaincre. Le lien discret en pied de page suffit — la
 * loi demande qu'elles soient **accessibles**, pas qu'elles soient lues.
 *
 * `noindex` : ces informations doivent être trouvables depuis le site, pas
 * concourir avec lui dans les résultats de recherche. Une page de mentions
 * légales qui remonte avant la page de vente est un contresens.
 *
 * Le téléphone et le courriel viennent de `config.ts` plutôt que d'être
 * recopiés ici. Deux endroits qui portent le même numéro divergent au premier
 * changement, et c'est toujours celui qu'on oublie qui reste affiché.
 */
export const metadata: Metadata = {
  title: 'Mentions légales — Site vitrine artisan express',
  robots: { index: false, follow: true },
};

const EDITEUR = {
  nom: 'Erwann Chevallier',
  forme: 'Entrepreneur individuel (EI)',
  adresse: '20A rue Clotilde Vautier, 35000 Rennes',
  siren: '109356972',
} as const;

/*
 * L'hébergeur, avec son adresse réelle — vérifiée le 03/09/2026 auprès des
 * registres et de la politique de confidentialité de Vercel, et non écrite de
 * mémoire. Une adresse d'hébergeur fausse vaut une mention absente : elle ne
 * permet pas de le joindre, ce qui est tout l'objet de l'obligation.
 */
const HEBERGEUR = {
  nom: 'Vercel Inc.',
  adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
} as const;

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold text-encre">{titre}</h2>
      <div className="mt-2 space-y-1 leading-relaxed text-ardoise">{children}</div>
    </section>
  );
}

export default function MentionsLegales() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link className="text-lg font-bold text-bleu underline" href="/">
        ← Retour à la page
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-encre">Mentions légales</h1>

      <Bloc titre="Éditeur du site">
        <p>
          {EDITEUR.nom} — {EDITEUR.forme}
        </p>
        <p>{EDITEUR.adresse}</p>
        <p>SIREN {EDITEUR.siren}</p>
        <p>
          <a className="font-bold text-bleu underline" href={`mailto:${contact.courrielDirect}`}>
            {contact.courrielDirect}
          </a>
        </p>
        {contact.telephoneLien === '' ? null : (
          <p>
            <a className="font-bold text-bleu underline" href={contact.telephoneLien}>
              {contact.telephoneAffiche}
            </a>
          </p>
        )}
      </Bloc>

      <Bloc titre="Directeur de la publication">
        <p>{EDITEUR.nom}</p>
      </Bloc>

      <Bloc titre="Hébergeur">
        <p>{HEBERGEUR.nom}</p>
        <p>{HEBERGEUR.adresse}</p>
      </Bloc>

      <Bloc titre="TVA">
        {/*
          La franchise en base n'est pas une omission : elle se dit, sinon un
          client professionnel cherche une TVA récupérable qui n'existe pas.
        */}
        <p>
          TVA non applicable, art. L. 233-1 du code des impositions sur les biens et services.
        </p>
      </Bloc>

      <Bloc titre="Propriété du site livré">
        {/*
          Ce paragraphe n'est pas obligatoire. Il est là parce que c'est la
          promesse la plus inhabituelle de l'offre, et qu'une promesse écrite
          seulement sur la page de vente se discute mal le jour où elle compte.
        */}
        <p>
          Le site livré au client — code, textes et images fournies par lui — lui appartient. Il
          peut l’emporter, le faire modifier par quelqu’un d’autre, ou l’héberger ailleurs, sans
          rien devoir.
        </p>
      </Bloc>

      <Bloc titre="Données personnelles">
        {/*
          Court et vrai. La page ne dépose rien et n'enregistre rien : le
          formulaire part en courriel et s'arrête là. Le dire en trois lignes
          vaut mieux qu'une politique de confidentialité recopiée qui
          décrirait des traitements inexistants.
        */}
        <p>
          Cette page ne dépose aucun cookie et ne charge aucun outil de mesure. Ce que vous écrivez
          dans le formulaire est transmis par courriel et n’est enregistré dans aucune base.
        </p>
        <p>
          Pour demander l’accès à ces informations ou leur effacement, écrivez à l’adresse
          ci-dessus.
        </p>
      </Bloc>
    </main>
  );
}
