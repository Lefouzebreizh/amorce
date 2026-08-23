let ctx: AudioContext | null = null

/** Contexte audio partagé (préécoute des bruitages, décodage). */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Décode un média en AudioBuffer. Retourne null si le codec est illisible. */
export async function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer | null> {
  try {
    return await getAudioContext().decodeAudioData(data.slice(0))
  } catch {
    return null
  }
}
