import Image from 'next/image';
import { BrandFooter, BrandNavigation } from '../../../design-system/components/BrandShell';
import './phare.css';

const reperes = [
  { number: '01', title: 'Voir clair', copy: 'Nommer ce qui compte, sans bruit ni jargon.' },
  { number: '02', title: 'Choisir le cap', copy: 'Transformer le brouillard en prochaine étape concrète.' },
  { number: '03', title: 'Avancer accompagné', copy: 'Garder un repère humain tout au long du chemin.' },
];

export default function PharePage() {
  return (
    <main className="phare-page">
      <BrandNavigation items={[
        { label: 'Le cap', href: '#cap' },
        { label: 'Les repères', href: '#reperes' },
        { label: 'La promesse', href: '#promesse' },
      ]} />
      <section className="phare-hero" id="cap">
        <Image className="phare-hero__image" src="/brand/lefouzebreizh-hero-master.jpg" fill priority sizes="100vw"
          alt="Zèbre en double exposition avec un phare breton, l’océan et les mégalithes dans une lumière turquoise, violette et ambrée." />
        <div className="phare-hero__veil" />
        <div className="phare-beam" aria-hidden="true" />
        <div className="phare-hero__content">
          <p className="phare-eyebrow">Le Phare · Orientation humaine</p>
          <h1>Lefouzèbreizh donne le cap.<br/><span>Le Phare éclaire ton chemin.</span></h1>
          <p>Quand tout se mélange, Le Phare remet l’essentiel devant toi : une direction lisible, une prochaine étape, et assez d’espace pour respirer.</p>
          <a className="phare-cta" href="#reperes">Trouver mon prochain repère <span>→</span></a>
        </div>
        <p className="phare-mantra">Racines · Rêves · Possibilités</p>
      </section>

      <section className="phare-reperes" id="reperes">
        <header>
          <p className="phare-eyebrow">Trois lumières dans la brume</p>
          <h2>Pas une injonction.<br/>Un repère à la fois.</h2>
        </header>
        <div className="phare-grid">
          {reperes.map((repere) => (
            <article key={repere.number}>
              <span>{repere.number}</span>
              <h3>{repere.title}</h3>
              <p>{repere.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="phare-promise" id="promesse">
        <div>
          <p className="phare-eyebrow">La promesse</p>
          <h2>La lumière ne décide pas à ta place.</h2>
          <p>Elle révèle le chemin pour que tu puisses choisir le tien — à ton rythme, avec sensibilité, clarté et confiance.</p>
        </div>
        <blockquote>« Un monde plus simple, plus humain, plus beau, c’est possible. »</blockquote>
      </section>
      <BrandFooter />
    </main>
  );
}
