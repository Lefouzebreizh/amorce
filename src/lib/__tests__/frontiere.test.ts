import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * La frontière du moteur de montage.
 *
 * `CLAUDE.md` autorise une exception unique à la promesse « aucun fichier ne
 * quitte l'appareil » : un serveur de licence, qui ne connaît que l'identité et
 * l'état de l'abonnement. L'exception ne tient que si elle reste bornée, et la
 * règle qui la borne est écrite noir sur blanc : **le moteur de montage ne
 * connaît pas le réseau.**
 *
 * Une règle qu'aucun test ne garde s'érode en trois mois. Celle-ci se vérifie,
 * et c'est ce qui la sépare d'une intention.
 */

const RACINE = new URL('../../..', import.meta.url).pathname;
const MOTEUR = ['src/lib', 'src/hooks'];

function fichiers(dossier: string): string[] {
  const chemin = join(RACINE, dossier);
  return readdirSync(chemin).flatMap((nom) => {
    const complet = join(chemin, nom);
    if (statSync(complet).isDirectory()) {
      // Les tests eux-mêmes ne sont pas le moteur : ils décrivent le moteur.
      return nom === '__tests__' ? [] : fichiers(join(dossier, nom));
    }
    return nom.endsWith('.ts') || nom.endsWith('.tsx') ? [join(dossier, nom)] : [];
  });
}

test('le moteur n’importe rien du module de licence', () => {
  /*
   * Le premier pas qui casse l'exception n'est pas le serveur : c'est une
   * dépendance du moteur vers lui. Le studio doit rester entier serveur
   * éteint, et la licence pilote ce que l'interface propose, jamais ce que le
   * moteur fait d'un fichier.
   *
   * Le module existe désormais — `src/licence/` — et ce test ne passe donc plus
   * par défaut : il mesure. Le moteur ne l'importe nulle part ; le seul
   * importateur est `src/components/Studio.tsx`, c'est-à-dire l'interface, et
   * c'est exactement le sens autorisé. Vérifié en le cassant exprès : un
   * `import ... from '@/licence/types'` posé dans `src/lib/timeline.ts` fait
   * échouer ce test-ci et lui seul.
   */
  const coupables: string[] = [];
  for (const dossier of MOTEUR) {
    for (const fichier of fichiers(dossier)) {
      const texte = readFileSync(join(RACINE, fichier), 'utf8');
      if (/from\s+['"](@\/licence|\.\.?\/(\.\.\/)*licence)/.test(texte)) coupables.push(fichier);
    }
  }
  assert.deepEqual(coupables, [], 'le moteur dépend du module de licence');
});

/*
 * Les seuls `fetch` que le moteur s'autorise, avec leur raison.
 *
 * Ils ne partent pas sur le réseau : leur argument est un lien objet, qui
 * désigne un fichier déjà en mémoire. C'est pour cela que la liste nomme les
 * fichiers plutôt que d'interdire `fetch` en bloc — une interdiction sèche
 * aurait été fausse dès le premier jour, et une règle fausse finit contournée.
 *
 * Un troisième appel fait échouer ce test. Ce n'est pas un obstacle : c'est
 * l'endroit où l'on écrit pourquoi il est légitime, ou l'on découvre qu'il ne
 * l'est pas.
 */
const FETCH_AUTORISES: Record<string, string> = {
  'src/lib/voice.ts': 'relit un lien objet pour décoder la voix hors ligne',
  'src/lib/persistence.ts': 'relit un lien objet pour ranger le fichier dans IndexedDB',
};

test('aucun appel réseau ne s’ajoute au moteur en silence', () => {
  const trouves: string[] = [];
  for (const dossier of MOTEUR) {
    for (const fichier of fichiers(dossier)) {
      const texte = readFileSync(join(RACINE, fichier), 'utf8');
      if (/\bfetch\s*\(/.test(texte)) trouves.push(fichier);
    }
  }
  assert.deepEqual(
    trouves.sort(),
    Object.keys(FETCH_AUTORISES).sort(),
    'un fetch est apparu ou a disparu dans le moteur : le déclarer avec sa raison',
  );
});

test('le moteur ne porte aucune adresse distante', () => {
  /*
   * Une adresse en dur est le signe avant-coureur d'un appel réseau : elle
   * arrive avant lui, dans une constante ou un commentaire de travail. On la
   * cherche donc dans le code, en laissant les commentaires tranquilles — un
   * lien de documentation n'a jamais fait sortir un octet.
   */
  const coupables: string[] = [];
  for (const dossier of MOTEUR) {
    for (const fichier of fichiers(dossier)) {
      const lignes = readFileSync(join(RACINE, fichier), 'utf8').split('\n');
      for (const [i, ligne] of lignes.entries()) {
        const sansCommentaire = ligne.replace(/^\s*(\/\/|\*|\/\*).*/, '');
        if (/https?:\/\//.test(sansCommentaire)) coupables.push(`${fichier}:${i + 1}`);
      }
    }
  }
  assert.deepEqual(coupables, [], 'une adresse distante est écrite dans le moteur');
});
