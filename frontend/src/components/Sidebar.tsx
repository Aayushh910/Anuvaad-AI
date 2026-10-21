import { useState } from 'react'
import {
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Check,
  Layers,
  Table,
  Image as ImageIcon,
  X,
  Plus,
  Home,
} from 'lucide-react'
import Logo from './Logo'
import UploadZone from './UploadZone'
import { STEP_LABELS, STEP_ORDER, type Document, type ProcessingStep } from '../types'

interface SidebarProps {
  documents: Document[]
  activeDocId: string | null
  onSelect: (id: string) => void
  onUpload: (file: File) => void
  onRemove: (id: string) => void
  onReindex?: (id: string, fullReprocess?: boolean) => void
  onClose?: () => void
  onNewChat?: () => void
  onNavigateLanding?: () => void
  dark?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getStepProgress(step: ProcessingStep): number {
  switch (step) {
    case 'uploading':
      return 20
    case 'extracting':
      return 45
    case 'chunking':
      return 70
    case 'indexing':
      return 90
    case 'ready':
      return 100
    case 'error':
      return 0
    default:
      return 0
  }
}

interface DocCardProps {
  doc: Document
  isActive: boolean
  onSelect: () => void
  onRemove: () => void | Promise<any>
  onReindex?: () => void | Promise<any>
}

function DocumentCard({ doc, isActive, onSelect, onRemove, onReindex }: DocCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeletingLocal, setIsDeletingLocal] = useState(false)
  const [isReindexingLocal, setIsReindexingLocal] = useState(false)

  const isReady = doc.step === 'ready'
  const isError = doc.step === 'error'
  const isProcessing = (!isReady && !isError) || doc.isReindexing || isReindexingLocal
  const progressPercent = getStepProgress(doc.step)

