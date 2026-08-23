import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { transitions } from '../data/transitions'
import { sfx } from '../data/sfx'
import { playSfx } from '../lib/sfxSynth'
import { formatDurationTag } from '../lib/format'
import { TransitionThumb } from './TransitionThumb'
import { IconPlay, IconPlus } from './Icons'
import type { Energy, SfxCategory } from '../types'

const energyOrder: Energy[] = ['impact', 'fluide', 'doux']
const categoryOrder: SfxCategory[] = ['transition', 'accent', 'ambiance']

export function LibraryPanel() {
  const { t, bi, lang } = useI18n()
  const tab = useStore((s) => s.libraryTab)
  const setTab = useStore((s) => s.setLibraryTab)
  const selectedCutIndex = useStore((s) => s.selectedCutIndex)
  const setTransition = useStore((s) => s.setTransition)
  const addSfxAt = useStore((s) => s.addSfxAt)
  const playhead = useStore((s) => s.playhead)
  const clipsCount = useStore((s) => s.clips.length)
  const showToast = useStore((s) => s.showToast)

  const [query, setQuery] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const normalized = query.trim().toLowerCase()

  const visibleTransitions = useMemo(
    () =>
      transitions.filter(
        (item) => !normalized || item.name.fr.toLowerCase().includes(normalized) || item.name.en.toLowerCase().includes(normalized),
      ),
    [normalized],
  )

  const visibleSfx = useMemo(
    () =>
      sfx.filter(
        (item) => !normalized || item.name.fr.toLowerCase().includes(normalized) || item.name.en.toLowerCase().includes(normalized),
      ),
    [normalized],
  )

  const applyTransition = (id: string) => {
    if (selectedCutIndex === null) {
      showToast({ text: t('lib.applyHintTransition'), tone: 'info' })
      return
    }
    setTransition(selectedCutIndex, id)
  }

  const applySfx = (id: string) => {
    if (clipsCount === 0) {
      showToast({ text: t('hooks.needClip'), tone: 'info' })
      return
    }
    addSfxAt(id, playhead)
    showToast({ text: t('lib.applyHintSfx'), tone: 'success' })
  }

  return (
    <section className="panel" aria-label={t('lib.title')}>
      <header className="panel__head">
        <h2 className="panel__title">{t('lib.title')}</h2>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'transitions'}
          className={`tabs__tab${tab === 'transitions' ? ' is-active' : ''}`}
          onClick={() => setTab('transitions')}
        >
          {t('lib.transitions')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sfx'}
          className={`tabs__tab${tab === 'sfx' ? ' is-active' : ''}`}
          onClick={() => setTab('sfx')}
        >
          {t('lib.sfx')}
        </button>
      </div>

      <input
        className="input"
        type="search"
        value={query}
        placeholder={t('lib.search')}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t('lib.search')}
      />

      <p className="panel__hint">{tab === 'transitions' ? t('lib.applyHintTransition') : t('lib.applyHintSfx')}</p>

      <div className="panel__scroll">
        {tab === 'transitions' ? (
          energyOrder.map((energy) => {
            const items = visibleTransitions.filter((item) => item.energy === energy)
            if (items.length === 0) return null
            return (
              <div key={energy} className="group">
                <h3 className="group__title">{t(`energy.${energy}`)}</h3>
                <div className="grid">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="card"
                      onMouseEnter={() => setPreviewId(item.id)}
                      onMouseLeave={() => setPreviewId((current) => (current === item.id ? null : current))}
                      onFocus={() => setPreviewId(item.id)}
                      onBlur={() => setPreviewId((current) => (current === item.id ? null : current))}
                    >
                      <TransitionThumb preview={item.preview} duration={item.duration} active={previewId === item.id} />
                      <div className="card__body">
                        <span className="card__name">{bi(item.name)}</span>
                        <span className="card__tag mono">{formatDurationTag(item.duration, lang)}</span>
                      </div>
                      <div className="card__actions">
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => setPreviewId(item.id)}
                          title={t('lib.preview')}
                        >
                          <IconPlay size={13} />
                        </button>
                        <button type="button" className="btn btn--tiny btn--accent" onClick={() => applyTransition(item.id)}>
                          <IconPlus size={13} />
                          {t('lib.apply')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          categoryOrder.map((category) => {
            const items = visibleSfx.filter((item) => item.category === category)
            if (items.length === 0) return null
            return (
              <div key={category} className="group">
                <h3 className="group__title">{t(`sfx.${category}`)}</h3>
                <ul className="list">
                  {items.map((item) => (
                    <li key={item.id} className="sfxrow">
                      <button
                        type="button"
                        className="sfxrow__play"
                        onClick={() => playSfx(item)}
                        title={t('lib.preview')}
                        aria-label={`${t('lib.preview')} — ${bi(item.name)}`}
                      >
                        <IconPlay size={14} />
                      </button>
                      <span className="sfxrow__name">{bi(item.name)}</span>
                      <span className="sfxrow__tag mono">{formatDurationTag(item.duration, lang)}</span>
                      <button type="button" className="btn btn--tiny btn--accent" onClick={() => applySfx(item.id)}>
                        <IconPlus size={13} />
                        {t('lib.apply')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}

        {(tab === 'transitions' ? visibleTransitions : visibleSfx).length === 0 ? (
          <p className="panel__empty">{t('lib.empty')}</p>
        ) : null}
      </div>
    </section>
  )
}
