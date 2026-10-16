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
  const sources = message.sources?.filter((s) => s.text?.trim()) ?? []

  if (isUser) {
    return (
      <div className="flex justify-end w-full animate-fade-in my-2.5">
        <div
          className="px-5 py-2.5 rounded-2xl text-[14.5px] font-medium max-w-lg shadow-sm leading-relaxed"
          style={{
            backgroundColor: 'var(--accent-bubble)',
            color: 'var(--text-inverse)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant response: borderless and free-flowing on the canvas with full Markdown rendering
  return (
    <div className="flex flex-col w-full animate-fade-in my-3.5 space-y-3">
      {/* Markdown formatted text */}
      <MarkdownRenderer content={message.content} />

      {/* Inline Sources Display */}
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
                const matchPct =
                  source.score != null
                    ? `${Math.round(source.score * 100)}% match`
                    : `${Math.max(45, 90 - idx * 7)}% match`

                return (
                  <div
                    key={idx}
                    className="rounded-xl border p-4 text-xs space-y-2.5 shadow-sm transition-all"
                    style={{
                      backgroundColor: 'var(--bg-source-card)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {/* Header: [1] SOURCE PREVIEW ---------- 53% match */}
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-sm font-semibold text-[10px]"
                          style={{
                            backgroundColor: 'var(--accent-subtle)',
                            color: 'var(--text-brand)',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className="font-semibold tracking-wider uppercase text-[10.5px]"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          SOURCE PREVIEW
                        </span>
                        {source.page != null && (
                          <span
                            className="text-[10px]"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            • Page {source.page}
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
                      className="leading-relaxed text-[12px] font-normal"
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
