import { useRef, useState } from 'react';
import type { LocalMedia } from '@/lib/phare-local';

async function loadImage(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

// Screen blending exposes the scene in the dark subject and preserves white highlights.
// Keep the subject alpha so that a cut-out stays transparent outside its silhouette.
async function compose(canvas: HTMLCanvasElement, subjectUrl: string, sceneUrl: string, amount: number) {
  const [subject, scene] = await Promise.all([loadImage(subjectUrl), loadImage(sceneUrl)]);
  const scale = Math.min(1, 2048 / Math.max(subject.naturalWidth, subject.naturalHeight));
  canvas.width = Math.max(1, Math.round(subject.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(subject.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Le dessin sur toile est indisponible dans ce navigateur.');
  const { width, height } = canvas;
  ctx.drawImage(subject, 0, 0, width, height);
  const portrait = ctx.getImageData(0, 0, width, height);
  ctx.clearRect(0, 0, width, height);
  const crop = Math.max(width / scene.naturalWidth, height / scene.naturalHeight);
  const w = scene.naturalWidth * crop, h = scene.naturalHeight * crop;
  ctx.drawImage(scene, (width - w) / 2, (height - h) / 2, w, h);
  const inside = ctx.getImageData(0, 0, width, height).data;
  for (let p = 0; p < inside.length; p += 4) {
    const strength = (amount / 100) * (inside[p + 3] / 255);
    for (let c = p; c < p + 3; c++) {
      portrait.data[c] += (255 - portrait.data[c]) * (inside[c] / 255) * strength;
    }
  }
  ctx.putImageData(portrait, 0, 0);
}

export default function DoubleExposure({ images, mediaUrl, save }: {
  images: LocalMedia[];
  mediaUrl: (id: string) => string;
  save: (png: Blob, name: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState(''), [scene, setScene] = useState('');
  const [amount, setAmount] = useState(75), [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false), [message, setMessage] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const inFlight = useRef(false);
  function reset() { setReady(false); setMessage(''); }
  async function run(saving: boolean) {
    if (!canvas.current || !subject || !scene || subject === scene || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (saving) {
        const png = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Export PNG impossible.')), 'image/png'
        ));
        const name = (id: string) => (images.find(image => image.id === id)?.name || id).replace(/\.[^.]+$/, '').slice(0, 60);
        const filename = `Double exposition - ${name(subject)} + ${name(scene)} - ${amount}.png`;
        await save(png, filename);
        setMessage(`Image ajoutée à « Ma matière » : ${filename}`);
        setReady(false);
      } else {
        await compose(canvas.current, mediaUrl(subject), mediaUrl(scene), amount);
        setReady(true);
        setMessage(`Aperçu de ${canvas.current.width} × ${canvas.current.height} pixels.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de créer cette image.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <details className="studio-exposure">
    <summary>Créer une double exposition</summary>
    <p>Choisis une silhouette sombre sur fond clair ou transparent. Le paysage apparaît dans ses ombres. Le PNG garde les proportions du sujet, jusqu’à 2 048 pixels de côté.</p>
    {images.length < 2 && <p>Ajoute deux images différentes dans « Ma matière » pour commencer.</p>}
    <fieldset disabled={busy || images.length < 2}>
      <legend>Images et intensité</legend>
      <div className="atelier-fields">
        <label>Silhouette<select value={subject} onChange={e => { setSubject(e.target.value); reset(); }}>
          <option value="">Choisir le sujet</option>{images.map(i => <option key={i.id} value={i.id} disabled={i.id === scene}>{i.name}</option>)}
        </select></label>
        <label>Paysage intérieur<select value={scene} onChange={e => { setScene(e.target.value); reset(); }}>
          <option value="">Choisir la scène</option>{images.map(i => <option key={i.id} value={i.id} disabled={i.id === subject}>{i.name}</option>)}
        </select></label>
      </div>
      <label>Intensité du paysage · {amount} %<input type="range" min="0" max="100" value={amount} onChange={e => { setAmount(Number(e.target.value)); reset(); }} /></label>
      <button type="button" disabled={!subject || !scene} onClick={() => void run(false)}>Voir la double exposition</button>
    </fieldset>
    <canvas hidden={!ready} ref={canvas} aria-label="Aperçu de la double exposition" role="img" />
    {ready && <button type="button" disabled={busy} onClick={() => void run(true)}>Ajouter le PNG à ma matière</button>}
    <p role="status">{busy ? 'Traitement en cours…' : message}</p>
  </details>;
}
