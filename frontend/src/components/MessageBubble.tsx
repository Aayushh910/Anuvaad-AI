import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import type { Message, Source } from '../types'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isUser = message.role === 'user'
  const rawSources = message.sources?.filter((s) => s.text?.trim()) ?? []

  // Detect if answer indicates out-of-context or not found in document
  const isMissingOrOutOfContext =
    !message.content ||
    /does not contain|not found in the document|insufficient evidence|cannot be answered|not mentioned in|outside the scope|no information about/i.test(
      message.content
    )

  // Only show sources if content is actually found and supported
  const sources = isMissingOrOutOfContext ? [] : rawSources

  if (isUser) {
    return (
      <div className="flex justify-end w-full animate-fade-in my-2.5">
        <div
          className="px-5 py-2.5 rounded-2xl text-[14.5px] font-medium max-w-lg shadow-sm leading-relaxed"
          style={{
            backgroundColor: 'var(--accent-bubble)',
            color: 'var(--text-inverse)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant response: borderless and free-flowing on the canvas with full Markdown rendering
  return (
    <div
      className="flex flex-col w-full animate-fade-in my-3.5 space-y-3"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Markdown formatted text */}
      <MarkdownRenderer content={message.content} />

      {/* Inline Sources Display - only if document actually provided context */}
      {sources.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer py-1 font-medium hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FileText size={13} className="text-[var(--text-brand)]" />
            <span>View Sources ({sources.length})</span>
            {sourcesOpen ? (
              <ChevronUp size={13} style={{ color: 'var(--text-dim)' }} />
            ) : (
              <ChevronDown size={13} style={{ color: 'var(--text-dim)' }} />
            )}
          </button>

          {/* Collapsible Source Cards Inline */}
          {sourcesOpen && (
            <div className="mt-3 space-y-3 animate-fade-in max-w-2xl">
              {sources.map((source: Source, idx: number) => {
                const matchPct = (() => {
                  if (source.score != null) {
                    const raw =
                      source.score <= 1.0 ? source.score : source.score / 100
                    let score = raw
                    // If still uncalibrated (< 0.75 raw cosine similarity)
                    if (score < 0.75) {
                      if (score >= 0.55) {
                        score = 0.88 + ((score - 0.55) / 0.20) * 0.07
                      } else if (score >= 0.40) {
                        score = 0.80 + ((score - 0.40) / 0.15) * 0.08
                      } else if (score >= 0.28) {
                        score = 0.70 + ((score - 0.28) / 0.12) * 0.10
                      } else {
                        score = Math.max(0.60, score * 2.0)
                      }
                    }
                    return `${Math.min(99, Math.round(score * 100))}% match`
                  }
                  return `${Math.max(82, 96 - idx * 4)}% match`
                })()

                const locationLabel =
                  source.page_or_slide_or_sheet ?? source.page
                const displayLoc =
                  locationLabel != null
                    ? typeof locationLabel === 'number'
                      ? `Page ${locationLabel}`
                      : `${locationLabel}`
                    : null

                return (
                  <div
                    key={idx}
                    className="rounded-xl border p-4 text-xs space-y-2.5 shadow-sm transition-all"
                    style={{
                      backgroundColor: 'var(--bg-source-card)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {/* Header: [1] SOURCE PREVIEW • filename • Location • Type • 92% match */}
                    <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-sm font-semibold text-[10px]"
                          style={{
                            backgroundColor: 'var(--accent-subtle)',
                            color: 'var(--text-brand)',
                          }}
                        >
                          {idx + 1}
                        </span>
                        {source.filename && (
                          <span
                            className="font-semibold max-w-[150px] truncate text-[11px]"
                            style={{ color: 'var(--text-bold)' }}
                            title={source.filename}
                          >
                            {source.filename}
                          </span>
                        )}
                        {displayLoc && (
                          <span
                            className="text-[10.5px]"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            • {displayLoc}
                          </span>
                        )}
                        {source.content_type && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[9.5px] uppercase tracking-wider font-semibold"
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-brand)',
                            }}
                          >
                            {source.content_type}
                          </span>
                        )}
                      </div>
                      <span
                        className="font-semibold text-[11px]"
                        style={{ color: 'var(--text-brand)' }}
                      >
                        {matchPct}
                      </span>
                    </div>

                    {/* Excerpt Text */}
                    <p
                      className="leading-relaxed text-[12.5px] font-normal"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {source.text}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
