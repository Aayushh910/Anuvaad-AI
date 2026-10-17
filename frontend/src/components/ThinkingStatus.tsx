import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Sparkles } from 'lucide-react'

interface ThinkingStatusProps {
  loading: boolean
  activeDocName?: string
  statusText?: string
}

export default function ThinkingStatus({
  loading,
  activeDocName,
  statusText = 'Translating & analyzing document context',
}: ThinkingStatusProps) {
  const [expanded, setExpanded] = useState(true)
  const [seconds, setSeconds] = useState(1)

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [loading])

  const steps = [
    { text: `Searching vector index for ${activeDocName || 'document'}`, done: seconds > 1 },
    { text: 'Retrieved relevant text passages, tables, and visual context', done: seconds > 2 },
    { text: 'Grounding translation and synthesis with page citations', done: seconds > 4 },
  ]

  return (
    <div
      className="my-3 rounded-2xl border p-3 text-xs animate-fade-in transition-all shadow-sm max-w-2xl"
      style={{
        backgroundColor: 'var(--bg-thinking)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header: Status title and toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none font-medium"
      >
        <div className="flex items-center gap-2.5">
          {/* Animated pulsing amber brand dots */}
          <div className="flex items-center gap-1 text-[var(--accent-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] animate-bounce [animation-delay:300ms]" />
          </div>

          <span
            className="text-[13px] font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {statusText}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-[11px]">
          <span>{seconds}s</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded Reasoning & Grounding Steps */}
      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t space-y-1.5 animate-fade-in" style={{ borderColor: 'var(--border-subtle)' }}>
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-[12px] transition-colors"
              style={{
                color: s.done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              }}
            >
              {s.done ? (
                <CheckCircle size={13} className="text-emerald-500 shrink-0" />
              ) : (
                <span className="h-3 w-3 rounded-full border border-[var(--accent-primary)] border-t-transparent animate-spin shrink-0" />
              )}
              <span>{s.text}</span>
            </div>
          ))}
          <div
            className="flex items-center gap-1.5 pt-1 text-[11px] font-medium"
            style={{ color: 'var(--accent-primary)' }}
          >
            <Sparkles size={11} />
            <span>Anuvaad RAG Engine Active</span>
          </div>
        </div>
      )}
    </div>
  )
}
