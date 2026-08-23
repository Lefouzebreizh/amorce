import { useEffect } from 'react'
import { useStore } from '../state/store'
import { IconClose } from './Icons'

export function Toast() {
  const toast = useStore((s) => s.toast)
  const showToast = useStore((s) => s.showToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => showToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast, showToast])

  if (!toast) return null

  return (
    <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
      <span>{toast.text}</span>
      <button type="button" className="toast__close" onClick={() => showToast(null)}>
        <IconClose size={14} />
      </button>
    </div>
  )
}
