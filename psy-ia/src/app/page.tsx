import React, { useState } from 'react';
import { 
  ShieldCheck, 
  HeartHandshake, 
  Sparkles, 
  Send, 
  Info, 
  Lock, 
  Moon, 
  Flame, 
  Smile 
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ia';
  text: string;
  time: string;
}

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ia',
      text: "Bonjour et bienvenue dans votre espace Respire. Prenez le temps qu'il vous faut. De quoi avez-vous besoin de vous décharger aujourd'hui ?",
      time: 'À l’instant'
    }
  ]);

  const starters = [
    { label: "Gérer un coup de stress ou d'angoisse", icon: Flame },
    { label: "Prendre du recul après une tension ou dispute", icon: Smile },
    { label: "Poser et vider mes pensées pour dormir", icon: Moon }
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

    // Réponse de confort / simulation d'écoute active
    setTimeout(() => {
      const iaMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: "Je vous écoute avec attention. Respirez lentement. Qu'est-ce qui pèse le plus lourd dans cette situation en ce moment ?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, iaMsg]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header & Marque */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg text-white">Respire</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Écoute Bienveillante
              </span>
            </div>
            <p className="text-xs text-slate-400">Votre espace d'apaisement et de décompression guidé par IA</p>
          </div>
        </div>

        {/* Badge Discrétion & Sécurité */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/40">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Session privée & anonyme</span>
        </div>
      </header>

      {/* Bannière de Réassurance et Cadre Éthique */}
      <div className="bg-slate-900/30 border-b border-slate-800/50 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Aucune conversation n'est archivée ni transmise.</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Soutien conversationnel non médical — En cas d’urgence, contactez le 3114.</span>
          </div>
        </div>
      </div>

      {/* Zone de Discussion */}
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
          {/* Chips d'amorces pour débloquer l'utilisateur */}
          <div className="flex flex-wrap gap-2">
            {starters.map((starter, idx) => {
              const IconComponent = starter.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(starter.label)}
                  className="flex items-center gap-1.5 text-xs bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-teal-500/40 px-3 py-1.5 rounded-full text-slate-300 hover:text-white transition"
                >
                  <IconComponent className="w-3 h-3 text-teal-400" />
                  <span>{starter.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input d'envoi */}
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
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
