/*
 * Les opérations du coffre, vérifiées sur ce qui sort réellement du navigateur.
 *
 * Deux familles de tests, et la seconde est la raison d'être du fichier :
 *
 * 1. **Ce que l'index devient.** Chaque opération le réécrit ; celle qui
 *    oublie un champ le perd pour de bon, sans erreur et sans que rien ne
 *    s'affiche différemment. On relit donc l'index tel qu'il a été chiffré et
 *    envoyé, pas la valeur de retour.
 * 2. **Ce qui part vers Supabase.** Le projet promet que la phrase secrète,
 *    les noms de documents et les libellés de rendez-vous ne quittent jamais
 *    la page — seule une date le fait. Cette promesse ne se relit pas, elle se
 *    mesure : on fouille le journal des appels à la recherche des mots qui
 *    n'ont rien à y faire.
 */

import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { PDFDocument } from 'pdf-lib';

import { clientFactice, toutCeQuiEstSorti, type Factice } from './aides-coffre';
import {
  ITERATIONS,
  TEXTE_VERIF,
  b64FromBuf,
  chiffrerOctets,
  chiffrerTexte,
  dechiffrerTexte,
  bufFromB64,
  deriverCle,
  empaqueterVerificateur,
  reempaqueterVerificateur,
} from '../crypto';

// Le module `./supabase` construit son client à l'import et lève sans les
// variables d'environnement : on le remplace avant que `./coffre` ne le
// charge. Le mandataire délègue au client factice du test en cours, ce qui
// évite de réinstaller la simulation à chaque cas.
let courant: Factice = clientFactice();
mock.module(new URL('../supabase.ts', import.meta.url).href, {
  namedExports: {
    supabase: new Proxy({}, {
      get: (_c, propriete) => (courant.client as Record<string, unknown>)[propriete as string],
    }),
  },
});

const coffre = await import('../coffre');
type IndexCoffre = Awaited<ReturnType<typeof coffre.chargerIndex>>;

const UTILISATEUR = 'u-123';
const PHRASE = 'une phrase secrète que personne ne doit voir';
const SEL = new Uint8Array(16).fill(3);
const cle = await deriverCle(PHRASE, SEL, ITERATIONS);

const IDENTITE = {
  nom: 'Erwann Chevallier', adresse: '3 rue des Ajoncs', codePostal: '29000', ville: 'Quimper',
};

function poser(factice: Factice): Factice {
  courant = factice;
  return factice;
}

/** L'index tel qu'il a réellement été chiffré puis envoyé à `coffre_index`. */
async function indexEnvoye(factice: Factice): Promise<IndexCoffre> {
  const upsert = factice.premier('upsert');
  assert.ok(upsert, 'aucun index n’a été sauvegardé');
  const ligne = upsert[0] as { contenu: string };
  return JSON.parse(await dechiffrerTexte(cle, bufFromB64(ligne.contenu))) as IndexCoffre;
}

function fichier(nom = 'avis-imposition.pdf', contenu = 'MONTANT: 1 234 €') {
  return new File([contenu], nom, { type: 'application/pdf' });
}

const ECHEANCE = {
  presente: true, date: '2026-11-15', libelle: 'Échéance assurance habitation',
  confiance: 'haute' as const,
};

// ─────────────────────────────── La lettre ───────────────────────────────

describe('la lettre de résiliation', () => {
  it('porte l’identité, l’émetteur et la date d’effet', () => {
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'Assureur X', 'CL-42', '2026-11-15');
    assert.match(lettre.corps, /Erwann Chevallier/);
    assert.match(lettre.corps, /3 rue des Ajoncs/);
    assert.match(lettre.corps, /29000 Quimper/);
    assert.match(lettre.corps, /Assureur X/);
    assert.match(lettre.corps, /15\/11\/2026/);
    assert.match(lettre.objet, /CL-42/);
  });

  it('rend un brouillon utilisable même incomplet, jamais une exception', () => {
    // Porté de la suite vitest retirée le 05/09/2026 : une lettre à laquelle il
    // manque une mention reste une lettre. Refuser de la composer priverait
    // l'utilisateur du brouillon au moment précis où il en a le plus besoin.
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'EDF', null, '2026-11-01');
    assert.ok(lettre.corps.length > 0);
  });

  it('n’invente pas de référence client dans l’objet quand elle est inconnue', () => {
    // Porté de la suite vitest. L'objet d'une lettre de résiliation est lu par
    // un service courrier : une référence inventée y ferait plus de dégâts
    // qu'une référence absente.
    const inconnue = coffre.composerLettreResiliation(IDENTITE, 'EDF', null, '2026-11-01');
    assert.equal(inconnue.objet.includes('réf. client'), false);
    assert.equal(/REF|ABC|CL-/.test(inconnue.objet), false);
  });

  it('signale la référence client quand elle n’a pas été lue', () => {
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'Assureur X', null, '2026-11-15');
    assert.ok(lettre.mentionsManquantes.some((m) => m.includes('référence client')));
    assert.equal(lettre.objet.includes('réf. client'), false);
  });

  it('ne réclame pas une mention que la lettre contient déjà', () => {
    // Signaler manquante une mention qui y est enverrait l'utilisateur ajouter
    // à la main une phrase déjà écrite — et userait la confiance dans la liste,
    // qui n'a d'usage que si tout ce qu'elle nomme manque vraiment.
    //
    // **On cherche le radical, pas la formulation.** Ce test épinglait
    // « m'en confirmer la prise en compte par écrit », et il est tombé le
    // 05/09/2026 : une autre session avait réécrit la phrase en « m'en adresser
    // une confirmation écrite ». Un test qui recopie le texte qu'il garde casse
    // à chaque reformulation, et fait croire à une régression là où il n'y a
    // qu'une tournure différente.
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'Assureur X', 'CL-42', '2026-11-15');
    assert.match(lettre.corps.toLowerCase(), /confirm/);
    assert.deepEqual(lettre.mentionsManquantes, []);
  });
});

