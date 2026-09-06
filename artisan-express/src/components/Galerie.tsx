import { SECTION, TITRE_SECTION } from '@/components/ui';

/*
 * La galerie des six modèles de métier.
 *
 * CE QU'ELLE MONTRE, ET CE QU'ELLE NE PRÉTEND PAS MONTRER.
 *
 * « Voilà ce que je produis », jamais « voilà mes clients ». Les six
 * entreprises sont inventées, et chaque page le dit dans sa propre
 * présentation — pas en petits caractères en bas. C'est la condition pour que
 * cette section coexiste avec `Temoignage`, qui dit courageusement que la
 * place du premier client est vide : une galerie de six « réalisations »
 * démentirait cette phrase à trois écrans d'intervalle, et c'est la phrase qui
 * a raison.
 *
 * Le dépôt n'a pourtant pas manqué de matière : dix-sept pages nominatives
 * existent, préparées pour de vraies entreprises qui n'ont rien demandé. Les
 * afficher ici en ferait des références — un mensonge sur la clientèle, et la
 * publication de données de tiers. Elles restent hors du dépôt.
 *
 * POURQUOI LA COULEUR CHANGE À CHAQUE CARTE.
 *
 * C'est l'argument, pas la décoration. Six pages du même gris prouveraient
 * qu'il existe un gabarit ; six pages qui se ressemblent par la structure et
 * diffèrent par la teinte prouvent qu'il est remis au métier — ce que le
 * prospect veut savoir avant de payer. La teinte de chaque carte est celle que
 * `titan-builder/src/lib/charte.ts` donne à ce corps de métier, donc exactement
 * celle de la page qui s'ouvre derrière.
 *
 * Ces teintes-là ne portent aucun texte : elles vivent dans un filet, et les
 * mots restent en `encre` et `ardoise`. C'est ce qui permet de les employer
 * sans mesurer six contrastes contre les surfaces de *cette* page-ci — elles
 * ont été mesurées contre celles des sites livrés, qui ne sont pas les mêmes.
 *
 * ET UN SEUL BOUTON PLEIN PAR ÉCRAN.
 *
 * Les cartes sont donc des surfaces cliquables, pas des boutons d'accent :
 * celui qui fait avancer la vente reste ailleurs. La carte entière est le lien,
 * ce qui donne une cible bien au-delà du plancher tactile de 44 px du §2.
 */

type Modele = {
  readonly metier: string;
  readonly entreprise: string;
  readonly ville: string;
  readonly promesse: string;
  readonly teinte: string;
  readonly fichier: string;
};

/*
 * Écrit à la main plutôt qu'importé de `titan-builder` : deux projets npm
 * distincts ne peuvent pas s'importer l'un l'autre, c'est déjà le cas de la
 * charte de couleurs et `tests/charte.test.ts` garde cet écart-là en relisant
 * le fichier voisin en texte. Ici c'est `tests/galerie.test.ts` qui refuse
 * qu'une carte pointe vers une page qui n'existe pas.
 */
const MODELES: readonly Modele[] = [
  {
    metier: 'Couvreur',
    entreprise: 'Toitures Le Goff',
    ville: 'Ploërmel',
    promesse: 'Ardoise, zinc, Velux. Devis sous 48 h.',
    teinte: '#2f6f4e',
    fichier: '/modeles/couvreur.html',
  },
  {
    metier: 'Électricien',
    entreprise: 'Le Bihan Électricité',
    ville: 'Vannes',
    promesse: 'Mise aux normes et dépannage.',
    teinte: '#1f5f8b',
    fichier: '/modeles/electricien.html',
  },
  {
    metier: 'Maçon',
    entreprise: 'Maçonnerie Kervran',
    ville: 'Lorient',
    promesse: 'Maçonnerie générale, 30 km autour.',
    teinte: '#8a5a2b',
    fichier: '/modeles/macon.html',
  },
  {
    metier: 'Serrurier',
    entreprise: 'Clé Douce Serrurerie',
    ville: 'Quimper',
    promesse: 'Ouverture de porte, 7 j/7.',
    teinte: '#7a3f6d',
    fichier: '/modeles/serrurier.html',
  },
  {
    metier: 'Paysagiste',
    entreprise: 'Jardins du Scorff',
    ville: 'Pontivy',
    promesse: 'Création et entretien à l’année.',
    teinte: '#4d7c2f',
    fichier: '/modeles/paysagiste.html',
  },
  {
    metier: 'Plombier',
    entreprise: 'Guillou Plomberie',
    ville: 'Saint-Brieuc',
    promesse: 'Fuite traitée le jour même.',
    teinte: '#2a6f7a',
    fichier: '/modeles/plombier.html',
  },
];

export function Galerie() {
  return (
    <section className={SECTION} id="galerie">
      <h2 className={TITRE_SECTION}>Six métiers, six sites</h2>

      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ardoise">
        <p>
          Voilà ce que je produis. Ce ne sont pas mes clients :{' '}
          <strong className="text-encre">ces six entreprises n’existent pas</strong>, et chaque page
          le dit d’elle-même, en toutes lettres. Le jour où un vrai artisan sera là, il sera plus bas
          — à la place qui l’attend.
        </p>
        <p>
          Ce qui change d’une page à l’autre, c’est la couleur et les mots du métier. Ce qui ne
          change pas, c’est la structure : elle a été réglée une fois, sur un téléphone, et c’est
          elle qui fait qu’un client appelle.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {MODELES.map((modele) => (
          <li key={modele.fichier}>
            <a
              className="flex h-full flex-col rounded-2xl border border-edge bg-slab p-5 transition-colors hover:bg-panel"
              href={modele.fichier}
            >
              {/*
                Le filet porte la teinte du métier. `aria-hidden` parce qu'il ne
                dit rien qu'un lecteur d'écran ne lise déjà dans le nom du
                métier, juste en dessous.
              */}
              <span
                aria-hidden
                className="block h-1.5 w-14 rounded-full"
                style={{ backgroundColor: modele.teinte }}
              />
              {/*
                Tout est à 18 px au moins — `text-lg` — et rien en dessous.
                Le premier jet mettait le métier en `text-sm` majuscules, la
                convention habituelle d'une étiquette de carte : le contrôle du
                pouce l'a mesuré à **15,75 px**, sous le plancher du §2. Les
                tests unitaires, le typage et le build étaient verts.

                La hiérarchie a donc changé plutôt que la taille : c'est le
                métier qu'un artisan cherche des yeux, pas le nom d'une
                entreprise qui n'existe pas. Il passe devant.
              */}
              <span className="mt-4 text-xl font-bold text-encre">{modele.metier}</span>
              <span className="mt-1 text-lg text-ardoise">
                {modele.entreprise} — {modele.ville}
              </span>
              <span className="mt-3 text-lg leading-relaxed text-ardoise">{modele.promesse}</span>
              <span className="mt-4 text-lg font-semibold text-accent">Ouvrir le site →</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-lg leading-relaxed text-ardoise">
        Chacune de ces pages sort en <code className="text-encre">noindex</code> : une entreprise
        inventée n’a rien à faire dans les résultats de recherche à côté de vrais artisans.
      </p>
    </section>
  );
}
