import { SECTION, TITRE_SECTION } from '@/components/ui';

const ETAPES = [
  {
    numero: '01',
    titre: 'Tu choisis ton irritant',
    texte: 'Les appels pendant les interventions ? Les devis du soir ? Ta visibilité locale ? On part de ton quotidien.',
    detail: 'un échange direct',
  },
  {
    numero: '02',
    titre: 'On vérifie ce qui est possible',
    texte: 'Téléphone, outils existants et besoin réel : je précise le périmètre, l’installation et les éventuels frais récurrents avant ton accord.',
    detail: 'un devis clair',
  },
  {
    numero: '03',
    titre: 'Tu testes avant de t’en servir',
    texte: 'On contrôle ensemble un appel, un message ou un document selon le service retenu. Tu sais ce qui se passe et comment reprendre la main.',
    detail: 'une prise en main',
  },
] as const;

export function Processus() {
  return (
    <section className="artisan-processus">
      <div className={SECTION}>
        <div className="artisan-section-heading">
          <p className="artisan-kicker">De la démonstration à ton quotidien</p>
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
          Les outils connectés sont proposés sur devis. Les coûts du numéro, des SMS et des services externes sont précisés avant toute activation. Aucun abonnement n’est souscrit depuis cette page.
        </p>
      </div>
    </section>
  );
}
