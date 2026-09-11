// Service worker minimal du Tiroir Secret — sert uniquement à rendre
// l'application installable et à laisser la coquille se recharger hors
// ligne. Il ne met JAMAIS en cache une requête vers Supabase (autre
// origine, donc déjà hors de portée du `fetch` ci-dessous) ni une requête
// qui n'est pas un simple GET : le chiffrement, l'authentification et les
// documents restent entièrement pilotés par le code de l'application,
// jamais par ce fichier.

const VERSION = 'tiroir-secret-v1';
const COQUILLE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(COQUILLE)).catch(() => {
      // Une icône ou une page absente au premier déploiement ne doit pas
      // empêcher l'installation du service worker lui-même.
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((nom) => nom !== VERSION).map((nom) => caches.delete(nom))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  // Seuls les GET du même site entrent dans le cache — jamais une requête
  // vers Supabase (autre origine) ni un POST/PUT d'API.
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) {
    return;
  }

  if (requete.mode === 'navigate') {
    // Réseau d'abord : la donnée la plus fraîche tant qu'elle est
    // disponible, repli sur la coquille en cache seulement hors ligne.
    evenement.respondWith(
      fetch(requete).catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  evenement.respondWith(
    caches.match(requete).then((reponseEnCache) => {
      if (reponseEnCache) return reponseEnCache;
      return fetch(requete).then((reponse) => {
        if (reponse.ok) {
          const copie = reponse.clone();
          caches.open(VERSION).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      });
    }),
  );
});
