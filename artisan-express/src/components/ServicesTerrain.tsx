import { SERVICES } from '@/lib/services';
import { ChoisirService } from '@/components/ChoisirService';

export function ServicesTerrain() {
  return <section className="outil-section" id="solutions" aria-labelledby="solutions-titre">
    <div className="outil-entete"><p className="artisan-kicker">L’installation qui te correspond</p><h2 id="solutions-titre">Un outil utile.<br /><span>Pas une usine à gaz.</span></h2><p>Tu peux commencer par un seul besoin. On définit ensemble le service, son coût et ses limites avant de le connecter à ton activité.</p></div>
    <div className="pivot-services">
      {SERVICES.map((service, index) => <article key={service.id}>
        <span className="outil-sur-titre">0{index + 1} / À construire avec toi</span>
        <h3>{service.nom}</h3><p>{service.description}</p>
        <p className="outil-note">{service.detail}</p>
        <ChoisirService besoin={service.id}>Parler de ce service ↗</ChoisirService>
      </article>)}
    </div>
  </section>;
}
