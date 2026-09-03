import { SECTION, TITRE_SECTION } from '@/components/ui';

/*
 * La place du premier client, laissée vide et dite comme telle.
 *
 * Le dépôt interdit le faux témoignage, et ce n'est pas qu'une règle morale :
 * le public visé repère un avis fabriqué en trois lignes, et il ne revient pas.
 * Un emplacement vide assumé vaut mieux qu'un « Jean-Michel, maçon à Vannes »
 * inventé — c'est même le seul argument qu'aucun concurrent ne peut copier.
 */
export function Temoignage() {
  return (
    <section className={SECTION} id="temoignage">
      <h2 className={TITRE_SECTION}>La place du premier client</h2>

      <figure className="mt-8 rounded-2xl border-2 border-dashed border-accent bg-slab p-6 sm:p-8">
        <blockquote className="text-xl leading-relaxed text-encre sm:text-2xl">
          Cette place est vide.
        </blockquote>
        <figcaption className="mt-4 space-y-3 text-lg leading-relaxed text-ardoise">
          <p>
            Je pourrais y coller un avis cinq étoiles avec une photo achetée. Ça se fait beaucoup, et
            ça se repère tout de suite. Alors elle reste vide tant que personne ne l’a remplie.
          </p>
          <p>
            Le premier qui me confie son site aura son nom ici, son métier, sa ville — et le droit de
            dire que ça n’a pas marché si ça n’a pas marché.
          </p>
        </figcaption>
      </figure>
    </section>
  );
}
