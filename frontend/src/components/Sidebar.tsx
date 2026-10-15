import {
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
  Layers,
  Table,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import UploadZone from './UploadZone'
import { STEP_LABELS, STEP_ORDER, type Document, type ProcessingStep } from '../types'

interface SidebarProps {
  documents: Document[]
  activeDocId: string | null
  onSelect: (id: string) => void
  onUpload: (file: File) => void
  onRemove: (id: string) => void
  onClose?: () => void
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
  onRemove: () => void
}

function DocumentCard({ doc, isActive, onSelect, onRemove }: DocCardProps) {
  const isReady = doc.step === 'ready'
  const isError = doc.step === 'error'
  const isProcessing = !isReady && !isError
  const progressPercent = getStepProgress(doc.step)

  return (
    <div
      onClick={isReady ? onSelect : undefined}
      className={`group relative rounded-xl p-3 transition-all duration-200 animate-fade-in border ${
        isActive
          ? 'bg-[#121622] border-[#3b82f6]/40 shadow-sm'
          : isError
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-[#0d1017] hover:bg-[#121620] border-white/[0.04]'
      } ${isReady ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Document Icon */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
            isError
              ? 'bg-red-500/10 text-red-400'
              : isActive
              ? 'bg-blue-500/15 text-[#3b82f6]'
              : 'bg-[#151924] text-[#6b7688]'
          }`}
        >
          <FileText size={16} />
        </div>

        {/* Document Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p
              className={`text-xs font-semibold truncate ${
                isActive ? 'text-[#3b82f6]' : 'text-[#e2e8f0]'
              }`}
              title={doc.filename}
            >
              {doc.filename}
            </p>

            {/* Remove Button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#555e6d] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              title="Remove document"
              aria-label="Remove document"
            >
              <Trash2 size={12} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#555e6d]">
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
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#141924] text-[#8c94a4]">
                  <Layers size={9} />
                  {doc.indexedChunks} chunks
                </span>
              )}
              {doc.tableCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#141924] text-[#8c94a4]">
                  <Table size={9} />
                  {doc.tableCount} tables
                </span>
              )}
              {doc.imageCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#141924] text-[#8c94a4]">
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
            <span className="font-medium flex items-center gap-1 text-[#3b82f6]">
              <Loader2 size={11} className="animate-spin" />
              {STEP_LABELS[doc.step]}
            </span>
            <span className="text-[#555e6d]">{progressPercent}%</span>
          </div>

          <div className="h-1.5 w-full rounded-full overflow-hidden bg-[#161a26]">
            <div
              className="h-full rounded-full bg-[#3b82f6] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
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
                      ? 'text-[#3b82f6]'
                      : isPast
                      ? 'text-[#10b981]'
                      : 'text-[#474f5e]'
                  }`}
                >
                  {s === 'extracting' ? 'Extract' : s === 'chunking' ? 'Chunk' : s}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg text-[11px] bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{doc.error || 'Processing failed'}</span>
        </div>
      )}

      {/* Active Checkmark Pill */}
      {isActive && isReady && (
        <div className="absolute right-2 top-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#3b82f6] text-white">
            Active
          </span>
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
  onClose,
}: SidebarProps) {
  const processingCount = documents.filter(
    (d) => d.step !== 'ready' && d.step !== 'error',
  ).length

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col bg-[#090b10] border-r border-white/[0.04] text-[#e6edf3]">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8c94a4]">
            Documents
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#141822] text-[#555e6d]">
            {documents.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {processingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3b82f6]">
              <Loader2 size={11} className="animate-spin" />
              {processingCount}
            </span>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#6b7688] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Close documents sidebar"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl mb-3 bg-[#12151e] text-[#555e6d]">
              <FileText size={18} />
            </div>
            <p className="text-xs font-medium text-[#8c94a4]">
              No documents yet
            </p>
            <p className="text-[11px] mt-1 text-[#555e6d]">
              Use the attach button in the chatbox or drop a file here.
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
            />
          ))
        )}
      </div>

      {/* Upload Zone at bottom */}
      <div className="p-3 border-t border-white/[0.04]">
        <UploadZone onUpload={onUpload} disabled={processingCount > 0} />
      </div>
    </aside>
  )
}
