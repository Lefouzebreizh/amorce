'use client';

import type { CSSProperties } from 'react';
import { BrandFooter, BrandNavigation } from '../../../design-system/components/BrandShell';
import { ImmersiveHero } from '../../../design-system/components/ImmersiveHero';
import { GlassCard, SectionHeading } from '../../../design-system/components/LefouzebreizhUI';
import './univers.css';

type StudioProject = {
  name: string;
  family: string;
  description: string;
  status: string;
  mark: string;
  accent: string;
  href?: string;
};

const projects: StudioProject[] = [
  { name: 'Ensemble face aux démarches', family: 'Univers Ensemble', description: 'Des parcours administratifs calmes et guidés pour retrouver une prochaine étape claire.', status: 'Prototype privé', mark: 'ED', accent: '#40e0d0', href: 'https://ensemble-copilote-prive.erwannchevallier.chatgpt.site' },
  { name: 'Ensemble face au chômage', family: 'Univers Ensemble', description: 'Des repères concrets pour comprendre ses droits, organiser ses démarches et rebondir.', status: 'En préparation', mark: 'EC', accent: '#58b8ff' },
  { name: 'Ensemble au quotidien', family: 'Univers Ensemble', description: 'Le copilote des petites décisions, documents et échéances de la vie courante.', status: 'Prototype privé', mark: 'EQ', accent: '#7fd68a', href: 'https://ensemble-copilote-prive.erwannchevallier.chatgpt.site' },
  { name: 'Ensemble pour rénover', family: 'Univers Ensemble', description: 'Un parcours lisible pour préparer, chiffrer et suivre un projet de rénovation.', status: 'À auditer', mark: 'ER', accent: '#75d8c2' },
  { name: 'Ensemble pour entreprendre', family: 'Univers Ensemble', description: 'Des décisions structurées pour lancer et piloter une activité sans se perdre.', status: 'En préparation', mark: 'EE', accent: '#a78bfa' },
  { name: 'Ensemble pour s’orienter', family: 'Univers Ensemble', description: 'Une orientation attentive qui questionne, approfondit et remet les envies au centre.', status: 'À auditer', mark: 'EO', accent: '#72c7ff' },
  { name: 'Respire', family: 'Univers Ensemble', description: 'Un espace d’accompagnement psychique conçu pour soutenir sans remplacer le soin.', status: 'Cadre à valider', mark: 'R', accent: '#86e8d9' },
  { name: 'Mon Tiroir Secret', family: 'Vie quotidienne', description: 'Un coffre documentaire personnel pour garder ses papiers importants à portée de main.', status: 'En ligne', mark: 'MT', accent: '#b89cff', href: 'https://coffre-puce.vercel.app' },
  { name: 'Annuaire IA', family: 'Solutions professionnelles', description: 'Des annuaires spécialisés pensés pour transformer une recherche précise en contact utile.', status: 'À auditer', mark: 'AI', accent: '#7fd68a' },
  { name: 'Bois Chiffrage', family: 'Solutions professionnelles', description: 'Des mesures, des postes et un chiffrage de travaux bois réunis dans une lecture claire.', status: 'En préparation', mark: 'BC', accent: '#e6b86a' },
  { name: 'Artisans Express', family: 'Solutions professionnelles', description: 'Des vitrines métier rapides, rassurantes et conçues pour déclencher un premier contact.', status: 'Prêt à tester', mark: 'AE', accent: '#67c1a0' },
  { name: 'Audit Landing', family: 'Solutions professionnelles', description: 'Un audit visuel et fonctionnel qui transforme les défauts d’une page en priorités vérifiables.', status: 'Moteur en cours', mark: 'AL', accent: '#40e0d0' },
  { name: 'Look & Find', family: 'Accessibilité', description: 'La reconnaissance d’objets et de couleurs pour mieux comprendre ce qui se trouve devant soi.', status: 'À auditer', mark: 'LF', accent: '#c0abff' },
  { name: 'Roussy & Zéphy', family: 'Création & transmission', description: 'La maison numérique d’un renard sensible et d’un zèbre ailé, entre récit et émerveillement.', status: 'En ligne', mark: 'RZ', accent: '#ffb680', href: 'https://roussy-et-zephy.erwannchevallier.chatgpt.site' },
  { name: 'L’Éveil des couleurs', family: 'Création & transmission', description: 'Une expérience sensible où la couleur devient matière, émotion et mouvement.', status: 'En préparation', mark: 'EC', accent: '#ff8fab' },
  { name: 'Accord', family: 'Création & transmission', description: 'Un projet autour du lien, du rythme et de ce qui remet les personnes en harmonie.', status: 'En préparation', mark: 'A', accent: '#8cc8ff' },
  { name: 'Amorce', family: 'Création assistée', description: 'Le studio qui transforme des rushes en montage vertical, directement dans le navigateur.', status: 'Ouvert', mark: 'AM', accent: '#40e0d0', href: '/studio' },
  { name: 'Conseiller Patrimoine & Financier', family: 'Patrimoine', description: 'Une vue structurée du patrimoine pour préparer les bonnes questions et éclairer les décisions.', status: '18e expérience', mark: 'PF', accent: '#d9e34a' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function UniversPage() {
  return (
    <main className="univers-page">
      <BrandNavigation items={[
        { label: 'Signature', href: '#signature' },
        { label: '18 expériences', href: '#univers' },
        { label: 'Exigence', href: '#exigence' },
      ]} />

      <ImmersiveHero
        eyebrow="Bretagne · Création · Utilité"
        signal="Le Phare numérique est allumé"
        title="Donner forme"
        highlight="à ce qui compte."
        description="Lefouzèbreizh Studio imagine des expériences numériques utiles, sensibles et ambitieuses. Dix-huit projets, une même exigence : éclairer le chemin sans prendre la place de l’humain."
        primaryLabel="Explorer les 18 expériences"
        secondaryLabel="Découvrir la signature"
        sceneImage="/brand/studio-phare-hero.webp"
        sceneAlt="Un phare breton numérique éclaire une côte rocheuse dans une nuit turquoise et violette."
        onPrimary={() => scrollTo('univers')}
        onSecondary={() => scrollTo('signature')}
      />

      <section className="univers-signal" aria-label="Le Studio en chiffres">
        <div><strong>18</strong><span>expériences présentées</span></div>
        <div><strong>1</strong><span>langage visuel partagé</span></div>
        <div><strong>100 %</strong><span>pensé autour de l’usage</span></div>
        <p>Le Phare donne le cap. Chaque projet garde sa propre lumière.</p>
      </section>

      <section id="signature" className="univers-section univers-signature">
        <SectionHeading
          eyebrow="La signature Lefouzèbreizh"
          title="La lumière ne décore pas. Elle révèle."
          copy="Fond noir, reliefs profonds, verre sombre et lumière directionnelle composent la famille. La scène change avec chaque produit pour raconter son utilité réelle."
        />
        <div className="univers-pillars">
          <GlassCard eyebrow="01 · Cap" title="Un Phare numérique">Une scène cinématographique qui transforme les projets en repères visibles, sans masquer le message ni l’action.</GlassCard>
          <GlassCard eyebrow="02 · Matière" title="Des interfaces en relief">Des surfaces vitrées, des contours précis et une profondeur lente inspirée des expériences web les plus contemporaines.</GlassCard>
          <GlassCard eyebrow="03 · Mouvement" title="Une lumière vivante">Le curseur et les textes réveillent subtilement l’interface. Sur mobile ou en mouvement réduit, l’expérience reste légère et lisible.</GlassCard>
        </div>
      </section>

      <section id="univers" className="univers-section univers-projects">
        <div className="univers-projects__intro">
          <SectionHeading
            eyebrow="Le portefeuille"
            title="Dix-huit portes. Un même horizon."
            copy="Les accès affichés mènent uniquement vers des versions déjà disponibles. Les autres projets restent présentés sans faux bouton ni promesse de mise en ligne."
          />
          <div className="univers-orbit" aria-hidden="true"><span>18</span><small>projets</small></div>
        </div>

        <div className="univers-project-grid">
          {projects.map((project, index) => (
            <article className="studio-project-card" key={project.name} style={{ '--project-accent': project.accent } as CSSProperties}>
              <div className="studio-project-card__top">
                <span className="studio-project-card__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="studio-project-card__mark" aria-hidden="true">{project.mark}</span>
                <span className="studio-project-card__status">{project.status}</span>
              </div>
              <p className="studio-project-card__family">{project.family}</p>
              <h3>{project.name}</h3>
              <p className="studio-project-card__description">{project.description}</p>
              {project.href ? (
                <a className="studio-project-card__link" href={project.href} {...(project.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>Voir l’expérience <span aria-hidden="true">↗</span></a>
              ) : (
                <span className="studio-project-card__pending">Présentation en préparation</span>
              )}
            </article>
          ))}
        </div>
        <p className="univers-roadmap">Ensemble face aux amendes reste une piste de produit à étudier : il n’entre pas dans les dix-huit expériences tant que sa promesse, son cadre et son utilité ne sont pas validés.</p>
      </section>

      <section id="exigence" className="univers-section univers-quality">
        <div><p className="lfb-eyebrow">Le spectaculaire sous contrôle</p><h2>Grand art. Vraie utilité.</h2></div>
        <ol className="univers-quality-list">
          <li><span>01</span><strong>Émerveiller</strong><p>Une scène signature propre à chaque produit, jamais un effet générique recopié.</p></li>
          <li><span>02</span><strong>Rassurer</strong><p>Des parcours lisibles, des contrastes mesurés et une action principale immédiatement compréhensible.</p></li>
          <li><span>03</span><strong>S’adapter</strong><p>Clavier, tactile, petit écran et réduction du mouvement prévus dès la conception.</p></li>
          <li><span>04</span><strong>Prouver</strong><p>Chaque lien, formulaire et résultat contrôlé sur la version réellement accessible avant toute annonce de sortie.</p></li>
        </ol>
      </section>

      <BrandFooter>
        <a href="#signature">Signature</a>
        <a href="#univers">18 expériences</a>
        <a href="#exigence">Exigence</a>
      </BrandFooter>
    </main>
  );
}