// ──────────────────────────── Ouvrir le coffre ────────────────────────────

describe('l’existence du coffre', () => {
  it('dit vrai quand une ligne existe déjà', async () => {
    poser(clientFactice({ tables: { coffre_cles: { data: { user_id: UTILISATEUR }, error: null } } }));
    assert.equal(await coffre.coffreExiste(UTILISATEUR), true);
  });

  it('dit faux quand rien n’a encore été initialisé', async () => {
    poser(clientFactice({ tables: { coffre_cles: { data: null, error: null } } }));
    assert.equal(await coffre.coffreExiste(UTILISATEUR), false);
  });

  it('remonte l’erreur du serveur plutôt que de la confondre avec « rien »', async () => {
    poser(clientFactice({ tables: { coffre_cles: { data: null, error: { message: 'panne réseau' } } } }));
    await assert.rejects(() => coffre.coffreExiste(UTILISATEUR), /panne réseau/);
  });
});

describe('initialiser le coffre', () => {
  it('ne transmet que les métadonnées prévues et le vérificateur chiffré', async () => {
    const f = poser(clientFactice({ tables: { coffre_cles: { error: null } } }));
    await coffre.initialiserCoffre(UTILISATEUR, PHRASE);

    const sorti = toutCeQuiEstSorti(f.journal);
    assert.equal(sorti.includes(PHRASE), false);
    assert.equal(sorti.includes('phrase secrète'), false);
    // Un mot court comme « ne » peut apparaître par hasard dans le Base64
    // du sel, de l'IV ou du chiffré. Vérifier le contrat transmis et le
    // contenu authentifié, plutôt que chercher des syllabes dans l'aléatoire.
    assert.deepEqual(f.journal.map((appel) => appel.methode), ['from', 'insert']);
    assert.deepEqual(f.premier('from'), ['coffre_cles']);
    const insertion = f.premier('insert')!;
    assert.equal(insertion.length, 1);
    const ligne = insertion[0] as {
      user_id: string; sel: string; iterations: number;
      verificateur_iv: string; verificateur_texte: string;
    };
    assert.deepEqual(Object.keys(ligne).sort(), [
      'iterations', 'sel', 'user_id', 'verificateur_iv', 'verificateur_texte',
    ]);
    assert.equal(ligne.user_id, UTILISATEUR);
    assert.equal(ligne.iterations, ITERATIONS);
    assert.equal(bufFromB64(ligne.sel).byteLength, 16);
    assert.equal(bufFromB64(ligne.verificateur_iv).byteLength, 12);
    const cleVerification = await deriverCle(
      PHRASE, new Uint8Array(bufFromB64(ligne.sel)), ligne.iterations,
    );
    const paquet = reempaqueterVerificateur(ligne.verificateur_iv, ligne.verificateur_texte);
    assert.equal(await dechiffrerTexte(cleVerification, paquet), TEXTE_VERIF);
    assert.equal(bufFromB64(ligne.verificateur_texte).byteLength,
      new TextEncoder().encode(TEXTE_VERIF).byteLength + 16);
  });

  it('déclare le nombre d’itérations qu’il a réellement utilisé', async () => {
    const f = poser(clientFactice({ tables: { coffre_cles: { error: null } } }));
    await coffre.initialiserCoffre(UTILISATEUR, PHRASE);
    const ligne = f.premier('insert')?.[0] as { iterations: number; sel: string };
    assert.equal(ligne.iterations, ITERATIONS);
    assert.equal(new Uint8Array(bufFromB64(ligne.sel)).length, 16);
  });
});

describe('déverrouiller le coffre', () => {
  async function ligneDeCle(iterationsAnnoncees: number) {
    const cleReelle = await deriverCle(PHRASE, SEL, ITERATIONS);
    const { iv, texte } = empaqueterVerificateur(await chiffrerTexte(cleReelle, TEXTE_VERIF));
    return {
      data: {
        sel: b64FromBuf(SEL.buffer as ArrayBuffer),
        iterations: iterationsAnnoncees,
        verificateur_iv: iv,
        verificateur_texte: texte,
      },
      error: null,
    };
  }

  it('ouvre avec la bonne phrase', async () => {
    poser(clientFactice({ tables: { coffre_cles: await ligneDeCle(ITERATIONS) } }));
    const ouverte = await coffre.deverrouillerCoffre(UTILISATEUR, PHRASE);
    assert.equal(await dechiffrerTexte(ouverte, await chiffrerTexte(cle, 'x')), 'x');
  });

  it('refuse une phrase fausse sans dire pourquoi', async () => {
    poser(clientFactice({ tables: { coffre_cles: await ligneDeCle(ITERATIONS) } }));
    await assert.rejects(
      () => coffre.deverrouillerCoffre(UTILISATEUR, 'pas la bonne'),
      /Phrase secrète incorrecte/,
    );
  });

  it('ouvre quand même si le serveur annonce un nombre d’itérations affaibli', async () => {
    // Le cas d'une ligne corrompue ou altérée à `1` : le plancher de
    // `iterationsSures` fait dériver la clé à 600 000 comme à l'origine, donc
    // le coffre s'ouvre. Si quelqu'un retirait ce plancher, la clé dérivée
    // serait fausse — et ce test tomberait, ce qui est bien le but.
    poser(clientFactice({ tables: { coffre_cles: await ligneDeCle(1) } }));
    await assert.doesNotReject(() => coffre.deverrouillerCoffre(UTILISATEUR, PHRASE));
  });

  it('dit « introuvable » quand il n’y a pas de coffre', async () => {
    poser(clientFactice({ tables: { coffre_cles: { data: null, error: { message: 'vide' } } } }));
    await assert.rejects(() => coffre.deverrouillerCoffre(UTILISATEUR, PHRASE), /introuvable/);
  });
});

