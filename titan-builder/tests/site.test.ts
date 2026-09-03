import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  accentLisible, contraste, couleurRetenue, echapper, encreSurAccent, genererSite,
  lienTelephonique, servicesListes,
} from '@/lib/site';
import type { Commande } from '@/lib/commande';
import { TEINTES } from '@/lib/charte';

function commande(remplacements: Partial<Commande> = {}): Commande {
  return {
    modele: 'btp',
    entreprise: 'Maçonnerie Dupont',
    telephone: '06 12 34 56 78',
    ville: 'Rennes',
    couleur: '',
    slogan: '',
    presentation: '',
    services: '',
    options: [],
    ...remplacements,
  };
}

test("le nom d'entreprise ne peut pas injecter de balise", () => {
  /*
   * Le nom vient d'un formulaire public et part sur le site d'un client, sous
   * son nom de domaine. Sans échappement, une commande piégée produirait un
   * site qui exécute du code chez lui.
   */
  const html = genererSite(commande({ entreprise: '<script>alert(1)</script>' }));

  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('le slogan et les services sont échappés aussi', () => {
  const html = genererSite(
    commande({ slogan: '"><img>', services: 'Toiture\n<b>Charpente</b>' }),
  );

  assert.equal(html.includes('<img>'), false);
  assert.equal(html.includes('<b>Charpente</b>'), false);
});

test('la teinte livrée vient toujours de la charte, jamais de la saisie', () => {
  /*
   * Ce test disait « une couleur libre est refusée, celle du modèle prend le
   * relais », et il ne gardait qu'une chose : l'absence d'injection CSS. Un
   * `#ff8800` passait donc — un orange franc sur un site livré.
   *
   * Ce qui est gardé maintenant est la promesse entière : **aucun chemin ne
   * produit une couleur hors charte.** Ni une injection, ni un orange, ni un
   * champ vide, ni un vieux dossier.
   */
  assert.equal(couleurRetenue(commande({ couleur: 'plombier' })), '#3eadd4');
  assert.equal(couleurRetenue(commande({ couleur: '#2f6f4e' })), '#4fb39c', 'le vieux vert de Tanguy');
  assert.equal(couleurRetenue(commande({ couleur: 'red; } body { display:none' })), '#4fb39c');
  assert.equal(couleurRetenue(commande({ couleur: '#ff8800' })), '#4fb39c', 'l’orange ne passe pas');
  assert.equal(couleurRetenue(commande({ couleur: '' })), '#4fb39c');
});

test('ce qui n’est pas rempli disparaît, jamais un texte de remplacement', () => {
  const html = genererSite(commande());

  assert.equal(html.includes('Qui je suis'), false);
  assert.equal(html.includes('Ce que je fais'), false);
  assert.equal(html.includes('réalisations'), false);
  // Et rien qui ressemble à un gabarit resté en place.
  assert.equal(/\[[^\]]*votre[^\]]*\]/i.test(html), false);
});

test('un bouton sans sa donnée ne sort pas', () => {
  /*
   * Un bouton WhatsApp sans numéro serait un lien mort sur la page d'un client
   * qui a payé — pire qu'un bouton en moins.
   */
  const html = genererSite(commande({ options: ['appel', 'whatsapp'], telephone: '' }));

  assert.equal(html.includes('wa.me'), false);
  assert.equal(html.includes('tel:'), false);
});

test('les boutons sortent quand l’option et la donnée sont là', () => {
  const html = genererSite(commande({ options: ['appel', 'whatsapp'] }));

  assert.ok(html.includes('tel:+33612345678'));
  assert.ok(html.includes('wa.me/33612345678'));
});

test('une option non cochée ne fabrique pas son bouton', () => {
  const html = genererSite(commande({ options: ['appel'] }));

  assert.ok(html.includes('tel:'));
  assert.equal(html.includes('wa.me'), false);
});

test('les photos sont désignées en relatif', () => {
  /*
   * Un chemin absolu ferait un site qui marche chez celui qui l'a fabriqué et
   * nulle part ailleurs — or le dossier produit doit se déposer tel quel.
   */
  const html = genererSite(commande(), [{ fichier: '01-chantier.jpg' }]);

  assert.ok(html.includes('src="01-chantier.jpg"'));
  assert.equal(html.includes('src="/'), false);
});

