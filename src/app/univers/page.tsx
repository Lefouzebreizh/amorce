'use client';

import Image from 'next/image';
import { BrandFooter, BrandNavigation } from '../../../design-system/components/BrandShell';
import { ImmersiveHero } from '../../../design-system/components/ImmersiveHero';
import { GlassCard, ProjectCard, SectionHeading } from '../../../design-system/components/LefouzebreizhUI';
import './univers.css';

const projects = [
  {
    name: 'Ensemble face aux démarches',
    badge: 'Déjà ouvert',
    description: 'Un premier pas simple pour ne plus se perdre dans les démarches. Des parcours calmes, progressifs et rassurants.',
    className: 'univers-card--ensemble',
    href: 'https://ensemble-copilote-prive.erwannchevallier.chatgpt.site',
    action: 'Découvrir Ensemble',
  },
  {
    name: 'Mon Tiroir Secret',
    badge: 'Déjà ouvert',
    description: 'Un refuge numérique pour garder ses documents importants organisés et accessibles au bon moment.',
    className: 'univers-card--tiroir',
    href: 'https://coffre-puce.vercel.app',
    action: 'Ouvrir le Tiroir Secret',
  },
  {
    name: 'Amorce',
    badge: 'Studio créatif',
    description: 'Le studio de montage qui transforme tes rushes en vidéo verticale prête à publier, directement dans ton navigateur.',
    className: 'univers-card--amorce',
    href: '/studio',
    action: 'Entrer dans Amorce',
  },
  {
    name: 'Le Phare',
    badge: 'Orientation',
    description: 'Un espace pour retrouver de la clarté, un cap et la prochaine petite étape quand tout devient trop dense.',
    className: 'univers-card--phare',
    href: '/phare',
    action: 'Suivre le Phare',
  },
  {
    name: 'Roussy & Zéphy',
    badge: 'Livre jeunesse',
    description: 'Le monde tendre et malicieux d’un petit renard et d’un zèbre ailé : la future maison de la BD et de ses surprises.',
    className: 'univers-card--roussy',
    action: 'En préparation',
  },
  {
    name: 'Audit de page de vente',
    badge: 'Pour les indépendants',
    description: 'Un regard clair sur une page qui vend : les priorités à corriger, illustrées et livrées rapidement.',
    className: 'univers-card--audit',
    action: 'Ouverture prochaine',
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
        title="Mes projets,"
        highlight="un même horizon."
        description="Bienvenue dans Lefouzèbreizh Studio : des projets utiles, créatifs et profondément humains, imaginés depuis la Bretagne pour faire avancer, créer et respirer."
        primaryLabel="Voir les projets"
        secondaryLabel="Notre signature"
        onPrimary={() => scrollTo('univers')}
        onSecondary={() => scrollTo('signature')}
      />

      <section className="univers-master" aria-labelledby="univers-master-title">
        <div className="univers-master__heading">
          <p className="lfb-eyebrow">Lefouzèbreizh Studio</p>
          <h2 id="univers-master-title">Un écosystème à explorer, pas à deviner.</h2>
          <p>Chaque projet a son rôle, son univers et son accès. Ici, tu retrouves tout au même endroit — avec une seule promesse : la technologie doit te simplifier la vie et te donner de l’élan.</p>
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
          title="Choisis la porte qui te ressemble."
          copy="Les projets déjà ouverts sont accessibles tout de suite. Les autres arrivent ici au fur et à mesure, sans liens morts ni promesses floues."
        />
        <div className="univers-project-grid">
          {projects.map((project) => (
            <div className={project.className} key={project.name}>
              <ProjectCard name={project.name} badge={project.badge} description={project.description}>
                {project.href ? (
                  <a className="univers-project-link" href={project.href} {...(project.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    {project.action} <span aria-hidden="true">→</span>
                  </a>
                ) : (
                  <span className="univers-project-status">{project.action}</span>
                )}
              </ProjectCard>
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
