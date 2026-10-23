'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { PlaybackEngine } from '@/hooks/usePlayback';
import { useStudio } from '@/lib/store';
import type { MixSettings, SongDraft } from '@/lib/types';
import { Preview } from './Preview';
import { Timeline } from './Timeline';
import { UndoControls } from './ui';

type Message = { role: 'user' | 'assistant'; content: string };
type AssistantReply = {
  reply: string;
  draftProposal: SongDraft | null;
  runAutoEdit: boolean;
  autoEditOptions: { shorten: boolean; visualEffects: boolean; soundEffects: boolean; captionGuide: boolean };
  mixUpdate: MixSettings | null;
  exportPreset: 'none' | 'full' | 'light' | 'share';
  openStep: 'none' | 'import' | 'montage' | 'composer' | 'texte' | 'son' | 'cinema' | 'analyse' | 'export';
};

const DEMARRAGE: Message = {
  role: 'assistant',
  content: 'Salut, on crée quoi ensemble ? Tu peux me donner une idée, quelques mots ou directement ton texte. Je t’aide à le construire, puis je m’occupe des réglages du clip.',
};

const EXEMPLES = [
  'Aide-moi à écrire un slam sur un nouveau départ',
  'Je veux un clip reggae lumineux à partir de mon texte',
  'J’ai déjà mes rushes, fais-moi un premier montage',
];

