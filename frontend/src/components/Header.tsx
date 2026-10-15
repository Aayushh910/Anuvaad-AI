import { useState, useEffect } from 'react'
import { Sun, Moon, FileText, Menu, X } from 'lucide-react'
import { checkHealth } from '../services/api'
import type { Document } from '../types'

interface HeaderProps {
  dark: boolean
  onToggleTheme: () => void
  activeDoc: Document | null
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export default function Header({
  dark,
  onToggleTheme,
  activeDoc,
  sidebarOpen,
  onToggleSidebar,
}: HeaderProps) {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    const verifyBackend = async () => {
      const ok = await checkHealth()
      if (mounted) setBackendHealthy(ok)
    }

    verifyBackend()
    const interval = setInterval(verifyBackend, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6 border-b transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Left: Brand & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors md:hidden"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-secondary)',
          }}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm font-semibold text-sm"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span
              className="font-semibold text-base tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              DocuMind
            </span>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
              }}
            >
              AI
            </span>
          </div>
        </div>

        {/* Active Document Info Badge */}
        {activeDoc && (
          <div
            className="hidden sm:flex items-center gap-2 pl-3 ml-2 border-l animate-fade-in"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <FileText size={13} style={{ color: 'var(--accent-primary)' }} />
              <span className="max-w-[200px] truncate" title={activeDoc.filename}>
                {activeDoc.filename}
              </span>
              {activeDoc.pageCount > 0 && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  · {activeDoc.pageCount}p
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Backend Status & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend health status badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          title={
            backendHealthy === null
              ? 'Checking backend connection...'
              : backendHealthy
              ? 'Backend API connected'
              : 'Backend API unreachable'
          }
        >
          {backendHealthy === null ? (
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          ) : backendHealthy ? (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--status-ready)' }}
            />
          ) : (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--status-error)' }}
            />
          )}
          <span className="text-[11px] tracking-wide">
            {backendHealthy === null
              ? 'Checking API'
              : backendHealthy
              ? 'API Online'
              : 'API Offline'}
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200 hover:scale-105"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-secondary)',
          }}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  )
}
