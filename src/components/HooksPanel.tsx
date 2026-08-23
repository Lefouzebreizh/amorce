import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { hookPatterns } from '../data/hooks'
import { transitionById } from '../data/transitions'
import { IconSpark } from './Icons'

function scoreTone(score: number): string {
  if (score < 50) return 'is-low'
  if (score < 75) return 'is-mid'
  return 'is-high'
}

/** Bibliothèque d'accroches virales (cahier §3.5). */
export function HooksPanel() {
  const { t, bi } = useI18n()
  const applyPacing = useStore((s) => s.applyPacing)
  const showToast = useStore((s) => s.showToast)

  const apply = (cuts: number[], transitionId: string) => {
    const result = applyPacing(cuts, transitionId)
    if (result === 'no-clip') showToast({ text: t('hooks.needClip'), tone: 'info' })
    else if (result === 'too-short') showToast({ text: t('hooks.tooShort'), tone: 'error' })
    else showToast({ text: t('hooks.applied'), tone: 'success' })
  }

  return (
    <section className="panel" aria-label={t('hooks.title')}>
      <header className="panel__head">
        <h2 className="panel__title">{t('hooks.title')}</h2>
      </header>
      <p className="panel__hint">{t('hooks.subtitle')}</p>

      <div className="panel__scroll">
        <ul className="list">
          {hookPatterns.map((hook) => {
            const transition = transitionById.get(hook.transitionId)
            return (
              <li key={hook.id} className="hookcard">
                <div className="hookcard__head">
                  <h3 className="hookcard__name">{bi(hook.name)}</h3>
                  <span className={`chip chip--score mono ${scoreTone(hook.estimatedScore)}`}>{hook.estimatedScore}</span>
                </div>

                <p className="hookcard__template">« {bi(hook.template)} »</p>
                <p className="hookcard__rationale">{bi(hook.rationale)}</p>

                <div className="hookcard__meta">
                  <span className="chip mono">{t(`pace.${hook.pace}`)}</span>
                  <span className="chip mono">
                    {hook.cuts.length} {t('timeline.cut').toLowerCase()}
                    {hook.cuts.length > 1 ? 's' : ''}
                  </span>
                  {transition ? <span className="chip mono">{bi(transition.name)}</span> : null}
                </div>

                <button
                  type="button"
                  className="btn btn--accent btn--block"
                  onClick={() => apply(hook.cuts, hook.transitionId)}
                >
                  <IconSpark size={15} />
                  {t('hooks.apply')}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
