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

import { clientFactice, toutCeQuiEstSorti, type Factice } from './aides-coffre';
import {
  ITERATIONS,
  TEXTE_VERIF,
  b64FromBuf,
  chiffrerTexte,
  dechiffrerTexte,
  bufFromB64,
  deriverCle,
  empaqueterVerificateur,
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

  it('signale la référence client quand elle n’a pas été lue', () => {
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'Assureur X', null, '2026-11-15');
    assert.ok(lettre.mentionsManquantes.some((m) => m.includes('référence client')));
    assert.equal(lettre.objet.includes('réf. client'), false);
  });

  it('ne réclame pas une mention que la lettre contient déjà', () => {
    // La lettre demande « m'en confirmer la prise en compte par écrit ». La
    // signaler manquante enverrait l'utilisateur ajouter à la main une phrase
    // qui y est déjà — et userait la confiance dans la liste, qui n'a d'usage
    // que si tout ce qu'elle nomme manque vraiment.
    const lettre = coffre.composerLettreResiliation(IDENTITE, 'Assureur X', 'CL-42', '2026-11-15');
    assert.match(lettre.corps.toLowerCase(), /confirmer .*par écrit/);
    assert.deepEqual(lettre.mentionsManquantes, []);
  });
});

// ──────────────────────────── Ouvrir le coffre ────────────────────────────

describe('initialiser le coffre', () => {
  it('n’envoie jamais la phrase secrète, sous aucune forme', async () => {
    const f = poser(clientFactice({ tables: { coffre_cles: { error: null } } }));
    await coffre.initialiserCoffre(UTILISATEUR, PHRASE);

    const sorti = toutCeQuiEstSorti(f.journal);
    assert.equal(sorti.includes(PHRASE), false);
    assert.equal(sorti.includes('phrase secrète'), false);
    for (const mot of PHRASE.split(' ')) {
      assert.equal(sorti.includes(mot), false, `le mot « ${mot} » est sorti`);
    }
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
  it('rend une proposition vide plutôt que d’échouer quand la fonction tombe', async () => {
    // Le classement est un confort ; le dépôt est le service. Une panne du
    // premier ne doit jamais empêcher le second.
    poser(clientFactice({ fonction: { data: null, error: { message: 'panne' } } }));
    const proposition = await coffre.proposerClassement(fichier());
    assert.equal(proposition.lisible, false);
    assert.equal(proposition.echeance.presente, false);
  });

  it('rend une proposition vide quand la fonction renvoie une erreur métier', async () => {
    poser(clientFactice({ fonction: { data: { erreur: 'illisible' }, error: null } }));
    assert.equal((await coffre.proposerClassement(fichier())).lisible, false);
  });

  it('transmet le fichier et son type, et rien d’autre', async () => {
    const f = poser(clientFactice({ fonction: { data: { lisible: true }, error: null } }));
    await coffre.proposerClassement(fichier());
    const [nom, options] = f.premier('invoke') as [string, { body: Record<string, unknown> }];
    assert.equal(nom, 'classer-document');
    assert.deepEqual(Object.keys(options.body).sort(), ['donnees', 'type']);
    // Le nom d'origine ne part pas : la fonction n'en a pas besoin pour lire.
    assert.equal(toutCeQuiEstSorti(f.journal).includes('avis-imposition'), false);
  });
});