  return (
    <div
      onClick={isReady ? onSelect : undefined}
      className={`group relative rounded-xl p-3 transition-all duration-200 animate-fade-in border ${
        isReady ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        backgroundColor: isActive
          ? 'var(--accent-subtle)'
          : isError
          ? 'rgba(239, 68, 68, 0.08)'
          : 'var(--bg-card)',
        borderColor: isActive
          ? 'var(--accent-primary)'
          : isError
          ? 'rgba(239, 68, 68, 0.25)'
          : 'var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Document Icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{
            backgroundColor: isError
              ? 'rgba(239, 68, 68, 0.15)'
              : isActive
              ? 'var(--accent-subtle)'
              : 'var(--bg-surface-elevated)',
            color: isError
              ? '#ef4444'
              : isActive
              ? 'var(--text-brand)'
              : 'var(--text-secondary)',
          }}
        >
          <FileText size={16} />
        </div>

        {/* Document Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p
              className="text-xs font-semibold truncate"
              title={doc.filename}
              style={{
                color: isActive ? 'var(--text-brand)' : 'var(--text-primary)',
              }}
            >
              {doc.filename}
            </p>

            {confirmDelete ? (
              <div
                className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] animate-fade-in"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-red-500 font-semibold">Delete?</span>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation()
                    setIsDeletingLocal(true)
                    try {
                      await onRemove()
                    } catch {
                      setIsDeletingLocal(false)
                      setConfirmDelete(false)
                    }
                  }}
                  disabled={isDeletingLocal}
                  className="p-0.5 rounded hover:bg-red-500/20 text-red-500 transition-colors cursor-pointer"
                  title="Confirm delete"
                  aria-label="Confirm delete"
                >
                  {isDeletingLocal ? (
                    <Loader2 size={11} className="animate-spin text-red-500" />
                  ) : (
                    <Check size={11} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(false)
                  }}
                  disabled={isDeletingLocal}
                  className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] transition-colors cursor-pointer"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Re-index Button */}
                {onReindex && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      setIsReindexingLocal(true)
                      try {
                        await onReindex()
                      } finally {
                        setIsReindexingLocal(false)
                      }
                    }}
                    disabled={
                      isProcessing ||
                      doc.isReindexing ||
                      isReindexingLocal ||
                      doc.isDeleting
                    }
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer hover:text-[var(--text-brand)] disabled:opacity-50"
                    style={{ color: 'var(--text-dim)' }}
                    title="Re-index document"
                    aria-label="Re-index document"
                  >
                    <RefreshCw
                      size={12}
                      className={
                        doc.isReindexing || isReindexingLocal
                          ? 'animate-spin text-[var(--text-brand)]'
                          : ''
                      }
                    />
                  </button>
                )}

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(true)
                  }}
                  disabled={doc.isDeleting || isDeletingLocal}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer hover:text-red-500 disabled:opacity-50"
                  style={{ color: 'var(--text-dim)' }}
                  title="Delete document"
                  aria-label="Delete document"
                >
                  {doc.isDeleting || isDeletingLocal ? (
                    <Loader2 size={12} className="animate-spin text-red-500" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            )}
          </div>

          <div
            className="flex items-center gap-1.5 mt-0.5 text-[11px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span>{formatBytes(doc.sizeBytes)}</span>
            {isReady && doc.pageCount > 0 && (
              <>
                <span>•</span>
                <span>{doc.pageCount}p</span>
              </>
            )}
          </div>

          {/* Metadata chips when ready */}
          {isReady && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {doc.indexedChunks != null && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Layers size={9} />
                  {doc.indexedChunks} chunks
                </span>
              )}
              {doc.tableCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Table size={9} />
                  {doc.tableCount} tables
                </span>
              )}
              {doc.imageCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <ImageIcon size={9} />
                  {doc.imageCount} imgs
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Real-time processing progress */}
      {isProcessing && (
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span
              className="font-medium flex items-center gap-1"
              style={{ color: 'var(--text-brand)' }}
            >
              <Loader2 size={11} className="animate-spin" />
              {STEP_LABELS[doc.step]}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>
              {progressPercent}%
            </span>
          </div>

          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: 'var(--accent-primary)',
              }}
            />
          </div>

          <div className="flex justify-between items-center px-0.5 pt-0.5">
            {STEP_ORDER.slice(0, 4).map((s, idx) => {
              const currentIdx = STEP_ORDER.indexOf(doc.step)
              const isPast = idx < currentIdx
              const isCurrent = idx === currentIdx
              return (
                <span
                  key={s}
                  className={`text-[9px] uppercase tracking-wider font-semibold ${
                    isCurrent
                      ? 'text-[var(--text-brand)]'
                      : isPast
                      ? 'text-emerald-500'
                      : 'text-[var(--text-dim)]'
                  }`}
                >
                  {s.slice(0, 3)}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="mt-2 flex items-center justify-between gap-1 text-[11px] text-red-500 bg-red-500/10 p-2 rounded-lg">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle size={13} className="shrink-0" />
            <span className="truncate">{doc.error || 'Processing failed'}</span>
          </div>
          {onReindex && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReindex()
              }}
              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-500 cursor-pointer shrink-0 transition-colors"
              title="Retry re-indexing"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  documents,
  activeDocId,
  onSelect,
  onUpload,
  onRemove,
  onReindex,
  onClose,
  onNewChat,
  onNavigateLanding,
  dark = true,
}: SidebarProps) {
  const processingCount = documents.filter(
    (d) => d.step !== 'ready' && d.step !== 'error',
  ).length

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-r transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Sidebar Brand Top Bar */}
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          onClick={() => {
            if (onNavigateLanding) {
              onNavigateLanding()
              if (onClose) onClose()
            }
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          title="Return to Landing Page"
        >
          <Logo variant="horizontal" dark={dark} className="h-6 w-auto" />
        </div>

        <div className="flex items-center gap-1">
          {onNavigateLanding && (
            <button
              onClick={() => {
                onNavigateLanding()
                if (onClose) onClose()
              }}
              className="p-1.5 rounded-lg transition-colors cursor-pointer hover:opacity-80"
              style={{
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
              title="Home / Landing"
              aria-label="Home / Landing"
            >
              <Home size={14} />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors cursor-pointer hover:opacity-80"
              style={{
                color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
              aria-label="Close documents sidebar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Documents Header & Badge */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            Documents
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-tertiary)',
            }}
          >
            {documents.length}
          </span>
        </div>

        {processingCount > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium"
            style={{ color: 'var(--text-brand)' }}
          >
            <Loader2 size={11} className="animate-spin" />
            {processingCount} processing
          </span>
        )}
      </div>

      {/* New Chat Action Button */}
      {onNewChat && (
        <div className="p-3 pb-1">
          <button
            onClick={() => {
              onNewChat()
              if (onClose) onClose()
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer hover:opacity-90 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Plus size={14} className="text-[var(--text-brand)]" />
            <span>Start New Chat</span>
          </button>
        </div>
      )}

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl mx-auto mb-3"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-tertiary)',
              }}
            >
              <FileText size={22} />
            </div>
            <p
              className="text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              No documents yet
            </p>
            <p
              className="text-[11px] mt-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Upload a PDF below to start chatting with your data.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              isActive={doc.id === activeDocId}
              onSelect={() => onSelect(doc.id)}
              onRemove={() => onRemove(doc.id)}
              onReindex={onReindex ? () => onReindex(doc.id) : undefined}
            />
          ))
        )}
      </div>

      {/* Upload Zone at Bottom */}
      <div
        className="p-3 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <UploadZone onUpload={onUpload} />
      </div>
    </aside>
  )
}
