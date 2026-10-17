import { useState, useRef, useCallback, useMemo } from 'react'
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Sun,
  Moon,
  Loader2,
  FileUp,
  CheckCircle2,
  Table2,
  Languages,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'
import Logo from './Logo'
import type { Document } from '../types'

interface LandingPageProps {
  dark: boolean
  onToggleTheme: () => void
  onNavigateChat: (initialQuery?: string, openSidebar?: boolean) => void
  onUpload: (file: File, onUploaded?: (docId: string) => void) => Promise<string | null | void>
  documents?: Document[]
  activeDocId?: string | null
  onSelectDoc?: (id: string) => void
  isTransitioning?: boolean
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function LandingPage({
  dark,
  onToggleTheme,
  onNavigateChat,
  onUpload,
  documents = [],
  activeDocId,
  onSelectDoc,
  isTransitioning = false,
}: LandingPageProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasNavigatedRef = useRef(false)

  // Identify most recent document if user has uploaded docs before
  const recentDoc = useMemo(() => {
    if (!documents || documents.length === 0) return null
    if (activeDocId) {
      const active = documents.find((d) => d.id === activeDocId)
      if (active) return active
    }
    return documents[0]
  }, [documents, activeDocId])

  const handleProcessFile = useCallback(
    async (file: File) => {
      setErrorMessage(null)

      // Validation 1: Must be a PDF
      const isPdf =
        file.name.toLowerCase().endsWith('.pdf') ||
        file.type === 'application/pdf'
      if (!isPdf) {
        setErrorMessage('Please select a valid PDF document (.pdf).')
        return
      }

      // Validation 2: Maximum file size
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage('File size exceeds the 25 MB limit.')
        return
      }

      // Validation 3: Non-empty file
      if (file.size === 0) {
        setErrorMessage('The selected file appears to be empty.')
        return
      }

      setCurrentFile(file)
      setIsUploading(true)
      setUploadStatus('Uploading your PDF...')
      hasNavigatedRef.current = false

      const triggerNavigation = () => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true
          setUploadStatus('Redirecting to Chat...')
          // Direct smooth transition to chatarea
          setTimeout(() => {
            onNavigateChat()
          }, 350)
        }
      }

