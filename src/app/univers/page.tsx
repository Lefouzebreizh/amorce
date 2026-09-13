'use client';

import Image from 'next/image';
import { BrandFooter, BrandNavigation } from '../../../design-system/components/BrandShell';
import { ImmersiveHero } from '../../../design-system/components/ImmersiveHero';
import { GlassCard, ProjectCard, SectionHeading } from '../../../design-system/components/LefouzebreizhUI';
import './univers.css';

const projects = [
  {
    name: 'Ensemble',
    badge: 'Clarté humaine',
    description: 'Une lumière chaleureuse dans la brume administrative. Des parcours calmes, progressifs et toujours rassurants.',
    className: 'univers-card--ensemble',
  },
  {
    name: 'Mon Tiroir Secret',
    badge: 'Intimité protégée',
    description: 'Le granit, la profondeur et une lumière contenue pour donner une sensation de refuge sans jamais assombrir l’usage.',
    className: 'univers-card--tiroir',
  },
  {
    name: 'OmniRoute',
    badge: 'Flux intelligent',
    description: 'Des trajectoires lumineuses, une profondeur 3D progressive et une interface qui rend les choix complexes immédiatement lisibles.',
    className: 'univers-card--route',
  },
  {
    name: 'Le Phare',
    badge: 'Orientation',
    description: 'Un horizon nocturne guidé par un faisceau ambré : spectaculaire pour découvrir, simple et précis pour avancer.',
    className: 'univers-card--phare',
  },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function UniversPage() {
  return (
    <main className="univers-page">
      <BrandNavigation items={[
        { label: 'Signature', href: '#signature' },
        { label: 'Univers', href: '#univers' },
        { label: 'Exigence', href: '#exigence' },
      ]} />

      <ImmersiveHero
        eyebrow="Bretagne · Singularité · Bienveillance"
        title="La Bretagne en inspiration."
        highlight="Le monde en horizon."
        description="Un écosystème numérique sensible et audacieux, où la double exposition, la lumière et la profondeur servent des expériences profondément humaines."
        primaryLabel="Découvrir les univers"
        secondaryLabel="Voir la signature"
        onPrimary={() => scrollTo('univers')}
        onSecondary={() => scrollTo('signature')}
      />

      <section className="univers-master" aria-labelledby="univers-master-title">
        <div className="univers-master__heading">
          <p className="lfb-eyebrow">Direction artistique validée</p>
          <h2 id="univers-master-title">Le master qui donne le cap.</h2>
          <p>Cette planche devient la référence visuelle du réseau : zèbre double exposition, côte bretonne, phare, mégalithes et lumière d’horizon.</p>
        </div>
        <figure className="univers-master__frame">
          <Image
            src="/brand/lefouzebreizh-hero-master.jpg"
            alt="Direction artistique Lefouzèbreizh : zèbre en double exposition dans un paysage côtier breton, avec phare, mégalithes et lumière turquoise, violette et ambrée."
            width={1536}
            height={640}
            priority
            sizes="100vw"
          />
          <span className="univers-master__brand univers-master__brand--hero-top" aria-hidden="true">Lefouzè<span>breizh</span><small>Des horizons plus grands</small></span>
          <span className="univers-master__brand univers-master__brand--hero-bottom" aria-hidden="true">Lefouzè<span>breizh</span><small>Des horizons plus grands</small></span>
          <figcaption>Hero Master · Référence canonique</figcaption>
        </figure>
        <figure className="univers-master__frame univers-master__frame--ecosystem">
          <Image
            src="/brand/lefouzebreizh-ecosystem-master.jpg"
            alt="Vue d’ensemble de l’écosystème Lefouzèbreizh et de ses univers : OmniRoute, Ensemble, Mon Tiroir Secret, Le Phare, créations, bien-être, oiseaux, solutions professionnelles et communauté."
            width={1536}
            height={1024}
            sizes="(max-width: 800px) 100vw, 1180px"
          />
          <span className="univers-master__brand univers-master__brand--ecosystem-top" aria-hidden="true">Lefouzè<span>breizh</span><small>Des horizons plus grands</small></span>
          <span className="univers-master__brand univers-master__brand--ecosystem-bottom" aria-hidden="true">Lefouzè<span>breizh</span><small>Des horizons plus grands</small></span>
          <figcaption>Écosystème Master · Déclinaisons de référence</figcaption>
        </figure>
      </section>

      <section id="signature" className="univers-section univers-signature">
        <SectionHeading
          eyebrow="La signature Lefouzèbreizh"
          title="Une identité qui ne ressemble à aucune autre."
          copy="Le zèbre incarne la singularité HPI et hypersensible. La Bretagne apporte la matière, l’horizon et l’ancrage. La lumière relie chaque projet à une même promesse : rendre le numérique plus beau, plus clair et plus humain."
        />
        <div className="univers-pillars">
          <GlassCard eyebrow="01 · Ancrage" title="Bretagne vivante">
            Océan, granit, brume, phares, mégalithes et hermine canonique : des symboles authentiques, jamais des clichés décoratifs.
          </GlassCard>
          <GlassCard eyebrow="02 · Singularité" title="Le regard du zèbre">
            Une double exposition cinématographique réservée aux grands moments de marque, avec un regard net, chaleureux et profondément bienveillant.
          </GlassCard>
          <GlassCard eyebrow="03 · Sensation" title="Lumière en profondeur">
            Turquoise et violet dessinent l’espace. L’ambre guide le regard. Les mouvements restent subtils, adaptatifs et désactivables.
          </GlassCard>
        </div>
      </section>

      <section id="univers" className="univers-section univers-projects">
        <SectionHeading
          eyebrow="Un ADN · Plusieurs expériences"
          title="Chaque site possède son propre horizon."
          copy="La famille est immédiatement reconnaissable, mais chaque produit conserve son ton, son rythme et son niveau d’immersion selon la mission qu’il remplit."
        />
        <div className="univers-project-grid">
          {projects.map((project) => (
            <div className={project.className} key={project.name}>
              <ProjectCard name={project.name} badge={project.badge} description={project.description} />
            </div>
          ))}
        </div>
      </section>

      <section id="exigence" className="univers-section univers-quality">
        <div>
          <p className="lfb-eyebrow">Le spectaculaire sous contrôle</p>
          <h2>Haut de gamme jusque dans le dernier détail.</h2>
        </div>
        <ol className="univers-quality-list">
          <li><span>01</span><strong>Émerveiller</strong><p>Double exposition, 2.5D/3D et éclairages cinéma dans les moments de découverte.</p></li>
          <li><span>02</span><strong>Faire respirer</strong><p>Hiérarchie nette, textes confortables et actions évidentes dans les moments d’usage.</p></li>
          <li><span>03</span><strong>S’adapter</strong><p>Expérience tactile, réduction du mouvement et profondeur allégée sur les appareils modestes.</p></li>
          <li><span>04</span><strong>Prouver</strong><p>Contrôle visuel, clavier, responsive et performance avant toute propagation à un site réel.</p></li>
        </ol>
      </section>

      <BrandFooter>
        <a href="#signature">Signature</a>
        <a href="#univers">Univers</a>
        <a href="#exigence">Exigence</a>
      </BrandFooter>
    </main>
  );
}
