'use client';

import React, { useState } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  time: string;
}

export default function RespirePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ia',
      text: "Bonjour et bienvenue dans votre espace Respire. Prenez le temps nécessaire. De quoi avez-vous besoin de vous décharger aujourd'hui ?",
      time: 'À l’instant'
    }
  ]);

  const starters = [
    { label: "Gérer un coup de stress ou d'angoisse", icon: "flame" },
    { label: "Prendre du recul après une tension", icon: "smile" },
    { label: "Poser et vider mes pensées pour dormir", icon: "moon" }
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');

    setTimeout(() => {
      const iaMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: "Je vous écoute avec bienveillance. Respirez calmement. Qu'est-ce qui vous pèse le plus dans cette situation en ce moment ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header & Marque */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19.5c-4-2-7-5.5-7-9.5a5.5 5.5 0 0 1 11 0c0 4-3 7.5-7 9.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 19.5c4-2 7-5.5 7-9.5a5.5 5.5 0 0 0-11 0" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg text-white">Respire</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Écoute Active
              </span>
            </div>
            <p className="text-xs text-slate-400">Espace d'apaisement et de décompression guidé par IA</p>
          </div>
        </div>

        {/* Badge Discrétion & Sécurité */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/40">
          <svg className="w-3.5 h-3.5 text-emerald-400 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Session privée & anonyme</span>
        </div>
      </header>

      {/* Bannière de Réassurance et Cadre Éthique */}
      <div className="bg-slate-900/30 border-b border-slate-800/50 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-teal-400 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Aucune conversation n'est archivée ni transmise.</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <svg className="w-3.5 h-3.5 text-amber-400 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Soutien non médical — En cas d’urgence vitale, contactez le 3114.</span>
          </div>
        </div>
      </div>

      {/* Zone de Messages */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col gap-4 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-teal-600 text-white rounded-br-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
              }`}
            >
              {m.text}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
          </div>
        ))}
      </main>

      {/* Amorces rapides & Zone de saisie */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Chips d'amorces */}
          <div className="flex flex-wrap gap-2">
            {starters.map((starter, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(starter.label)}
                className="flex items-center gap-1.5 text-xs bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-teal-500/40 px-3 py-1.5 rounded-full text-slate-300 hover:text-white transition"
              >
                <span className="text-teal-400 text-xs">●</span>
                <span>{starter.label}</span>
              </button>
            ))}
          </div>

          {/* Formulaire de saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Exprimez ce que vous ressentez, sans filtre..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white p-3 rounded-xl transition"
              title="Envoyer"
            >
              <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
