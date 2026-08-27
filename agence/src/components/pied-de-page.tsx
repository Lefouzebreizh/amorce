import Link from 'next/link';

/*
 * Les deux pages que la loi rend obligatoires doivent être atteignables depuis
 * n'importe où — un lien qui n'existe que sur l'accueil ne les rend pas
 * accessibles à qui arrive par un lien profond. Ce pied de page est donc posé
 * sur les écrans publics et sur ceux d'authentification, qui sont les deux
 * portes d'entrée réelles.
 */
export function PiedDePage() {
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
      <Link href="/mentions-legales" className="hover:text-foreground">
        Mentions légales
      </Link>
      <Link href="/confidentialite" className="hover:text-foreground">
        Données personnelles
      </Link>
    </footer>
  );
}
