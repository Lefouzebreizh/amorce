import { AvantApres } from '@/components/AvantApres';
import { BarreAction } from '@/components/BarreAction';
import { CeQueTuAs } from '@/components/CeQueTuAs';
import { FormulaireDevis } from '@/components/FormulaireDevis';
import { Galerie } from '@/components/Galerie';
import { Hero } from '@/components/Hero';
import { Offre } from '@/components/Offre';
import { PiedDePage } from '@/components/PiedDePage';
import { Temoignage } from '@/components/Temoignage';

/*
 * L'ordre des sections est l'ordre des questions que se pose un artisan :
 * qu'est-ce que c'est, qu'est-ce que j'ai, en quoi c'est mieux que maintenant,
 * à quoi ça ressemble, combien, qui l'a déjà fait, comment je te joins.
 *
 * `Galerie` s'intercale avant `Offre`, et la place n'est pas indifférente : on
 * regarde la marchandise avant de lire le prix. Elle reste **avant**
 * `Temoignage`, qui dit que la place du premier client est vide — l'ordre
 * inverse laisserait croire que les six entreprises de la galerie sont des
 * clients, ce qu'elles ne sont pas et ce que chacune de leurs pages dément.
 *
 * Tout est rendu côté serveur sauf le formulaire : la page s'affiche entière
 * sur une 4G de chantier avant même que le JavaScript arrive.
 */
export default function Page() {
  return (
    <main>
      <Hero />
      <CeQueTuAs />
      <AvantApres />
      <Galerie />
      <Offre />
      <Temoignage />
      <FormulaireDevis />
      <PiedDePage />
      <BarreAction />
    </main>
  );
}