export function StudioAssistant({
  engine,
  onAdvanced,
}: {
  engine: PlaybackEngine;
  onAdvanced: (step?: 'import' | 'montage' | 'composer' | 'texte' | 'son' | 'cinema' | 'analyse' | 'export') => void;
}) {
  const project = useStudio((state) => state.project);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const canUndo = useStudio((state) => state.past.length > 0);
  const canRedo = useStudio((state) => state.future.length > 0);
  const montageExpress = useStudio((state) => state.montageExpress);
  const updateSongDraft = useStudio((state) => state.updateSongDraft);
  const setMix = useStudio((state) => state.setMix);
  const setExportPreset = useStudio((state) => state.setExportPreset);
  const [messages, setMessages] = useState<Message[]>([DEMARRAGE]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDraft, setPendingDraft] = useState<SongDraft | null>(null);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [messages, busy]);

  const send = async (event?: FormEvent, suggestion?: string) => {
    event?.preventDefault();
    const content = (suggestion ?? input).trim();
    if (!content || busy || !geminiConsent) return;

    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setError('');
    setStatus('Amorce réfléchit…');
    setBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          project: {
            name: project.name,
            assets: project.assets.map(({ kind, duration }) => ({ kind, duration })),
            assetCount: project.assets.length,
            clipCount: project.clips.length,
            hasMusic: Boolean(project.music),
            captionCount: project.captions.length,
            song: project.song ?? { title: '', lyrics: '', style: '', mood: '', voice: '' },
          },
        }),
      });
      const result = await response.json() as AssistantReply | { error?: string };
      if (!response.ok) throw new Error('error' in result ? result.error : 'Amorce ne peut pas répondre pour le moment.');
      const answer = result as AssistantReply;
      const applied: string[] = [];

      if (answer.draftProposal) {
        const hasExistingText = Boolean(project.song?.lyrics.trim());
        if (hasExistingText) {
          setPendingDraft(answer.draftProposal);
        } else {
          updateSongDraft(answer.draftProposal);
          applied.push('paroles et intention musicale');
        }
      }
      if (answer.runAutoEdit && project.assets.length > 0) {
        montageExpress(answer.autoEditOptions);
        applied.push('premier montage');
      }
      if (answer.mixUpdate && project.music) {
        const mix = Object.fromEntries(
          Object.entries(answer.mixUpdate).map(([key, value]) => [key, Math.min(1, Math.max(0, Number(value) || 0))]),
        ) as Partial<MixSettings>;
        setMix(mix);
        applied.push('mixage');
      }
      if (answer.exportPreset !== 'none') {
        setExportPreset(answer.exportPreset);
        applied.push('définition d’export');
      }
      // L'assistant pilote les outils et leurs réglages en arrière-plan. Le
      // passage à l'atelier détaillé reste un choix explicite de l'utilisateur :
      // changer toute la coque au milieu d'une conversation la ferait perdre.

      setStatus(applied.length ? `Mis à jour : ${applied.join(' · ')}. Tu peux annuler avec la flèche ↶.` : '');
      setMessages([...next, { role: 'assistant', content: answer.reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Une erreur empêche Amorce de répondre.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="studio-shell studio-assistant-shell flex h-[100dvh] flex-col overflow-hidden text-mist">
      <header className="studio-header flex shrink-0 items-center justify-between gap-4 border-b border-edge px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/" className="studio-wordmark flex min-h-11 items-center font-display text-xl tracking-tight">amorce</Link>
          <span className="studio-live-dot" aria-label="Assistant de création" />
          <span className="hidden text-sm text-muted sm:inline">Ton studio créatif</span>
        </div>
        <div className="flex items-center gap-3">
          <UndoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
          <button type="button" onClick={() => onAdvanced()} className="min-h-11 rounded-xl border border-white/10 px-3 text-sm font-semibold text-mist transition hover:border-accent/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-accent">
            Studio complet
          </button>
        </div>
      </header>

      <main className="studio-assistant-main grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(330px,390px)] gap-3 p-3">
        <section className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Aperçu du clip">
          <div className="studio-preview-plate flex min-h-0 flex-1 items-center justify-center rounded-[28px] p-4">
            <Preview engine={engine} />
          </div>
          <div className="studio-timeline-plate shrink-0 rounded-[22px]">
            <Timeline engine={engine} />
          </div>
          <div className="flex items-center justify-between gap-3 px-2 text-xs text-muted">
            <span className="truncate">{project.name || 'Nouveau clip'} · {project.assets.length} média{project.assets.length === 1 ? '' : 's'} · {project.clips.length} plan{project.clips.length === 1 ? '' : 's'}</span>
            <button type="button" onClick={() => onAdvanced('import')} className="shrink-0 rounded-lg px-3 py-2 font-semibold text-accent transition hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent">Ajouter des médias</button>
          </div>
        </section>

        <aside className="studio-assistant-panel flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(160deg,rgba(21,28,42,.94),rgba(12,15,25,.92))] shadow-[0_24px_60px_rgba(0,0,0,.28)]">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Atelier de création</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">On crée ensemble</h1>
          </div>

          <div className="studio-assistant-messages flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-accent/15 text-mist' : 'rounded-bl-md border border-white/8 bg-white/[.045] text-mist/90'}`}>
                  {message.content}
                </p>
              </div>
            ))}
            {pendingDraft && (
              <section className="rounded-2xl border border-accent/25 bg-accent/[.06] p-4" aria-label="Proposition de paroles">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">Nouveau brouillon proposé</p>
                <p className="mt-2 text-sm font-semibold text-mist">{pendingDraft.title || 'Paroles retravaillées'}</p>
                <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-mist/80">{pendingDraft.lyrics}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { updateSongDraft(pendingDraft); setPendingDraft(null); setStatus('Brouillon ajouté au projet. Tu peux annuler avec la flèche ↶.'); }} className="min-h-11 flex-1 rounded-xl bg-accent px-3 text-sm font-bold text-[#061313]">Utiliser ce brouillon</button>
                  <button type="button" onClick={() => setPendingDraft(null)} className="min-h-11 rounded-xl border border-white/10 px-3 text-sm text-muted">Garder le mien</button>
                </div>
              </section>
            )}
            {busy && <p className="text-sm text-muted" role="status">Amorce réfléchit…</p>}
            <div ref={endRef} />
          </div>

          {messages.length === 1 && geminiConsent && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {EXEMPLES.map((example) => <button key={example} type="button" disabled={busy} onClick={() => void send(undefined, example)} className="rounded-full border border-white/10 px-3 py-2 text-left text-xs text-muted transition hover:border-accent/40 hover:text-mist disabled:opacity-50">{example}</button>)}
            </div>
          )}

          <form onSubmit={(event) => void send(event)} className="border-t border-white/10 p-3">
            {!geminiConsent && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
                <p className="text-xs leading-relaxed text-muted">
                  Pour répondre, Gemini reçoit tes messages, tes paroles et un résumé du projet. Tes vidéos et sons restent sur ton appareil. En offre gratuite, Google peut utiliser les échanges pour améliorer ses produits ; en offre payante, Google indique ne pas les utiliser ainsi. Des journaux limités peuvent servir à la sécurité. L’API peut être facturée selon la clé configurée. Amorce désactive l’historique Gemini.
                </p>
                <a href="https://ai.google.dev/gemini-api/docs/logs-policy" target="_blank" rel="noreferrer" className="mt-2 inline-block min-h-11 py-3 text-xs font-semibold text-accent underline underline-offset-4">Voir le traitement des données par Google</a>
                <button type="button" onClick={() => setGeminiConsent(true)} className="mt-2 min-h-11 w-full rounded-xl border border-accent/35 bg-accent/10 px-3 text-sm font-semibold text-accent transition hover:bg-accent/15">Compris, continuer avec Gemini</button>
              </div>
            )}
            <label htmlFor="amorce-message" className="sr-only">Décris ton idée ou demande une modification</label>
            <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-black/20 p-2 transition focus-within:border-accent/55 focus-within:shadow-[0_0_0_3px_rgba(64,224,208,.1)]">
              <textarea
                id="amorce-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }}
                maxLength={6000}
                rows={2}
                placeholder="Écris ton idée, ton texte ou ta demande…"
                disabled={!geminiConsent}
                className="max-h-36 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-relaxed text-mist outline-none placeholder:text-muted/80"
              />
              <button type="submit" disabled={!input.trim() || busy || !geminiConsent} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-[#061313] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40">↑</button>
            </div>
            {error && <p role="alert" className="mt-2 px-1 text-sm text-rose-300">{error}</p>}
            {status && <p role="status" className="mt-2 px-1 text-xs text-accent">{status}</p>}
            {geminiConsent && <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted">Seuls le texte et le résumé du projet partent à Google. Aucune vidéo ni piste audio n’est envoyée.</p>}
          </form>
        </aside>
      </main>
    </div>
  );
}
