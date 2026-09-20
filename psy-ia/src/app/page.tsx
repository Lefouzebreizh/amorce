'use client';

import React, { useState, useEffect } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  time: string;
}

export default function RespirePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [breathPhase, setBreathPhase] = useState('Inspirez lentement...');

  useEffect(() => {
    const phases = [
      'Inspirez lentement...',
      'Retenez doucement...',
      'Expirez profondément...'
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setBreathPhase(phases[idx] ?? 'Respirez calmement...');
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const starters = [
    {
      badge: '3 min • Apaisement corporel',
      title: 'Crise de panique ou angoisse',
      desc: 'Ralentir la pulsation, relâcher les tensions physiques et retrouver un ancrage stable.',
      glow: 'hover:border-teal-400/60 hover:shadow-[0_0_35px_rgba(45,212,191,0.22)]',
      icon: (
        <svg className="w-6 h-6 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )
    },
    {
      badge: '5 min • Dépôt de charge',
      title: 'Tension, colère ou surcharge',
      desc: 'Déposer le trop-plein émotionnel, désamorcer l’agitation et retrouver de la clarté.',
      glow: 'hover:border-cyan-400/60 hover:shadow-[0_0_35px_rgba(6,182,212,0.22)]',
      icon: (
        <svg className="w-6 h-6 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
    },
    {
      badge: 'Transition calme • Soir',
      title: 'Pensées en boucle du soir',
      desc: 'Mettre le mental en pause, desserrer l’attention et glisser paisiblement vers le repos.',
      glow: 'hover:border-indigo-400/60 hover:shadow-[0_0_35px_rgba(129,140,248,0.22)]',
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
        text: "Je suis là avec vous. Prenez une inspiration profonde face à cet horizon, puis soufflez lentement. Qu'est-ce qui prend le plus de place dans votre esprit à cet instant précis ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 600);
  };

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden bg-[#050811]">
      {/* Fond breton immersif */}
      <div 
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat opacity-45 scale-105 transition-transform duration-1000"
        style={{ backgroundImage: "url('/fond-bretagne.jpg')" }}
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#050811]/75 via-[#070d1a]/55 to-[#050811]/85 backdrop-blur-[1px]" />

      {/* Header aéré */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.25)]">
              <svg className="w-5 h-5 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-lg text-white tracking-wide">Respire</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  Écoute Bienveillante
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs bg-slate-900/60 border border-white/10 px-4 py-1.5 rounded-full text-slate-300 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">Espace confidentiel • Zéro trace conservée</span>
          </div>
        </div>
      </header>

      {/* Main content élargi */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex flex-col justify-center">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center text-center my-auto">
            {/* Orbe 3D circulaire agrandi */}
            <div className="relative mb-6 flex flex-col justify-center items-center">
              <div className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-teal-500/20 blur-3xl animate-pulse pointer-events-none" />
              <div className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-teal-400/25 animate-ping opacity-25 pointer-events-none" style={{ animationDuration: '6s' }} />

              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-white/20 shadow-[0_0_60px_rgba(20,184,166,0.35)] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
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

              {/* Guide de respiration */}
              <div className="mt-5 px-4 py-1.5 rounded-full bg-slate-950/60 border border-white/10 backdrop-blur-md text-xs font-medium text-teal-200 tracking-wider shadow-md">
                {breathPhase}
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3 drop-shadow-xl">
              Déposez ce qui pèse. Respirez.
            </h1>
            <p className="text-base text-slate-300 max-w-xl mb-12 leading-relaxed drop-shadow">
              Un refuge calme sans jugement pour poser vos pensées et relâcher la pression à votre rythme.
            </p>

            {/* Cartes d'intention espacées */}
            <div className="grid sm:grid-cols-3 gap-6 w-full text-left mb-10">
              {starters.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(s.title)}
                  className={`group relative p-6 rounded-3xl bg-slate-950/50 hover:bg-slate-900/80 border border-white/10 ${s.glow} transition-all duration-300 flex flex-col justify-between backdrop-blur-xl hover:-translate-y-1.5 shadow-2xl`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {s.icon}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        {s.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-100 group-hover:text-white transition">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-2 text-xs font-medium text-teal-300 group-hover:translate-x-1 transition-transform">
                    <span>Commencer ce moment</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-300 flex items-center gap-2 backdrop-blur-md px-5 py-2 rounded-full bg-slate-950/60 border border-white/10 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span>Soutien d'écoute non médical • En cas d'urgence vitale ou détresse majeure : composez le 3114</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 max-w-4xl w-full mx-auto flex flex-col gap-4 overflow-y-auto py-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-3xl px-6 py-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-br-sm'
                      : 'bg-slate-950/80 border border-white/15 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1.5 px-2 drop-shadow">{m.time}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Barre de saisie */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950/50 backdrop-blur-2xl px-6 py-5">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3 bg-slate-900/70 border border-white/15 focus-within:border-teal-400/80 focus-within:shadow-[0_0_30px_rgba(45,212,191,0.25)] rounded-2xl p-2 transition backdrop-blur-xl"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que ressentez-vous en ce moment ? Écrivez librement..."
              className="flex-1 bg-transparent px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:opacity-30 text-white px-6 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition shadow-lg"
            >
              Envoyer
            </button>
          </form>
          <p className="text-[11px] text-center text-slate-400">
            Respire • Vos échanges restent anonymes et ne sont pas archivés.
          </p>
        </div>
      </footer>
    </div>
  );
}
