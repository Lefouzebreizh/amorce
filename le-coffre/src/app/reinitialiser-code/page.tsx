'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ReinitialiserCode() {
  const routeur = useRouter();
  const [pret, setPret] = useState(false);
  const [code, setCode] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState(''); const [enCours, setEnCours] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setPret(!!data.session)); }, []);
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setErreur('');
    if (code.length < 12) return setErreur('Choisis au moins 12 caractères.');
    if (code !== confirmation) return setErreur('Les deux codes ne correspondent pas.');
    setEnCours(true); const { error } = await supabase.auth.updateUser({ password: code }); setEnCours(false);
    if (error) return setErreur('Le lien n’est plus valide. Redemande-en un nouveau.');
    routeur.replace('/coffre');
  }
  return <main className="min-h-screen bg-[#071225] px-6 py-16 text-[#e8efff]"><section className="mx-auto max-w-lg rounded-3xl border border-cyan-200/30 bg-slate-950/60 p-7 shadow-2xl"><p className="mb-3 text-sm font-semibold uppercase tracking-[.16em] text-cyan-200">Mon Tiroir Secret</p><h1 className="text-4xl font-semibold">Choisis un nouveau code.</h1>{!pret ? <p className="mt-5 text-slate-300">Ce lien est absent ou a expiré. Reviens à l’accueil et demande un nouveau lien.</p> : <form onSubmit={enregistrer} className="mt-7 flex flex-col gap-4"><label htmlFor="code">Nouveau code d’accès</label><input id="code" type="password" autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value)} className="rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white" required /><label htmlFor="confirmation">Retape-le</label><input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="rounded-xl border border-slate-500 bg-slate-950 px-4 py-3 text-white" required />{erreur && <p role="alert" className="text-rose-300">{erreur}</p>}<button disabled={enCours} className="mt-2 rounded-xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 px-5 py-3 font-bold text-slate-950">{enCours ? 'Enregistrement…' : 'Enregistrer mon nouveau code'}</button></form>}</section></main>;
}
