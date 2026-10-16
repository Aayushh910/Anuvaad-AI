import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Sparkles } from 'lucide-react'

interface ClaudeThinkingStatusProps {
  loading: boolean
  activeDocName?: string
  statusText?: string
}

export default function ClaudeThinkingStatus({
  loading,
  activeDocName,
  statusText = 'Retrieving document context and analyzing',
}: ClaudeThinkingStatusProps) {
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
    { text: `Searching indexed embeddings for ${activeDocName || 'document'}`, done: seconds > 1 },
    { text: 'Retrieved relevant text chunks, tables, and images', done: seconds > 2 },
    { text: 'Grounding factual answer with source citations', done: seconds > 4 },
  ]

  return (
    <div
      className="my-3 rounded-2xl border p-3 text-xs animate-fade-in transition-all shadow-sm max-w-2xl"
      style={{
        backgroundColor: 'var(--bg-thinking)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header matching user's Image 2: ••• Title   8s   v */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none font-medium"
      >
        <div className="flex items-center gap-2">
          {/* Animated 3 dots */}
          <div className="flex items-center gap-0.5 text-[var(--text-coral)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:300ms]" />
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

      {/* Expanded Steps Card (Matching Screenshot 2) */}
      {expanded && (
        <div
          className="mt-3 rounded-xl border divide-y overflow-hidden text-xs animate-fade-in"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              className="px-3.5 py-2.5 flex items-center justify-between transition-colors"
              style={{
                borderColor: 'var(--border-subtle)',
                color: step.done ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              }}
            >
              <div className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                ) : (
                  <Sparkles
                    size={13}
                    className="animate-spin text-[var(--text-coral)] shrink-0"
                  />
                )}
                <span>{step.text}</span>
              </div>

              <span className="text-[10px] text-[var(--text-dim)]">
                {step.done ? 'Done' : 'Running...'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
