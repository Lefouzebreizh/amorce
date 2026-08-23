import { useI18n } from '../i18n'
import type { Lang } from '../types'
import { useStore } from '../state/store'
import { formatTime } from '../lib/format'
import { totalDuration } from '../state/store'
import { IconExport } from './Icons'

export function TopBar() {
  const { t, lang, setLang } = useI18n()
  const clips = useStore((s) => s.clips)
  const setPanel = useStore((s) => s.setPanel)
  const duration = totalDuration(clips)

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">AMORCE</span>
        <span className="topbar__tagline">{t('app.tagline')}</span>
      </div>

      <div className="topbar__center">
        <span className="topbar__project">{t('app.project')}</span>
        <span className="topbar__meta mono">
          {formatTime(duration, 1)} · {clips.length} {clips.length > 1 ? 'clips' : 'clip'}
        </span>
      </div>

      <div className="topbar__actions">
        <div className="langswitch" role="group" aria-label={t('top.lang')}>
          {(['fr', 'en'] as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              className={`langswitch__btn${lang === code ? ' is-active' : ''}`}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        <button type="button" className="btn btn--accent" onClick={() => setPanel('export')}>
          <IconExport size={16} />
          {t('top.export')}
        </button>
      </div>
    </header>
  )
}
