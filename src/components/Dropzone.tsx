import { useCallback, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { ImportError, importVideoFile } from '../lib/media'
import { IconPlus } from './Icons'

interface Props {
  variant?: 'full' | 'compact'
}

/** Import vidéo : glisser-déposer et sélecteur classique (cahier §3.1). */
export function Dropzone({ variant = 'full' }: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const addAsset = useStore((s) => s.addAsset)
  const addClipFromAsset = useStore((s) => s.addClipFromAsset)
  const showToast = useStore((s) => s.showToast)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          const asset = await importVideoFile(file)
          await addAsset(asset)
          addClipFromAsset(asset)
        }
      } catch (error) {
        if (error instanceof ImportError) {
          const message =
            error.code === 'format'
              ? t('import.errFormat')
              : error.code === 'duration'
                ? t('import.errDuration', { d: `${error.detail}s` })
                : t('import.errDecode')
          showToast({ text: message, tone: 'error' })
        } else {
          showToast({ text: t('import.errDecode'), tone: 'error' })
        }
      } finally {
        setBusy(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [addAsset, addClipFromAsset, showToast, t],
  )

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
      multiple
      hidden
      onChange={(event) => void handleFiles(event.target.files)}
    />
  )

  if (variant === 'compact') {
    return (
      <>
        {input}
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          <IconPlus size={16} />
          {busy ? t('import.reading') : t('import.addAnother')}
        </button>
      </>
    )
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void handleFiles(event.dataTransfer.files)
      }}
    >
      {input}
      <h3 className="dropzone__title">{t('import.title')}</h3>
      <p className="dropzone__hint">{busy ? t('import.reading') : t('import.drop')}</p>
      <span className="dropzone__or">{t('import.or')}</span>
      <button type="button" className="btn btn--accent" disabled={busy} onClick={() => inputRef.current?.click()}>
        {t('import.browse')}
      </button>
      <p className="dropzone__formats mono">{t('import.formats')}</p>
    </div>
  )
}
