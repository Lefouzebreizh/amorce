'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Folder, Globe, Send, X } from 'lucide-react';
import { demanderAuCoffre, type IndexCoffre, type TourConversation } from '@/lib/coffre';

type Message = TourConversation & {
  // Présents seulement sur un message de l'assistant — jamais reconstruits
  // pour un message de l'utilisateur, qui n'a rien de tout ça.
  documentsCites?: string[];
  ouvrirFormulaire?: boolean;
  ouvrirRangement?: boolean;
  rechercheWebEffectuee?: boolean;
};

export function AssistantCoffre({ index, questionInitiale, onFermer, onOuvrirDocument, onOuvrirFormulaire, onOuvrirRangement }: {
  index: IndexCoffre;
  // Posée par la recherche locale restée sans résultat, envoyée une seule
  // fois à l'ouverture — voir l'effet ci-dessous. Absente ou vide : le chat
  // s'ouvre à blanc, comme avant.
  questionInitiale?: string;
  onFermer: () => void;
  onOuvrirDocument: (nom: string) => void;
  onOuvrirFormulaire: () => void;
  onOuvrirRangement: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [enCours, setEnCours] = useState(false);
  const finDesMessages = useRef<HTMLDivElement>(null);
  const dejaEnvoyee = useRef(false);

  useEffect(() => {
    finDesMessages.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Retrouve le nom réel d'un document cité par son nom exact — jamais
  // deviné : si Claude a mal recopié un nom, on ne montre pas de lien plutôt
  // que d'en montrer un faux.
  function nomExistant(nom: string): boolean {
    return Object.values(index.objets).some((o) => o.nom === nom);
  }

  async function envoyerTexte(texte: string) {
    if (!texte || enCours) return;
    const historique = messages.map(({ role, texte: t }) => ({ role, texte: t }));
    setMessages((precedent) => [...precedent, { role: 'user', texte }]);
    setEnCours(true);
    try {
      const reponse = await demanderAuCoffre(texte, historique, index);
      setMessages((precedent) => [...precedent, {
        role: 'assistant',
        texte: reponse.reponse,
        documentsCites: reponse.documentsCites,
        ouvrirFormulaire: reponse.ouvrirFormulaire,
        ouvrirRangement: reponse.ouvrirRangement,
        rechercheWebEffectuee: reponse.rechercheWebEffectuee,
      }]);
    } finally {
      setEnCours(false);
    }
  }

  // Envoi automatique de la question posée dans la barre de recherche, une
  // seule fois — `dejaEnvoyee` évite un doublon si le composant se
  // remontait pour une autre raison sans que `questionInitiale` change.
  useEffect(() => {
    if (questionInitiale && !dejaEnvoyee.current) {
      dejaEnvoyee.current = true;
      envoyerTexte(questionInitiale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const texte = question.trim();
    if (!texte || enCours) return;
    setQuestion('');
    await envoyerTexte(texte);
  }

  function ouvrirDocumentEtFermer(nom: string) {
    onFermer();
    onOuvrirDocument(nom);
  }

  function ouvrirFormulaireEtFermer() {
    onFermer();
    onOuvrirFormulaire();
  }

  function ouvrirRangementEtFermer() {
    onFermer();
    onOuvrirRangement();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6" onClick={onFermer}>
      <div
        className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-paper-raised sm:h-[80vh] sm:max-w-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <h2 className="font-affiche text-xl">Demander au coffre</h2>
            <p className="text-sm text-ink-soft">Retrouve un papier, ou pose une question.</p>
          </div>
          <button onClick={onFermer} className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line/40" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-paper p-4 text-sm text-ink-soft">
              Essaie « trouve mes photos », « le papier de la mutuelle », « comment résilier une
              assurance habitation », ou « je veux remplir un formulaire ».
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <li key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-bleu text-paper' : 'border border-line bg-paper'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.texte}</p>
                  {m.rechercheWebEffectuee && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
                      <Globe size={12} /> Réponse appuyée sur une recherche web.
                    </p>
                  )}
                  {m.documentsCites && m.documentsCites.filter(nomExistant).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.documentsCites.filter(nomExistant).map((nom) => (
                        <button
                          key={nom}
                          type="button"
                          onClick={() => ouvrirDocumentEtFermer(nom)}
                          className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/25"
                        >
                          {nom}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.ouvrirFormulaire && (
                    <button
                      type="button"
                      onClick={ouvrirFormulaireEtFermer}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <FileText size={12} /> Remplir un formulaire
                    </button>
                  )}
                  {m.ouvrirRangement && (
                    <button
                      type="button"
                      onClick={ouvrirRangementEtFermer}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-bleu px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-bleu-strong"
                    >
                      <Folder size={12} /> Ranger en dossiers
                    </button>
                  )}
                </div>
              </li>
            ))}
            {enCours && (
              <li className="flex justify-start">
                <div className="rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm text-ink-soft">
                  Je regarde…
                </div>
              </li>
            )}
          </ul>
          <div ref={finDesMessages} />
        </div>

        <form onSubmit={envoyer} className="flex gap-2 border-t border-line p-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pose ta question…"
            disabled={enCours}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={enCours || !question.trim()}
            className="flex shrink-0 items-center justify-center rounded-lg bg-bleu px-4 py-2.5 text-paper transition hover:bg-bleu-strong disabled:opacity-60"
            aria-label="Envoyer"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
