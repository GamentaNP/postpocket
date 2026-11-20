import { useEffect } from 'react'

export function applyTheme(theme?: string) {
  let resolved = theme || 'dark'
  if (resolved === 'system') {
    resolved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useTheme(theme?: string) {
  useEffect(() => applyTheme(theme), [theme])
}
