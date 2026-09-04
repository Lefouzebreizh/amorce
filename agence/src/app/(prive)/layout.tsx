import { BarreLaterale } from '@/components/barre-laterale';
import { ID_CONTENU, LienEvitement } from '@/components/lien-evitement';
import { exigerSession, lireProfil } from '@/lib/supabase/session';

/*
 * Coque de l'espace privé.
 *
 * `exigerSession()` est appelé ici en plus du garde de `proxy.ts` : le proxy
 * redirige un navigateur, il ne protège pas contre un rendu déclenché
 * autrement. Deux lignes pour ne pas dépendre d'une seule barrière.
 */
export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const session = await exigerSession();
  const profil = await lireProfil(session);

  const nom = profil?.full_name ?? session.utilisateur.email ?? 'Mon compte';
  const detail = profil?.company_name ?? session.utilisateur.email ?? '';

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/*
        Avant la barre latérale, donc premier au clavier : placé après, il
        n'éviterait plus rien.
      */}
      <LienEvitement />
      <BarreLaterale nom={nom} detail={detail} estAdministrateur={profil?.role === 'admin'} />
      {/*
        `pb-28` sur téléphone : la barre d'onglets est fixée en bas, et sans
        cette réserve elle recouvre la dernière ligne de chaque page.
      */}
      <main
        id={ID_CONTENU}
        tabIndex={-1}
        className="flex-1 px-4 pb-28 pt-6 lg:px-10 lg:pb-12 lg:pt-10"
      >
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