      try {
        await onUpload(file, () => {
          // Direct navigate as soon as upload succeeds!
          triggerNavigation()
        })
        triggerNavigation()
      } catch (err) {
        setIsUploading(false)
        setCurrentFile(null)
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to upload PDF. Please check your connection and try again.',
        )
      }
    },
    [onUpload, onNavigateChat],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isUploading) {
      setIsDragging(true)
    }
  }, [isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (isUploading) return

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        handleProcessFile(files[0])
      }
    },
    [isUploading, handleProcessFile],
  )

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleProcessFile(files[0])
    }
    e.target.value = ''
  }

  const handleResumeRecent = () => {
    if (recentDoc && onSelectDoc) {
      onSelectDoc(recentDoc.id)
    } else {
      onNavigateChat()
    }
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden select-text flex flex-col justify-between relative transition-all duration-300 ease-out ${isTransitioning
        ? 'opacity-0 -translate-y-6 scale-[0.985] pointer-events-none'
        : 'opacity-100 translate-y-0 scale-100'
        }`}
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Global Background Images with Smooth Crossfade */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out ${dark ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          backgroundImage: 'url(/anuvaad-bg-dark.webp)',
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out ${dark ? 'opacity-0' : 'opacity-100'
          }`}
        style={{
          backgroundImage: 'url(/anuvaad-bg-light.webp)',
        }}
      />

      {/* Subtle Ambient Radial Glow overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] rounded-full blur-[130px] opacity-20"
        style={{
          background: dark
            ? 'radial-gradient(circle, rgba(242, 163, 58, 0.22) 0%, rgba(27, 27, 58, 0.08) 70%, transparent 100%)'
            : 'radial-gradient(circle, rgba(224, 138, 18, 0.18) 0%, rgba(243, 239, 233, 0.25) 70%, transparent 100%)',
        }}
      />

      {/* Top Header */}
      <header
        className="relative z-10 w-full px-6 pt-3.5 pb-2.5 flex items-center justify-between border-b shrink-0 backdrop-blur-md"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: dark ? 'rgba(12, 14, 26, 0.65)' : 'rgba(250, 248, 245, 0.75)',
        }}
      >
        <div className="flex items-center gap-3">
          <Logo variant="horizontal" dark={dark} className="h-7 w-auto" />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Direct navigation for existing documents */}
          {recentDoc ? (
            <button
              onClick={handleResumeRecent}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer hover:border-[var(--accent-primary)]/50 hover:scale-[1.02] shadow-2xs group"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              title={`Resume chat with ${recentDoc.filename}`}
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Resume Chat</span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-brand)',
                }}
              >
                {documents.length}
              </span>
              <ArrowRight
                size={12}
                className="text-[var(--text-tertiary)] group-hover:text-[var(--text-brand)] group-hover:translate-x-0.5 transition-all"
              />
            </button>
          ) : (
            <button
              onClick={() => onNavigateChat()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer hover:border-[var(--accent-primary)]/50 hover:scale-[1.02] shadow-2xs group"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <MessageSquare size={13} className="text-[var(--text-brand)]" />
              <span className="hidden sm:inline">Open Workspace</span>
              <ArrowRight
                size={12}
                className="text-[var(--text-tertiary)] group-hover:text-[var(--text-brand)] group-hover:translate-x-0.5 transition-all"
              />
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border transition-all cursor-pointer hover:scale-105 shadow-xs"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark/light mode"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* Main Hero & Upload Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 flex-1 flex flex-col items-center justify-center text-center py-4">
        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.18] mb-3 select-none">
          Ask your documents <span className="text-gradient-amber">anything.</span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-xs sm:text-sm max-w-lg leading-relaxed mb-6 select-none"
          style={{ color: 'var(--text-secondary)' }}
        >
          Understand PDFs, uncover insights, and get answers in the language you speak.
        </p>

        {/* Drag & Drop Upload Container */}
        <div className="w-full max-w-xl">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isUploading) {
                fileInputRef.current?.click()
              }
            }}
            className={`group relative rounded-3xl border-2 border-dashed p-8 transition-all duration-300 select-none cursor-pointer flex flex-col items-center justify-center text-center shadow-xl backdrop-blur-md ${isDragging
              ? 'scale-[1.02] border-[var(--accent-primary)] ring-4 ring-[var(--accent-primary)]/20 shadow-2xl'
              : 'hover:border-[var(--accent-primary)]/60 hover:shadow-2xl hover:scale-[1.006]'
              }`}
            style={{
              backgroundColor: isDragging
                ? 'var(--accent-subtle)'
                : dark ? 'rgba(17, 20, 36, 0.78)' : 'rgba(255, 255, 255, 0.82)',
              borderColor: isDragging
                ? 'var(--accent-primary)'
                : 'var(--border-medium)',
            }}
          >
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {isUploading ? (
              /* State: Uploading & preparing insights */
              <div className="flex flex-col items-center justify-center w-full py-2 animate-fade-in">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 relative"
                  style={{
                    backgroundColor: 'var(--accent-subtle)',
                    color: 'var(--text-brand)',
                  }}
                >
                  <Loader2 size={32} className="animate-spin text-[var(--accent-primary)]" />
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <FileText size={16} className="text-[var(--text-brand)]" />
                  <span
                    className="text-sm font-semibold max-w-xs truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentFile?.name}
                  </span>
                  {currentFile && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {formatFileSize(currentFile.size)}
                    </span>
                  )}
                </div>

                <p
                  className="text-xs font-medium mb-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {uploadStatus || 'Processing your document...'}
                </p>

                {/* Animated shimmer progress bar */}
                <div
                  className="w-full max-w-xs h-2 rounded-full overflow-hidden relative"
                  style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
                >
                  <div
                    className="h-full rounded-full animate-pulse"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                </div>

                <span
                  className="text-[11px] mt-2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Navigating straight to your chat area in a moment...
                </span>
              </div>
            ) : (
              /* State: Idle / Drag Over Ready */
              <div className="flex flex-col items-center justify-center w-full">
                {/* Floating Icon Halo */}
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-4 transition-transform duration-300 ${isDragging ? 'scale-110 rotate-3' : 'group-hover:scale-108'
                    }`}
                  style={{
                    backgroundColor: isDragging
                      ? 'var(--accent-primary)'
                      : 'var(--accent-subtle)',
                    color: isDragging ? '#ffffff' : 'var(--text-brand)',
                  }}
                >
                  {isDragging ? (
                    <FileUp size={32} strokeWidth={2.2} />
                  ) : (
                    <UploadCloud size={32} strokeWidth={2.2} />
                  )}
                </div>

                {/* Action Heading / Upload Title */}
                <p
                  className="text-base sm:text-lg font-semibold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isDragging
                    ? 'Release to upload your document'
                    : 'Upload a document to begin.'}
                </p>

                {/* Secondary instruction */}
                <p
                  className="text-xs sm:text-sm mb-4"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Drag & drop your PDF file here, or click to browse
                </p>

                {/* Prominent Browse Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shadow-md hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: dark ? '#1B1B3A' : '#ffffff',
                  }}
                >
                  <FileUp size={15} />
                  <span>Choose PDF Document</span>
                </button>

                {/* Spec details */}
                <div
                  className="mt-4 flex items-center gap-2 text-[11px]"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <span>Supports PDF documents up to 25 MB</span>
                  <span>•</span>
                  <span>Automatic indexing & citations</span>
                </div>
              </div>
            )}
          </div>

          {/* Small Navigation Pop for Users with Existing Documents */}
          {recentDoc && !isUploading && (
            <div
              onClick={handleResumeRecent}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs shadow-xs transition-all duration-200 hover:scale-[1.02] hover:border-[var(--accent-primary)]/60 cursor-pointer animate-fade-in group select-none backdrop-blur-md"
              style={{
                backgroundColor: dark ? 'rgba(18, 21, 38, 0.82)' : 'rgba(255, 255, 255, 0.88)',
                borderColor: 'var(--border-medium)',
              }}
              title={`Click to open ${recentDoc.filename}`}
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span style={{ color: 'var(--text-tertiary)' }}>Continue previous session:</span>
              <span
                className="font-medium max-w-[180px] sm:max-w-[260px] truncate group-hover:text-[var(--text-brand)] transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                {recentDoc.filename}
              </span>
              <ArrowRight
                size={13}
                className="text-[var(--text-brand)] group-hover:translate-x-0.5 transition-transform"
              />
            </div>
          )}

          {/* Error Message Display */}
          {errorMessage && (
            <div className="mt-3 flex items-center justify-between gap-2 p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-500 animate-fade-in text-left backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="hover:opacity-80 font-bold px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3 Value Proposition Features underneath Dropzone */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
            <div
              className="p-3 rounded-xl border flex items-center gap-2.5 transition-all shadow-2xs backdrop-blur-sm"
              style={{
                backgroundColor: dark ? 'rgba(18, 21, 38, 0.72)' : 'rgba(255, 255, 255, 0.80)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-brand)',
                }}
              >
                <Languages size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  Native Languages
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  Respond in your native tongue
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5 transition-all shadow-2xs backdrop-blur-sm"
              style={{
                backgroundColor: dark ? 'rgba(18, 21, 38, 0.72)' : 'rgba(255, 255, 255, 0.80)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-brand)',
                }}
              >
                <Table2 size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  Table Extraction
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  Structured data & metrics
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5 transition-all shadow-2xs backdrop-blur-sm"
              style={{
                backgroundColor: dark ? 'rgba(18, 21, 38, 0.72)' : 'rgba(255, 255, 255, 0.80)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--text-brand)',
                }}
              >
                <CheckCircle2 size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  Page Citations
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                  100% verifiable answers
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Full-Width Footer */}
      <footer
        className="relative z-10 w-full border-t py-3 px-6 shrink-0 backdrop-blur-md"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: dark ? 'rgba(12, 14, 26, 0.65)' : 'rgba(250, 248, 245, 0.75)',
        }}
      >
        <div
          className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <div className="flex items-center gap-1.5">
            <Logo variant="icon" dark={dark} className="h-4 w-4" />
            <span
              className="font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Anuvaad AI
            </span>
            <span>—</span>
            <span>Your Document. Your Language.</span>
          </div>

          {/* Contact GitHub Link */}
          <a
            href="https://github.com/Aayushh910"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all hover:scale-105 shadow-2xs hover:border-[var(--accent-primary)]/40 group cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
            title="GitHub: Aayushh910"
          >
            <svg
              className="h-3.5 w-3.5 fill-current text-[var(--text-secondary)] group-hover:text-[var(--text-brand)] transition-colors"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span
              className="font-medium text-[11px] group-hover:text-[var(--text-brand)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Aayushh910
            </span>
          </a>
        </div>
      </footer>
    </div>
  )
}
