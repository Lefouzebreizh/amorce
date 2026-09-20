'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  time: string;
}

const PHASES = [
  'Inspirez lentement...',
  'Retenez doucement...',
  'Expirez profondément...'
] as const;

export default function RespirePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ia',
      text: "Je suis là avec vous. Prenez une respiration face à l'océan. Qu'aimeriez-vous déposer aujourd'hui ?",
      time: 'À l’instant'
    }
  ]);
  const [breathIndex, setBreathIndex] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setBreathIndex((prev) => (prev + 1) % PHASES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const starters = [
    {
      title: 'Crise d’angoisse',
      action: 'Je ressens une crise d’angoisse, aide-moi à calmer mon souffle.',
      icon: (
        <svg className="w-5 h-5 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )
    },
    {
      title: 'Tension & Surcharge',
      action: 'J’ai accumulé trop de charge mentale, j’ai besoin de déposer mes tensions.',
      icon: (
        <svg className="w-5 h-5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
    },
    {
      title: 'Pensées du soir',
      action: 'Mes pensées tournent en boucle, j’ai besoin d’apaiser mon esprit pour dormir.',
      icon: (
        <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )
    }
  ];

  const handleSend = (customText?: string) => {
    const text = (customText || input).trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput('');

    setTimeout(() => {
      const iaMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: "Prenez une inspiration profonde et soufflez lentement. Qu'est-ce qui pèse le plus en ce moment ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 600);
  };

  return (
    <div className="relative h-screen w-screen text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-hidden bg-[#050811]">
      {/* Fond paysage breton */}
      <div 
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat opacity-45 scale-105"
        style={{ backgroundImage: "url('/fond-bretagne.jpg')" }}
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#050811]/75 via-[#070d1a]/55 to-[#050811]/85 backdrop-blur-[0.5px]" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl px-6 py-2.5 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.25)]">
              <svg className="w-4 h-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <span className="font-semibold text-base text-white tracking-wide">Respire</span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
              Écoute Bienveillante
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] bg-slate-900/60 border border-white/10 px-3 py-1 rounded-full text-slate-300 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Chiffrement éphémère</span>
          </div>
        </div>
      </header>

      {/* Cœur de l'application */}
      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-4 py-2 flex flex-col items-center justify-between overflow-hidden">
        
        {/* Vidéo 3D mise en valeur */}
        <div className="flex flex-col items-center text-center shrink-0">
          <div className="relative my-2 flex flex-col justify-center items-center">
            <div className="absolute w-52 h-52 rounded-full bg-teal-500/20 blur-3xl animate-pulse pointer-events-none" />
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden border border-white/20 shadow-[0_0_40px_rgba(20,184,166,0.35)] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
              <video 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="w-full h-full object-cover scale-110"
              >
                <source src="/respire.mp4" type="video/mp4" />
              </video>
            </div>
            <span className="mt-2 px-3 py-0.5 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-md text-xs font-medium text-teal-200 tracking-wider shadow-sm">
              {PHASES[breathIndex]}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 drop-shadow-md">
            Déposez ce qui pèse. Respirez.
          </h1>
        </div>

        {/* Modules d'intention */}
        <div className="grid grid-cols-3 gap-3 w-full my-2 shrink-0">
          {starters.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(s.action)}
              className="group p-3 rounded-2xl bg-slate-950/65 hover:bg-slate-900/85 border border-white/10 hover:border-teal-400/50 transition flex items-center gap-3 backdrop-blur-md shadow-lg text-left"
            >
              <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform shrink-0">
                {s.icon}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-teal-200 block truncate">
                  {s.title}
                </span>
                <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                  Poser & apaiser
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Zone de chat calibrée */}
        <div className="w-full h-32 sm:h-36 bg-slate-950/50 border border-white/10 rounded-2xl backdrop-blur-md p-3 overflow-y-auto flex flex-col gap-2 shrink-0 shadow-inner">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs leading-relaxed shadow-md backdrop-blur-md ${
                  m.sender === 'user'
                    ? 'bg-teal-600/90 text-white rounded-br-none'
                    : 'bg-slate-900/90 border border-white/10 text-slate-100 rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 px-1 drop-shadow">{m.time}</span>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
      </main>

      {/* Footer / Champ de saisie */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/60 backdrop-blur-xl px-4 py-2.5 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-900/80 border border-white/15 focus-within:border-teal-400/80 rounded-xl p-1 transition backdrop-blur-md"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez ce que vous ressentez à cet instant..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 disabled:opacity-30 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition shadow-md"
            >
              Envoyer
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span>Respire • Échanges temporaires & sans trace</span>
            <span>Urgence médicale : composez le 3114</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
