# Le squelette complet — Next.js 16, React 19, Supabase

Code entier, à recopier et adapter. Rien n'y est abrégé : un « … le reste du
code ici » se traduit en régression chez le client suivant.

## Table des matières

1. [Variables d'environnement](#1-variables-denvironnement)
2. [Les trois clients Supabase](#2-les-trois-clients-supabase)
3. [Le proxy — rafraîchir la session](#3-le-proxy--rafraîchir-la-session)
4. [Les types de la base](#4-les-types-de-la-base)
5. [Une Server Action complète](#5-une-server-action-complète)
6. [La page serveur](#6-la-page-serveur)
7. [Le composant client](#7-le-composant-client)

---

## 1. Variables d'environnement

`.env.local`, jamais versionné. `.env.example` versionné, avec les mêmes clés
et des valeurs vides — c'est lui qui documente ce qu'il faut fournir.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

La clé `service_role` n'a rien à faire ici tant qu'aucun traitement ne l'exige.
Le jour où elle devient nécessaire (une tâche planifiée, un import), elle
s'appelle `SUPABASE_SERVICE_ROLE_KEY`, sans `NEXT_PUBLIC_` : ce préfixe inscrit
la valeur en clair dans le paquet envoyé au navigateur, et cette clé-là ignore
toutes les politiques RLS.

## 2. Les trois clients Supabase

Trois contextes d'exécution, trois façons de retrouver les cookies de session.
Les mélanger donne des sessions qui « se perdent » au rechargement.

```ts
// lib/supabase/client.ts — composants client
'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

```ts
// lib/supabase/server.ts — composants serveur, Server Actions, Route Handlers
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'

export async function createClient() {
  // `cookies()` est asynchrone depuis Next.js 15 : l'oublier ne casse pas la
  // compilation, cela renvoie une promesse dont personne ne lit les cookies,
  // et l'utilisateur paraît déconnecté au hasard des rendus.
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Un composant serveur ne peut pas écrire de cookie. Le proxy
            // ayant déjà rafraîchi la session, il n'y a rien à rattraper ici.
          }
        },
      },
    },
  )
}
```

```ts
// lib/supabase/proxy.ts — utilisé par le seul proxy, qui a sa propre réponse
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/lib/database.types'

export function createProxyClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  return { supabase, response }
}
```

## 3. Le proxy — rafraîchir la session

**En Next.js 16, `middleware.ts` est déprécié et s'appelle `proxy.ts`**, avec
un export nommé `proxy`. Tout le reste est identique. La quasi-totalité des
guides Supabase en ligne montrent encore `middleware.ts` : les recopier tels
quels donne un fichier que Next.js ignore, donc une session qui expire au bout
d'une heure sans explication.

```ts
// proxy.ts — à la racine, à côté de app/
import { NextResponse, type NextRequest } from 'next/server'

import { createProxyClient } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const { supabase, response } = createProxyClient(request)

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès de Supabase. `getSession()` se contente de relire le cookie, qu'un
  // client peut écrire.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const chemin = request.nextUrl.pathname

  if (!user && chemin.startsWith('/app')) {
    const versConnexion = request.nextUrl.clone()
    versConnexion.pathname = '/connexion'
    versConnexion.searchParams.set('suite', chemin)
    return NextResponse.redirect(versConnexion)
  }

  return response
}

export const config = {
  // Ni les fichiers statiques ni les images : le proxy s'exécute sur chaque
  // requête qu'il accepte, et rafraîchir une session pour servir un SVG est du
  // temps perdu à chaque chargement de page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
```

Cette redirection est **un confort, pas une protection**. La documentation de
Next.js est explicite : le proxy sert à des contrôles optimistes, jamais de
solution d'autorisation. L'autorisation se refait dans chaque page et chaque
action — voir plus bas.

## 4. Les types de la base

Générés depuis le schéma réel, jamais écrits à la main : une colonne renommée
doit casser la compilation, pas la production.

```bash
npx supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts
```

Les alias qui rendent le reste lisible :

```ts
// lib/types.ts
import type { Database } from '@/lib/database.types'

export type Projet = Database['public']['Tables']['projects']['Row']
export type NouveauProjet = Database['public']['Tables']['projects']['Insert']
export type StatutProjet = Projet['status']

export const STATUTS: ReadonlyArray<{ valeur: StatutProjet; libelle: string }> = [
  { valeur: 'draft', libelle: 'Brouillon' },
  { valeur: 'in_progress', libelle: 'En cours' },
  { valeur: 'completed', libelle: 'Terminé' },
]
```

## 5. Une Server Action complète

Une Server Action est **un point d'entrée HTTP public**. Le fait qu'elle soit
appelée depuis un bouton visible seulement des connectés ne protège rien : son
identifiant est dans le paquet JavaScript, et n'importe qui peut la poster.
D'où les trois temps : session, validation, écriture.

```ts
// app/(app)/projets/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const schemaProjet = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(200, 'Titre trop long'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.enum(['draft', 'in_progress', 'completed']),
  amount_estimated: z.coerce.number().min(0, 'Le montant ne peut pas être négatif'),
})

