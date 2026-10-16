import { useState, useEffect } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('documind-theme')
    return saved !== 'light'
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('documind-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = () => setDark((prev) => !prev)

  return { dark, toggle }
}
