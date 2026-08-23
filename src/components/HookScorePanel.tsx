import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useI18n } from '../i18n'
import { computeSegments, useStore } from '../state/store'
import { analyzeHook, HOOK_WINDOW } from '../lib/hookScore'
import { openingPresets } from '../data/hooks'
import type { HookSignals } from '../types'
import { IconRefresh, IconSpark } from './Icons'

const SIGNAL_ORDER: (keyof HookSignals)[] = [
  'cutRhythm',
  'audioOnset',
  'motion',
  'contrast',
  'timeToAction',
  'saturation',
]

function toneFor(score: number): 'is-low' | 'is-mid' | 'is-high' {
  if (score < 50) return 'is-low'
  if (score < 75) return 'is-mid'
  return 'is-high'
}

/** Panneau de score d'accroche : mesure réelle sur les 2 premières secondes. */
export function HookScorePanel() {
  const { t, bi } = useI18n()
  const clips = useStore((s) => s.clips)
  const assets = useStore((s) => s.assets)
  const hookScore = useStore((s) => s.hookScore)
  const hookLoading = useStore((s) => s.hookLoading)
  const setHookScore = useStore((s) => s.setHookScore)
  const setHookLoading = useStore((s) => s.setHookLoading)
  const applyPacing = useStore((s) => s.applyPacing)
  const showToast = useStore((s) => s.showToast)

  const first = clips[0]
  const asset = first ? assets[first.assetId] : undefined

  /** Coupes de la timeline situées dans la fenêtre d'accroche. */
  const timelineCuts = useMemo(
    () => computeSegments(clips).filter((s) => s.index > 0 && s.start < HOOK_WINDOW).length,
    [clips],
  )

  // Signature : relancer l'analyse seulement si l'ouverture a réellement changé.
  const signature = first && asset ? `${asset.id}:${first.in.toFixed(2)}:${timelineCuts}` : ''
  const lastSignature = useRef('')

  const run = useCallback(async () => {
    if (!first || !asset) {
      setHookScore(null)
      return
    }
    setHookLoading(true)
    try {
      const score = await analyzeHook({ blob: asset.blob, startOffset: first.in, timelineCuts })
      setHookScore(score)
    } catch {
      setHookScore(null)
    } finally {
      setHookLoading(false)
    }
  }, [first, asset, timelineCuts, setHookScore, setHookLoading])

  useEffect(() => {
    if (!signature) {
      lastSignature.current = ''
      setHookScore(null)
      return
    }
    if (signature === lastSignature.current) return
    lastSignature.current = signature
    void run()
  }, [signature, run, setHookScore])

  const applyPreset = (cuts: number[], transitionId: string) => {
    const result = applyPacing(cuts, transitionId)
    if (result === 'no-clip') showToast({ text: t('hooks.needClip'), tone: 'info' })
    else if (result === 'too-short') showToast({ text: t('hooks.tooShort'), tone: 'error' })
    else showToast({ text: t('hooks.applied'), tone: 'success' })
  }

  const tone = hookScore ? toneFor(hookScore.score) : 'is-mid'
  const ratio = hookScore ? hookScore.score / 100 : 0
  const circumference = 2 * Math.PI * 52

  return (
    <aside className="score" aria-label={t('score.title')}>
      <header className="panel__head">
        <h2 className="panel__title">{t('score.title')}</h2>
        <button
          type="button"
          className="btn btn--tiny"
          onClick={() => void run()}
          disabled={!first || hookLoading}
          title={t('score.recompute')}
        >
          <IconRefresh size={14} />
        </button>
      </header>
      <p className="panel__hint">{t('score.subtitle')}</p>

      <div className="panel__scroll">
        <div className={`gauge ${tone}${hookLoading ? ' is-loading' : ''}`}>
          <svg viewBox="0 0 120 120" className="gauge__svg" aria-hidden>
            <circle cx="60" cy="60" r="52" className="gauge__track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="gauge__value"
              strokeDasharray={`${circumference * ratio} ${circumference}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="gauge__center">
            {hookLoading ? (
              <span className="gauge__loading">{t('score.analyzing')}</span>
            ) : hookScore ? (
              <>
                <span className="gauge__number mono">{hookScore.score}</span>
                <span className="gauge__level">{t(`level.${hookScore.level}`)}</span>
              </>
            ) : (
              <span className="gauge__loading">{t('score.none')}</span>
            )}
          </div>
        </div>

        {hookScore?.audioUnavailable ? <p className="panel__note">{t('score.audioUnavailable')}</p> : null}

        {hookScore ? (
          <>
            <h3 className="group__title">{t('score.signals')}</h3>
            <ul className="signals">
              {SIGNAL_ORDER.map((key) => (
                <li key={key} className="signals__row">
                  <span className="signals__name">{t(`signal.${key}`)}</span>
                  <span className="signals__bar">
                    <span className="signals__fill" style={{ width: `${Math.round(hookScore.signals[key] * 100)}%` }} />
                  </span>
                  <span className="signals__value mono">{Math.round(hookScore.signals[key] * 100)}</span>
                </li>
              ))}
            </ul>

            {hookScore.advice.length > 0 ? (
              <>
                <h3 className="group__title">{t('score.advice')}</h3>
                <ul className="advice">
                  {hookScore.advice.map((item, index) => (
                    <li key={index} className="advice__item">
                      <IconSpark size={14} className="advice__icon" />
                      <div>
                        <p className="advice__text">{bi(item.text)}</p>
                        <span className="advice__gain mono">{t('score.gain', { n: item.gain })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}

        <h3 className="group__title">{t('score.presets')}</h3>
        <ul className="list">
          {openingPresets.map((preset) => (
            <li key={preset.id} className="preset">
              <div className="preset__head">
                <span className="preset__name">{bi(preset.name)}</span>
                <span className={`chip chip--score mono ${toneFor(preset.referenceScore)}`}>
                  {preset.referenceScore}
                  <em className="chip__note">{t('score.reference')}</em>
                </span>
              </div>
              <p className="preset__desc">{bi(preset.description)}</p>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => applyPreset(preset.cuts, preset.transitionId)}>
                {t('hooks.apply')}
              </button>
            </li>
          ))}
        </ul>

        <p className="panel__note">{t('disclaimer.virality')}</p>
      </div>
    </aside>
  )
}
