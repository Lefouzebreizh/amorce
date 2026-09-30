'use client';

import { useEffect, useState } from 'react';

type Mode = 'chat' | 'image' | 'video';
type Message = { role: 'user' | 'model'; text: string };

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 80,
  right: 16,
  bottom: 16,
  width: 'min(440px, calc(100vw - 32px))',
  maxHeight: 'min(760px, calc(100dvh - 32px))',
  display: 'flex',
  flexDirection: 'column',
  color: '#eef3ff',
  background: 'linear-gradient(155deg, #151a28, #0c101a 72%)',
  border: '1px solid rgba(116, 137, 180, .3)',
  borderRadius: 20,
  boxShadow: '0 24px 80px rgba(0,0,0,.55)',
  overflow: 'hidden',
  fontFamily: 'var(--font-body, system-ui, sans-serif)',
};
const controlStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  color: '#eef3ff',
  background: '#0a0e17',
  border: '1px solid rgba(173, 190, 223, .22)',
  borderRadius: 11,
  font: 'inherit',
  fontSize: 14,
};
const actionStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 14px',
  border: 0,
  borderRadius: 11,
  color: '#071313',
  background: 'linear-gradient(100deg, #40e0d0, #8be8d2)',
  fontWeight: 750,
  cursor: 'pointer',
};

async function api<T>(path: string, access: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-mouvance-access': access,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'La demande a échoué.');
  return data;
}

