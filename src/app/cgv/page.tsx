import type { Metadata } from 'next';

import { Bloc, PageTexte } from '@/components/PageTexte';

export const metadata: Metadata = {
  title: 'Conditions de vente — Amorce',
  description: 'Ce que vous achetez, comment vous le recevez, et ce que vous pouvez annuler.',
};

/**
 * Les conditions générales de vente.
 *
 * ## Le point qui compte vraiment, et qu'on oublie toujours
 *
 * Un contenu numérique livré immédiatement fait perdre le droit de rétractation
 * de quatorze jours — mais **seulement si l'acheteur y a expressément renoncé
 * avant le paiement** (article L221-28 13° du code de la consommation). Sans
 * cette case, le délai court malgré la livraison, et le vendeur doit rembourser.
 *
 * La case n'existe pas encore : elle se pose dans la page de paiement Stripe, le
 * jour où celle-ci est branchée. Le texte ci-dessous la décrit donc telle
 * qu'elle sera, et le bloc de tête de `Accueil.tsx` rappelle que rien ne se vend
 * tant que ce chemin n'existe pas.
 *
 * ## Ce qui n'est pas écrit parce qu'il n'existe pas
 *
 * Le médiateur de la consommation. La loi impose à tout professionnel qui vend
 * à des particuliers d'en désigner un, et cela se souscrit auprès d'un organisme
 * agréé. En nommer un qu'on n'a pas serait un faux ; la section le dit et
 * attend le vrai.
 */
export default function Page() {
  return (
    <PageTexte titre="Conditions générales de vente" miseAJour="2 septembre 2026">
      <Bloc titre="Qui vend">
        <p>
          Erwann Chevallier, entrepreneur individuel, 20a rue Clotilde Vautier,
          35000 Rennes.
        </p>
        <a href="/mentions-legales" className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Coordonnées complètes — mentions légales
        </a>
      </Bloc>

      <Bloc titre="Ce que vous achetez">
        <p>
          Une licence d’utilisation d’Amorce, studio de montage vidéo qui
          fonctionne dans votre navigateur. Elle ouvre l’export en pleine
          définition et l’export sans signature.
        </p>
        <p>
          <strong className="text-mist">C’est un achat unique, pas un abonnement.</strong>{' '}
          Rien ne se renouvelle, rien n’est prélevé ensuite.
        </p>
        <p>
          Le montage lui-même — importer, couper, sous-titrer, sonoriser,
          exporter — reste utilisable sans licence.
        </p>
      </Bloc>

      <Bloc titre="Prix">
        <p>
          <strong className="text-mist">49 € pour la licence</strong>, payables une
          fois.
        </p>
        <p className="text-base">
          TVA non applicable, article 293 B du code général des impôts. Le prix
          affiché est celui que vous payez.
        </p>
      </Bloc>

      <Bloc titre="Paiement">
        <p>
          Le paiement se fait par carte bancaire via <strong className="text-mist">Stripe</strong>.
          Amorce ne voit ni ne conserve vos données bancaires.
        </p>
      </Bloc>

      <Bloc titre="Livraison">
        <p>
          Votre clé de licence s’affiche <strong className="text-mist">immédiatement</strong>{' '}
          après le paiement, sur la page où Stripe vous renvoie. Vous la collez
          dans le studio, à l’étape Exporter.
        </p>
        <p>
          Elle reste enregistrée dans le navigateur de cet appareil. Il n’y a ni
          compte, ni mot de passe. Si vous changez d’appareil ou effacez vos
          données de navigation, vous recollez la même clé.
        </p>
        <p className="text-base">
          Gardez-la quelque part : c’est votre seule preuve d’achat côté
          utilisateur.
        </p>
      </Bloc>

      <Bloc titre="Droit de rétractation">
        <p>
          Vous disposez normalement de quatorze jours pour changer d’avis sur un
          achat en ligne.
        </p>
        <p>
          Parce que la licence est livrée immédiatement, il vous sera demandé,
          <strong className="text-mist"> avant le paiement</strong>, de renoncer
          expressément à ce délai — c’est ce que prévoit l’article L221-28 13° du
          code de la consommation. Sans cet accord, le délai s’applique et le
          remboursement est de droit.
        </p>
        <p>
          Vous pouvez essayer le studio entier gratuitement avant d’acheter :
          c’est le meilleur moyen de savoir s’il vous convient, et c’est pour ça
          qu’il est ouvert.
        </p>
      </Bloc>

      <Bloc titre="Si quelque chose ne marche pas">
        <p>
          Les garanties légales de conformité et des vices cachés s’appliquent
          (articles L217-3 et suivants du code de la consommation, articles 1641
          et suivants du code civil).
        </p>
        <p>
          Concrètement : si votre clé n’est pas reconnue ou si l’export en pleine
          définition ne s’ouvre pas, écrivez — c’est la même personne qui répond,
          et le problème est réparé ou remboursé.
        </p>
        <a href="mailto:erwannchevallier@gmail.com" className="inline-flex min-h-11 items-center text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          erwannchevallier@gmail.com
        </a>
      </Bloc>

      <Bloc titre="Ce dont Amorce ne répond pas">
        <p>
          L’export au format MP4 demande Chrome ou Edge. Sur un autre navigateur,
          le fichier sort dans un format différent — c’est écrit sur la page
          d’accueil, et ce n’est pas un défaut de la licence.
        </p>
        <p>
          Vos fichiers ne quittant jamais votre appareil, ils ne sont sauvegardés
          nulle part. Un navigateur vidé, c’est un montage perdu : exportez ce qui
          compte.
        </p>
      </Bloc>

      <Bloc titre="Litiges">
        <p>
          En cas de désaccord, écrivez d’abord — la plupart des choses se règlent
          en un message.
        </p>
        <p className="text-base">
          La désignation d’un médiateur de la consommation est en cours et sera
          publiée ici. En attendant, vous pouvez saisir la plateforme européenne
          de règlement des litiges en ligne.
        </p>
        <p className="text-base">
          Droit applicable : droit français.
        </p>
      </Bloc>
    </PageTexte>
  );
}
