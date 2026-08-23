import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { cancelExport, exportVideo, type ExportProgress } from '../lib/export'
import { formatBytes, formatTime } from '../lib/format'
import { totalDuration } from '../state/store'
import { IconCheck, IconExport } from './Icons'

type Status = 'idle' | 'running' | 'done' | 'error'

/** Export MP4 9:16, encodé dans le navigateur (cahier §3.6). */
export function ExportPanel() {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<ExportProgress>({ stage: 'loading', progress: 0 })
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ url: string; size: number } | null>(null)
  const resultRef = useRef<string | null>(null)

  const store = useStore()
  const duration = totalDuration(store.clips)

  useEffect(
    () => () => {
      if (resultRef.current) URL.revokeObjectURL(resultRef.current)
    },
    [],
  )

  const run = async () => {
    if (store.clips.length === 0) {
      useStore.getState().showToast({ text: t('export.emptyTimeline'), tone: 'info' })
      return
    }
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current)
      resultRef.current = null
    }
    setResult(null)
    setError('')
    setStatus('running')
    setProgress({ stage: 'loading', progress: 0 })

    try {
      const blob = await exportVideo({
        clips: store.clips,
        assets: store.assets,
        sfxPlacements: store.sfxPlacements,
        music: store.musicAssetId ? (store.assets[store.musicAssetId] ?? null) : null,
        voiceLevel: store.voiceLevel,
        musicLevel: store.musicLevel,
        sfxLevel: store.sfxLevel,
        onProgress: setProgress,
      })
      const url = URL.createObjectURL(blob)
      resultRef.current = url
      setResult({ url, size: blob.size })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const stageLabel =
    progress.stage === 'loading'
      ? t('export.loadingCore')
      : progress.stage === 'writing'
        ? t('export.preparing')
        : t('export.encoding', { p: Math.round(progress.progress * 100) })

  return (
    <section className="panel" aria-label={t('export.title')}>
      <header className="panel__head">
        <h2 className="panel__title">{t('export.title')}</h2>
      </header>

      <div className="panel__scroll">
        <dl className="specs">
          <div>
            <dt>{t('export.spec')}</dt>
            <dd className="mono">{formatTime(duration, 1)}</dd>
          </div>
        </dl>

        {status === 'running' ? (
          <div className="progress">
            <div className="progress__bar">
              <div
                className="progress__fill"
                style={{ width: progress.stage === 'encoding' ? `${progress.progress * 100}%` : '12%' }}
              />
            </div>
            <p className="progress__label mono">{stageLabel}</p>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => void cancelExport().then(() => setStatus('idle'))}>
              {t('export.cancel')}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--accent btn--block" onClick={() => void run()}>
            <IconExport size={16} />
            {t('export.start')}
          </button>
        )}

        {status === 'done' && result ? (
          <div className="exportdone">
            <p className="exportdone__title">
              <IconCheck size={16} />
              {t('export.done')} · <span className="mono">{formatBytes(result.size)}</span>
            </p>
            <a className="btn btn--accent btn--block" href={result.url} download="amorce.mp4">
              {t('export.download')}
            </a>
          </div>
        ) : null}

        {status === 'error' ? <p className="panel__error">{t('export.failed', { e: error })}</p> : null}

        <p className="panel__note">{t('export.note')}</p>
        <p className="panel__note">{t('disclaimer.virality')}</p>
      </div>
    </section>
  )
}
