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
  { name: 'Artisan Express', family: 'Solutions professionnelles', description: 'Des vitrines métier rapides, rassurantes et conçues pour déclencher un premier contact.', status: 'Offre publique', mark: 'AE', accent: '#67c1a0', href: 'https://artisan-express-ashy.vercel.app' },
  { name: 'Audit Landing', family: 'Solutions professionnelles', description: 'Un audit visuel et fonctionnel qui transforme les défauts d’une page en priorités vérifiables.', status: 'Moteur en cours', mark: 'AL', accent: '#40e0d0' },
  { name: 'Look & Find', family: 'Accessibilité', description: 'La reconnaissance d’objets et de couleurs pour mieux comprendre ce qui se trouve devant soi.', status: 'À auditer', mark: 'LF', accent: '#c0abff' },
  { name: 'Roussy & Zéphy', family: 'Création & transmission', description: 'La maison numérique d’un renard sensible et d’un zèbre ailé, entre récit et émerveillement.', status: 'En ligne', mark: 'RZ', accent: '#ffb680', href: 'https://roussy-et-zephy.erwannchevallier.chatgpt.site' },
  { name: 'L’Éveil des couleurs', family: 'Création & transmission', description: 'Une expérience sensible où la couleur devient matière, émotion et mouvement.', status: 'En préparation', mark: 'EC', accent: '#ff8fab' },
  { name: 'Accord', family: 'Création & transmission', description: 'Un projet autour du lien, du rythme et de ce qui remet les personnes en harmonie.', status: 'En préparation', mark: 'A', accent: '#8cc8ff' },
  { name: 'Amorce', family: 'Création assistée', description: 'Le studio qui transforme des rushes en montage vertical, directement dans le navigateur.', status: 'Prototype en développement', mark: 'AM', accent: '#40e0d0', href: '/studio' },
  { name: 'Conseiller Patrimoine & Financier', family: 'Patrimoine', description: 'Une vue structurée du patrimoine pour préparer les bonnes questions et éclairer les décisions.', status: 'Prévu', mark: 'PF', accent: '#d9e34a' },
];

