'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { COMPARATIFS, MEDIA, type Comparatif } from './contenu';

/**
 * Vrai quand le système demande à ce que ça bouge le moins possible.
 *
 * La feuille de style neutralise déjà les transitions, mais elle ne peut pas
 * empêcher une vidéo de se lancer toute seule : cette décision-là se prend en
 * JavaScript, et c'est la seule raison d'être de ce petit crochet.
 */
function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia('(prefers-reduced-motion: reduce)');
    const suivre = () => setReduit(requete.matches);
    suivre();
    requete.addEventListener('change', suivre);
    return () => requete.removeEventListener('change', suivre);
  }, []);

  return reduit;
}

/**
 * Fait apparaître un bloc quand il entre dans l'écran.
 *
 * L'observateur se débranche dès le premier passage : une page de vente se
 * lit une fois de haut en bas, et redéclencher l'animation au défilement
 * inverse donne la nausée sur un téléphone tenu à bout de bras.
 */
export function Apparition({
  children,
  delai = 0,
  className = '',
}: {
  children: ReactNode;
  delai?: number;
  className?: string;
}) {
  const cible = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = cible.current;
    if (!element) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          element.classList.add('est-vu');
          observateur.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={cible}
      className={`titan-apparait ${className}`}
      style={delai ? { transitionDelay: `${delai}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Un cadre qui dit ce qui manque.
 *
 * Une page de vente sans ses médias se livre quand même : mieux vaut un
 * emplacement franc, qui indique quoi y déposer, qu'une balise vidéo cassée
 * ou qu'une page qui attend un fichier pour exister.
 */
function Emplacement({ etiquette, note }: { etiquette: string; note?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0b0f1a] p-5 text-center">
      <span className="text-lg font-semibold tracking-[0.24em] text-titan-neon uppercase">
        {etiquette}
      </span>
      {note ? <span className="max-w-[22ch] text-lg text-muted">{note}</span> : null}
    </div>
  );
}

/**
 * La tête de Titan.
 *
 * Tant qu'aucune photo n'est fournie, elle est dessinée : un portrait tracé
 * tient dans le dépôt sans y poser de binaire, et surtout la page a une tête
 * dès la première minute au lieu d'attendre un fichier. Dès que `MEDIA.portrait`
 * pointe quelque part, la photo prend la place — et si son adresse casse, le
 * dessin revient plutôt qu'une icône d'image brisée.
 */
export function TeteTitan({ className = '' }: { className?: string }) {
  const [photoRatee, setPhotoRatee] = useState(false);
  const photo = MEDIA.portrait;

  if (photo && !photoRatee) {
    return (
      // Adresse quelconque, fournie à la main et repliable sur le dessin :
      // l'optimiseur d'images de Next exigerait d'inscrire le domaine dans la
      // configuration, ce qui casserait dès le premier changement d'hébergeur.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt="Erwann en Titan de la route, les yeux bleus incandescents"
        className={`h-full w-full object-cover ${className}`}
        onError={() => setPhotoRatee(true)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 200 240"
      role="img"
      aria-label="Portrait de Titan : une silhouette encapuchonnée aux yeux bleus incandescents"
      className={`h-full w-full ${className}`}
    >
      <defs>
        <radialGradient id="titan-halo" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor="var(--color-titan-neon)" stopOpacity="0.42" />
          <stop offset="55%" stopColor="var(--color-titan-neon)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-titan-neon)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="titan-capuche" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2438" />
          <stop offset="60%" stopColor="#0d1220" />
          <stop offset="100%" stopColor="#070a12" />
        </linearGradient>
        <linearGradient id="titan-braise" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-titan-ember)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-titan-ember)" stopOpacity="0" />
        </linearGradient>
        <filter id="titan-lueur" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="200" height="240" fill="url(#titan-halo)" />

      {/* Les épaules, larges : c'est un routier, pas un elfe. */}
      <path d="M14 240c6-42 34-62 86-62s80 20 86 62Z" fill="url(#titan-capuche)" />

      {/* La capuche, d'un seul trait pour rester lisible en très petit. */}
      <path
        d="M100 26c-34 0-56 24-56 58 0 20 5 35 13 47l86 0c8-12 13-27 13-47 0-34-22-58-56-58Z"
        fill="url(#titan-capuche)"
      />

      {/* Le visage, dans l'ombre de la capuche. */}
      <path d="M100 52c-24 0-38 17-38 42 0 26 17 44 38 44s38-18 38-44c0-25-14-42-38-42Z" fill="#0a0e18" />

      {/* La barbe, suggérée : trois masses valent mieux que trente poils. */}
      <path d="M70 108c4 22 14 34 30 34s26-12 30-34c-8 12-18 17-30 17s-22-5-30-17Z" fill="#070a12" />

      {/* Les yeux. La lueur d'abord, la pupille par-dessus. */}
      <g className="titan-pupille">
        <ellipse cx="80" cy="94" rx="12" ry="7" fill="var(--color-titan-neon)" filter="url(#titan-lueur)" />
        <ellipse cx="120" cy="94" rx="12" ry="7" fill="var(--color-titan-neon)" filter="url(#titan-lueur)" />
        <ellipse cx="80" cy="94" rx="6.5" ry="3.4" fill="#d8fbff" />
        <ellipse cx="120" cy="94" rx="6.5" ry="3.4" fill="#d8fbff" />
      </g>

      {/* Les arcades, qui donnent le regard dur. */}
      <path d="M66 84c6-5 14-8 22-7M112 77c8-1 16 2 22 7" stroke="#20304a" strokeWidth="3" strokeLinecap="round" fill="none" />

      {/* Les braises qui montent des épaules. */}
      <g fill="url(#titan-braise)">
        <circle cx="42" cy="196" r="3.4" />
        <circle cx="58" cy="176" r="2.2" />
        <circle cx="158" cy="190" r="3" />
        <circle cx="146" cy="168" r="2" />
        <circle cx="170" cy="208" r="2.4" />
      </g>
    </svg>
  );
}

/**
 * La démo, en boucle et sans son.
 *
 * Elle se lance seule, comme demandé — sauf si le système réclame le mouvement
 * réduit, auquel cas elle attend qu'on la lance. Le bouton reste visible dans
 * les deux cas : une vidéo qui tourne sans qu'on puisse l'arrêter est le
 * premier réflexe de fuite d'une page.
 */
export function VideoDemo() {
  const mouvementReduit = useMouvementReduit();
  const video = useRef<HTMLVideoElement>(null);
  const [enLecture, setEnLecture] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (mouvementReduit) {
      element.pause();
      return;
    }
    // Un refus de lecture automatique n'est pas une erreur : certains
    // navigateurs la réservent à une interaction, et le bouton la couvre.
    void element.play().catch(() => undefined);
  }, [mouvementReduit]);

  const basculer = useCallback(() => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }, []);

  if (!MEDIA.demo) {
    /*
     * Un emplacement vide ne prend pas la hauteur d'une vidéo verticale : à
     * pleine largeur de téléphone, un 9/16 fait plus de six cents pixels, et
     * trois cadres noirs de cette taille donnent une page en panne. Le format
     * revient au 9/16 dès qu'il y a quelque chose à montrer.
     */
    return (
      <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl">
        <Emplacement etiquette="Démo AZEROTH · 21,5 s" note="Colle l’adresse de la vidéo dans contenu.ts" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black">
      <video
        ref={video}
        className="h-full w-full object-cover"
        src={MEDIA.demo}
        poster={MEDIA.demoAffiche || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setEnLecture(true)}
        onPause={() => setEnLecture(false)}
      />
      <button
        type="button"
        onClick={basculer}
        aria-label={enLecture ? 'Mettre la démo en pause' : 'Lancer la démo'}
        className="absolute right-3 bottom-3 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/70 px-4 text-lg text-mist backdrop-blur"
      >
        {enLecture ? '❚❚' : '▶'}
      </button>
    </div>
  );
}

/**
 * Un avant/après, en bascule plutôt qu'en côte à côte.
 *
 * Deux formats verticaux posés l'un à côté de l'autre font 180 px de large sur
 * le terrain de référence : on n'y voit plus la différence qu'on est venu
 * montrer. La bascule garde la pleine largeur pour les deux états, et la
 * comparaison se fait au même endroit de l'écran — c'est là qu'elle frappe.
 */
function BasculeComparatif({ comparatif }: { comparatif: Comparatif }) {
  const [apres, setApres] = useState(true);
  const source = apres ? comparatif.apres : comparatif.avant;

  return (
    <figure className="overflow-hidden rounded-2xl bg-slab">
      <div className={`relative w-full bg-black ${source ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {source ? (
          <video
            key={source}
            className="h-full w-full object-cover"
            src={source}
            muted
            loop
            playsInline
            autoPlay
            preload="none"
          />
        ) : (
          <Emplacement
            etiquette={apres ? 'Après · montée' : 'Avant · brute'}
            note={`Vidéo « ${comparatif.titre.toLowerCase()} » à coller dans contenu.ts`}
          />
        )}
        {apres && source ? (
          <span className="absolute top-3 left-3 rounded-full bg-titan-ember px-3 py-1 text-lg font-bold text-titan-night">
            TITAN
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1 p-1" role="group" aria-label={`Comparatif ${comparatif.titre}`}>
        {[false, true].map((etat) => (
          <button
            key={String(etat)}
            type="button"
            onClick={() => setApres(etat)}
            aria-pressed={apres === etat}
            className={`min-h-11 rounded-xl px-3 text-lg font-semibold transition-colors ${
              apres === etat
                ? 'bg-titan-neon text-titan-night'
                : 'bg-panel text-muted hover:text-mist'
            }`}
          >
            {etat ? 'Après' : 'Avant'}
          </button>
        ))}
      </div>

      <figcaption className="px-4 pt-1 pb-4">
        <p className="text-xl font-bold text-mist">{comparatif.titre}</p>
        <p className="mt-1 text-lg text-muted">{comparatif.contexte}</p>
      </figcaption>
    </figure>
  );
}

/** Les trois avant/après, empilés sur téléphone et alignés sur grand écran. */
export function Comparatifs() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {COMPARATIFS.map((comparatif, index) => (
        <Apparition key={comparatif.cle} delai={index * 90}>
          <BasculeComparatif comparatif={comparatif} />
        </Apparition>
      ))}
    </div>
  );
}

/**
 * Le bandeau d'achat, en bas, une fois le premier écran passé.
 *
 * En bas parce que c'est là que le pouce vit sur un écran de 20:9 ; après le
 * premier écran parce qu'il ne doit pas recouvrir la promesse qu'il vend. La
 * marge basse reprend la barre de gestes de HyperOS, sans quoi le bouton se
 * confond avec le retour système.
 */
export function BarreAchat({ lien, libelle }: { lien: string; libelle: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const surDefilement = () => setVisible(window.scrollY > 520);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-titan-night/95 px-4 pt-3 backdrop-blur transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      aria-hidden={!visible}
    >
      <a
        href={lien}
        tabIndex={visible ? undefined : -1}
        className="mx-auto flex min-h-14 w-full max-w-md items-center justify-center rounded-2xl bg-titan-ember px-6 text-xl font-black text-titan-night"
      >
        {libelle}
      </a>
    </div>
  );
}
