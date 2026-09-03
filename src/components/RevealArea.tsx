'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * La révélation au défilement de la page de vente.
 *
 * `IntersectionObserver` plutôt que le CSS `animation-timeline: view()` —
 * voir la note dans `globals.css` pour la mesure qui a écarté ce dernier.
 * Le même petit crochet sert aux trois formes que prend le contenu ici : une
 * section, un lien, un pied de page.
 */
function useRevele<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  return { ref, visible };
}

function classes(visible: boolean, ...reste: string[]): string {
  return ['revele', visible ? 'est-visible' : '', ...reste].filter(Boolean).join(' ');
}

export function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  const { ref, visible } = useRevele<HTMLElement>();
  return (
    <section ref={ref} className={classes(visible, 'flex flex-col gap-4')}>
      <h2 className="text-balance text-2xl font-semibold leading-tight text-mist sm:text-3xl">
        {titre}
      </h2>
      {children}
    </section>
  );
}

export function RevealLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const { ref, visible } = useRevele<HTMLAnchorElement>();
  return (
    <Link ref={ref} href={href} className={classes(visible, className)}>
      {children}
    </Link>
  );
}

export function RevealFooter({ children }: { children: React.ReactNode }) {
  const { ref, visible } = useRevele<HTMLElement>();
  return (
    <footer
      ref={ref}
      className={classes(visible, 'flex flex-col gap-4 border-t border-edge pt-6 text-base leading-relaxed text-muted')}
    >
      {children}
    </footer>
  );
}