export function MouvanceCreation() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [access, setAccess] = useState('');
  const [accessDraft, setAccessDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoTaskId, setVideoTaskId] = useState('');
  const [videoStatus, setVideoStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('mouvance-ai-access') ?? '';
      setAccess(saved);
      setAccessDraft(saved);
    } catch {
      // La création reste disponible même si le stockage de session est bloqué.
    }
  }, []);

  useEffect(() => {
    if (!access || !videoTaskId || videoUrl || videoStatus === 'Échec') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api<{ status: string; videoUrl: string | null; error: string | null }>(
          `/api/mouvance/videos/${encodeURIComponent(videoTaskId)}`, access, undefined, 'GET',
        );
        if (stopped) return;
        if (result.status === 'SUCCEEDED' && result.videoUrl) {
          setVideoUrl(result.videoUrl);
          setVideoStatus('Vidéo prête');
          return;
        }
        if (result.status === 'FAILED') {
          setVideoStatus('Échec');
          setError(result.error || 'Runway n’a pas terminé la génération.');
          return;
        }
        setVideoStatus(result.status === 'RUNNING' ? 'Création en cours…' : 'En attente…');
        timer = setTimeout(poll, 5000);
      } catch (cause) {
        if (stopped) return;
        setError(cause instanceof Error ? cause.message : 'Suivi vidéo interrompu.');
        setVideoStatus('Échec');
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [access, videoTaskId, videoUrl, videoStatus]);

  function saveAccess() {
    const value = accessDraft.trim();
    setAccess(value);
    setError('');
    try {
      if (value) window.sessionStorage.setItem('mouvance-ai-access', value);
      else window.sessionStorage.removeItem('mouvance-ai-access');
    } catch {
      // The code remains available for this open panel.
    }
  }

  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text || busy || !access) return;
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setChatDraft('');
    setBusy(true);
    setError('');
    try {
      const result = await api<{ text: string }>('/api/mouvance/chat', access, { messages: next });
      setMessages([...next, { role: 'model', text: result.text }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le chat est indisponible.');
    } finally {
      setBusy(false);
    }
  }

  async function createImage(event: React.FormEvent) {
    event.preventDefault();
    if (!access || busy) return;
    setBusy(true);
    setError('');
    setImageUrl('');
    try {
      const result = await api<{ dataUrl: string }>('/api/mouvance/images', access, { prompt: imagePrompt });
      setImageUrl(result.dataUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La création d’image a échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function createVideo(event: React.FormEvent) {
    event.preventDefault();
    if (!access || busy) return;
    const confirmed = window.confirm(
      'Runway facture cette génération selon ton compte et le modèle. Une vidéo de 5 secondes va être demandée. Continuer ?',
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    setVideoTaskId('');
    setVideoUrl('');
    setVideoStatus('Envoi de la demande…');
    try {
      const result = await api<{ taskId: string }>('/api/mouvance/videos', access, { prompt: videoPrompt });
      setVideoTaskId(result.taskId);
      setVideoStatus('En attente…');
    } catch (cause) {
      setVideoStatus('');
      setError(cause instanceof Error ? cause.message : 'La création vidéo a échoué.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir Mouvance Studio IA"
        style={{
          position: 'fixed', zIndex: 70, right: 18, bottom: 18, minHeight: 52,
          padding: '0 17px', borderRadius: 999, border: '1px solid rgba(64,224,208,.45)',
          color: '#f1fbff', background: 'linear-gradient(140deg, #1c2735, #12141f)',
          boxShadow: '0 10px 38px rgba(0,0,0,.4), 0 0 24px rgba(64,224,208,.12)',
          font: '700 14px var(--font-body, system-ui)', cursor: 'pointer',
        }}
      >
        ✦ Mouvance IA
      </button>
    );
  }

  return (
    <section style={panelStyle} aria-label="Espace de création IA Mouvance">
      <header style={{ padding: '15px 16px 12px', borderBottom: '1px solid rgba(173,190,223,.13)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#40e0d0', fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Mouvance Studio</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 17 }}>Atelier de création IA</strong>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer l’atelier" style={{ ...controlStyle, width: 44, padding: 0, cursor: 'pointer' }}>×</button>
        </div>
        <div role="tablist" aria-label="Outils IA" style={{ display: 'flex', gap: 6, marginTop: 13 }}>
          {([['chat', 'Chat'], ['image', 'Image'], ['video', 'Vidéo']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => { setMode(id); setError(''); }}
              style={{
                ...controlStyle, width: 'auto', flex: 1, minHeight: 40, padding: '7px 8px',
                borderColor: mode === id ? 'rgba(64,224,208,.65)' : 'rgba(173,190,223,.18)',
                color: mode === id ? '#8ff4e7' : '#c4cede',
                background: mode === id ? 'rgba(64,224,208,.09)' : 'rgba(255,255,255,.025)',
                cursor: 'pointer',
              }}
            >{label}</button>
          ))}
        </div>
      </header>

      {!access ? (
        <form onSubmit={(event) => { event.preventDefault(); saveAccess(); }} style={{ display: 'grid', gap: 10, padding: 16 }}>
          <p style={{ margin: 0, color: '#bdc8da', fontSize: 13, lineHeight: 1.55 }}>
            Entre le code d’accès configuré pour ce déploiement. Il reste dans cette session de navigateur.
          </p>
          <input
            type="password"
            value={accessDraft}
            onChange={(event) => setAccessDraft(event.target.value)}
            autoComplete="current-password"
            aria-label="Code d’accès Mouvance IA"
            placeholder="Code d’accès"
            style={controlStyle}
          />
          <button type="submit" style={actionStyle}>Ouvrir l’atelier</button>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, padding: 15, overflowY: 'auto' }}>
          {mode === 'chat' && (
            <>
              <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 110, maxHeight: 300, overflowY: 'auto' }}>
                {messages.length === 0 && <p style={{ color: '#aebbd0', fontSize: 13, lineHeight: 1.55 }}>Parle de ton idée de vidéo : je t’aide à trouver un angle, une scène ou une accroche.</p>}
                {messages.map((message, index) => (
                  <div key={index} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '9px 11px', borderRadius: 12, background: message.role === 'user' ? 'rgba(64,224,208,.13)' : 'rgba(255,255,255,.06)', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
                    {message.text}
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} style={{ display: 'grid', gap: 8 }}>
                <textarea value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} rows={3} maxLength={4000} placeholder="Décris ce que tu veux créer…" aria-label="Message au copilote" style={{ ...controlStyle, resize: 'vertical' }} />
                <button disabled={busy || !chatDraft.trim()} type="submit" style={{ ...actionStyle, opacity: busy || !chatDraft.trim() ? .6 : 1 }}>{busy ? 'Réflexion…' : 'Envoyer au copilote'}</button>
              </form>
            </>
          )}

          {mode === 'image' && (
            <form onSubmit={createImage} style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0, color: '#aebbd0', fontSize: 13, lineHeight: 1.5 }}>Décris l’image à créer. Elle s’ouvre ici, puis tu peux la télécharger pour l’importer dans ton montage.</p>
              <textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} rows={4} maxLength={1200} placeholder="Ex. Une scène cinématographique au bord de mer, lumière turquoise et violet…" aria-label="Description de l’image" style={{ ...controlStyle, resize: 'vertical' }} />
              <button disabled={busy || !imagePrompt.trim()} type="submit" style={{ ...actionStyle, opacity: busy || !imagePrompt.trim() ? .6 : 1 }}>{busy ? 'Création de l’image…' : 'Créer une image 16:9'}</button>
              {imageUrl && <div style={{ display: 'grid', gap: 8 }}>
                {/* Image URL is returned by the authenticated server call. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Image générée par Mouvance" style={{ display: 'block', width: '100%', borderRadius: 12, border: '1px solid rgba(173,190,223,.18)' }} />
                <a href={imageUrl} download="mouvance-image.png" style={{ ...actionStyle, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Télécharger l’image</a>
              </div>}
            </form>
          )}

          {mode === 'video' && (
            <form onSubmit={createVideo} style={{ display: 'grid', gap: 10 }}>
              <p style={{ margin: 0, color: '#aebbd0', fontSize: 13, lineHeight: 1.5 }}>Runway crée une vidéo de 5 secondes à partir de ta description. La génération consomme les crédits de ton compte Runway et demande une confirmation avant l’envoi.</p>
              <textarea value={videoPrompt} onChange={(event) => setVideoPrompt(event.target.value)} rows={4} maxLength={1000} placeholder="Décris le sujet, le mouvement de caméra, la lumière et l’ambiance…" aria-label="Description de la vidéo" style={{ ...controlStyle, resize: 'vertical' }} />
              <button disabled={busy || !videoPrompt.trim()} type="submit" style={{ ...actionStyle, opacity: busy || !videoPrompt.trim() ? .6 : 1 }}>{busy ? 'Envoi…' : 'Préparer une vidéo 5 s'}</button>
              {videoStatus && <p aria-live="polite" style={{ margin: 0, color: '#8fe7dc', fontSize: 13 }}>{videoStatus}</p>}
              {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" style={{ ...actionStyle, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Ouvrir la vidéo et la télécharger</a>}
              {videoUrl && <p style={{ margin: 0, color: '#aebbd0', fontSize: 12, lineHeight: 1.45 }}>Le lien Runway est temporaire. Télécharge la vidéo puis importe-la dans le montage.</p>}
            </form>
          )}

          {error && <p role="alert" style={{ margin: 0, color: '#ffb4a9', fontSize: 13, lineHeight: 1.45 }}>{error}</p>}
          <button
            type="button"
            onClick={() => { setAccess(''); setAccessDraft(''); setMessages([]); setImageUrl(''); setVideoUrl(''); setVideoTaskId(''); try { window.sessionStorage.removeItem('mouvance-ai-access'); } catch {} }}
            style={{ ...controlStyle, minHeight: 38, color: '#adb8cb', fontSize: 12, cursor: 'pointer' }}
          >Effacer le code de cette session</button>
        </div>
      )}
    </section>
  );
}
