import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Navigation } from '../composants/Navigation.tsx'
import './globals.css'

/*
 * Tout l'arbre est rendu à la demande, et c'est une décision, pas un repli.
 *
 * Next pré-rend par défaut ce qu'il peut au moment du build. Ici cela n'a aucun
 * sens : les pages lisent un catalogue qui n'existe pas encore quand on
 * construit l'application, et qui change à chaque import. Le build échouait
 * d'ailleurs franchement — « unable to open database file » — ce qui vaut mieux
 * qu'une page figée sur l'état d'un soir.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'IPTV / VOD',
  description: 'Gestion et lecture de ses propres abonnements IPTV',
}

/*
 * La coque. La navigation est en **bas** sur téléphone et sur le côté au-delà :
 * un menu en haut d'un écran de 6,7 pouces demande de changer la prise en main
 * à chaque changement d'onglet, et c'est l'écran qu'on ouvre le plus souvent
 * d'une seule main.
 */
export default function RacineLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-[100dvh] bg-fond text-texte antialiased">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col md:flex-row">
          <Navigation />
          <main className="flex-1 px-4 pb-28 pt-4 md:pb-8 md:pl-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
