import { ApercuSite } from '@/components/ApercuSite';

/*
 * Le téléphone du haut de page — et ce qu'il montre est un vrai site livré.
 *
 * CE QUI A CHANGÉ, ET POURQUOI C'ÉTAIT UN DOUBLON.
 *
 * Ce fichier dessinait à la main un site d'artisan : un en-tête d'accent, trois
 * boutons, trois vignettes de chantier, une ligne d'avis, un bandeau d'appel.
 * L'intention était juste — « une capture serait de toute façon fausse, le site
 * montré n'existe pas encore » — et elle a cessé de l'être le jour où six vrais
 * modèles sont entrés dans `public/modeles/`. À partir de là, la page portait
 * **deux réponses au même besoin** : un site dessiné ici, et six sites
 * véritables à trois écrans plus bas. C'est exactement le doublon que le dépôt
 * refuse : les deux divergent au premier changement de charte, et c'est le
 * dessin — celui que personne ne pense à mettre à jour — qui gagne la moitié
 * des regards.
 *
 * Le cadre reste, le contenu part. Ce que ce fichier apportait vraiment n'était
 * pas le faux site : c'était le **halo de chantier** et la coque du téléphone,
 * qui disent « voilà comment ça se voit dans une main » — et ça, aucune page
 * livrée ne peut le dire d'elle-même.
 *
 * LA MAÇONNERIE PLUTÔT QU'UN AUTRE MÉTIER.
 *
 * Le dessin d'avant montrait une maçonnerie, et le premier mot de la page est
 * « Maçon ». On garde donc `/modeles/macon.html`, qui est la même entreprise
 * que la troisième carte de la galerie — un visiteur qui descend retrouve le
 * site qu'il a vu en arrivant, en entier cette fois.
 *
 * `aria-hidden` sur l'enveloppe : rien de ce cadre n'a de sens lu à voix haute.
 * C'est une image, et elle est décrite par le texte qui l'entoure.
 */
export function MockupChantier() {
  return (
    <div className="relative mx-auto w-full max-w-[20rem]" aria-hidden="true">
      {/* Le fond de chantier : bandes de signalisation et poussière de lumière,
          posées au gradient plutôt qu'en image.

          Il était en dégradé bleu clair, et il éclairait tout le bloc au milieu
          d'une page sombre — le téléphone flottait dans une tache blanche. Il
          prend le voile de la charte, qui est exactement ce que fait l'entête
          d'un site livré : un halo, pas un aplat. */}
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-90"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, var(--color-voile) 0%, var(--color-slab) 55%, var(--color-ink) 100%)',
        }}
      />
      <div
        className="absolute inset-0 -m-6 rounded-[2.5rem] opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(135deg, var(--color-accent) 0 14px, transparent 14px 34px)',
        }}
      />
      {/*
        Le voile violet, et c'est la seule chose que le violet fait ici : un
        halo derrière l'épaule du téléphone, sans un mot dessus. Sa mesure de
        contraste — 3,42:1, écrite dans `globals.css` — ne s'y applique pas,
        puisqu'il n'y a rien à lire.
      */}
      <div
        className="absolute -left-10 -top-8 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: 'var(--color-violet-voile)' }}
      />

      <div className="relative rounded-[2.25rem] border border-edge bg-ink p-2 shadow-2xl">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-ink">
          {/*
            La barre d'état et son encoche, en `ink` : le site commence en
            dessous. Le premier jet posait l'encoche **par-dessus** l'aperçu,
            comme sur un vrai téléphone — et elle mangeait le nom de
            l'entreprise, qui est la première chose que le site dit. Un détail
            de réalisme qui coûte l'argument ne vaut pas d'être gardé.
          */}
          <div className="flex h-7 items-center justify-center bg-ink">
            <span className="block h-4 w-20 rounded-full bg-slab" />
          </div>

          <ApercuSite
            chargement="eager"
            contour=""
            fichier="/modeles/macon.html"
            hauteur="h-[26rem]"
            titre="Aperçu d’un site d’artisan livré, ouvert sur un téléphone"
          />
        </div>
      </div>
    </div>
  );
}
