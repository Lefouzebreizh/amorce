import type { CSSProperties } from 'react'

export interface TransitionFrame {
  /** Style du plan entrant. */
  incoming: CSSProperties
  /** Style du plan sortant. */
  outgoing: CSSProperties
  /** Voile éventuel par-dessus les deux plans (flash, coupe noire). */
  overlay?: CSSProperties
}

const pct = (value: number) => `${value * 100}%`

/**
 * Décrit l'état visuel d'une transition à l'avancement `p` (0 → 1).
 * Sert à la fois aux vignettes de la bibliothèque et à l'aperçu 9:16 :
 * ce que l'on voit ici correspond au filtre `xfade` appliqué à l'export.
 */
export function transitionFrame(preview: string, p: number): TransitionFrame {
  const t = Math.max(0, Math.min(1, p))

  switch (preview) {
    case 'fade':
      return { incoming: { opacity: t }, outgoing: { opacity: 1 } }

    case 'dissolve':
      return {
        incoming: { opacity: t, filter: `contrast(${1 + (1 - t) * 0.4})` },
        outgoing: { opacity: 1 },
      }

    case 'grays':
      return {
        incoming: { opacity: t, filter: `saturate(${t})` },
        outgoing: { filter: `saturate(${Math.max(0, 1 - t * 1.6)})` },
      }

    case 'blur':
      return {
        incoming: { opacity: t, filter: `blur(${(1 - t) * 14}px)` },
        outgoing: { filter: `blur(${t * 14}px)` },
      }

    case 'flash':
      return {
        incoming: { opacity: t > 0.5 ? 1 : 0 },
        outgoing: { opacity: 1 },
        overlay: { background: '#ffffff', opacity: 1 - Math.abs(t - 0.5) * 2 },
      }

    case 'black':
      return {
        incoming: { opacity: t > 0.5 ? 1 : 0 },
        outgoing: { opacity: 1 },
        overlay: { background: '#000000', opacity: 1 - Math.abs(t - 0.5) * 2 },
      }

    case 'zoom':
      return {
        incoming: { opacity: t, transform: `scale(${0.55 + t * 0.45})` },
        outgoing: { transform: `scale(${1 + t * 0.5})`, opacity: 1 - t * 0.6 },
      }

    case 'squeeze':
      return {
        incoming: { opacity: 1, transform: `scaleX(${t})` },
        outgoing: { transform: `scaleX(${Math.max(0.001, 1 - t)})` },
      }

    case 'slide-l':
      return {
        incoming: { transform: `translateX(${pct(1 - t)})`, opacity: 1 },
        outgoing: { transform: `translateX(${pct(-t)})` },
      }

    case 'slide-u':
      return {
        incoming: { transform: `translateY(${pct(1 - t)})`, opacity: 1 },
        outgoing: { transform: `translateY(${pct(-t)})` },
      }

    case 'cover-u':
      return {
        incoming: { transform: `translateY(${pct(1 - t)})`, opacity: 1 },
        outgoing: {},
      }

    case 'wipe-l':
      return {
        incoming: { clipPath: `inset(0 0 0 ${pct(1 - t)})`, opacity: 1 },
        outgoing: {},
      }

    case 'circle':
      return {
        incoming: { clipPath: `circle(${t * 78}% at 50% 50%)`, opacity: 1 },
        outgoing: {},
      }

    case 'radial':
      return {
        incoming: {
          opacity: 1,
          maskImage: `conic-gradient(from 0deg, #000 0turn, #000 ${t}turn, transparent ${t}turn)`,
          WebkitMaskImage: `conic-gradient(from 0deg, #000 0turn, #000 ${t}turn, transparent ${t}turn)`,
        } as CSSProperties,
        outgoing: {},
      }

    case 'slice': {
      // Lamelles horizontales qui se remplissent progressivement.
      const mask = `repeating-linear-gradient(to bottom, #000 0 ${t * 12.5}%, transparent ${t * 12.5}% 12.5%)`
      return {
        incoming: { opacity: 1, maskImage: mask, WebkitMaskImage: mask } as CSSProperties,
        outgoing: {},
      }
    }

    case 'glitch': {
      const shake = Math.sin(t * 34) * (1 - t) * 8
      return {
        incoming: {
          opacity: t > 0.35 ? 1 : 0,
          transform: `translateX(${shake}px)`,
          filter: `hue-rotate(${(1 - t) * 90}deg) saturate(${1 + (1 - t) * 2})`,
        },
        outgoing: {
          transform: `translateX(${-shake}px)`,
          filter: `hue-rotate(${t * -70}deg) contrast(${1 + t})`,
        },
      }
    }

    default:
      return { incoming: { opacity: t }, outgoing: { opacity: 1 } }
  }
}