describe('charger l’index', () => {
  it('rend un index vide mais complet quand rien n’a encore été déposé', async () => {
    poser(clientFactice({ tables: { coffre_index: { data: null, error: null } } }));
    const index = await coffre.chargerIndex(UTILISATEUR, cle);
    assert.deepEqual(index, { objets: {}, rendezVous: {} });
  });

  it('rétablit les champs absents d’un index ancien', async () => {
    // Un index enregistré avant les rendez-vous n'a pas la clé : la lui
    // rendre ici évite que chaque appelant ait à s'en méfier.
    const contenu = b64FromBuf(await chiffrerTexte(cle, JSON.stringify({ objets: {} })));
    poser(clientFactice({ tables: { coffre_index: { data: { contenu }, error: null } } }));
    const index = await coffre.chargerIndex(UTILISATEUR, cle);
    assert.deepEqual(index.rendezVous, {});
  });
});

// ─────────────────────────────── Déposer ───────────────────────────────

describe('déposer un fichier', () => {
  it('n’envoie au seau ni le contenu en clair ni le nom d’origine', async () => {
    const f = poser(clientFactice());
    await coffre.deposerFichier(
      UTILISATEUR, cle, fichier(), 'Impôts', { objets: {} },
    );

    const [chemin, paquet] = f.premier('upload') as [string, ArrayBuffer];
    assert.match(chemin, new RegExp(`^${UTILISATEUR}/[0-9a-f]{32}$`));
    assert.equal(chemin.includes('avis-imposition'), false);
    const octets = new TextDecoder('latin1').decode(new Uint8Array(paquet));
    assert.equal(octets.includes('MONTANT'), false);
    assert.equal(octets.includes('1 234'), false);
  });

  it('garde le nom lisible dans l’index chiffré, et lui seul', async () => {
    const f = poser(clientFactice());
    await coffre.deposerFichier(UTILISATEUR, cle, fichier(), 'Impôts', { objets: {} });

    const index = await indexEnvoye(f);
    const [nom, objet] = Object.entries(index.objets)[0]!;
    assert.match(nom, /^[0-9a-f]{32}$/);
    assert.equal(objet.nom, 'avis-imposition.pdf');
    assert.equal(objet.categorie, 'Impôts');
  });

  it('n’envoie à coffre_echeances que la date, jamais le libellé', async () => {
    const f = poser(clientFactice());
    await coffre.deposerFichier(
      UTILISATEUR, cle, fichier(), 'Assurance', { objets: {} }, undefined, ECHEANCE,
    );

    const inserts = f.tous('insert').map(([l]) => l as Record<string, unknown>);
    const ligne = inserts.find((l) => 'date' in l);
    assert.ok(ligne, 'aucune échéance envoyée');
    assert.deepEqual(Object.keys(ligne).sort(), ['date', 'objet_nom', 'user_id']);
    assert.equal(ligne.date, '2026-11-15');
    assert.equal(toutCeQuiEstSorti(f.journal).includes('assurance habitation'), false);
  });

  it('conserve les rendez-vous et l’identité déjà enregistrés', async () => {
    // L'index est réécrit en entier à chaque dépôt. S'il se reconstruit champ
    // par champ, tout ce qu'il ne nomme pas disparaît — sans erreur, et sans
    // que rien ne le signale avant qu'on cherche un rendez-vous perdu.
    const f = poser(clientFactice());
    const depart = {
      objets: {},
      rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
      identite: IDENTITE,
    };
    await coffre.deposerFichier(UTILISATEUR, cle, fichier(), 'Impôts', depart);

    const index = await indexEnvoye(f);
    assert.deepEqual(index.rendezVous, depart.rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });

  it('compose la lettre quand la catégorie s’y prête et que l’émetteur est lu', async () => {
    poser(clientFactice());
    const index = await coffre.deposerFichier(
      UTILISATEUR, cle, fichier(), 'Assurance', { objets: {}, identite: IDENTITE },
      undefined, ECHEANCE, 'Assureur X', 'CL-42',
    );
    const objet = Object.values(index.objets)[0]!;
    assert.ok(objet.lettre);
    assert.match(objet.lettre.corps, /Assureur X/);
  });

  it('ne compose aucune lettre sans identité, faute d’en-tête à écrire', async () => {
    poser(clientFactice());
    const index = await coffre.deposerFichier(
      UTILISATEUR, cle, fichier(), 'Assurance', { objets: {} },
      undefined, ECHEANCE, 'Assureur X', 'CL-42',
    );
    assert.equal(Object.values(index.objets)[0]!.lettre, undefined);
  });

  it('ne compose aucune lettre pour une catégorie qui ne se résilie pas', async () => {
    poser(clientFactice());
    const index = await coffre.deposerFichier(
      UTILISATEUR, cle, fichier(), 'Impôts', { objets: {}, identite: IDENTITE },
      undefined, ECHEANCE, 'Direction des finances publiques', null,
    );
    assert.equal(Object.values(index.objets)[0]!.lettre, undefined);
  });
});

// ─────────────────────────────── Récupérer ───────────────────────────────

describe('récupérer un fichier', () => {
  it('déchiffre ce qui a été téléchargé et lui redonne son type d’origine', async () => {
    const clair = new TextEncoder().encode('contenu du document').buffer as ArrayBuffer;
    const paquet = await chiffrerOctets(cle, clair);
    poser(clientFactice({
      telechargement: { data: { arrayBuffer: () => Promise.resolve(paquet) }, error: null },
    }));
    const info = {
      nom: 'avis.pdf', taille: 10, type: 'application/pdf',
      categorie: 'Impôts', deposeLe: '2026-01-01T00:00:00Z',
    };
    const blob = await coffre.recupererFichier(UTILISATEUR, cle, 'abc', info);
    assert.equal(blob.type, 'application/pdf');
    const relu = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual(Array.from(relu), Array.from(new Uint8Array(clair)));
  });

  it('refuse quand le serveur ne trouve pas l’objet', async () => {
    poser(clientFactice({ telechargement: { data: null, error: { message: 'absent' } } }));
    const info = {
      nom: 'avis.pdf', taille: 10, type: 'application/pdf',
      categorie: 'Impôts', deposeLe: '2026-01-01T00:00:00Z',
    };
    await assert.rejects(() => coffre.recupererFichier(UTILISATEUR, cle, 'abc', info), /introuvable/);
  });
});

// ─────────────────────────────── Supprimer ───────────────────────────────

describe('supprimer un fichier', () => {
  const depart = () => ({
    objets: {
      abc: {
        nom: 'vieux.pdf', taille: 10, type: 'application/pdf',
        categorie: 'Impôts', deposeLe: '2026-01-01T00:00:00Z',
      },
    },
    rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
    identite: IDENTITE,
  });

  it('retire l’objet du seau et son échéance en clair', async () => {
    // Sans le second geste, une alerte finirait par arriver pour un document
    // qui n'existe plus — et personne ne saurait dire lequel.
    const f = poser(clientFactice());
    await coffre.supprimerFichier(UTILISATEUR, cle, 'abc', depart());
    assert.deepEqual(f.premier('remove'), [[`${UTILISATEUR}/abc`]]);
    assert.ok(f.premier('delete'), 'l’échéance n’a pas été retirée');
  });

  it('conserve les rendez-vous et l’identité', async () => {
    const f = poser(clientFactice());
    await coffre.supprimerFichier(UTILISATEUR, cle, 'abc', depart());

    const index = await indexEnvoye(f);
    assert.deepEqual(index.objets, {});
    assert.deepEqual(index.rendezVous, depart().rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });
});

// ────────────────────────────── Rendez-vous ──────────────────────────────

describe('les rendez-vous', () => {
  it('gardent leur libellé chiffré et n’envoient que la date', async () => {
    const f = poser(clientFactice());
    await coffre.ajouterRendezVous(
      UTILISATEUR, cle, 'Dentiste, cabinet Martin', '2026-10-02', { objets: {} },
    );

    const ligne = f.premier('insert')?.[0] as Record<string, unknown>;
    assert.equal(ligne.date, '2026-10-02');
    assert.equal(ligne.type, 'rendezvous');
    const sorti = toutCeQuiEstSorti(f.journal);
    assert.equal(sorti.includes('Dentiste'), false);
    assert.equal(sorti.includes('Martin'), false);

    const index = await indexEnvoye(f);
    assert.equal(Object.values(index.rendezVous!)[0]!.libelle, 'Dentiste, cabinet Martin');
  });

  it('conservent l’identité, dont dépendent les lettres à venir', async () => {
    const f = poser(clientFactice());
    await coffre.ajouterRendezVous(
      UTILISATEUR, cle, 'Dentiste', '2026-10-02', { objets: {}, identite: IDENTITE },
    );
    assert.deepEqual((await indexEnvoye(f)).identite, IDENTITE);
  });

  it('se retirent de l’index et de la table des échéances', async () => {
    const f = poser(clientFactice());
    const index = await coffre.supprimerRendezVous(UTILISATEUR, cle, 'r1', {
      objets: {},
      rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
      identite: IDENTITE,
    });
    assert.deepEqual(index.rendezVous, {});
    assert.ok(f.premier('delete'));
    assert.deepEqual((await indexEnvoye(f)).identite, IDENTITE);
  });
});

// ─────────────────────────────── Classement ───────────────────────────────

describe('la proposition de classement', () => {
  it('classe localement par type sans appeler de fonction serveur', async () => {
    const f = poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    const proposition = await coffre.proposerClassement(fichier('avis-imposition.pdf', 'application/pdf'));
    assert.equal(proposition.lisible, true);
    assert.equal(proposition.categorie, 'Papiers');
    assert.equal(proposition.nomSuggere, 'avis-imposition.pdf');
    assert.equal(proposition.echeance.presente, false);
    assert.equal(f.journal.some((entree) => entree.methode === 'invoke'), false);
  });

  it('ne prétend pas lire les montants, échéances ou émetteurs', async () => {
    poser(clientFactice());
    const proposition = await coffre.proposerClassement(new File(['image'], 'facture-edf.jpg', { type: 'image/jpeg' }));
    assert.equal(proposition.categorie, 'Images');
    assert.equal(proposition.emetteur, null);
    assert.equal(proposition.referenceClient, null);
    assert.equal(proposition.montant, null);
    assert.equal(proposition.texteExtrait, null);
    assert.equal(proposition.erreurTechnique, undefined);
  });

  it('analyse intelligemment seulement quand le parcours photo le demande', async () => {
    const resultat = {
      lisible: true, categorie: 'Énergie', nomSuggere: 'Facture EDF septembre',
      emetteur: 'EDF', referenceClient: 'CL-42', montant: '89,90 €', texteExtrait: 'Facture EDF',
      echeance: { presente: true, date: '2026-10-10', libelle: 'Paiement EDF', confiance: 'haute' },
    };
    const f = poser(clientFactice({ fonction: { data: resultat, error: null } }));
    const photo = new File(['image-test'], 'photo.jpg', { type: 'image/jpeg' });
    const proposition = await coffre.analyserDocumentPourClassement(photo);
    assert.equal(proposition.categorie, 'Énergie');
    const [nom, options] = f.premier('invoke') as [string, { body: { donnees: string; type: string } }];
    assert.equal(nom, 'classer-document');
    assert.equal(options.body.type, 'image/jpeg');
    assert.ok(options.body.donnees.length > 0);
  });

  it('revient vers une vérification humaine si la lecture intelligente échoue', async () => {
    poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    const proposition = await coffre.analyserDocumentPourClassement(
      new File(['image-test'], 'photo.jpg', { type: 'image/jpeg' }),
    );
    assert.equal(proposition.lisible, false);
    assert.equal(proposition.erreurTechnique, true);
  });

  it('n envoie pas un très gros fichier à Gemini', async () => {
    const f = poser(clientFactice());
    const gros = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'archive.pdf', { type: 'application/pdf' });
    const resultat = await coffre.analyserDocumentPourClassement(gros);
    assert.equal(resultat.lisible, false);
    assert.equal(resultat.erreurTechnique, true);
    assert.equal(f.journal.some((entree) => entree.methode === 'invoke'), false);
  });

  it('sépare un PDF mêlant deux documents et conserve chaque plage de pages', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]);
    pdf.addPage([300, 400]);
    pdf.addPage([400, 300]);
    const donneesPdf = await pdf.save();
    const octetsPdf = new ArrayBuffer(donneesPdf.byteLength);
    new Uint8Array(octetsPdf).set(donneesPdf);
    const fichier = new File([octetsPdf], 'lot-administratif.pdf', { type: 'application/pdf' });
    const document = (pagesDebut: number, pagesFin: number, nomSuggere: string, categorie: string) => ({
      pagesDebut, pagesFin, lisible: true, categorie, nomSuggere,
      emetteur: null, referenceClient: null, montant: null, texteExtrait: null,
      echeance: { presente: false, date: null, libelle: null, confiance: 'basse' as const },
    });
    const reponse = {
      pagesDebut: 1, pagesFin: 3, lisible: false, categorie: '', nomSuggere: '',
      emetteur: null, referenceClient: null, montant: null, texteExtrait: null,
      echeance: { presente: false, date: null, libelle: null, confiance: 'basse' as const },
      documentsDetectes: [
        document(1, 2, 'Attestation employeur', 'Emploi'),
        document(3, 3, 'Justificatif de domicile', 'Logement'),
      ],
    };
    const factice = poser(clientFactice({ fonction: { data: reponse, error: null } }));

    const proposition = await coffre.analyserDocumentPourClassement(fichier);
    const [nomFonction, options] = factice.premier('invoke') as [string, { body: { nombrePages?: number } }];
    assert.equal(nomFonction, 'classer-document');
    assert.equal(options.body.nombrePages, 3);

    const separes = await coffre.separerPdfParDocuments(fichier, proposition.documentsDetectes ?? []);
    assert.deepEqual(separes.map(({ fichier: piece }) => piece.name), [
      'lot-administratif — Attestation employeur.pdf',
      'lot-administratif — Justificatif de domicile.pdf',
    ]);
    const pages = await Promise.all(separes.map(async ({ fichier: piece }) =>
      (await PDFDocument.load(await piece.arrayBuffer())).getPageCount(),
    ));
    assert.deepEqual(pages, [2, 1]);
    assert.deepEqual(separes.map(({ proposition: piece }) => piece.categorie), ['Emploi', 'Logement']);
  });

  it('refuse une segmentation qui laisse des pages de côté', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage(); pdf.addPage(); pdf.addPage();
    const donneesPdf = await pdf.save();
    const octetsPdf = new ArrayBuffer(donneesPdf.byteLength);
    new Uint8Array(octetsPdf).set(donneesPdf);
    const fichier = new File([octetsPdf], 'lot.pdf', { type: 'application/pdf' });
    const valide = (pagesDebut: number, pagesFin: number) => ({
      pagesDebut, pagesFin, lisible: true, categorie: 'Administratif', nomSuggere: 'Document',
      emetteur: null, referenceClient: null, montant: null, texteExtrait: null,
      echeance: { presente: false, date: null, libelle: null, confiance: 'basse' as const },
    });
    await assert.rejects(
      coffre.separerPdfParDocuments(fichier, [valide(1, 1), valide(3, 3)]),
      /pages/,
    );
  });
});

