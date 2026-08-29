import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  couleurRetenue, echapper, genererSite, lienTelephonique, servicesListes,
} from '@/lib/site';
import type { Commande } from '@/lib/commande';

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

test('une couleur libre est refusée, celle du modèle prend le relais', () => {
  // La valeur part dans une feuille de style : une chaîne libre y ouvrirait
  // une injection CSS.
  assert.equal(couleurRetenue(commande({ couleur: 'red; } body { display:none' })), '#38bdf8');
  assert.equal(couleurRetenue(commande({ couleur: '#ff8800' })), '#ff8800');
  assert.equal(couleurRetenue(commande({ couleur: '' })), '#38bdf8');
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
