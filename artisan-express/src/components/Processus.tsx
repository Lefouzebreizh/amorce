import { SECTION, TITRE_SECTION } from '@/components/ui';

const ETAPES = [
  {
    numero: '01',
    titre: 'Tu m’envoies l’essentiel',
    texte: 'Ton métier, ta ville, ton téléphone et quelques photos de chantiers. Pas de questionnaire interminable.',
    detail: '15 minutes',
  },
  {
    numero: '02',
    titre: 'Je construis ta vitrine',
    texte: 'Je mets en valeur tes services, tes réalisations et les boutons qui permettent de t’appeler sans chercher.',
    detail: 'création soignée',
  },
  {
    numero: '03',
    titre: 'Tu regardes, je finalise',
    texte: 'Tu testes sur ton téléphone. Une modification est incluse, puis je te livre le site et son code.',
    detail: 'sous 48 h*',
  },
] as const;

export function Processus() {
  return (
    <section className="artisan-processus">
      <div className={SECTION}>
        <div className="artisan-section-heading">
          <p className="artisan-kicker"><span>02</span> Du premier échange à la mise en ligne</p>
          <h2 className={TITRE_SECTION}>Simple pour toi.<br /><span>Soigné dans chaque détail.</span></h2>
          <p>
            Tu restes concentré sur ton métier. Je m’occupe du reste, sans jargon et avec un interlocuteur unique.
          </p>
        </div>

        <ol className="artisan-processus__grid">
          {ETAPES.map((etape) => (
            <li key={etape.numero} className="artisan-processus__card">
              <div className="artisan-processus__topline">
                <span>{etape.numero}</span>
                <small>{etape.detail}</small>
              </div>
              <h3>{etape.titre}</h3>
              <p>{etape.texte}</p>
            </li>
          ))}
        </ol>

        <p className="artisan-processus__note">
          * Le délai démarre après réception de tes textes, photos et informations, et après confirmation du créneau.
        </p>
      </div>
    </section>
  );
}
