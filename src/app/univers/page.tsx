'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import { BrandFooter, BrandNavigation } from '../../../design-system/components/BrandShell';
import { ImmersiveHero } from '../../../design-system/components/ImmersiveHero';
import { SectionHeading } from '../../../design-system/components/LefouzebreizhUI';
import './univers.css';

type StudioProject = {
  name: string;
  family: string;
  description: string;
  status: string;
  mark: string;
  accent: string;
  href?: string;
  preview?: string;
  video?: string;
};

const projects: StudioProject[] = [
  { name: 'Ensemble face aux démarches', family: 'Écosystème Ensemble', description: 'Douze parcours administratifs pour comprendre ses droits et avancer sans rester seul.', status: 'En ligne', mark: 'ED', accent: '#40e0d0', href: 'https://ensemble-face-aux-demarches.vercel.app', preview: '/portfolio/ensemble-demarches.png' },
  { name: 'Ensemble face au chômage', family: 'Écosystème Ensemble', description: 'Des repères concrets pour préparer sa prochaine étape professionnelle.', status: 'En ligne', mark: 'EC', accent: '#58b8ff', href: '/ensemble-face-au-chomage/index.html', preview: '/portfolio/ensemble-chomage.png' },
  { name: 'Ensemble au quotidien', family: 'Écosystème Ensemble', description: 'Un copilote pour les papiers, les échéances et les petites décisions courantes.', status: 'En ligne', mark: 'EQ', accent: '#7fd68a', href: 'https://ensemble-copilote-prive.erwannchevallier.chatgpt.site', preview: '/portfolio/ensemble-quotidien.png' },
  { name: 'Ensemble pour rénover', family: 'Écosystème Ensemble', description: 'Préparer, chiffrer et suivre un projet de rénovation étape par étape.', status: 'En ligne', mark: 'ER', accent: '#75d8c2', href: 'https://renov-facile.vercel.app', preview: '/portfolio/ensemble-renover.png' },
  { name: 'Ensemble pour entreprendre', family: 'Écosystème Ensemble', description: 'Des décisions structurées pour lancer et piloter une activité.', status: 'En ligne', mark: 'EE', accent: '#a78bfa', href: 'https://lefouzebreizh.github.io/ensemble-pour-entreprendre/', preview: '/portfolio/ensemble-entreprendre.png', video: '/portfolio/ensemble-pour-entreprendre-video.mp4' },
  { name: 'Ensemble pour s’orienter', family: 'Écosystème Ensemble', description: 'Une orientation attentive qui remet les envies et les capacités au centre.', status: 'En ligne', mark: 'EO', accent: '#72c7ff', href: 'https://orientation-express.vercel.app', preview: '/portfolio/ensemble-orientation.png' },
  { name: 'Respire', family: 'Écosystème Ensemble', description: 'Un espace d’accompagnement conçu pour soutenir sans remplacer le soin.', status: 'En préparation', mark: 'R', accent: '#86e8d9' },
  { name: 'Mon Tiroir Secret', family: 'Vie quotidienne', description: 'Un espace privé pour retrouver ses papiers et ses échéances.', status: 'Espace privé', mark: 'MT', accent: '#b89cff', href: 'https://mon-tiroir-secret-erwann.vercel.app', preview: '/portfolio/mon-tiroir-secret.png' },
  { name: 'Annuaire IA', family: 'Solutions professionnelles', description: 'Des annuaires spécialisés pour transformer une recherche en contact utile.', status: 'En préparation', mark: 'AI', accent: '#7fd68a' },
  { name: 'Bois Chiffrage', family: 'Solutions professionnelles', description: 'Des mesures, des postes et des devis dédiés aux travaux bois.', status: 'En préparation', mark: 'BC', accent: '#e6b86a' },
  { name: 'Artisan Express', family: 'Solutions professionnelles', description: 'Trois formules pour présenter son métier et ses réalisations : 300 €, 690 € et 1 290 €.', status: 'Offre publique', mark: 'AE', accent: '#67c1a0', href: 'https://artisan-express-ashy.vercel.app', preview: '/portfolio/artisan-express.png', video: '/portfolio/artisan-express-video.mp4' },
  { name: 'Audit Landing', family: 'Solutions professionnelles', description: 'Un audit visuel et fonctionnel qui transforme les défauts d’une page en priorités.', status: 'En préparation', mark: 'AL', accent: '#40e0d0' },
  { name: 'Look & Find', family: 'Accessibilité', description: 'La reconnaissance d’objets et de couleurs pour mieux comprendre son environnement.', status: 'Application à publier', mark: 'LF', accent: '#c0abff' },
  { name: 'Roussy & Zéphy', family: 'Création & transmission', description: 'La maison numérique d’un renard sensible et d’un zèbre ailé.', status: 'En ligne', mark: 'RZ', accent: '#ffb680', href: 'https://roussy-et-zephy.erwannchevallier.chatgpt.site', preview: '/portfolio/roussy-zephy.png' },
  { name: 'Accord — L’Éveil des couleurs', family: 'Accessibilité', description: 'Une application Android pour associer reconnaissance visuelle, couleurs et harmonie.', status: 'Application à publier', mark: 'A·EC', accent: '#ff8fab' },
  { name: 'TPChiffrage UTP', family: 'Solutions professionnelles · TP & VRD', description: 'Un outil de chiffrage pensé pour les travaux publics et les réseaux.', status: 'En ligne', mark: 'TP', accent: '#e6b86a', href: 'https://tpchiffrage-utp.erwannchevallier.chatgpt.site/', preview: '/portfolio/tpchiffrage.png' },
  { name: 'Amorce', family: 'Création assistée', description: 'Le studio qui transforme des rushes en montages verticaux dans le navigateur.', status: 'Prototype', mark: 'AM', accent: '#40e0d0', href: '/studio', preview: '/portfolio/amorce-studio.png' },
  { name: 'Conseiller Patrimoine & Financier', family: 'Patrimoine', description: 'Des repères structurés pour éclairer les décisions patrimoniales.', status: 'En préparation', mark: 'PF', accent: '#d9e34a' },
  { name: 'AvisLocal', family: 'Démonstrateur professionnel', description: 'Préparer une réponse personnalisée à un avis client.', status: 'Démonstrateur', mark: 'AL', accent: '#40e0d0', href: 'https://avislocal.erwannchevallier.chatgpt.site', preview: '/portfolio/avislocal.png' },
  { name: 'RecruteClair', family: 'Démonstrateur professionnel', description: 'Rendre une annonce et un parcours de recrutement plus clairs.', status: 'Démonstrateur', mark: 'RC', accent: '#58b8ff', href: 'https://recrute-clair.erwannchevallier.chatgpt.site', preview: '/portfolio/recruteclair.png' },
  { name: 'ImmoDéclic', family: 'Démonstrateur professionnel', description: 'Présenter une annonce immobilière sans inventer les caractéristiques du bien.', status: 'Démonstrateur', mark: 'ID', accent: '#7fd68a', href: 'https://immo-declic.erwannchevallier.chatgpt.site', preview: '/portfolio/immodeclic.png' },
  { name: 'Mémoire en voix', family: 'Création & transmission', description: 'Transformer des souvenirs en récits, livrets illustrés et créations audio.', status: 'Démonstrateur', mark: 'MV', accent: '#ffb680', href: 'https://memoire-en-voix.erwannchevallier.chatgpt.site', preview: '/portfolio/memoire-en-voix.png' },
  { name: 'Les Mots Justes', family: 'Création & transmission', description: 'Écrire un premier brouillon de discours à partir de ses propres mots.', status: 'Démonstrateur', mark: 'MJ', accent: '#b89cff', href: 'https://les-mots-justes.erwannchevallier.chatgpt.site', preview: '/portfolio/mots-justes.png' },
  { name: 'Mots & Merveilles', family: 'Création & transmission', description: 'Préparer une création personnalisée, entre image, émotion et mots.', status: 'Démonstrateur', mark: 'MM', accent: '#ff8fab', href: 'https://mots-et-merveilles.erwannchevallier.chatgpt.site', preview: '/portfolio/mots-merveilles.png' },
];