test('chaque photo porte un texte de remplacement', () => {
  const html = genererSite(commande(), [{ fichier: '01-a.jpg' }]);

  assert.ok(html.includes('alt="Chantier de Maçonnerie Dupont"'));
});

test('les services se coupent aux lignes et aux points-virgules', () => {
  assert.deepEqual(
    servicesListes(commande({ services: ' Toiture \n\n Zinguerie ; Charpente ' })),
    ['Toiture', 'Zinguerie', 'Charpente'],
  );
});

test('le numéro devient un lien international', () => {
  assert.equal(lienTelephonique('06 12 34 56 78'), '+33612345678');
  assert.equal(lienTelephonique('+33612345678'), '+33612345678');
});

test('la page est un document complet et déclare le français', () => {
  const html = genererSite(commande());

  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<html lang="fr">'));
  assert.ok(html.includes('name="viewport"'));
  assert.ok(html.trimEnd().endsWith('</html>'));
});

test('echapper couvre les cinq caractères', () => {
  assert.equal(echapper(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('le site tient sans réseau et sans racine de domaine', () => {
  /*
   * La page livrée est déposée sous un sous-dossier — `/nom-du-client/` sur
   * GitHub Pages — et souvent ouverte hors ligne pour être montrée. Une seule
   * référence absolue ou distante suffirait à la vider de son style ou de ses
   * images, sans le moindre message pour dire pourquoi.
   */
  const html = genererSite(
    commande({ options: ['appel', 'whatsapp'], presentation: 'Je suis maçon.' }),
    [{ fichier: '01-a.jpg' }],
  );

  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const externes = references.filter(
    (r) => r.startsWith('/') || r.startsWith('http://') || r.startsWith('//'),
  );

  assert.deepEqual(externes, []);
  // Les seuls liens sortants admis sont ceux que le visiteur déclenche.
  const distants = references.filter((r) => r.startsWith('https://'));
  assert.ok(distants.every((r) => r.startsWith('https://wa.me/')));
});

test('aucune police ni feuille de style distante', () => {
  // Une police Google sur le site d'un artisan, c'est une page qui s'affiche
  // en Times le jour où le réseau du chantier est mauvais.
  const html = genererSite(commande());

  assert.equal(html.includes('fonts.googleapis'), false);
  assert.equal(html.includes('<link rel="stylesheet"'), false);
});

test('la présentation garde ses paragraphes, et le simple retour ne coupe pas', () => {
  /*
   * Le texte vient d'un `<textarea>` : l'artisan y aère son propos. Tout rendre
   * dans un seul `<p>` collait ses paragraphes bout à bout, et un simple retour
   * à la ligne au milieu d'une phrase ne doit pas, lui, fabriquer un paragraphe.
   */
  const html = genererSite(
    commande({ presentation: 'Premier paragraphe.\n\nSecond.\nMême phrase.' }),
  );

  assert.match(html, /<p>Premier paragraphe\.<\/p>/);
  assert.match(html, /<p>Second\. Même phrase\.<\/p>/);
});

test('le contraste se calcule comme WCAG le définit', () => {
  // Les deux bornes de l'échelle, qui valident l'implémentation d'un coup.
  assert.equal(Math.round(contraste('#000000', '#ffffff')), 21);
  assert.equal(contraste('#777777', '#777777'), 1);
});

test('on écrit sur la couleur du client ce qui s’y lit, pas toujours du blanc', () => {
  /*
   * Le défaut réparé ici : un artisan qui demande du jaune recevait un titre
   * blanc sur jaune, à 1,4:1 — invisible sur un chantier en plein soleil.
   */
  assert.equal(encreSurAccent('#ffd400'), '#16202b');
  assert.equal(encreSurAccent('#004aad'), '#ffffff');
});

test('la couleur du client devient lisible en texte sans changer de teinte', () => {
  const lisible = accentLisible('#ffd400', '#ffffff');

  assert.ok(contraste(lisible, '#ffffff') >= 4.5, `${lisible} reste illisible sur blanc`);
  // Toujours un jaune : le rouge et le vert dominent encore le bleu.
  const [r, v, b] = [1, 3, 5].map((i) => parseInt(lisible.slice(i, i + 2), 16));
  assert.ok(r > b && v > b, `${lisible} n’est plus une déclinaison du jaune`);
});

test('une couleur déjà lisible n’est pas touchée', () => {
  // Sans cette garantie, la fonction dénaturerait tous les choix corrects.
  assert.equal(accentLisible('#004aad', '#ffffff'), '#004aad');
});

test('aucune saisie de client ne produit une page hors charte ni illisible', () => {
  /*
   * Le tour complet de la roue, par pas de 15°, plus les gris et deux métiers.
   * C'est la seule façon de savoir que la règle tient partout et pas seulement
   * sur l'exemple qui a servi à l'écrire.
   *
   * **Ce que ce test mesurait avant, et pourquoi ça ne suffit plus.** Il
   * vérifiait 4,5:1 sur fond blanc — la barre légale, et la page était claire.
   * Deux choses ont changé : la page est sombre, donc mesurer sur du blanc ne
   * mesure plus rien ; et le dépôt tient un plancher de 7:1 pour un accent,
   * parce que ces pages se lisent dehors. Un test écrit sur l'ancienne barre
   * reste vert et ne signale jamais qu'une nouvelle existe — c'est le plus
   * discret des défauts, et il a déjà été payé sur `chat-traducteur`.
   */
  const teintes = [
    ...Array.from({ length: 24 }, (_, i) => {
      const [r, v, b] = [0, 8, 16].map((d) => Math.round(
        127 + 127 * Math.cos(((i * 15 + d * 15) * Math.PI) / 180),
      ));
      return `#${[r, v, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    }),
    '#808080', '#ffffff', '#000000', '#7f9a6d', '#c8783c', 'plombier', 'Maçon', '', 'nimportequoi',
  ];
  const accentsDeLaCharte = new Set(Object.values(TEINTES).map((t) => t.accent.toLowerCase()));

  for (const teinte of teintes) {
    const html = genererSite(commande({ couleur: teinte }));
    const fond = /--ink: (#[0-9a-f]{6})/.exec(html)?.[1];
    const accent = /--accent: (#[0-9a-f]{6})/.exec(html)?.[1];
    const encre = /--encre-entete: (#[0-9a-f]{6})/.exec(html)?.[1];
    const texte = /--accent-texte: (#[0-9a-f]{6})/.exec(html)?.[1];

    assert.ok(fond && accent && encre && texte, `jetons absents pour « ${teinte} »`);
    assert.ok(accentsDeLaCharte.has(accent!), `« ${teinte} » a produit ${accent}, hors charte`);
    // L'accent, sur le fond de page : le plancher de la maison, pas celui du standard.
    assert.ok(contraste(accent!, fond!) >= 7,
      `accent à ${contraste(accent!, fond!).toFixed(2)}:1 pour « ${teinte} »`);
    // Le libellé du bouton plein, sur sa propre teinte.
    assert.ok(contraste(encre!, accent!) >= 4.5,
      `bouton à ${contraste(encre!, accent!).toFixed(2)}:1 pour « ${teinte} »`);
    // L'accent en tant que texte vit sur le même fond : même plancher.
    assert.ok(contraste(texte!, fond!) >= 7,
      `texte d’accent à ${contraste(texte!, fond!).toFixed(2)}:1 pour « ${teinte} »`);
  }
});

test('la page livrée est sombre, et n’emporte pas un second thème', () => {
  /*
   * Deux palettes tenues en parallèle divergent au premier changement, et
   * c'est toujours celle qu'on ne regarde pas qui part en vrille. Le gabarit
   * portait un `prefers-color-scheme: dark` qui recalculait l'accent : deux
   * jeux de valeurs, un seul éprouvé.
   */
  const html = genererSite(commande({ couleur: 'peintre' }));

  /*
   * On cherche la règle, pas le mot : le commentaire du gabarit **cite**
   * `prefers-color-scheme` pour expliquer pourquoi il n'y en a plus, et il
   * part avec la feuille de style comme tous les autres commentaires de ce
   * fichier. Chercher le mot condamnait donc l'explication elle-même.
   */
  assert.equal(html.includes('@media (prefers-color-scheme'), false, 'un second thème est revenu');
  assert.match(html, /color-scheme: dark/);
  assert.match(html, /Site réalisé par Artisan Express/, 'la signature du pied a disparu');
  // Le filet vertical et la flèche : la patte se reconnaît avant la teinte.
  assert.match(html, /border-left: 3px solid var\(--accent\)/);
  assert.match(html, /content: "→"/);
});

test('un nom d’entreprise ne peut pas refermer le bloc de données structurées', () => {
  /*
   * Le piège propre au JSON-LD : dans un `<script>`, l'analyseur HTML cherche
   * `</script` avant que JSON n'existe. Sans échappement du chevron, un nom
   * piégé refermerait le bloc et la suite deviendrait du HTML exécutable, sur
   * le domaine du client.
   *
   * Et l'échappement HTML habituel serait faux ici : `&lt;` survivrait tel quel
   * à `JSON.parse`, et la fiche porterait des entités au lieu du nom.
   */
  const html = genererSite(commande({ entreprise: 'Toitures </script><img src=x onerror=alert(1)>' }));
  const bloc = /<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/.exec(html);

  assert.ok(bloc, 'aucun bloc de données structurées');
  assert.equal(bloc[1].includes('</script'), false, 'le bloc peut être refermé');
  assert.equal(JSON.parse(bloc[1]).name, 'Toitures </script><img src=x onerror=alert(1)>');
});

test('la fiche d’établissement porte le métier, le téléphone et la zone', () => {
  const html = genererSite(commande({
    entreprise: 'Couverture Tanguy', ville: 'Auray', telephone: '02 97 00 11 22',
    services: 'Toiture ardoise\nZinguerie', presentation: 'Je travaille seul.',
  }));
  const bloc = /<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/.exec(html);
  assert.ok(bloc, 'aucun bloc de données structurées');
  const fiche = JSON.parse(bloc[1]);

  assert.equal(fiche['@type'], 'LocalBusiness');
  assert.equal(fiche.telephone, '+33297001122');
  assert.equal(fiche.address.addressLocality, 'Auray');
  assert.equal(fiche.hasOfferCatalog.itemListElement.length, 2);
  assert.equal(fiche.hasOfferCatalog.itemListElement[0].itemOffered.name, 'Toiture ardoise');
});

test('sans domaine, rien n’est inventé', () => {
  /*
   * Une adresse absolue supposée ferait afficher un rectangle vide à chaque
   * partage — un lien qui paraît cassé, ce qui est pire qu'aucune image.
   */
  const html = genererSite(commande(), [{ fichier: 'chantier.jpg' }]);

  assert.equal(html.includes('og:image'), false);
  assert.equal(html.includes('rel="canonical"'), false);
  assert.equal(html.includes('og:url'), false);
  assert.match(html, /og:title/);
  const bloc = /ld\+json">\n([\s\S]*?)\n<\/script>/.exec(html);
  assert.ok(bloc, 'aucun bloc de données structurées');
  assert.equal(JSON.parse(bloc[1]).url, undefined);
});

test('le domaine est nettoyé, et un domaine faux est ignoré', () => {
  const avec = genererSite(commande(), [{ fichier: 'chantier.jpg' }], {
    domaine: 'HTTPS://Couverture-Tanguy.FR/',
  });
  assert.match(avec, /<link rel="canonical" href="https:\/\/couverture-tanguy\.fr\/">/);
  assert.match(avec, /og:image" content="https:\/\/couverture-tanguy\.fr\/chantier\.jpg"/);

  // « localhost » n'a pas de point : accepté, il produirait un lien mort.
  assert.equal(genererSite(commande(), [], { domaine: 'localhost' }).includes('canonical'), false);
});

test('une démonstration ne s’indexe pas', () => {
  /*
   * Elle porte un nom d'entreprise qui n'existe pas et un numéro qui ne sonne
   * nulle part. Indexée, elle se présenterait comme un vrai artisan.
   */
  assert.match(genererSite(commande(), [], { demonstration: true }), /name="robots" content="noindex, nofollow"/);
  assert.equal(genererSite(commande()).includes('name="robots"'), false);
});

test('une image peut être embarquée, et la page reste un seul fichier', () => {
  /*
   * La démonstration n'a pas de photo de chantier — le dépôt ne versionne aucun
   * binaire — mais un artisan décide sur des photos, et une galerie absente ne
   * montre pas où les siennes iront. Les cadres sont donc des SVG embarqués :
   * la page garde sa propriété d'être **un seul fichier** qui s'ouvre depuis le
   * disque comme depuis un hébergement.
   */
  const html = genererSite(commande(), [{ fichier: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', legende: 'Emplacement' }]);

  assert.match(html, /<img src="data:image\/svg\+xml;base64,PHN2Zz48L3N2Zz4=" alt="Emplacement"/);
});

test('le numéro du pied de page s’appelle', () => {
  /*
   * Il était lisible et pas cliquable. Le visiteur qui a fait défiler les
   * photos et lu « et les communes autour » — l'instant où il décide — devait
   * remonter deux écrans pour trouver le bouton d'appel : 2,2 écrans mesurés
   * sur le terrain de référence.
   *
   * Le lien sort dès que le numéro est affiché, sans dépendre de l'option
   * « appel » : le pied de page montrait déjà le numéro dans tous les cas, et
   * un numéro affiché qu'on ne peut pas toucher est un numéro à recopier à la
   * main sur un chantier.
   */
  const html = genererSite(commande({ options: [], telephone: '02 97 00 11 22' }));
  const pied = html.slice(html.indexOf('<footer>'));

  assert.ok(pied.includes('href="tel:+33297001122"'));
  assert.ok(pied.includes('02 97 00 11 22'));
});

test('sans numéro, le pied de page ne fabrique pas de lien mort', () => {
  const html = genererSite(commande({ options: [], telephone: '' }));
  const pied = html.slice(html.indexOf('<footer>'));

  assert.equal(pied.includes('tel:'), false);
  assert.equal(pied.includes('<a'), false);
});

test('sans avis dans la commande, la section n’existe pas', () => {
  /*
   * C'est la garantie qui compte : le générateur ne fabrique aucun
   * témoignage. Un faux avis sur le site d'un artisan est le seul défaut de
   * cette page qui puisse lui coûter sa réputation.
   */
  const html = genererSite(commande({}));
  assert.equal(html.includes('Ce qu’en disent mes clients'), false);
  assert.equal(genererSite(commande({ avis: [] })).includes('disent mes clients'), false);
});

test('un avis vide ne fabrique pas une carte vide', () => {
  const html = genererSite(commande({ avis: [{ texte: '   ', prenom: 'Marc', commune: 'Rennes' }] }));
  assert.equal(html.includes('disent mes clients'), false);
});

test('les avis fournis sortent avec leur prénom et leur commune', () => {
  const html = genererSite(
    commande({ avis: [{ texte: 'Travail net, délai tenu.', prenom: 'Marc', commune: 'Cesson-Sévigné' }] }),
  );
  assert.ok(html.includes('Ce qu’en disent mes clients'));
  assert.ok(html.includes('Travail net, délai tenu.'));
  assert.ok(html.includes('Marc, Cesson-Sévigné'));
});

test('la mention « exemple » n’apparaît qu’en démonstration', () => {
  /*
   * Les deux moitiés comptent. En démonstration, sans la mention, un prospect
   * croirait à de vrais clients. Sur un vrai site, la mention jetterait un
   * doute sur des avis authentiques — c'est le même mensonge, retourné.
   */
  const avis = [{ texte: 'Rapide et propre.', prenom: 'Élodie', commune: 'Bruz' }];
  assert.ok(genererSite(commande({ avis }), [], { demonstration: true }).includes('Avis d’exemple'));
  assert.equal(genererSite(commande({ avis })).includes('Avis d’exemple'), false);
});

test('un avis n’échappe pas au filtre des balises', () => {
  const html = genererSite(
    commande({ avis: [{ texte: '<script>alert(1)</script>', prenom: '<b>x</b>', commune: 'Rennes' }] }),
  );
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<b>x</b>'), false);
});