export interface EtatFormulaire {
  readonly succes: boolean
  readonly message: string
  readonly erreurs: Readonly<Record<string, string[]>>
}

export const ETAT_INITIAL: EtatFormulaire = { succes: false, message: '', erreurs: {} }

export async function creerProjet(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { succes: false, message: 'Votre session a expiré. Reconnectez-vous.', erreurs: {} }
  }

  const analyse = schemaProjet.safeParse({
    title: donnees.get('title'),
    description: donnees.get('description'),
    status: donnees.get('status'),
    amount_estimated: donnees.get('amount_estimated'),
  })

  if (!analyse.success) {
    return {
      succes: false,
      message: 'Corrigez les champs signalés.',
      erreurs: analyse.error.flatten().fieldErrors,
    }
  }

  try {
    const { error } = await supabase.from('projects').insert({
      // `user_id` vient de la session, jamais du formulaire : accepter la
      // valeur envoyée par le client reviendrait à le laisser créer des
      // projets au nom d'autrui. La policy RLS le refuserait, mais l'erreur
      // qui en résulterait serait incompréhensible.
      user_id: user.id,
      title: analyse.data.title,
      description: analyse.data.description || null,
      status: analyse.data.status,
      amount_estimated: analyse.data.amount_estimated,
    })

    if (error) {
      // Le message de PostgreSQL décrit le schéma : le journaliser côté
      // serveur, montrer une phrase utile à l'utilisateur.
      console.error('Insertion du projet refusée', error)
      return { succes: false, message: "Le projet n'a pas pu être enregistré.", erreurs: {} }
    }
  } catch (cause) {
    console.error('Supabase injoignable', cause)
    return { succes: false, message: 'Service momentanément indisponible.', erreurs: {} }
  }

  revalidatePath('/app/projets')
  return { succes: true, message: 'Projet créé.', erreurs: {} }
}
```

## 6. La page serveur

Le contrôle de session se refait ici, sans se reposer sur le proxy.

```tsx
// app/(app)/projets/page.tsx
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { ListeProjets } from './liste-projets'

export default async function PageProjets() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  // Pas de `.eq('user_id', user.id)` : la policy RLS le fait déjà, et le
  // dupliquer ferait croire que la sécurité tient au filtre côté application.
  const { data: projets, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Lecture des projets refusée', error)
  }

  return <ListeProjets projets={projets ?? []} enErreur={Boolean(error)} />
}
```

## 7. Le composant client

`useActionState` porte l'état de chargement ; le retour visuel passe par un
toast et par les messages sous les champs concernés.

```tsx
// app/(app)/projets/formulaire-projet.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { STATUTS } from '@/lib/types'
import { creerProjet, ETAT_INITIAL } from './actions'

export function FormulaireProjet() {
  const [etat, action, enCours] = useActionState(creerProjet, ETAT_INITIAL)

  useEffect(() => {
    if (!etat.message) return
    if (etat.succes) toast.success(etat.message)
    else toast.error(etat.message)
  }, [etat])

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={200}
          aria-invalid={Boolean(etat.erreurs.title)}
          aria-describedby={etat.erreurs.title ? 'title-erreur' : undefined}
        />
        {etat.erreurs.title ? (
          <p id="title-erreur" role="alert" className="text-sm text-destructive">
            {etat.erreurs.title[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Statut</Label>
        <select
          id="status"
          name="status"
          defaultValue="draft"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUTS.map(({ valeur, libelle }) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount_estimated">Montant estimé (€)</Label>
        <Input
          id="amount_estimated"
          name="amount_estimated"
          type="number"
          min={0}
          step="0.01"
          defaultValue="0"
          aria-invalid={Boolean(etat.erreurs.amount_estimated)}
        />
        {etat.erreurs.amount_estimated ? (
          <p role="alert" className="text-sm text-destructive">
            {etat.erreurs.amount_estimated[0]}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={enCours} className="min-h-11 w-full sm:w-auto">
        {enCours ? 'Enregistrement…' : 'Créer le projet'}
      </Button>
    </form>
  )
}
```

Le bouton reste monté pendant l'envoi et change de libellé plutôt que de
disparaître : un bouton qui s'efface pendant l'attente fait douter du clic et
provoque le second envoi qu'on cherchait à éviter.
