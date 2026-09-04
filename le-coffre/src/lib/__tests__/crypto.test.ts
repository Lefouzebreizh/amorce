/*
 * Le chiffrement, vérifié sur des octets.
 *
 * Ce fichier ne teste pas « est-ce que ça chiffre » — un aller-retour réussi
 * ne prouve rien, un XOR avec une constante le passerait. Il teste les quatre
 * propriétés dont dépend la promesse du projet : deux chiffrements du même
 * texte ne se ressemblent pas, une clé fausse est refusée, un octet modifié
 * est refusé, et le nombre d'itérations ne se laisse pas revoir à la baisse.
 *
 * Web Crypto est celui de Node, pas une simulation : c'est la même
 * implémentation que celle du navigateur, et un test qui bouchonnerait
 * `crypto.subtle` ne vérifierait plus que sa propre maquette.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  ITERATIONS,
  TEXTE_VERIF,
  b64FromBuf,
  bufFromB64,
  chiffrerOctets,
  chiffrerTexte,
  dechiffrerOctets,
  dechiffrerTexte,
  deriverCle,
  empaqueterVerificateur,
  iterationsSures,
  nomOpaque,
  reempaqueterVerificateur,
} from '../crypto';

/** Le même paquet, avec un octet retourné. Sert aux deux tests de falsification.
 *
 * Passe par `set` plutôt que par une affectation indexée : `noUncheckedIndexedAccess`
 * rend toute lecture d'indice `number | undefined`, et une assertion non nulle
 * cacherait ici exactement ce qu'on veut lire.
 */
function abimer(paquet: ArrayBuffer, index: number): ArrayBuffer {
  const octets = new Uint8Array(paquet.slice(0));
  const cible = index < 0 ? octets.length + index : index;
  octets.set([(octets.at(cible) ?? 0) ^ 0x01], cible);
  return octets.buffer;
}

const SEL = new Uint8Array(16).fill(7);

// Une dérivation à 600 000 itérations coûte le tiers d'une seconde : on la
// fait une fois pour tout le fichier plutôt qu'une fois par test.
const cle = await deriverCle('phrase-secrète-de-test', SEL, ITERATIONS);
const autreCle = await deriverCle('une-autre-phrase', SEL, ITERATIONS);

describe('le plancher d’itérations', () => {
  it('refuse de descendre sous le plancher, même si le serveur l’annonce', () => {
    // Le cas qui compte : une ligne corrompue — ou altérée — à `1` ferait
    // dériver une clé faible en silence, sans qu'aucune erreur ne sorte.
    assert.equal(iterationsSures(1), ITERATIONS);
    assert.equal(iterationsSures(0), ITERATIONS);
    assert.equal(iterationsSures(-100), ITERATIONS);
  });

  it('honore une valeur plus haute, qui ne peut que renforcer', () => {
    assert.equal(iterationsSures(1_200_000), 1_200_000);
  });

  it('retombe au plancher plutôt que de lever, quelle que soit l’absurdité reçue', () => {
    // Lever enfermerait l'utilisateur dehors de son propre coffre pour une
    // ligne mal formée — il n'a rien à décider ici.
    for (const valeur of [undefined, null, NaN, Infinity, -Infinity, 'beaucoup', {}, []]) {
      assert.equal(iterationsSures(valeur), ITERATIONS, `pour ${String(valeur)}`);
    }
  });

  it('tronque une valeur fractionnaire au lieu de la propager', () => {
    assert.equal(iterationsSures(ITERATIONS + 0.9), ITERATIONS);
    assert.equal(iterationsSures(1_000_000.7), 1_000_000);
  });
});

describe('base64', () => {
  it('fait l’aller-retour sur tous les octets possibles', () => {
    // 0 et 255 compris : c'est là qu'une conversion par chaîne se trahit.
    const octets = new Uint8Array(256).map((_, i) => i);
    const retour = new Uint8Array(bufFromB64(b64FromBuf(octets.buffer as ArrayBuffer)));
    assert.deepEqual(Array.from(retour), Array.from(octets));
  });

  it('rend une chaîne vide pour un tampon vide', () => {
    assert.equal(b64FromBuf(new Uint8Array(0).buffer as ArrayBuffer), '');
  });
});

