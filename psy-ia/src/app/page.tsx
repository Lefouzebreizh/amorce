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
      title: "Coup de stress ou anxiété",
      desc: "Ralentir le rythme cardiaque, retrouver son calme et décompresser.",
      tag: "Urgence calme"
    },
    {
      title: "Conflit ou charge mentale",
      desc: "Prendre du recul après une dispute, une tension pro ou perso.",
      tag: "Mise au clair"
    },
    {
      title: "Pensées parasites du soir",
      desc: "Déposer ce qui tourne en boucle dans la tête avant de dormir.",
      tag: "Apaisement nuit"
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
        text: "Je vous lis avec toute mon attention. Prenez une respiration profonde. Qu'est-ce qui est le plus difficile ou le plus lourd à porter dans ce que vous traversez en ce moment ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 700);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden">
      {/* Halo lumineux d'ambiance apaisante (décoration) */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-600/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 left-1/3 w-[450px] h-[250px] bg-emerald-600/10 rounded-full blur-3xl" />

      {/* Header épuré et centré */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
              <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-white tracking-tight">Respire</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Espace confidentiel
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Écoute bienveillante & soutien émotionnel 24h/24</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Zéro stockage • Anonyme</span>
          </div>
        </div>
      </header>

      {/* Zone centrale */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col justify-center">
        {messages.length === 0 ? (
          /* Écran d'accueil quand la conversation n'a pas encore démarré */
          <div className="flex flex-col items-center text-center my-auto py-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-emerald-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 shadow-lg shadow-teal-500/5">
              <svg className="w-7 h-7 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
              Un espace pour relâcher la pression.
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
              Exprimez librement ce que vous ressentez, sans jugement ni attente. Cet espace est entièrement privé : rien n'est conservé.
            </p>

            {/* Cartes d'amorce engageantes */}
            <div className="grid sm:grid-cols-3 gap-3 w-full text-left mb-6">
              {starters.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(s.title)}
                  className="group p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md"
                >
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-400/90 mb-1.5 block">
                      {s.tag}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-300 transition">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-[11px] text-teal-400 font-medium">
                    <span>Commencer</span>
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 max-w-md">
              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
              </svg>
              <span>En cas d'urgence médicale ou de détresse sévère, composez immédiatement le 3114.</span>
            </div>
          </div>
        ) : (
          /* Fil de conversation si des messages existent */
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Barre de saisie centrée et bien dessinée */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md p-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 focus-within:border-teal-500/70 rounded-2xl p-1.5 shadow-inner transition"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que traversez-vous en ce moment ? Écrivez sans retenue..."
              className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition"
            >
              <span>Envoyer</span>
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-400">
            Respire IA • Vos échanges sont éphémères et disparaissent à la fermeture de la page.
          </p>
        </div>
      </footer>
    </div>
  );
}
