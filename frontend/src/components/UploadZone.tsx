import { useRef, useState, useCallback } from 'react'
import { UploadCloud, FileText, AlertCircle } from 'lucide-react'

interface UploadZoneProps {
  onUpload: (file: File) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

export default function UploadZone({ onUpload, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const validateAndUpload = useCallback(
    (file: File) => {
      setErrorMessage(null)

      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setErrorMessage('Unsupported file. Please select a PDF document.')
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage('File exceeds the 25 MB size limit.')
        return
      }

      if (file.size === 0) {
        setErrorMessage('The selected file is empty.')
        return
      }

      onUpload(file)
    },
    [onUpload],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)

      if (disabled) return

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        validateAndUpload(files[0])
      }
    },
    [disabled, validateAndUpload],
  )

  return (
    <div className="w-full">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group relative flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed transition-all duration-200 select-none ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
        }`}
        style={{
          backgroundColor: dragging
            ? 'var(--accent-subtle)'
            : 'var(--bg-card)',
          borderColor: dragging
            ? 'var(--accent-primary)'
            : 'var(--border-medium)',
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg mb-2 transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: dragging
              ? 'var(--accent-primary)'
              : 'var(--bg-surface-elevated)',
            color: dragging ? 'var(--text-inverse)' : 'var(--text-brand)',
          }}
        >
          {dragging ? <FileText size={16} /> : <UploadCloud size={16} />}
        </div>

        <p
          className="text-xs font-semibold text-center mb-0.5"
          style={{ color: 'var(--text-primary)' }}
        >
          {dragging ? 'Drop PDF here' : 'Upload PDF Document'}
        </p>

        <p
          className="text-[11px] text-center"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Drag & drop or browse · Up to 25 MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) validateAndUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {errorMessage && (
        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-500 animate-fade-in">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="hover:opacity-75 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