describe('chiffrement', () => {
  it('fait l’aller-retour sur du texte', async () => {
    const paquet = await chiffrerTexte(cle, 'avis d’imposition 2026');
    assert.equal(await dechiffrerTexte(cle, paquet), 'avis d’imposition 2026');
  });

  it('fait l’aller-retour sur des octets quelconques', async () => {
    const source = crypto.getRandomValues(new Uint8Array(5000));
    const paquet = await chiffrerOctets(cle, source.buffer as ArrayBuffer);
    const retour = new Uint8Array(await dechiffrerOctets(cle, paquet));
    assert.deepEqual(Array.from(retour), Array.from(source));
  });

  it('ne rend jamais deux fois le même paquet pour le même texte', async () => {
    // Le vecteur d'initialisation est tiré au hasard à chaque appel. Sans
    // cela, deux documents identiques se reconnaîtraient dans le seau, sans
    // qu'on ait eu besoin de les déchiffrer.
    const a = b64FromBuf(await chiffrerTexte(cle, TEXTE_VERIF));
    const b = b64FromBuf(await chiffrerTexte(cle, TEXTE_VERIF));
    assert.notEqual(a, b);
  });

  it('laisse passer les douze octets du vecteur en tête, puis le texte chiffré', async () => {
    const clair = new TextEncoder().encode('douze octets devant');
    const paquet = await chiffrerOctets(cle, clair.buffer as ArrayBuffer);
    // 12 octets de vecteur + le clair + 16 octets d'étiquette GCM.
    assert.equal(paquet.byteLength, 12 + clair.length + 16);
  });

  it('ne laisse pas le clair apparaître dans le paquet', async () => {
    const paquet = await chiffrerTexte(cle, 'numéro de sécurité sociale');
    const octets = new Uint8Array(paquet);
    const texte = new TextDecoder('latin1').decode(octets);
    assert.equal(texte.includes('sécurité'), false);
    assert.equal(texte.includes('numéro'), false);
  });

  it('refuse une clé qui n’est pas la bonne', async () => {
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    await assert.rejects(() => dechiffrerTexte(autreCle, paquet));
  });

  it('refuse un paquet dont un seul octet a changé', async () => {
    // C'est la garantie d'AES-GCM, et c'est elle qui distingue « chiffré » de
    // « chiffré et non falsifiable ». Un serveur qui modifierait un octet ne
    // doit pas pouvoir le faire passer pour du contenu légitime.
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    await assert.rejects(() => dechiffrerTexte(cle, abimer(paquet, -1)));
  });

  it('refuse un paquet dont le vecteur a changé', async () => {
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    await assert.rejects(() => dechiffrerTexte(cle, abimer(paquet, 0)));
  });

  it('refuse un paquet tronqué', async () => {
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    await assert.rejects(() => dechiffrerTexte(cle, paquet.slice(0, 20)));
  });
});

describe('la clé dérivée', () => {
  it('n’est pas extractible, même depuis la console du navigateur', async () => {
    assert.equal(cle.extractable, false);
    await assert.rejects(() => crypto.subtle.exportKey('raw', cle));
  });

  it('change avec le sel, à phrase secrète identique', async () => {
    // Deux coffres ouverts avec la même phrase n'ont pas la même clé : c'est
    // ce qui empêche de préparer une table pour tout le monde d'un coup.
    const autreSel = new Uint8Array(16).fill(9);
    const cleAilleurs = await deriverCle('phrase-secrète-de-test', autreSel, ITERATIONS);
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    await assert.rejects(() => dechiffrerTexte(cleAilleurs, paquet));
  });
});

describe('le nom opaque', () => {
  it('fait trente-deux caractères hexadécimaux', () => {
    assert.match(nomOpaque(), /^[0-9a-f]{32}$/);
  });

  it('ne se répète pas', () => {
    // Le nom du fichier dans le seau ne doit rien dire de son contenu : c'est
    // le seul élément que Supabase voit en clair.
    const noms = new Set(Array.from({ length: 200 }, () => nomOpaque()));
    assert.equal(noms.size, 200);
  });
});

describe('le vérificateur', () => {
  it('se découpe et se recolle sans rien perdre', async () => {
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    const { iv, texte } = empaqueterVerificateur(paquet);
    const recolle = reempaqueterVerificateur(iv, texte);
    assert.equal(await dechiffrerTexte(cle, recolle), TEXTE_VERIF);
  });

  it('sort le vecteur sur douze octets, séparé du texte chiffré', async () => {
    const paquet = await chiffrerTexte(cle, TEXTE_VERIF);
    const { iv } = empaqueterVerificateur(paquet);
    assert.equal(new Uint8Array(bufFromB64(iv)).length, 12);
  });
});