describe('la catégorie instantanée', () => {
  // Posée le 10/09/2026 : aucun fichier ne doit jamais rester sans catégorie
  // après un tri, quel que soit son type — voir trierAutomatiquement.
  it('range chaque type courant dans son dossier générique, sans appel réseau', () => {
    assert.equal(coffre.categorieInstantanee('image/jpeg'), 'Images');
    assert.equal(coffre.categorieInstantanee('image/png'), 'Images');
    assert.equal(coffre.categorieInstantanee('video/mp4'), 'Vidéos');
    assert.equal(coffre.categorieInstantanee('audio/mpeg'), 'Audio');
    assert.equal(coffre.categorieInstantanee('application/pdf'), 'Papiers');
  });

  it('range dans « Autre » ce qu’elle ne reconnaît pas, jamais dans une catégorie vide', () => {
    assert.equal(coffre.categorieInstantanee('application/zip'), 'Autre');
    assert.equal(coffre.categorieInstantanee(''), 'Autre');
  });

  it('ne propose aucun affinage IA en mode privé par défaut', () => {
    assert.equal(coffre.CATEGORIES_AFFINABLES_PAR_IA.has('Images'), false);
    assert.equal(coffre.CATEGORIES_AFFINABLES_PAR_IA.has('Papiers'), false);
    assert.equal(coffre.CATEGORIES_AFFINABLES_PAR_IA.has('Vidéos'), false);
    assert.equal(coffre.CATEGORIES_AFFINABLES_PAR_IA.has('Audio'), false);
    assert.equal(coffre.CATEGORIES_AFFINABLES_PAR_IA.has('Autre'), false);
  });

  it('n’affine plus automatiquement les images, même lisibles par un modèle externe', () => {
    assert.equal(coffre.affinableParIA('Images', 'image/jpeg'), false);
    assert.equal(coffre.affinableParIA('Images', 'image/png'), false);
    assert.equal(coffre.affinableParIA('Images', 'image/gif'), false);
    assert.equal(coffre.affinableParIA('Images', 'image/webp'), false);
    assert.equal(coffre.affinableParIA('Images', 'image/svg+xml'), false);
    assert.equal(coffre.affinableParIA('Images', 'image/bmp'), false);
  });

  it('n’affine plus automatiquement les PDF', () => {
    assert.equal(coffre.affinableParIA('Papiers', 'application/pdf'), false);
  });

  it('n’affine jamais Vidéos, Audio ou Autre, quel que soit le type', () => {
    assert.equal(coffre.affinableParIA('Vidéos', 'video/mp4'), false);
    assert.equal(coffre.affinableParIA('Audio', 'audio/mpeg'), false);
    assert.equal(coffre.affinableParIA('Autre', 'application/zip'), false);
  });
});

