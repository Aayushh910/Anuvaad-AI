import { useState, useEffect } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { Document } from '../types'

interface DocumentProcessingCardProps {
  doc: Document
  onStartChatting?: () => void
  onReindex?: () => void
  onDelete?: () => void
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
  onReindex,
  onDelete,
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
      active: doc.step === 'uploading',
    },
    {
      title: 'Extracting document layout, text & embedded tables',
      done: doc.step === 'chunking' || doc.step === 'indexing' || isReady,
      active: doc.step === 'extracting',
    },
    {
      title: 'Generating page-aware text chunks',
      done: doc.step === 'indexing' || isReady,
      active: doc.step === 'chunking',
    },
    {
      title: 'Indexing vector embeddings into Qdrant store',
      done: isReady,
      active: doc.step === 'indexing',
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

      {/* Expanded Accordion */}
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
                  color: step.done
                    ? 'var(--text-secondary)'
                    : step.active
                    ? 'var(--text-brand)'
                    : 'var(--text-tertiary)',
                }}
              >
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle
                      size={13}
                      className="text-emerald-500 shrink-0"
                    />
                  ) : step.active ? (
                    <Loader2
                      size={13}
                      className="animate-spin text-[var(--text-brand)] shrink-0"
                    />
                  ) : (
                    <span
                      className="h-3 w-3 rounded-full border shrink-0 opacity-40"
                      style={{ borderColor: 'var(--text-tertiary)' }}
                    />
                  )}
                  <span className={step.active ? 'font-medium' : ''}>
                    {step.title}
                  </span>
                </div>

                <span
                  className={`text-[10px] ${
                    step.done
                      ? 'text-emerald-500 font-medium'
                      : step.active
                      ? 'text-[var(--text-brand)] font-semibold'
                      : 'text-[var(--text-dim)]'
                  }`}
                >
                  {step.done
                    ? 'Done'
                    : step.active
                    ? 'Processing...'
                    : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {/* Document Attachment Card */}
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
                  color: 'var(--text-brand)',
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

            <div className="flex items-center gap-1.5 shrink-0">
              {onReindex && (
                <button
                  type="button"
                  onClick={onReindex}
                  disabled={doc.isReindexing || doc.isDeleting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                  title="Re-index document"
                >
                  <RefreshCw
                    size={11}
                    className={
                      doc.isReindexing
                        ? 'animate-spin text-[var(--text-brand)]'
                        : ''
                    }
                  />
                  <span>{isError ? 'Retry' : 'Re-index'}</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={doc.isDeleting}
                  className="flex items-center gap-1 p-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer hover:text-red-500 hover:border-red-500/30 disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-dim)',
                  }}
                  title="Delete document"
                  aria-label="Delete document"
                >
                  {doc.isDeleting ? (
                    <Loader2 size={12} className="animate-spin text-red-500" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              )}

              {isReady && onStartChatting && (
                <button
                  type="button"
                  onClick={onStartChatting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-90 shadow-2xs"
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
        </div>
      )}
    </div>
  )
}
