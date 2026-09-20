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
      title: 'Crise de panique ou angoisse',
      desc: 'Ralentir le souffle et poser son corps.',
      icon: (
        <svg className="w-6 h-6 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )
    },
    {
      title: 'Tension, colère ou surcharge',
      desc: 'Déposer le trop-plein et retrouver son calme.',
      icon: (
        <svg className="w-6 h-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
    },
    {
      title: 'Pensées en boucle du soir',
      desc: 'Vider l’esprit pour trouver le sommeil.',
      icon: (
        <svg className="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )
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
        text: "Je suis là avec vous. Prenez une grande inspiration, puis soufflez lentement. Qu'est-ce qui pèse le plus lourd à cet instant ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 600);
  };

  return (
    <div className="relative min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden">
      {/* Fond texturé et nappes lumineuses */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
          backgroundSize: '36px 36px'
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-teal-500/20 via-cyan-500/10 to-transparent rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-[-10%] w-[650px] h-[450px] bg-indigo-500/10 rounded-full blur-[160px]" />

      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg text-white tracking-tight">Respire • Écoute IA</span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-full text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Échanges chiffrés</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-4xl w-full mx-auto px-6 py-6 flex flex-col justify-center">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center my-auto">
            {/* Conteneur de l'animation vidéo 3D */}
            <div className="relative mb-6 flex justify-center items-center">
              <div className="absolute w-56 h-56 rounded-full bg-teal-500/20 blur-3xl animate-pulse" />
              <video 
                autoPlay 
                loop 
                muted 
                playsInline 
                className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-3xl border border-slate-800/80 bg-slate-950/60 shadow-[0_0_50px_rgba(20,184,166,0.25)] object-cover"
              >
                <source src="/respire.mp4" type="video/mp4" />
              </video>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              Déposez ce qui pèse. Respirez.
            </h1>
            <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
              Un espace d'écoute empathique et immédiat, sans jugement ni conservation de données.
            </p>

            <div className="grid sm:grid-cols-3 gap-3.5 w-full text-left mb-6">
              {starters.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(s.title)}
                  className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all duration-300 flex flex-col justify-between backdrop-blur-md hover:-translate-y-1 shadow-lg"
                >
                  <div className="mb-3">{s.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-300 transition">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <span>Soutien bienveillant non médical • Urgence : composez le 3114</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 max-w-3xl w-full mx-auto flex flex-col gap-4 overflow-y-auto py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-br-none'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-bl-none backdrop-blur-md'
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

      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 focus-within:border-teal-500/70 rounded-2xl p-1.5 transition"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Saisir un message..."
              className="flex-1 bg-transparent px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 disabled:opacity-30 text-white px-4 py-2 rounded-xl text-xs font-medium transition"
            >
              Envoyer
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
