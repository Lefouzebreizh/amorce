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
  const [messages, setMessages] = useState<Message[]>([]);

  const starters = [
    {
      tag: "Apaisement immédiat",
      title: "Coup de stress ou anxiété",
      desc: "Ralentir le rythme, libérer le diaphragme et reprendre pied.",
      gradient: "from-teal-500/20 to-emerald-500/10",
      accent: "text-teal-400"
    },
    {
      tag: "Prise de recul",
      title: "Conflit ou charge mentale",
      desc: "Déposer une tension relationnelle ou professionnelle trop lourde.",
      gradient: "from-cyan-500/20 to-blue-500/10",
      accent: "text-cyan-400"
    },
    {
      tag: "Nuit sereine",
      title: "Pensées parasites du soir",
      desc: "Vider l’esprit de ce qui tourne en boucle pour trouver le sommeil.",
      gradient: "from-indigo-500/20 to-purple-500/10",
      accent: "text-indigo-400"
    }
  ];

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

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
        text: "Je vous écoute avec toute mon attention. Prenez le temps de respirer calmement. Qu'est-ce qui vous pèse le plus dans cette situation en ce moment ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 600);
  };

  return (
    <div className="relative min-h-screen bg-[#060913] text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden">
      {/* Fond texturé & Halos d'ambiance 3D */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="pointer-events-none absolute top-[-10%] left-1/2 -translate-x-1/2 w-[750px] h-[550px] bg-gradient-to-b from-teal-500/25 via-cyan-600/15 to-transparent rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-10%] w-[600px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px]" />

      {/* Header en verre dépoli */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-900/40 border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.25)]">
              <svg className="w-5 h-5 text-teal-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-white tracking-tight">Respire</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  Espace confidentiel
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Écoute active & décompression émotionnelle</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300 shadow-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Chiffrement éphémère • Zéro trace</span>
          </div>
        </div>
      </header>

      {/* Zone d'interaction centrale */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center my-auto">
            {/* Orbe 3D avec respiration dynamique */}
            <div className="relative mb-6 flex items-center justify-center">
              <div className="absolute w-36 h-36 rounded-full bg-teal-500/20 blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-teal-600 via-cyan-400 to-indigo-300 p-0.5 shadow-[0_0_50px_rgba(20,184,166,0.35)] animate-[bounce_6s_infinite_ease-in-out]">
                <div className="w-full h-full rounded-full bg-[#080d1a]/85 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-teal-400 to-cyan-200 opacity-80 blur-xs" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tight mb-3">
              Déposez ce qui pèse. Respirez.
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
              Un espace d'écoute empathique sans jugement, disponible instantanément pour clarifier vos pensées et retrouver votre calme.
            </p>

            {/* Cartes d'amorce stylisées Glassmorphism */}
            <div className="grid sm:grid-cols-3 gap-3.5 w-full text-left mb-8">
              {starters.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(s.title)}
                  className={`group relative p-4 rounded-2xl bg-gradient-to-b ${s.gradient} bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 hover:border-teal-500/50 transition-all duration-300 flex flex-col justify-between backdrop-blur-md hover:-translate-y-1 shadow-lg hover:shadow-teal-500/10`}
                >
                  <div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${s.accent} block mb-1.5`}>
                      {s.tag}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-300 group-hover:text-teal-300 transition">
                    <span>Commencer</span>
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-1 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Soutien non médical — Urgences vitales : composez le 3114</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-br-none'
                      : 'bg-slate-900/90 border border-slate-800/80 text-slate-200 rounded-bl-none backdrop-blur-sm'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Barre de saisie flottante */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 focus-within:border-teal-500/70 focus-within:shadow-[0_0_20px_rgba(20,184,166,0.15)] rounded-2xl p-1.5 transition"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que ressentez-vous en ce moment ? Écrivez sans retenue..."
              className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:opacity-30 disabled:hover:from-teal-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <span>Envoyer</span>
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <p className="text-[10px] text-center text-slate-500">
            Respire IA • Échanges confidentiels et temporaires.
          </p>
        </div>
      </footer>
    </div>
  );
}
