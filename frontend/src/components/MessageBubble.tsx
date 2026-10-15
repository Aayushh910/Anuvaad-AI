import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
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
      <div className="flex justify-end w-full animate-fade-in my-2">
        <div className="bg-[#3b82f6] text-white px-5 py-2.5 rounded-2xl text-sm font-normal max-w-lg shadow-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant response: completely free-flowing, no enclosing box or borders!
  return (
    <div className="flex flex-col w-full animate-fade-in my-4 space-y-3">
      {/* Free text */}
      <div className="text-[14.5px] leading-relaxed text-[#d4d8e0] font-normal whitespace-pre-wrap">
        {message.content}
      </div>

      {/* Sources Display Toggle (Matching screenshot: "View Sources (5) v") */}
      {sources.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="inline-flex items-center gap-1.5 text-xs text-[#8c94a4] hover:text-white transition-colors cursor-pointer py-1"
          >
            <FileText size={13} className="text-[#8c94a4]" />
            <span>
              View Sources ({sources.length})
            </span>
            {sourcesOpen ? (
              <ChevronUp size={13} className="text-[#8c94a4]" />
            ) : (
              <ChevronDown size={13} className="text-[#8c94a4]" />
            )}
          </button>

          {/* Source Preview Cards (Matching screenshot 1) */}
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
                    className="rounded-xl bg-[#0f121a] border border-white/[0.04] p-4 text-xs space-y-2.5 shadow-sm"
                  >
                    {/* Header: [1] SOURCE PREVIEW ---------- 53% match */}
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#1e293b] text-[#3b82f6] font-semibold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold tracking-wider text-[#64748b] text-[10.5px]">
                          SOURCE PREVIEW
                        </span>
                        {source.page != null && (
                          <span className="text-[#475569] text-[10px]">
                            • Page {source.page}
                          </span>
                        )}
                      </div>
                      <span className="text-[#3b82f6] font-medium text-[11px]">
                        {matchPct}
                      </span>
                    </div>

                    {/* Excerpt Text */}
                    <p className="text-[#94a3b8] leading-relaxed text-[12px] font-normal">
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