const publicProofs = [
  { name: 'AvisLocal', description: 'Génère localement une réponse personnalisée à partir de l’enseigne, de la note et du ton choisi.', href: 'https://avislocal.erwannchevallier.chatgpt.site', mark: 'AL' },
  { name: 'RecruteClair', description: 'Analyse localement la clarté d’une annonce et met à jour un score indicatif selon l’intitulé, les missions et l’information salariale.', href: 'https://recrute-clair.erwannchevallier.chatgpt.site', mark: 'RC' },
  { name: 'ImmoDéclic', description: 'Propose un diagnostic interactif d’annonce avec score, verdict et conseil, sans inventer les caractéristiques du bien.', href: 'https://immo-declic.erwannchevallier.chatgpt.site', mark: 'ID' },
  { name: 'Mémoire en voix', description: 'Oriente une demande de récit ou de transmission vers une formule selon la durée et le type de création choisi.', href: 'https://memoire-en-voix.erwannchevallier.chatgpt.site', mark: 'MV' },
  { name: 'Les Mots Justes', description: 'Guide l’utilisateur en quatre étapes et génère un premier brouillon à partir de ses réponses, avec sauvegarde locale et estimation du temps de lecture.', href: 'https://les-mots-justes.erwannchevallier.chatgpt.site', mark: 'MJ' },
  { name: 'Mots & Merveilles', description: 'Permet de choisir une ambiance, préparer une demande personnalisée et la télécharger si la messagerie ne s’ouvre pas.', href: 'https://mots-et-merveilles.erwannchevallier.chatgpt.site', mark: 'MM' },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function UniversPage() {
  return (
    <main className="univers-page">
      <BrandNavigation items={[
        { label: 'Offre', href: '#offre' },
        { label: 'Réalisations', href: '#realisations' },
        { label: 'Studio', href: '#studio' },
      ]} />

      <ImmersiveHero
        eyebrow="Bretagne · Création · Utilité"
        signal="Le Phare numérique est allumé"
        title="Donner forme"
        highlight="à ce qui compte."
        description="Lefouzèbreizh Studio imagine des expériences numériques utiles, sensibles et ambitieuses. Dix-huit projets, une même exigence : éclairer le chemin sans prendre la place de l’humain."
        primaryLabel="Découvrir l’offre"
        secondaryLabel="Voir les réalisations"
        sceneImage="/brand/studio-phare-hero.webp"
        sceneAlt="Un phare breton numérique éclaire une côte rocheuse dans une nuit turquoise et violette."
        onPrimary={() => scrollTo('offre')}
        onSecondary={() => scrollTo('realisations')}
      />

      <section className="univers-signal" aria-label="Le Studio en chiffres">
        <div><strong>6</strong><span>démonstrateurs publics sélectionnés</span></div>
        <div><strong>3</strong><span>axes commerciaux prioritaires</span></div>
        <div><strong>18</strong><span>projets recensés dans la feuille de route</span></div>
        <p>Une activité récente, des preuves visibles et une priorité commerciale resserrée.</p>
      </section>

      <section id="offre" className="univers-section bank-offer">
        <SectionHeading
          eyebrow="L’activité commerciale"
          title="Trois offres. Une priorité claire."
          copy="Le Studio concentre maintenant son développement sur les sites professionnels, l’audit et la maintenance. L’offre déjà publiée est distinguée des services encore en structuration."
        />
        <div className="bank-offer-grid">
          <article className="bank-offer-card bank-offer-card--active">
            <p className="bank-offer-card__status">Offre publique actuelle</p>
            <h3>Artisan Express</h3>
            <p className="bank-offer-card__price">300 €</p>
            <p>Une page professionnelle claire pour présenter son activité et faciliter le premier contact.</p>
            <ul><li>Une page vitrine</li><li>Sans abonnement Artisan Express</li><li>Nom de domaine en supplément</li></ul>
            <a href="https://artisan-express-ashy.vercel.app" target="_blank" rel="noreferrer">Voir l’offre publiée <span aria-hidden="true">↗</span></a>
          </article>
          <article className="bank-offer-card">
            <p className="bank-offer-card__status">Structuration commerciale</p>
            <h3>Audit & correction</h3>
            <p className="bank-offer-card__price">Du diagnostic à la reprise</p>
            <p>Une gamme progressive qui distingue clairement ce qui fonctionne déjà de ce qui doit encore être éprouvé.</p>
            <ul><li>Déclic : diagnostic gratuit fonctionnel</li><li>Audit Landing : futur rapport payant, commandes fermées jusqu’à preuve complète</li><li>Reprise humaine premium : sur devis après cadrage</li></ul>
            <a href="mailto:erwannchevallier@gmail.com?subject=Parler%20de%20mon%20application">Parler de mon application <span aria-hidden="true">→</span></a>
          </article>
          <article className="bank-offer-card">
            <p className="bank-offer-card__status">Récurrence envisagée</p>
            <h3>Maintenance Sérénité</h3>
            <p className="bank-offer-card__price">Sur devis <small>offre en structuration</small></p>
            <p>Une maintenance bornée pour sécuriser, actualiser et améliorer les sites livrés.</p>
            <ul><li>Suivi régulier</li><li>Corrections encadrées</li><li>Contenu exact à contractualiser</li></ul>
            <span className="bank-offer-card__pending">Hypothèse commerciale prudente</span>
          </article>
        </div>
        <p className="bank-disclaimer">Artisan Express est l’offre actuellement affichée au public. Les commandes Audit Landing restent fermées tant que le parcours paiement → rapport n’est pas prouvé. La maintenance et les autres niveaux d’audit sont des hypothèses de structuration : ils ne constituent ni des commandes signées ni du chiffre d’affaires acquis.</p>
      </section>

      <section id="realisations" className="univers-section bank-proofs">
        <div className="bank-proofs__intro">
          <SectionHeading
            eyebrow="Preuves visibles"
            title="Six réalisations à ouvrir maintenant."
            copy="Ces démonstrateurs publics montrent la capacité du Studio à transformer un besoin en expérience numérique publique, lisible et utilisable."
          />
          <p>Démonstrateurs publics fonctionnels, prêts à tester. Les fonctions indiquées ont été contrôlées ; la validation commerciale, les transactions réelles et la livraison de bout en bout restent à confirmer.</p>
        </div>
        <div className="bank-proof-grid">
          {publicProofs.map((proof, index) => (
            <article className="bank-proof-card" key={proof.name}>
              <div><span>{String(index + 1).padStart(2, '0')}</span><b aria-hidden="true">{proof.mark}</b></div>
              <h3>{proof.name}</h3>
              <p>{proof.description}</p>
              <a href={proof.href} target="_blank" rel="noreferrer">Ouvrir le démonstrateur <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
      </section>

      <section id="studio" className="univers-section bank-founder">
        <div className="bank-founder__identity">
          <p className="lfb-eyebrow">Le porteur du projet</p>
          <h2>Erwann Chevallier</h2>
          <p>Fondateur de Lefouzèbreizh Studio · micro-entreprise créée le 31 août 2026</p>
        </div>
        <div className="bank-founder__story">
          <h3>Du terrain au numérique.</h3>
          <p>Après vingt ans dans les travaux publics et sur la route, Erwann transforme aujourd’hui sa connaissance des professionnels de terrain et sa maîtrise des outils d’intelligence artificielle en une activité numérique structurée.</p>
          <p>Le cap est volontairement resserré : commercialiser Artisan Express, consolider une offre d’audit vérifiable, puis construire un revenu récurrent de maintenance.</p>
          <div className="bank-founder__actions">
            <a href="mailto:erwannchevallier@gmail.com?subject=Échange%20avec%20Lefouzèbreizh%20Studio">Contacter le Studio <span aria-hidden="true">→</span></a>
            <a href="#univers">Voir les 18 projets recensés</a>
          </div>
        </div>
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
            title="Dix-huit projets. Un même horizon."
            copy="Cette feuille de route réunit des démonstrateurs, des prototypes et des projets prévus. Les accès affichés mènent uniquement vers des versions déjà disponibles."
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
        <p className="univers-roadmap">Ensemble face aux amendes reste une piste de produit à étudier : il n’entre pas dans les dix-huit projets tant que sa promesse, son cadre et son utilité ne sont pas validés.</p>
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
        <a href="#offre">Offre</a>
        <a href="#realisations">Réalisations</a>
        <a href="mailto:erwannchevallier@gmail.com">Contact</a>
        <a href="/mentions-legales">Mentions légales</a>
      </BrandFooter>
    </main>
  );
}