// ─────────────────────────────── L'assistant ───────────────────────────────

describe('demander au coffre', () => {
  it('ne fait pas passer une réponse locale pour une réponse Gemini quand le serveur échoue', async () => {
    poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    await assert.rejects(() => coffre.demanderAuCoffre('résume ce courrier', []), /panne/);
  });

  it('affiche le vrai motif renvoyé par la fonction Gemini', async () => {
    poser(clientFactice({ fonction: { data: null, error: {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ erreur: 'Session utilisateur requise.' }), { status: 401 }),
    } } }));
    await assert.rejects(() => coffre.demanderAuCoffre('bonjour', []), /Session utilisateur requise/);
  });

  it('n’envoie aucun document du coffre sans pièce jointe explicitement sélectionnée', async () => {
    const f = poser(clientFactice({ fonction: { data: {
      reponse: 'Je l’ai trouvée.', documentsCites: ['Facture EDF'], ouvrirFormulaire: false,
      ouvrirRangement: false, declencherTriAutomatique: false, rechercheWebEffectuee: false,
      actions: [], formulaireCerfa: null,
    }, error: null } }));
    await coffre.demanderAuCoffre('Explique la différence entre médiation et conciliation.', []);
    const [nom, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.equal(nom, 'assistant-coffre');
    assert.deepEqual(options.body, {
      question: 'Explique la différence entre médiation et conciliation.', historique: [], piecesJointes: [],
    });
    assert.equal('documents' in options.body, false);
    assert.equal(JSON.stringify(options.body).includes('Facture EDF'), false);
  });

  it('transmet uniquement le contenu des pièces jointes choisies', async () => {
    const f = poser(clientFactice({ fonction: { data: {
      reponse: 'Ce document est un exemple.', documentsCites: ['faux-exemple.pdf'], ouvrirFormulaire: false,
      ouvrirRangement: false, declencherTriAutomatique: false, rechercheWebEffectuee: false,
      actions: [], formulaireCerfa: null,
    }, error: null } }));
    const piecesJointes = [{ nom: 'faux-exemple.pdf', type: 'application/pdf', donnees: 'JVBERiQ=' }];
    await coffre.demanderAuCoffre('Résume ce document.', [], piecesJointes);
    const [, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.deepEqual(options.body.piecesJointes, piecesJointes);
    assert.equal(JSON.stringify(options.body).includes('Facture EDF'), false);
    assert.equal(JSON.stringify(options.body).includes('phrase secrète'), false);
  });

  it('envoie l’historique du fil pour garder une vraie conversation', async () => {
    const f = poser(clientFactice({ fonction: { data: {
      reponse: 'Voici la suite.', documentsCites: [], ouvrirFormulaire: false,
      ouvrirRangement: false, declencherTriAutomatique: false, rechercheWebEffectuee: false,
      actions: [], formulaireCerfa: null,
    }, error: null } }));
    const historique = [{ role: 'user' as const, texte: 'bonjour' }, { role: 'assistant' as const, texte: 'salut' }];
    await coffre.demanderAuCoffre('et ensuite ?', historique);
    const [, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.deepEqual(options.body.historique, historique);
  });

  it('conserve une action structurée proposée par le LLM pour confirmation', async () => {
    poser(clientFactice({ fonction: { data: {
      reponse: 'Je peux la classer.', documentsCites: ['Facture EDF'], ouvrirFormulaire: false,
      ouvrirRangement: false, declencherTriAutomatique: false, rechercheWebEffectuee: false,
      actions: [{ type: 'classer', nom: 'Facture EDF', categorie: 'Énergie' }], formulaireCerfa: null,
    }, error: null } }));
    const reponse = await coffre.demanderAuCoffre('classe le document joint dans Énergie', [], [{ nom: 'Facture EDF', type: 'application/pdf', donnees: 'JVBERiQ=' }]);
    assert.deepEqual(reponse.actions, [{ type: 'classer', nom: 'Facture EDF', categorie: 'Énergie' }]);
  });

  it('signale l’indisponibilité Gemini au lieu de déclencher une réponse locale', async () => {
    poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    await assert.rejects(() => coffre.demanderAuCoffre('remplir le formulaire de carte grise', []), /panne/);
  });
});

describe('récupérer un formulaire CERFA trouvé par l’assistant', () => {
  it('décode les octets renvoyés par la fonction serveur', async () => {
    const octetsAttendus = new Uint8Array([37, 80, 68, 70]); // "%PDF"
    const donnees = b64FromBuf(octetsAttendus.buffer as ArrayBuffer);
    poser(clientFactice({ fonction: { data: { donnees, type: 'application/pdf' }, error: null } }));
    const buf = await coffre.recupererFormulaireCerfa('https://www.service-public.fr/cerfa.pdf');
    assert.deepEqual(new Uint8Array(buf), octetsAttendus);
  });

  it('transmet l’adresse exacte à la fonction serveur, et rien d’autre', async () => {
    const donnees = b64FromBuf(new Uint8Array([37, 80, 68, 70]).buffer as ArrayBuffer);
    const f = poser(clientFactice({ fonction: { data: { donnees, type: 'application/pdf' }, error: null } }));
    await coffre.recupererFormulaireCerfa('https://www.service-public.fr/cerfa.pdf');
    const [nom, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.equal(nom, 'recuperer-formulaire-cerfa');
    assert.deepEqual(options.body, { url: 'https://www.service-public.fr/cerfa.pdf' });
  });

  it('lève une erreur explicite plutôt que de rendre des octets vides quand la fonction refuse', async () => {
    poser(clientFactice({ fonction: { data: { erreur: 'domaine non autorisé' }, error: null } }));
    await assert.rejects(
      coffre.recupererFormulaireCerfa('https://exemple-malveillant.fr/faux.pdf'),
      /domaine non autorisé/,
    );
  });
});

describe('suggérer des valeurs pour un formulaire à partir des papiers', () => {
  const DOCUMENTS_CHOISIS = [{ nom: 'Facture EDF', categorie: 'Énergie', type: 'application/pdf', emetteur: 'EDF', montant: '89,90 €', extrait: 'Client fictif 123456789' }];

  it('rend les suggestions Gemini proposées pour les champs reconnus', async () => {
    poser(clientFactice({ fonction: { data: { valeurs: { numero_client: '123456789' } }, error: null } }));
    const valeurs = await coffre.suggererChampsFormulaire(['numero_client'], DOCUMENTS_CHOISIS, 'Carte grise');
    assert.deepEqual(valeurs, { numero_client: '123456789' });
  });

  it('transmet uniquement les champs et les fiches choisies, jamais l’identité complète', async () => {
    const f = poser(clientFactice({ fonction: { data: { valeurs: {} }, error: null } }));
    await coffre.suggererChampsFormulaire(['numero_client'], DOCUMENTS_CHOISIS, 'Carte grise');
    const [nom, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.equal(nom, 'suggerer-champs-formulaire');
    assert.deepEqual(options.body.champs, ['numero_client']);
    assert.equal(options.body.demarche, 'Carte grise');
    assert.deepEqual(options.body.documents, DOCUMENTS_CHOISIS);
    assert.equal('identite' in options.body, false);
    assert.equal(JSON.stringify(options.body).includes('Jean Test'), false);
  });

  it('signale une panne Gemini au lieu de masquer l’échec', async () => {
    poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    await assert.rejects(() => coffre.suggererChampsFormulaire(['numero_client'], DOCUMENTS_CHOISIS, 'Carte grise'), /panne/);
  });
});

describe('résoudre un nom affiché vers sa clé de stockage', () => {
  const index: IndexCoffre = {
    objets: {
      abc: { nom: 'Facture EDF', taille: 1, type: 'application/pdf', categorie: 'Énergie', deposeLe: '2026-01-01' },
      def: { nom: 'Facture EDF', taille: 1, type: 'application/pdf', categorie: '', deposeLe: '2026-01-02' },
      ghi: { nom: 'Autre papier', taille: 1, type: 'application/pdf', categorie: '', deposeLe: '2026-01-03' },
    },
  };

  it('trouve la clé réelle depuis le nom affiché, jamais l’inverse', () => {
    // Le résumé envoyé à l'assistant ne porte que `.nom` (« Facture EDF »),
    // jamais la clé opaque (« abc ») qui identifie l'entrée dans l'index —
    // sans cette résolution, un document cité par l'assistant ne s'ouvrait
    // jamais et une action ne pouvait rien classer ni supprimer.
    assert.deepEqual(coffre.clesParNomAffiche(index, 'Autre papier'), ['ghi']);
  });

  it('rend toutes les clés qui partagent le même nom affiché, plutôt que d’en choisir une au hasard', () => {
    assert.deepEqual(coffre.clesParNomAffiche(index, 'Facture EDF'), ['abc', 'def']);
  });

  it('rend un tableau vide pour un nom qui n’existe pas', () => {
    assert.deepEqual(coffre.clesParNomAffiche(index, 'Fantôme'), []);
  });
});

// ─────────────────────────────── Échéances ───────────────────────────────

describe('écarter une échéance', () => {
  const depart = (): IndexCoffre => ({
    objets: {
      abc: {
        nom: 'facture.pdf', taille: 10, type: 'application/pdf',
        categorie: 'Assurance', deposeLe: '2026-01-01T00:00:00Z',
        echeance: ECHEANCE, emetteur: 'Assureur X', referenceClient: 'CL-42',
        lettre: coffre.composerLettreResiliation(IDENTITE, 'Assureur X', 'CL-42', '2026-11-15'),
      },
    },
    rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
    identite: IDENTITE,
  });

  it('retire l’échéance et la lettre déjà composée, sans supprimer le document', async () => {
    const f = poser(clientFactice());
    const index = await coffre.ecarterEcheance(UTILISATEUR, cle, 'abc', depart());
    assert.equal(index.objets.abc?.echeance, undefined);
    assert.equal(index.objets.abc?.lettre, undefined);
    assert.equal(index.objets.abc?.nom, 'facture.pdf');
    assert.ok(f.premier('delete'), 'l’échéance n’a pas été retirée de coffre_echeances');
  });

  it('conserve les rendez-vous et l’identité, comme les autres écritures', async () => {
    const f = poser(clientFactice());
    await coffre.ecarterEcheance(UTILISATEUR, cle, 'abc', depart());
    const index = await indexEnvoye(f);
    assert.deepEqual(index.rendezVous, depart().rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });

  it('refuse un document qu’elle ne trouve pas, plutôt que d’en créer un', async () => {
    poser(clientFactice());
    await assert.rejects(() => coffre.ecarterEcheance(UTILISATEUR, cle, 'inconnu', depart()));
  });
});

// ─────────────────────────── Corriger un classement ───────────────────────────

describe('modifier un objet', () => {
  const depart = (): IndexCoffre => ({
    objets: {
      abc: {
        nom: 'facture.pdf', taille: 10, type: 'application/pdf',
        categorie: 'Divers', deposeLe: '2026-01-01T00:00:00Z',
        echeance: ECHEANCE, emetteur: 'Orange', montant: '19,99 €',
      },
    },
    rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
    identite: IDENTITE,
  });

  it('conserve les rendez-vous et l’identité, comme les cinq autres écritures', async () => {
    // Sixième fonction à réécrire l'index, donc sixième occasion de perdre ce
    // qu'elle ne nomme pas. Elle est arrivée après la correction des cinq
    // autres, et sans test : c'est la forme énumérée qui est le piège, pas
    // telle fonction en particulier, et rien n'empêche la septième.
    const f = poser(clientFactice());
    await coffre.modifierObjet(UTILISATEUR, cle, 'abc', { categorie: 'Télécom' }, depart());

    const index = await indexEnvoye(f);
    assert.deepEqual(index.rendezVous, depart().rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });

  it('ne touche ni à l’échéance ni à ce qui a été lu au dépôt', async () => {
    // Corriger un classement n'est pas redéposer : l'échéance vit aussi dans
    // `coffre_echeances`, et la lettre de résiliation a été composée avec ces
    // valeurs-là. Les toucher ici les désaccorderait en silence.
    const f = poser(clientFactice());
    await coffre.modifierObjet(UTILISATEUR, cle, 'abc', { nom: 'facture-orange.pdf' }, depart());

    const objet = (await indexEnvoye(f)).objets.abc;
    assert.equal(objet?.nom, 'facture-orange.pdf');
    assert.deepEqual(objet?.echeance, ECHEANCE);
    assert.equal(objet?.emetteur, 'Orange');
    assert.equal(objet?.montant, '19,99 €');
  });

  it('refuse un document qu’elle ne trouve pas, plutôt que d’en créer un', async () => {
    poser(clientFactice());
    await assert.rejects(
      () => coffre.modifierObjet(UTILISATEUR, cle, 'inconnu', { categorie: 'Impôts' }, depart()),
    );
  });
});

describe('modifier plusieurs objets à la fois', () => {
  const depart = (): IndexCoffre => ({
    objets: {
      abc: {
        nom: 'facture.pdf', taille: 10, type: 'application/pdf',
        categorie: '', deposeLe: '2026-01-01T00:00:00Z',
      },
      def: {
        nom: 'avis.pdf', taille: 20, type: 'application/pdf',
        categorie: '', deposeLe: '2026-01-02T00:00:00Z',
      },
    },
    rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
    identite: IDENTITE,
  });

  it('classe plusieurs documents en une seule sauvegarde de l’index — le tri automatique en lot', async () => {
    const f = poser(clientFactice());
    await coffre.modifierPlusieursObjets(UTILISATEUR, cle, {
      abc: { categorie: 'Impôts' },
      def: { categorie: 'Énergie', montant: '54,20 €' },
    }, depart());

    // Une seule ligne envoyée à `coffre_index`, pas une par document.
    assert.equal(f.tous('upsert').length, 1);
    const index = await indexEnvoye(f);
    assert.equal(index.objets.abc?.categorie, 'Impôts');
    assert.equal(index.objets.def?.categorie, 'Énergie');
    assert.equal(index.objets.def?.montant, '54,20 €');
  });

  it('conserve les rendez-vous et l’identité, comme les six autres écritures', async () => {
    const f = poser(clientFactice());
    await coffre.modifierPlusieursObjets(UTILISATEUR, cle, { abc: { categorie: 'Impôts' } }, depart());
    const index = await indexEnvoye(f);
    assert.deepEqual(index.rendezVous, depart().rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });

  it('ignore un nom introuvable au lieu de faire échouer tout le lot', async () => {
    // À la différence de `modifierObjet` : un tri automatique porte sur des
    // dizaines de documents, et un seul nom déjà supprimé entre-temps ne doit
    // pas perdre les classements de tous les autres.
    const f = poser(clientFactice());
    const index = await coffre.modifierPlusieursObjets(UTILISATEUR, cle, {
      abc: { categorie: 'Impôts' },
      inconnu: { categorie: 'Santé' },
    }, depart());
    assert.equal(index.objets.abc?.categorie, 'Impôts');
    assert.equal('inconnu' in index.objets, false);
    assert.equal((await indexEnvoye(f)).objets.abc?.categorie, 'Impôts');
  });
});

// ─────────────────────────────── Identité ───────────────────────────────

describe('enregistrer l’identité', () => {
  it('conserve les documents et rendez-vous déjà présents dans l’index', async () => {
    const f = poser(clientFactice());
    const depart: IndexCoffre = {
      objets: {
        abc: {
          nom: 'avis.pdf', taille: 1, type: 'application/pdf',
          categorie: 'Impôts', deposeLe: '2026-01-01T00:00:00Z',
        },
      },
      rendezVous: { r1: { id: 'r1', libelle: 'Dentiste', date: '2026-10-02' } },
    };
    await coffre.enregistrerIdentite(UTILISATEUR, cle, IDENTITE, depart);

    const index = await indexEnvoye(f);
    assert.deepEqual(index.objets, depart.objets);
    assert.deepEqual(index.rendezVous, depart.rendezVous);
    assert.deepEqual(index.identite, IDENTITE);
  });
});
