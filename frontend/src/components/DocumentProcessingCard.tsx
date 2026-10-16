import { useState, useEffect } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import type { Document } from '../types'

interface DocumentProcessingCardProps {
  doc: Document
  onStartChatting?: () => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentProcessingCard({
  doc,
  onStartChatting,
}: DocumentProcessingCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [seconds, setSeconds] = useState(1)

  const isReady = doc.step === 'ready'
  const isError = doc.step === 'error'

  useEffect(() => {
    if (isReady || isError) return
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isReady, isError])

  const steps = [
    {
      title: 'Streaming PDF to local storage',
      done: doc.step !== 'uploading',
    },
    {
      title: 'Extracting document layout, text & embedded tables',
      done: doc.step === 'chunking' || doc.step === 'indexing' || isReady,
    },
    {
      title: 'Generating page-aware text chunks',
      done: doc.step === 'indexing' || isReady,
    },
    {
      title: 'Indexing vector embeddings into Qdrant store',
      done: isReady,
    },
  ]

  return (
    <div
      className="my-4 rounded-2xl border p-3.5 text-xs animate-fade-in transition-all shadow-md max-w-2xl mx-auto"
      style={{
        backgroundColor: 'var(--bg-thinking)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Header matching Image 2 */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none font-medium"
      >
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {isReady ? (
            <CheckCircle size={15} className="text-emerald-500" />
          ) : (
            <div className="flex items-center gap-0.5 text-[var(--text-coral)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-coral)] animate-bounce [animation-delay:300ms]" />
            </div>
          )}

          <span
            className="text-[13px] font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {isReady
              ? `Document ready: ${doc.filename}`
              : `Processing document: ${doc.filename}`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-[11px]">
          <span>{seconds}s</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded Accordion (Image 2 style) */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <div
            className="rounded-xl border divide-y overflow-hidden text-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {steps.map((step, idx) => (
              <div
                key={idx}
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
                    <Loader2
                      size={13}
                      className="animate-spin text-[var(--text-coral)] shrink-0"
                    />
                  )}
                  <span>{step.title}</span>
                </div>

                <span className="text-[10px] text-[var(--text-dim)]">
                  {step.done ? 'Done' : 'Running...'}
                </span>
              </div>
            ))}
          </div>

          {/* Claude Attachment Card (matching bottom of Image 2) */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-blue)',
                }}
              >
                <FileText size={20} />
              </div>

              <div>
                <h4
                  className="text-xs font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {doc.filename}
                </h4>
                <p
                  className="text-[11px] mt-0.5 flex items-center gap-1.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  {doc.pageCount > 0 && <span>• {doc.pageCount} pages</span>}
                  {doc.tableCount > 0 && <span>• {doc.tableCount} tables</span>}
                </p>
              </div>
            </div>

            {isReady && onStartChatting && (
              <button
                onClick={onStartChatting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                }}
              >
                Chat Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