const orderedProjects = [...projects].sort((a, b) => Number(Boolean(b.href)) - Number(Boolean(a.href)));

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function UniversPage() {
  return (
    <main className="univers-page">
      <BrandNavigation items={[
        { label: 'Accueil', href: '#accueil' },
        { label: 'Ensemble', href: '#ensemble' },
        { label: 'Nos projets', href: '#projets' },
        { label: 'Contact', href: '#contact' },
      ]} />

      <div id="accueil">
        <ImmersiveHero
          eyebrow="Bretagne · Humain · Technologie · Demain"
          title="Un écosystème"
          highlight="pour un monde plus humain."
          description="Des applications et des sites utiles, beaux et inspirants pour simplifier le quotidien et ouvrir de nouveaux horizons."
          primaryLabel="Explorer nos projets"
          secondaryLabel="Notre mission"
          sceneImage="/brand/le-phare-double-exposure-v2.jpg"
          sceneAlt="Un zèbre breton face à l’océan, un phare allumé et des lumières turquoise et violettes."
          onPrimary={() => scrollTo('projets')}
          onSecondary={() => scrollTo('mission')}
        />
      </div>

      <section id="projets" className="univers-section univers-projects">
        <div id="ensemble" className="univers-projects__intro">
          <SectionHeading
            eyebrow="Un même horizon"
            title="Des projets qui éclairent le quotidien."
            copy="Les parcours Ensemble, les outils professionnels et les créations de Lefouzèbreizh Studio réunis au même endroit."
          />
          <p className="univers-projects__count"><strong>{projects.length}</strong><span>projets & démonstrateurs</span></p>
        </div>

        <div className="univers-project-grid">
          {orderedProjects.map((project, index) => (
            <article className="studio-project-card" key={project.name} style={{ '--project-accent': project.accent } as CSSProperties}>
              <div className="studio-project-card__top">
                <span className="studio-project-card__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="studio-project-card__mark" aria-hidden="true">{project.mark}</span>
                <span className="studio-project-card__status">{project.status}</span>
              </div>
              <div className="studio-project-card__preview">
                {project.video ? (
                  <video controls preload="none" playsInline poster={project.preview} aria-label={'Vidéo de présentation de ' + project.name}>
                    <source src={project.video} type="video/mp4" />
                    La vidéo de présentation n’est pas prise en charge par ce navigateur.
                  </video>
                ) : project.preview ? (
                  <Image
                    src={project.preview}
                    alt={'Visuel de ' + project.name}
                    fill
                    sizes="(min-width: 1700px) 18vw, (min-width: 1121px) 23vw, (min-width: 761px) 32vw, 50vw"
                    loading="lazy"
                    className="studio-project-card__image"
                  />
                ) : (
                  <div className="studio-project-card__art" aria-hidden="true"><span>{project.mark}</span><i /><small>{project.family}</small></div>
                )}
              </div>
              <p className="studio-project-card__family">{project.family}</p>
              <h3>{project.name}</h3>
              <p className="studio-project-card__description">{project.description}</p>
              {project.href ? (
                <a className="studio-project-card__link" href={project.href} {...(project.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                  Ouvrir le projet <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="studio-project-card__pending">Présentation en préparation</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="mission" className="univers-mission">
        <div>
          <p className="lfb-eyebrow">Lefouzèbreizh Studio · Bretagne</p>
          <h2>La technologie au service de l’humain.</h2>
          <p>Des outils qui rendent les prochaines étapes plus simples, plus lisibles et plus accessibles.</p>
        </div>
        <a id="contact" href="mailto:erwannchevallier@gmail.com?subject=Échange%20avec%20Lefouzèbreizh%20Studio">
          Contacter le Studio <span aria-hidden="true">↗</span>
        </a>
      </section>

      <BrandFooter>
        <a href="#accueil">Accueil</a>
        <a href="#ensemble">Ensemble</a>
        <a href="#projets">Nos projets</a>
        <a href="#contact">Contact</a>
        <a href="/mentions-legales">Mentions légales</a>
      </BrandFooter>
    </main>
  );
}