import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Bilingual, Lang } from '../types'
import { strings, type StringKey } from './strings'

const STORAGE_KEY = 'amorce.lang'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible : on retombe sur la langue du navigateur */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Traduit une clé du dictionnaire, avec interpolation `{nom}`. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  /** Résout un objet bilingue issu des données (effets, hooks…). */
  bi: (value: Bilingual) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* non bloquant */
    }
  }, [lang])

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      let out = strings[key][lang]
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          out = out.replaceAll(`{${name}}`, String(value))
        }
      }
      return out
    },
    [lang],
  )

  const bi = useCallback((value: Bilingual) => value[lang], [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, bi }), [lang, setLang, t, bi])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>')
  return ctx
}
