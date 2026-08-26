'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { seDeconnecter } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

/*
 * Navigation de l'espace privé, en deux dispositions issues du même composant.
 *
 * Sur ordinateur : une colonne fixe à gauche. Sur téléphone : un bandeau en
 * haut pour l'identité, et les onglets en bas, à portée du pouce — une
 * navigation logée en haut d'un écran de six pouces oblige à changer de main.
 * Dupliquer le composant pour les deux cas ferait diverger les deux menus au
 * premier ajout de rubrique.
 */
const LIENS = [
  { href: '/tableau-de-bord', libelle: 'Tableau de bord', Icone: LayoutDashboard },
  { href: '/projets', libelle: 'Projets', Icone: FolderKanban },
  { href: '/compte', libelle: 'Mon compte', Icone: UserRound },
] as const;

const LIEN_ADMINISTRATION = {
  href: '/administration',
  libelle: 'Administration',
  Icone: ShieldCheck,
} as const;

type ProprietesBarre = {
  nom: string;
  detail: string;
  estAdministrateur: boolean;
};

export function BarreLaterale({ nom, detail, estAdministrateur }: ProprietesBarre) {
  const chemin = usePathname();

  // Le lien n'apparaît que pour un administrateur — mais c'est un confort, pas
  // une protection : la page elle-même redemande le rôle, et la RLS décide
  // seule de ce que la base accepte de servir.
  const liens = estAdministrateur ? [...LIENS, LIEN_ADMINISTRATION] : LIENS;

  const estActif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-card px-4 py-6 lg:flex">
        <Link href="/" className="px-2 text-sm font-semibold tracking-tight">
          Socle Agence
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {liens.map(({ href, libelle, Icone }) => (
            <Link
              key={href}
              href={href}
              aria-current={estActif(href) ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                estActif(href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icone aria-hidden className="size-4" />
              {libelle}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Identite nom={nom} detail={detail} />
          <BoutonDeconnexion />
        </div>
      </aside>

      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 lg:hidden">
        <Identite nom={nom} detail={detail} />
        <BoutonDeconnexion compact />
      </header>

      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card lg:hidden',
          // La barre de gestes d'Android et la barre d'accueil d'iOS mangent le
          // bas de l'écran : sans cette marge, le dernier onglet est sous le
          // doigt du système.
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {liens.map(({ href, libelle, Icone }) => (
          <Link
            key={href}
            href={href}
            aria-current={estActif(href) ? 'page' : undefined}
            className={cn(
              // `leading-tight` et `px-1` : avec quatre onglets sur un écran
              // étroit, « Tableau de bord » passe sur deux lignes plutôt que
              // d'être coupé.
              'flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1',
              'text-center text-xs font-medium leading-tight',
              estActif(href) ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icone aria-hidden className="size-5" />
            {libelle}
          </Link>
        ))}
      </nav>
    </>
  );
}

function Identite({ nom, detail }: Omit<ProprietesBarre, 'estAdministrateur'>) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
      >
        {initiales(nom)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{nom}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function BoutonDeconnexion({ compact = false }: { compact?: boolean }) {
  return (
    <form action={seDeconnecter}>
      <Button
        type="submit"
        variante="fantome"
        taille={compact ? 'icone' : 'petite'}
        className={compact ? undefined : 'w-full justify-start'}
        aria-label={compact ? 'Se déconnecter' : undefined}
      >
        <LogOut aria-hidden />
        {compact ? null : 'Se déconnecter'}
      </Button>
    </form>
  );
}

/** Deux lettres au plus : au-delà, la pastille déborde sur les noms composés. */
function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const lettres = mots.slice(0, 2).map((mot) => mot.charAt(0).toUpperCase());

  return lettres.join('') || '?';
}
