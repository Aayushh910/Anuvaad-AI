import { useState, useEffect } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('documind-theme')
    return saved !== 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('documind-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark((v) => !v)

  return { dark, toggle }
}
