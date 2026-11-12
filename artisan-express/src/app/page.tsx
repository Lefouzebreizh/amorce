import { AppelsManques } from '@/components/AppelsManques';
import { DevisVocal } from '@/components/DevisVocal';
import { PresenceLocale } from '@/components/PresenceLocale';
import { ServicesTerrain } from '@/components/ServicesTerrain';
import { BarreAction } from '@/components/BarreAction';
import { CeQueTuAs } from '@/components/CeQueTuAs';
import { FormulaireDevis } from '@/components/FormulaireDevis';
import { Galerie } from '@/components/Galerie';
import { Hero } from '@/components/Hero';
import { Navigation } from '@/components/Navigation';
import { Offre } from '@/components/Offre';
import { PiedDePage } from '@/components/PiedDePage';
import { Processus } from '@/components/Processus';
import { QuiSuisJe } from '@/components/QuiSuisJe';

/*
 * L'ordre des sections est l'ordre des questions que se pose un artisan :
 * quel problème je rencontre, comment l’outil aide, comment le tester,
 * puis comment le raccorder à mon activité.
 *
 * La galerie précède l’offre et présente explicitement des modèles fictifs.
 * Les témoignages seront ajoutés lorsqu’un client aura donné un avis réel.
 *
 * Les sections restent rendues sur le serveur ; les démonstrations et les
 * interactions sont isolées en composants client. Aucun SMS réel n’est envoyé.
 */
export default function Page() {
  return (
    <>
      <Navigation />
      <main id="top">
        <Hero />
        <CeQueTuAs />
        <AppelsManques />
        <DevisVocal />
        <PresenceLocale />
        <ServicesTerrain />
        <Processus />
        <Galerie />
        <Offre />
        <QuiSuisJe />
        <FormulaireDevis />
      </main>
      <PiedDePage />
      <BarreAction />
    </>
  );
}
