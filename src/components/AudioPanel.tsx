import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../state/store'
import { ImportError, importAudioFile } from '../lib/media'
import { formatTime } from '../lib/format'
import { IconPlus, IconTrash } from './Icons'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

function LevelSlider({ label, value, onChange, disabled }: SliderProps) {
  return (
    <label className={`slider${disabled ? ' is-disabled' : ''}`}>
      <span className="slider__label">
        {label}
        <span className="slider__value mono">{Math.round(value * 100)} %</span>
      </span>
      <input
        type="range"
        min={0}
        max={1.5}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

/** Niveaux audio : voix originale et musique de fond indépendantes (cahier §3.3). */
export function AudioPanel() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const voiceLevel = useStore((s) => s.voiceLevel)
  const musicLevel = useStore((s) => s.musicLevel)
  const sfxLevel = useStore((s) => s.sfxLevel)
  const setLevel = useStore((s) => s.setLevel)
  const musicAssetId = useStore((s) => s.musicAssetId)
  const music = useStore((s) => (s.musicAssetId ? s.assets[s.musicAssetId] : null))
  const setMusic = useStore((s) => s.setMusic)
  const showToast = useStore((s) => s.showToast)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const asset = await importAudioFile(file)
      await setMusic(asset)
    } catch (error) {
      const message = error instanceof ImportError && error.code === 'format' ? t('audio.errFormat') : t('import.errDecode')
      showToast({ text: message, tone: 'error' })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="panel" aria-label={t('audio.title')}>
      <header className="panel__head">
        <h2 className="panel__title">{t('audio.title')}</h2>
      </header>

      <div className="panel__scroll">
        <LevelSlider label={t('audio.voice')} value={voiceLevel} onChange={(v) => setLevel('voiceLevel', v)} />
        <LevelSlider
          label={t('audio.music')}
          value={musicLevel}
          onChange={(v) => setLevel('musicLevel', v)}
          disabled={!musicAssetId}
        />
        <LevelSlider label={t('audio.sfx')} value={sfxLevel} onChange={(v) => setLevel('sfxLevel', v)} />

        <div className="musicbox">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {music ? (
            <>
              <div className="musicbox__info">
                <span className="musicbox__name">{music.name}</span>
                <span className="musicbox__meta mono">{formatTime(music.duration)}</span>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => void setMusic(null)}>
                <IconTrash size={15} />
                {t('audio.removeMusic')}
              </button>
            </>
          ) : (
            <>
              <p className="musicbox__empty">{t('audio.noMusic')}</p>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
                <IconPlus size={15} />
                {t('audio.addMusic')}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
