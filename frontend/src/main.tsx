import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const saved = localStorage.getItem('documind-theme')
if (saved === 'light') {
  document.documentElement.classList.remove('dark')
} else {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
