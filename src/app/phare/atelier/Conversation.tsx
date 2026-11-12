'use client';
import { useEffect, useRef, useState } from 'react';
import { assistantContext, validateResult } from '@/lib/phare-assistant';
import type { AssistantResult, ChatMessage } from '@/lib/phare-assistant';
import { CAPABILITIES, routeLocalCommand } from '@/lib/phare-capabilities';
import type { Workspace } from '@/lib/phare';

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; abort: () => void; stop: () => void; onresult: ((e: { results: { length: number; [n: number]: { isFinal: boolean; [n: number]: { transcript: string } } } }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export default function Conversation({ workspace, selected, blocked, save, local, openProduction }: { workspace: Workspace; selected: string; blocked: boolean; save: (message: string, answer: AssistantResult) => boolean; local: (message: string, result: NonNullable<ReturnType<typeof routeLocalCommand>>) => boolean; openProduction: () => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voice, setVoice] = useState(false);
  const [interim, setInterim] = useState('');
  const [support, setSupport] = useState(false);
  const [token, setToken] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const project = workspace.projects.find(p => p.id === selected)!;
  const messages = workspace.conversation || [];
  useEffect(() => {
    const w = window as SpeechWindow;
    // Capability detection is intentionally client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      const hash = new URLSearchParams(location.hash.slice(1));
      const key = hash.get('acces');
      if (key) { sessionStorage.setItem('phare-access', key); history.replaceState(null, '', location.pathname + location.search); }
      setUnlocked(!!sessionStorage.getItem('phare-access'));
    } catch { setError('L’accès personnel ne peut pas être mémorisé dans cet onglet.'); }
    fetch('/api/phare/conversation').then(r => r.json()).then(d => setReady(d.ready === true)).catch(() => setReady(false));
    return () => { recognition.current?.abort(); controller.current?.abort(); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [messages.length]);
  function dictate() {
    if (voice) { recognition.current?.stop(); return; }
    const Constructor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) return;
    const r = new Constructor(); recognition.current = r;
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = true;
    r.onresult = event => {
      let final = '', pending = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript + ' '; else pending += result[0].transcript;
      }
      // The browser reports the full current recognition session, so replace its suffix.
      setDraft((base + (base ? ' ' : '') + final).slice(0, 10000)); setInterim(pending);
    };
    const base = draft;
    r.onerror = event => { setError(event.error === 'not-allowed' ? 'Micro refusé. Autorise-le dans ton navigateur, ou écris ta demande.' : 'Dictée interrompue. Tu peux reprendre ou écrire.'); setVoice(false); setInterim(''); };
    r.onend = () => { setVoice(false); setInterim(''); };
    try { r.start(); setVoice(true); setError(''); } catch { setError('Impossible de démarrer le micro. Réessaie.'); }
  }
  async function send(search = false) {
    const message = draft.trim(); if (!message || busy || blocked) return;
    recognition.current?.stop();
    if (!search) {
      try {
        const result = routeLocalCommand(workspace, selected, message);
        if (result) { if (local(message, result)) { setDraft(''); setError(''); } return; }
      } catch (error) { setError(error instanceof Error ? error.message : 'Commande non enregistrée.'); return; }
    }
    if (!ready) { setError('La création IA attend son activation. Tu peux déjà écrire « note : … », « reprends Le Phare », « cherche : … » ou « prépare mon clip ».'); return; }
    if (!unlocked) { setError('Ouvre ta connexion personnelle avant de lancer un échange IA.'); return; }
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      const response = await fetch('/api/phare/conversation', { method: 'POST', signal: controller.current.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('phare-access') || ''}` }, body: JSON.stringify({ message, search, context: assistantContext(workspace, selected, message), history: messages.slice(-12).map(m => ({ role: m.role, text: m.text.slice(0, 6000) })) }) });
      const data = await response.json(); if (!response.ok) { if (response.status === 401) setUnlocked(false); throw new Error(data.error || 'Échange indisponible.'); }
      const answer = validateResult(data);
      if (Array.isArray(data.sources)) answer.sources = data.sources;
      if (save(message, answer)) setDraft(''); else throw new Error('Réponse reçue mais non enregistrée. Exporte ta mémoire avant de recharger.');
    } catch (e) { setError(e instanceof Error && e.name === 'AbortError' ? 'Envoi arrêté. Ton texte est conservé. Une requête déjà reçue par le fournisseur peut avoir été traitée.' : e instanceof Error ? e.message : 'Connexion indisponible.'); }
    finally { setBusy(false); }
  }
  function read(message: ChatMessage) {
    if (!window.speechSynthesis) { setError('Lecture vocale indisponible dans ce navigateur.'); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text); utterance.lang = 'fr-FR'; window.speechSynthesis.speak(utterance);
  }
  return <section className="phare-conversation" aria-label="Conversation avec Le Phare">
    <div className="conversation-heading"><div><p className="atelier-kicker">Un seul fil pour créer</p><h2>On fait quoi, ensemble ?</h2></div><span>Projet · {project.title}</span></div>
    <div className="conversation-starters"><button disabled={busy || voice || blocked} onClick={() => setDraft(`Reprends ${project.title}`)}>Reprendre mon morceau</button><button disabled={busy || voice || blocked} onClick={() => setDraft(ready ? 'Aide-moi à écrire les paroles. Fais une première proposition à partir de mon projet.' : 'note : ')}>{ready ? 'Écrire avec moi' : 'Garder une idée'}</button><button disabled={busy || voice || blocked} onClick={() => { openProduction(); setDraft('prépare mon clip'); }}>Préparer mon clip</button></div>
    <div className="conversation-messages" role="log" aria-label="Notre échange" aria-live="polite" aria-relevant="additions text">
      {!messages.length && <div className="conversation-welcome"><p>Dis-moi ce que tu veux créer. Tu peux écrire, ou dicter puis relire avant d’envoyer.</p><p>Essaie « note : mon idée », « reprends Le Phare », « cherche : un mot » ou « prépare mon clip ».</p></div>}
      {messages.map(m => <article key={m.id} className={`conversation-message conversation-${m.role}`}><header><strong>{m.role === 'user' ? 'Toi' : 'Le Phare'}</strong><small>{workspace.projects.find(p => p.id === m.projectId)?.title || 'Projet archivé'}</small></header><p>{m.text}</p>{m.sources?.length ? <ul>{m.sources.map(s => <li key={s.uri}><a href={s.uri} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul> : null}{m.role === 'assistant' && <button onClick={() => read(m)}>Écouter cette réponse</button>}</article>)}<div ref={end} />
    </div>
    {ready === false && <p className="atelier-warning conversation-status" role="status">Commandes internes actives. Création IA en attente du chiffrage ; aucun appel payant.</p>}
    {!unlocked && ready && <form className="conversation-unlock" onSubmit={e => { e.preventDefault(); try { sessionStorage.setItem('phare-access', token); setUnlocked(true); setToken(''); } catch { setError('Stockage de session indisponible.'); } }}><label htmlFor="phare-access">Code personnel de l’atelier</label><input id="phare-access" type="password" value={token} onChange={e => setToken(e.target.value)} required autoComplete="off" /><button>Ouvrir ma connexion</button></form>}
    <details className="conversation-capabilities"><summary>Ce que je peux faire ici</summary>{CAPABILITIES.map(c => <p key={c.id}><strong>{c.name} · {c.state}</strong><br/>{c.proof}<br/><small>{c.cost}. {c.excludes}</small></p>)}</details>
    <form className="conversation-compose" onSubmit={e => { e.preventDefault(); void send(); }}>
      <label htmlFor="phare-message">Parle-moi de ton idée</label><textarea id="phare-message" value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={10000} disabled={busy || voice} placeholder="On reprend Le Phare. Aide-moi à…" onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }} />
      {interim && <p className="conversation-interim">{interim}</p>}
      <div className="conversation-controls"><button type="button" aria-pressed={voice} disabled={!support || busy || blocked} onClick={dictate}>{voice ? 'Arrêter la dictée' : '● Dicter'}</button><button className="atelier-primary" disabled={busy || voice || blocked || !draft.trim()}>{busy ? 'Le Phare prépare sa réponse…' : 'Envoyer au Phare'}</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>Arrêter l’envoi</button>}</div>
      <details><summary>Recherche web et voix</summary><button type="button" disabled={busy || voice || blocked || !draft.trim() || !ready || !unlocked} onClick={() => void send(true)}>Chercher cette demande sur le web</button><button type="button" onClick={() => window.speechSynthesis?.cancel()}>Arrêter la lecture</button><p>La recherche renvoie ses sources et ne change pas ton projet. {support ? 'La dictée peut utiliser le service vocal de ton navigateur.' : 'Dictée indisponible ici : essaie Chrome ou la dictée du clavier de ton téléphone.'}</p></details>
      <small>Tu relis la dictée avant l’envoi. Les commandes internes ne contactent aucun fournisseur. Pour un échange IA, Gemini reçoit ce message, les 12 derniers messages, tes préférences et des extraits utiles de tes projets. Aucune image ni piste audio n’est envoyée par ce chat. Les 100 derniers messages sont conservés : exporte régulièrement.</small>
      {error && <p role="alert" className="conversation-error">{error}</p>}
    </form>
  </section>;
}
