import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

/*
 * Le script est éprouvé pour de vrai, en le lançant.
 *
 * C'est justement parce qu'il n'était pas lançable hors d'un terminal qu'il a
 * fallu lui ajouter une lecture non interactive : `rl.question` ne se résout
 * plus une fois le flux d'entrée terminé, et le script restait suspendu sans
 * rien dire. Un outil de livraison qu'on ne peut pas éprouver n'est pas
 * éprouvé.
 */
function lancer(reponses: string[], sortie: string): Promise<{ code: number; texte: string }> {
  return new Promise((resoudre) => {
    const enfant = spawn(
      process.execPath,
      ['--experimental-strip-types', 'scripts/nouveau-client.mjs', sortie],
      { cwd: path.resolve(import.meta.dirname, '..') },
    );
    let texte = '';
    enfant.stdout.on('data', (d) => (texte += d));
    enfant.stderr.on('data', (d) => (texte += d));
    enfant.stdin.end(`${reponses.join('\n')}\n`);
    enfant.on('close', (code) => resoudre({ code: code ?? 0, texte }));
  });
}

const COMPLET = [
  'btp', 'Couverture Tanguy', '0645129803', 'Auray',
  'Couvreur zingueur.', 'Je travaille seul.', 'Toiture; Zinguerie',
  '#2f6f4e', 'appel whatsapp',
];

test('écrit le dossier et la page depuis des réponses', async () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'client-'));
  const { code } = await lancer(COMPLET, sortie);

  assert.equal(code, 0);
  const [reference] = readdirSync(sortie);
  assert.match(reference, /^couverture-tanguy-\d{4}-\d{2}-\d{2}$/);

  const fichiers = readdirSync(path.join(sortie, reference)).sort();
  assert.deepEqual(fichiers, ['commande.json', 'index.html']);
});

test('le dossier écrit a la même forme que celui de la route web', async () => {
  /*
   * Deux chemins produisent des dossiers ; s'ils divergent, `generer` marche
   * sur l'un et pas sur l'autre, et on ne s'en aperçoit que devant un client.
   */
  const sortie = mkdtempSync(path.join(tmpdir(), 'client-'));
  await lancer(COMPLET, sortie);
  const [reference] = readdirSync(sortie);
  const dossier = JSON.parse(
    readFileSync(path.join(sortie, reference, 'commande.json'), 'utf8'),
  );

  for (const cle of ['reference', 'recue_le', 'prix_total_euros', 'commande', 'photos']) {
    assert.ok(cle in dossier, `clé absente : ${cle}`);
  }
  assert.equal(dossier.prix_total_euros, 300);
  assert.deepEqual(dossier.commande.options, ['appel', 'whatsapp']);
});

test('la page porte ce qui a été saisi', async () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'client-'));
  await lancer(COMPLET, sortie);
  const [reference] = readdirSync(sortie);
  const html = readFileSync(path.join(sortie, reference, 'index.html'), 'utf8');

  assert.ok(html.includes('Couverture Tanguy'));
  /*
   * Le dossier porte `#2f6f4e`, la page sort en `#67c1a0` : c'est le vert de la
   * charte, et c'est le comportement voulu. Un dossier écrit avant la charte
   * doit rester régénérable — et se régénérer **dans** la charte, sinon un
   * site livré demain depuis un vieux dossier s'en écarterait sans que rien ne
   * le signale.
   */
  assert.ok(html.includes('--accent: #67c1a0'), 'la teinte livrée sort de la charte');
  assert.ok(html.includes('tel:+33645129803'));
  assert.ok(html.includes('Zinguerie'));
});

test('un champ obligatoire manquant arrête tout, avec la même règle que le web', async () => {
  /*
   * `reproches()` est partagée avec la route d'API. Une seconde validation
   * écrite pour le terminal aurait dérivé sans que rien ne le signale, et
   * fabriqué des dossiers qu'un autre chemin refuse.
   */
  const sortie = mkdtempSync(path.join(tmpdir(), 'client-'));
  const sansVille = [...COMPLET];
  sansVille[3] = '';
  const { code, texte } = await lancer(sansVille, sortie);

  assert.equal(code, 1);
  assert.match(texte, /Il manque/);
  assert.deepEqual(readdirSync(sortie), []);
});

test('une couleur inventée est refusée avant d’écrire quoi que ce soit', async () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'client-'));
  const couleurFausse = [...COMPLET];
  couleurFausse[7] = 'vert bouteille';
  const { code } = await lancer(couleurFausse, sortie);

  assert.equal(code, 1);
  assert.deepEqual(readdirSync(sortie), []);
});
