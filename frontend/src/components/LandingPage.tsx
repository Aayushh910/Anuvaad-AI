import { useState, useCallback } from 'react'
import {
  ArrowRight,
  Eye,
  Table,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
  MessageSquare,
} from 'lucide-react'
import Logo from './Logo'
import { useRotatingPlaceholder } from '../hooks/useRotatingPlaceholder'

interface LandingPageProps {
  dark: boolean
  onToggleTheme: () => void
  onNavigateChat: (initialQuery?: string) => void
  isTransitioning?: boolean
}

const SAMPLE_PROMPTS = [
  'Summarize in Hindi or English',
  'Extract table data & metrics',
  'Explain key findings',
]

export default function LandingPage({
  dark,
  onToggleTheme,
  onNavigateChat,
  isTransitioning = false,
}: LandingPageProps) {
  const [query, setQuery] = useState('')
  const { text: dynamicPlaceholder, isFading } = useRotatingPlaceholder(5000, 400)

  const handleLaunch = useCallback(
    (customText?: string) => {
      const textToUse = customText !== undefined ? customText : query
      onNavigateChat(textToUse.trim() || undefined)
    },
    [query, onNavigateChat],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleLaunch()
      }
    },
    [handleLaunch],
  )

  return (
    <div
      className={`relative h-screen w-screen overflow-y-auto select-text transition-all duration-300 ${
        isTransitioning ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Ambient background glow aura */}
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full pointer-events-none blur-[100px] animate-pulse-glow -z-0"
        style={{
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
        }}
      />

      {/* Top Navigation */}
      <header
        className="relative z-10 w-full max-w-5xl mx-auto px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Logo variant="horizontal" dark={dark} className="h-8 sm:h-8.5 w-auto" />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer hover:scale-105 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Open Chat Link */}
          <button
            onClick={() => handleLaunch()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: dark ? '#1B1B3A' : '#ffffff',
            }}
          >
            <span>Open Chat</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 pt-10 pb-12 flex flex-col items-center text-center">
        {/* Floating Brand Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5 border animate-float shadow-xs backdrop-blur-sm"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            borderColor: 'var(--border-medium)',
            color: 'var(--text-brand)',
          }}
        >
          <Sparkles size={12} />
          <span>Multimodal Document Intelligence</span>
        </div>

        {/* Main Headline with requested tagline */}
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.18] max-w-2xl mb-4">
          Every document.{' '}
          <span className="text-gradient-amber">Your language.</span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-sm sm:text-base max-w-xl leading-relaxed mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          Ask questions, extract tabular data, and explore insights across your PDF
          documents in any language with cited precision.
        </p>

        {/* Sleek Landing Chatbox with rotating placeholder */}
        <div className="w-full max-w-xl mb-4">
          <div
            className="group relative flex items-center rounded-2xl border p-2 pl-3.5 transition-all shadow-lg focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)]/50"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
            }}
          >
            <div className="text-[var(--text-brand)] mr-2 shrink-0">
              <MessageSquare size={17} />
            </div>

            <div className="relative flex-1 flex items-center min-w-0">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full py-1.5 bg-transparent text-sm sm:text-[15px] outline-none relative z-10"
                style={{ color: 'var(--text-primary)' }}
              />
              {!query && (
                <span
                  className={`pointer-events-none absolute left-0 text-sm sm:text-[15px] select-none transition-all duration-400 ease-in-out truncate max-w-[95%] ${
                    isFading ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
                  }`}
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {dynamicPlaceholder}
                </span>
              )}
            </div>

            <button
              onClick={() => handleLaunch()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xs"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: dark ? '#1B1B3A' : '#ffffff',
              }}
              title="Launch chat"
              aria-label="Launch chat"
            >
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </div>

          {/* Compact Sample Suggestions */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {SAMPLE_PROMPTS.map((text, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleLaunch(text)}
                className="px-2.5 py-1 rounded-full text-[11px] border transition-all cursor-pointer hover:scale-[1.02] shadow-2xs"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="text-[var(--text-brand)] mr-1">✦</span>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Core Capabilities */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left mt-8">
          {/* Card 1 */}
          <div
            className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.01] hover:border-[var(--accent-primary)]/40 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
              }}
            >
              <Eye size={17} />
            </div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Multimodal Vision & OCR
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Extracts text, diagrams, and embedded charts using vision-augmented processing.
            </p>
          </div>

          {/* Card 2 */}
          <div
            className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.01] hover:border-[var(--accent-primary)]/40 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
              }}
            >
              <Table size={17} />
            </div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Table & Financial Data
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Preserves matrix layouts and row relations so tabular queries remain accurate.
            </p>
          </div>

          {/* Card 3 */}
          <div
            className="p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.01] hover:border-[var(--accent-primary)]/40 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
              }}
            >
              <CheckCircle2 size={17} />
            </div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Verified Page Citations
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Every answer highlights specific source passages, page numbers, and similarity scores.
            </p>
          </div>
        </div>
      </main>

      {/* Clean Footer */}
      <footer
        className="w-full border-t py-4 px-6 mt-auto text-center"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          <div className="flex items-center gap-1.5">
            <Logo variant="icon" dark={dark} className="h-4 w-4" />
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Anuvaad AI</span>
            <span>—</span>
            <span>Every document. Your language.</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Engine Ready</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
