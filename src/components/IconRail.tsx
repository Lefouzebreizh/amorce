import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { IconAudio, IconExport, IconHook, IconLibrary } from './Icons'

const items = [
  { id: 'library', label: 'rail.library', Icon: IconLibrary },
  { id: 'hooks', label: 'rail.hooks', Icon: IconHook },
  { id: 'audio', label: 'rail.audio', Icon: IconAudio },
  { id: 'export', label: 'rail.export', Icon: IconExport },
] as const

export function IconRail() {
  const { t } = useI18n()
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)

  return (
    <nav className="rail" aria-label={t('rail.library')}>
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`rail__btn${panel === id ? ' is-active' : ''}`}
          onClick={() => setPanel(id)}
          aria-current={panel === id}
          title={t(label)}
        >
          <Icon size={20} />
          <span className="rail__label">{t(label)}</span>
        </button>
      ))}
    </nav>
  )
}
