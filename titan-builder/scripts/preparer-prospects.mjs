#!/usr/bin/env node
// Préparation locale uniquement : aucun connecteur d'envoi ou de paiement.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cle = x => String(x ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const texte = x => typeof x === 'string' && x.trim().length > 0;
function telephoneCle(value) {
  const raw = String(value ?? '').replace(/[\s().-]/g, '');
  const local = raw.replace(/^(?:\+33|0033)0?([1-9]\d{8})$/, '0$1');
  return /^0[1-9]\d{8}$/.test(local) ? local : cle(value);
}
const identites = p => [...[p.id, p.name, p.email].map(cle), telephoneCle(p.phone)].filter(Boolean);
const sourceValide = x => { try { return ['https:', 'http:'].includes(new URL(Array.isArray(x) ? x[1] : x).protocol); } catch { return false; } };

export function selectionner(input) {
  if (!input || !Array.isArray(input.prospects) || !Array.isArray(input.exclusions)) throw Error('prospects et exclusions doivent être des tableaux.');
  if (input.prospects.some(p => !p || typeof p !== 'object') || input.exclusions.some(p => !p || !['string', 'object'].includes(typeof p))) throw Error('Entrée invalide.');
  const refuses = new Set(input.exclusions.flatMap(p => typeof p === 'string' ? [cle(p), telephoneCle(p)] : identites(p)));
  // Une opposition trouvée plus bas dans le même lot bloque aussi le premier doublon.
  for (const p of input.prospects) if (p.opposition === true || p.sent === true || p.inactive === true) identites(p).forEach(k => refuses.add(k));
  // Propage les exclusions entre alias liés : une troisième fiche ne doit pas
  // passer parce qu'elle ne partage que le téléphone du deuxième alias bloqué.
  let change = true;
  while (change) {
    change = false;
    for (const p of input.prospects) {
      const ids = identites(p);
      if (ids.some(k => refuses.has(k))) for (const k of ids) {
        if (!refuses.has(k)) { refuses.add(k); change = true; }
      }
    }
  }
  const vus = new Set();
  return input.prospects.map(p => {
    if (!p || typeof p !== 'object') throw Error('Prospect invalide.');
    const ids = identites(p);
    let reason = ids.some(k => refuses.has(k)) ? 'exclusion' : ids.some(k => vus.has(k)) ? 'doublon' : '';
    ids.forEach(k => vus.add(k));
    if (!reason && (!texte(p.id) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id))) reason = 'identifiant invalide';
    if (!reason && (!texte(p.name) || !texte(p.city) || !texte(p.observation) || !Array.isArray(p.sources) || !p.sources.some(sourceValide))) reason = 'sources ou faits incomplets';
    return { ...p, reason };
  });
}

function message(p, demo, signature) {
  return `Bonjour, ${p.observation}\n${demo ? `J’ai préparé une proposition de page pour ${p.name}.` : `Je peux préparer une proposition de page pour ${p.name}.`} Mon offre : un site vitrine d’une page à 300 €, sans abonnement à ma prestation ; le domaine éventuel reste à votre charge. Souhaitez-vous ${demo ? 'voir cet aperçu' : 'que je prépare un aperçu'} ?\n${signature}\nSi vous ne souhaitez plus être contacté, indiquez-le simplement en réponse.`;
}

export async function preparer(input, sortie) {
  const selection = selectionner(input);
  if (!texte(input.signature)) throw Error('signature obligatoire');
  const limite = input.limit ?? 5;
  if (!Number.isInteger(limite) || limite < 1 || limite > 5) throw Error('limit doit être compris entre 1 et 5');
  const root = path.resolve(sortie);
  // Refus d'écraser un lot : conserve les corrections et validations humaines.
  await mkdir(root, { recursive: false });
  const rapport = [];
  let retenus = 0;
  for (const p of selection) {
    if (p.reason) { rapport.push({ id: p.id, status: 'exclu', reason: p.reason }); continue; }
    if (retenus++ >= limite) { rapport.push({ id: p.id, status: 'differe', reason: 'limite du lot' }); continue; }
    const dossier = path.join(root, p.id);
    await mkdir(dossier);
    let demo = false;
    let reason = 'Téléphone public ou prestations à compléter';
    const phone = String(p.phone ?? '').replace(/[\s().-]/g, '');
    if (/^(?:0[1-9]\d{8}|\+33[1-9]\d{8})$/.test(phone) && p.phone_source && sourceValide(p.phone_source) && texte(p.services)) {
      const commande = { modele: 'btp', entreprise: p.name, telephone: p.phone, ville: p.city,
        slogan: `Découvrez ${p.name} à ${p.city}`, services: p.services, couleur: p.metier ?? '', options: ['appel'], avis: [],
        presentation: `Proposition privée préparée pour ${p.name}. Ce n’est pas le site officiel de l’entreprise et cette page n’a pas été commandée par elle. Les cadres sont des emplacements pour ses futures photos, pas des réalisations. Contenus et coordonnées à valider avec l’entreprise.` };
      await writeFile(path.join(dossier, 'commande.json'), JSON.stringify({ commande }, null, 2));
      try {
        execFileSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./generer.mjs', import.meta.url)), dossier, '--demonstration'], { stdio: 'pipe', timeout: 30000 });
        const html = await readFile(path.join(dossier, 'index.html'), 'utf8');
        if (!html.includes('noindex')) throw Error('mention noindex absente');
        demo = true; reason = '';
      } catch (e) { reason = `Échec de génération : ${e.message}`; }
    }
    const draft = message(p, demo, input.signature);
    await writeFile(path.join(dossier, 'message.txt'), draft);
    rapport.push({ ...p, status: demo ? 'a_valider' : 'a_completer', reason, demo_preparee: demo, sent: false, approved: false, message: draft });
  }
  await writeFile(path.join(root, 'file.json'), JSON.stringify({ prepared_at: new Date().toISOString(), envois: 0, prospects: rapport }, null, 2));
  return rapport;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [entree, sortie, ...extra] = process.argv.slice(2);
    if (!entree || !sortie || extra.length) throw Error('Usage : node scripts/preparer-prospects.mjs entree.json nouveau-dossier');
    const rapport = await preparer(JSON.parse(await readFile(entree, 'utf8')), sortie);
    console.log(`${rapport.filter(p => p.demo_preparee).length} démo(s), ${rapport.filter(p => p.status === 'a_completer').length} à compléter, ${rapport.filter(p => p.status === 'exclu').length} exclu(s). Aucun envoi. ${path.resolve(sortie, 'file.json')}`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
