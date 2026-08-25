/*
 * Service worker : recevoir un fichier partagé, et rien d'autre.
 *
 * Le sélecteur de fichiers d'Android rend régulièrement un fichier de zéro
 * octet quand l'entrée choisie vient d'un espace de stockage en ligne. Le bouton
 * « Partager », lui, transmet les octets réels. Ce worker est ce qui permet à
 * Amorce d'être une destination de partage.
 *
 * Il intercepte la requête DANS le navigateur : `respondWith` l'empêche
 * d'atteindre le réseau. C'est ce qui rend la chose compatible avec la promesse
 * du studio — aucun fichier ne part sur un serveur. Un traitement côté serveur,
 * plus court à écrire, téléverserait précisément ce qu'on s'est engagé à garder
 * sur l'appareil.
 *
 * IL NE MET RIEN EN CACHE. JAMAIS.
 *
 * Ce n'est pas un oubli, c'est la règle la plus importante de ce fichier. Un
 * cache de service worker qui sert une vieille version pendant des heures est
 * exactement le défaut qui a coûté une soirée à ce projet : on croit corriger,
 * on déploie, et l'appareil affiche imperturbablement l'ancien code. L'API Cache
 * n'est donc pas utilisée, et le gestionnaire `fetch` sort immédiatement pour
 * tout ce qui n'est pas le dépôt de partage.
 *
 * Le worker est un fichier statique de `public/`, pas un module assemblé : un
 * worker servi depuis `/_next/static/…` ne peut pas revendiquer la portée `/`
 * sans l'en-tête `Service-Worker-Allowed`, qui suppose de maîtriser le serveur.
 */

/**
 * Base distincte de celle de la reprise.
 *
 * Écrire dans la base de `persistence.ts` obligerait ce fichier et ce module à
 * s'accorder sur un numéro de version et un schéma, alors qu'ils ne peuvent pas
 * s'importer l'un l'autre : la première divergence passerait inaperçue jusqu'à
 * ce qu'un utilisateur perde son montage.
 */
const DB_NAME = 'amorce-partage';
const STORE = 'recus';
const ACTION = '/partage';

self.addEventListener('install', () => {
  // Prendre la main sans attendre la fermeture des onglets ouverts : un worker
  // en attente ne recevrait aucun partage.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tout le reste part au réseau, sans que ce worker n'y touche.
  if (event.request.method !== 'POST' || url.pathname !== ACTION) return;

  event.respondWith(receive(event.request));
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function keep(files) {
  const db = await openDb();
  try {
    for (const file of files) {
      const tx = db.transaction(STORE, 'readwrite');
      // Le blob est rangé tel quel : c'est lui qui porte les octets que le
      // sélecteur de fichiers n'arrivait pas à transmettre.
      await done(tx.objectStore(STORE).add({ name: file.name, type: file.type, blob: file }));
    }
  } finally {
    db.close();
  }
}

async function receive(request) {
  try {
    const form = await request.formData();
    // Un fichier vide est précisément ce qu'on cherche à éviter : le laisser
    // passer redonnerait l'erreur qu'on est venu supprimer.
    const files = form.getAll('fichiers').filter((file) => file && file.size > 0);

    if (files.length > 0) await keep(files);

    // 303 : le navigateur repart en GET vers l'application, qui videra la
    // réserve au démarrage.
    return Response.redirect(`/?partage=${files.length}`, 303);
  } catch {
    // L'échec doit rester silencieux et ramener à l'application : une page
    // d'erreur du navigateur ne dirait rien d'utile.
    return Response.redirect('/?partage=0', 303);
  }
}
