'use client';

// Écran de conversation minimal — le seul but est de rendre le squelette
// vérifiable par une vraie personne (couche 4, TODO.md : la revue humaine
// par un professionnel de santé mentale). Pas le parcours guidé à choix
// prévu pour la V1 : juste de quoi taper un message et voir ce que les
// couches 1 à 3 en font, avant de bâtir davantage dessus.
import { useEffect, useRef, useState } from 'react';
import type { Tour } from '@/lib/orchestrer';
import type { EtatSession } from '@/lib/sessionLimits';

interface Message {
  role: 'user' | 'assistant';
  texte: string;
  crise?: boolean;
}

export default function PageChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Une seule session locale, pour la durée de l'onglet — pas de persistance
  // inter-sessions tant que Supabase n'existe pas (couche 3, seuil 2).
  // `demarreeLe` se pose dans un effet, pas à l'initialisation du rendu :
  // `Date.now()` est impur, et React interdit un appel impur pendant le rendu.
  const session = useRef<EtatSession>({
    demarreeLe: 0,
    nombreEchanges: 0,
    detressePersistanteInterSessions: false,
  });
  useEffect(() => {
    session.current.demarreeLe = Date.now();
  }, []);

  async function envoyer() {
    const texte = saisie.trim();
    if (!texte || enCours) return;
    setErreur(null);
    setSaisie('');
    const historiqueEnvoye: Tour[] = messages.map((m) => ({ role: m.role, texte: m.texte }));
    setMessages((precedent) => [...precedent, { role: 'user', texte }]);
    setEnCours(true);
    try {
      const reponse = await fetch('/api/repondre', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: texte, historique: historiqueEnvoye, session: session.current }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) {
        setErreur(donnees.erreur ?? 'Une erreur est survenue.');
        return;
      }
      session.current.nombreEchanges += 1;
      setMessages((precedent) => [...precedent, { role: 'assistant', texte: donnees.reponse, crise: donnees.crise }]);
    } catch {
      setErreur('Impossible de joindre le serveur.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6">
      <header className="mb-4">
        <p className="text-sm font-semibold tracking-widest text-ink-soft uppercase">Psy IA — aperçu privé</p>
        <p className="mt-1 text-xs text-ink-soft">
          Squelette de démonstration, non validé cliniquement — à regarder, pas à utiliser pour un
          vrai besoin. Danger immédiat : 15 ou 112. Prévention du suicide, 24h/24 : 3114.
        </p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-ink-soft">
            Écris un message pour commencer — c&apos;est un aperçu privé, personne d&apos;autre ne le voit.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              'rounded-xl px-4 py-3 text-lg leading-relaxed ' +
              (m.role === 'user'
                ? 'ml-auto max-w-[85%] bg-ink text-paper'
                : m.crise
                  ? 'max-w-[95%] whitespace-pre-line border-2 border-ink bg-paper text-ink'
                  : 'max-w-[85%] border border-line bg-paper text-ink')
            }
          >
            {m.texte}
          </div>
        ))}
        {enCours && <p className="text-sm text-ink-soft">Psy IA écrit…</p>}
        {erreur && <p className="text-sm text-red-400">{erreur}</p>}
      </div>

      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          envoyer();
        }}
        className="mt-4 flex gap-2"
      >
        <textarea
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === 'Enter' && !evenement.shiftKey) {
              evenement.preventDefault();
              envoyer();
            }
          }}
          rows={1}
          placeholder="Écris ce que tu ressens…"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-paper px-4 py-3 text-lg text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <button
          type="submit"
          disabled={enCours || !saisie.trim()}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-ink px-4 text-lg font-semibold text-paper disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </main>
  );
}
