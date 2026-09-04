import { describe, expect, it } from 'vitest';
import {
  ITERATIONS, b64FromBuf, bufFromB64, chiffrerOctets, chiffrerTexte, dechiffrerOctets,
  dechiffrerTexte, deriverCle, empaqueterVerificateur, iterationsSures, nomOpaque,
  reempaqueterVerificateur,
} from './crypto';

const SEL_TEST = crypto.getRandomValues(new Uint8Array(16));

describe('deriverCle + chiffrer/déchiffrer', () => {
  it('un texte chiffré puis déchiffré avec la même clé redonne le texte original', async () => {
    const cle = await deriverCle('phrase-secrete-de-test', SEL_TEST, ITERATIONS);
    const paquet = await chiffrerTexte(cle, 'Bonjour, voici un document.');
    const clair = await dechiffrerTexte(cle, paquet);
    expect(clair).toBe('Bonjour, voici un document.');
  });

  it('des octets binaires chiffrés puis déchiffrés redonnent les mêmes octets', async () => {
    const cle = await deriverCle('autre-phrase', SEL_TEST, ITERATIONS);
    const original = crypto.getRandomValues(new Uint8Array(256));
    const paquet = await chiffrerOctets(cle, original.buffer as ArrayBuffer);
    const clair = new Uint8Array(await dechiffrerOctets(cle, paquet));
    expect(clair).toEqual(original);
  });

  it('deux chiffrements du même texte produisent des blobs différents (IV aléatoire)', async () => {
    const cle = await deriverCle('phrase', SEL_TEST, ITERATIONS);
    const a = await chiffrerTexte(cle, 'même texte');
    const b = await chiffrerTexte(cle, 'même texte');
    expect(b64FromBuf(a)).not.toBe(b64FromBuf(b));
  });

  it('déchiffrer avec la mauvaise clé échoue (jamais un contenu incorrect silencieux)', async () => {
    const cleA = await deriverCle('phrase-a', SEL_TEST, ITERATIONS);
    const cleB = await deriverCle('phrase-b', SEL_TEST, ITERATIONS);
    const paquet = await chiffrerTexte(cleA, 'secret');
    await expect(dechiffrerTexte(cleB, paquet)).rejects.toThrow();
  });

  it('la même phrase + le même sel + les mêmes itérations dérivent une clé utilisable de façon identique', async () => {
    const cle1 = await deriverCle('phrase-stable', SEL_TEST, ITERATIONS);
    const cle2 = await deriverCle('phrase-stable', SEL_TEST, ITERATIONS);
    const paquet = await chiffrerTexte(cle1, 'vérificateur');
    // Une clé dérivée séparément mais avec les mêmes paramètres doit pouvoir
    // déchiffrer ce que l'autre a chiffré — c'est ce qui permet à
    // deverrouillerCoffre de fonctionner sans jamais stocker la clé elle-même.
    await expect(dechiffrerTexte(cle2, paquet)).resolves.toBe('vérificateur');
  });
});

describe('empaqueterVerificateur / reempaqueterVerificateur', () => {
  it('empaqueter puis réempaqueter redonne un blob déchiffrable', async () => {
    const cle = await deriverCle('phrase', SEL_TEST, ITERATIONS);
    const paquetOriginal = await chiffrerTexte(cle, 'texte-verif');
    const { iv, texte } = empaqueterVerificateur(paquetOriginal);
    const reempaquete = reempaqueterVerificateur(iv, texte);
    await expect(dechiffrerTexte(cle, reempaquete)).resolves.toBe('texte-verif');
  });
});

describe('b64FromBuf / bufFromB64', () => {
  it('fait l\'aller-retour sans perte, y compris sur des octets à zéro', () => {
    const original = new Uint8Array([0, 1, 255, 128, 0, 42]);
    const b64 = b64FromBuf(original.buffer as ArrayBuffer);
    const retour = new Uint8Array(bufFromB64(b64));
    expect(retour).toEqual(original);
  });
});

describe('iterationsSures', () => {
  it('remonte au plancher une valeur absente ou invalide', () => {
    expect(iterationsSures(undefined)).toBe(ITERATIONS);
    expect(iterationsSures(null)).toBe(ITERATIONS);
    expect(iterationsSures('600000')).toBe(ITERATIONS); // une chaîne n'est pas un nombre
    expect(iterationsSures(NaN)).toBe(ITERATIONS);
    expect(iterationsSures(Infinity)).toBe(ITERATIONS);
  });

  it('remonte au plancher une valeur numérique trop basse — jamais crue à la baisse', () => {
    expect(iterationsSures(1)).toBe(ITERATIONS);
    expect(iterationsSures(-600_000)).toBe(ITERATIONS);
    expect(iterationsSures(0)).toBe(ITERATIONS);
  });

  it('honore une valeur plus haute que le plancher, telle quelle', () => {
    expect(iterationsSures(1_000_000)).toBe(1_000_000);
  });

  it('tronque une valeur décimale', () => {
    expect(iterationsSures(700_000.9)).toBe(700_000);
  });
});

describe('nomOpaque', () => {
  it('produit une chaîne hexadécimale de 32 caractères', () => {
    const nom = nomOpaque();
    expect(nom).toMatch(/^[0-9a-f]{32}$/);
  });

  it('ne se répète pas d\'un appel à l\'autre', () => {
    const noms = new Set(Array.from({ length: 50 }, () => nomOpaque()));
    expect(noms.size).toBe(50);
  });
});
