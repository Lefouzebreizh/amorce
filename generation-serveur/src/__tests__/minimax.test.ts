import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { minimax } from '../minimax.ts';

const ACCES = { hote: 'https://exemple.invalide', cle: 'clé-de-bois' };

/** Une porte de bois : elle rend ce qu'on lui dit et note ce qu'on lui demande. */
function porte(reponses: Record<string, unknown>) {
  const vues: string[] = [];
  const fausse = (async (url: string | URL | Request, init?: RequestInit) => {
    const adresse = String(url);
    vues.push(adresse);
    const cle = Object.keys(reponses).find((motif) => adresse.includes(motif));
    if (cle === undefined) return new Response('', { status: 404 });
    return new Response(JSON.stringify(reponses[cle]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fausse, vues, dernierCorps: () => vues };
}

test('lancer une vidéo poste sur la route réelle et rend le task_id', async () => {
  const { fausse, vues } = porte({ '/v1/video_generation': { task_id: 't-42' } });
  const tache = await minimax(ACCES, fausse).lancerVideo({
    modele: 'MiniMax-Hailuo-2.3',
    invite: 'un druide sur une crête volcanique',
  });
  assert.equal(tache, 't-42');
  assert.match(vues[0], /\/v1\/video_generation$/);
});

test('une réponse sans task_id est une erreur, pas une tâche fantôme', async () => {
  const { fausse } = porte({ '/v1/video_generation': { message: 'ok' } });
  await assert.rejects(
    () => minimax(ACCES, fausse).lancerVideo({ modele: 'm', invite: 'x' }),
    /task_id/,
  );
});

test('tout ce qui n’est ni Success ni Fail veut dire « encore en cours »', async () => {
  // Y compris un état que ce code ne connaît pas : c'est exactement le cas que
  // l'absence d'énumération fermée protège.
  for (const status of ['Preparing', 'Queueing', 'Processing', 'Un-État-Inventé-Demain']) {
    const { fausse } = porte({ '/v1/query/video_generation': { status } });
    assert.deepEqual(await minimax(ACCES, fausse).suivre('t-42'), { etat: 'en-cours' });
  }
});

test('« Fail » est terminal et se dit tel quel', async () => {
  const { fausse } = porte({ '/v1/query/video_generation': { status: 'Fail' } });
  const etat = await minimax(ACCES, fausse).suivre('t-42');
  assert.equal(etat.etat, 'echoue');
});

test('« Success » déclenche la troisième étape, celle qui livre le fichier', async () => {
  const { fausse, vues } = porte({
    '/v1/query/video_generation': { status: 'Success', file_id: 'f-7' },
    '/v1/files/retrieve': { file: { download_url: 'https://exemple.invalide/plan.mp4' } },
  });
  const etat = await minimax(ACCES, fausse).suivre('t-42');

  assert.deepEqual(etat, { etat: 'fini', adresse: 'https://exemple.invalide/plan.mp4' });
  // Le brief V3 s'arrêtait à deux appels ; il en faut trois.
  assert.equal(vues.length, 2);
  assert.match(vues[1], /\/v1\/files\/retrieve\?file_id=f-7$/);
});

test('un succès sans file_id ne rend pas une adresse vide : il échoue franchement', async () => {
  const { fausse } = porte({ '/v1/query/video_generation': { status: 'Success' } });
  const etat = await minimax(ACCES, fausse).suivre('t-42');
  assert.equal(etat.etat, 'echoue');
});

test('un fichier sans adresse de téléchargement échoue aussi', async () => {
  const { fausse } = porte({
    '/v1/query/video_generation': { status: 'Success', file_id: 'f-7' },
    '/v1/files/retrieve': { file: {} },
  });
  assert.equal((await minimax(ACCES, fausse).suivre('t-42')).etat, 'echoue');
});

test('le corps envoyé ne porte que du texte, une durée et un cadrage', async () => {
  // La frontière se mesure sur ce qui **monte**, pas sur les mots du fichier :
  // `file_id` apparaît légitimement dans l'étape qui *reçoit* le résultat, et
  // un `grep` naïf s'y trompait. Ici on relit le corps réel de la requête.
  let corps: Record<string, unknown> = {};
  const fausse = (async (_url: string, init?: RequestInit) => {
    corps = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ task_id: 't-1' }), { status: 200 });
  }) as unknown as typeof fetch;

  await minimax(ACCES, fausse).lancerVideo({
    modele: 'MiniMax-Hailuo-2.3',
    invite: 'une créature de ferraille',
    secondes: 6,
    cadrage: '9:16',
  });

  assert.deepEqual(Object.keys(corps).sort(), ['aspect_ratio', 'duration', 'model', 'prompt']);
});

test('un champ non demandé n’est pas envoyé : le défaut du fournisseur vaut mieux qu’une valeur inventée', async () => {
  let corps: Record<string, unknown> = {};
  const fausse = (async (_url: string, init?: RequestInit) => {
    corps = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ task_id: 't-1' }), { status: 200 });
  }) as unknown as typeof fetch;

  await minimax(ACCES, fausse).lancerVideo({ modele: 'm', invite: 'x' });
  assert.deepEqual(Object.keys(corps).sort(), ['model', 'prompt']);
});

test('aucune image de départ n’est exposée, et le jour où elle le sera ce test tombera', async () => {
  // `first_frame_image` existe dans l'API et n'est pas branché : ce serait le
  // rush de quelqu'un qui partirait chez un tiers. Ce n'est pas un oubli, donc
  // ça se garde — même mesure que `conseiller-patrimoine`, qui relit son
  // propre source pour refuser une dépendance réseau.
  const source = await readFile(new URL('../minimax.ts', import.meta.url), 'utf8');
  const code = source
    .split('\n')
    .filter((ligne) => {
      const nu = ligne.trimStart();
      return !nu.startsWith('*') && !nu.startsWith('//') && !nu.startsWith('/*');
    })
    .join('\n');

  assert.equal(code.includes('first_frame_image'), false);
});
